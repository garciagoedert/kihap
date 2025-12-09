const functions = require('firebase-functions/v1');
const axios = require('axios');
const admin = require('firebase-admin');

admin.initializeApp();

const stripe = require('stripe');
let stripeClient; // Lazily initialize
const nodemailer = require('nodemailer');
const qrcode = require('qrcode');
const { createPagarmeOrder, getPagarmeOrder, syncPagarmeSalesStatus, createPagarmeSubscription, cancelPagarmeSubscription } = require('./pagarme.js');
const { syncEvoToOlist, syncEvoToOlistScheduled, getStudentPurchases } = require('./olist.js');
const db = admin.firestore();

exports.syncEvoToOlist = syncEvoToOlist;
exports.syncEvoToOlistScheduled = syncEvoToOlistScheduled;

exports.getStudentPurchases = functions.https.onCall(async (data, context) => {
    // Verifica autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'O usuário deve estar autenticado.');
    }

    const { cpf } = data;
    if (!cpf) {
        throw new functions.https.HttpsError('invalid-argument', 'O CPF é obrigatório.');
    }

    try {
        const purchases = await getStudentPurchases(cpf);
        return { purchases };
    } catch (error) {
        console.error("Erro ao buscar compras:", error);
        throw new functions.https.HttpsError('internal', 'Erro ao buscar histórico de compras.');
    }
});

exports.syncPagarmeSalesStatus = functions.https.onCall(async (data, context) => {
    // Opcional: Adicionar verificação de autenticação para garantir que apenas administradores possam chamar
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado para executar esta ação.');
    }
    return await syncPagarmeSalesStatus();
});

// Função para enviar o e-mail com o ingresso
const sendTicketEmail = async (saleId, saleData) => {
    console.log(`[sendTicketEmail] Iniciando para venda ${saleId}. E-mail do destinatário: ${saleData.userEmail}`);

    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_PASSWORD;

    if (!gmailEmail || !gmailPassword) {
        console.error('[sendTicketEmail] Erro Crítico: As credenciais do Gmail (email/senha) não estão configuradas no Firebase. Verifique as variáveis de ambiente.');
        return; // Interrompe a execução se as credenciais não estiverem definidas
    }
    console.log(`[sendTicketEmail] Usando o e-mail: ${gmailEmail} para autenticação.`);

    try {
        // Lazy initialization do transporter para evitar erro de config no deploy
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailEmail,
                pass: gmailPassword,
            },
        });
        const qrCodeDataURL = await qrcode.toDataURL(saleId);

        const mailOptions = {
            from: `Kihap <${process.env.GMAIL_EMAIL}>`,
            to: saleData.userEmail,
            subject: `Seu Ingresso para ${saleData.productName}`,
            html: `
                <h1>Compra Confirmada!</h1>
                <p>Olá, ${saleData.userName}.</p>
                <p>Obrigado por sua compra. Aqui está o seu ingresso para <strong>${saleData.productName}</strong>.</p>
                <p>Apresente este QR Code no dia do evento para fazer o check-in.</p>
                <img src="${qrCodeDataURL}" alt="QR Code do Ingresso">
                <hr>
                <p>ID da Compra: ${saleId}</p>
            `,
            attachments: [
                {
                    filename: 'ingresso.png',
                    path: qrCodeDataURL
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[sendTicketEmail] Sucesso! E-mail de ingresso enviado para ${saleData.userEmail}. ID da Mensagem: ${info.messageId}`);

        // Marca a venda como tendo o e-mail enviado
        await db.collection('inscricoesFaixaPreta').doc(saleId).update({ emailSent: true });
        console.log(`[sendTicketEmail] Venda ${saleId} marcada como 'emailSent: true' no Firestore.`);

        // Registra o envio do e-mail
        await logEmailSend(saleId, 'ticket', saleData.userEmail, true);

    } catch (error) {
        console.error(`[sendTicketEmail] Falha ao enviar e-mail de ingresso para ${saleData.userEmail}. Erro:`, error);
        await logEmailSend(saleId, 'ticket', saleData.userEmail, false, error.message);
    }
};

// Função para registrar o envio de e-mail
const logEmailSend = async (saleId, type, recipient, success, error = null) => {
    try {
        await db.collection('inscricoesFaixaPreta').doc(saleId).collection('emailLogs').add({
            type: type,
            recipient: recipient,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            success: success,
            error: error
        });
        console.log(`[logEmailSend] Log de email registrado para venda ${saleId}: ${type}, sucesso=${success}`);
    } catch (logError) {
        console.error(`[logEmailSend] Falha ao registrar log de email para venda ${saleId}:`, logError);
    }
};

// Função para enviar e-mail de recibo genérico (não-ingresso)
const sendPurchaseReceiptEmail = async (saleId, saleData) => {
    console.log(`[sendPurchaseReceiptEmail] Iniciando para venda ${saleId}. E-mail do destinatário: ${saleData.userEmail}`);

    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_PASSWORD;

    if (!gmailEmail || !gmailPassword) {
        console.error('[sendPurchaseReceiptEmail] Erro Crítico: As credenciais do Gmail não estão configuradas.');
        await logEmailSend(saleId, 'receipt', saleData.userEmail, false, 'Credenciais Gmail não configuradas');
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailEmail,
                pass: gmailPassword,
            },
        });
        const amountFormatted = (saleData.amountTotal / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: saleData.currency || 'BRL'
        });

        const mailOptions = {
            from: `Kihap <${gmailEmail}>`,
            to: saleData.userEmail,
            subject: `Recibo de Compra - ${saleData.productName}`,
            html: `
                <h1>Compra Confirmada!</h1>
                <p>Olá, ${saleData.userName}.</p>
                <p>Obrigado por sua compra. Aqui estão os detalhes do seu pedido:</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3>Detalhes da Compra</h3>
                    <p><strong>Produto:</strong> ${saleData.productName}</p>
                    <p><strong>Valor:</strong> ${amountFormatted}</p>
                    <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                    <p><strong>ID da Compra:</strong> ${saleId}</p>
                </div>
                
                <p>Se você tiver qualquer dúvida, entre em contato conosco.</p>
                <p>Atenciosamente,<br>Equipe Kihap</p>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[sendPurchaseReceiptEmail] Sucesso! E-mail de recibo enviado para ${saleData.userEmail}. ID: ${info.messageId}`);

        await db.collection('inscricoesFaixaPreta').doc(saleId).update({ emailSent: true });
        await logEmailSend(saleId, 'receipt', saleData.userEmail, true);

    } catch (error) {
        console.error(`[sendPurchaseReceiptEmail] Falha ao enviar e-mail de recibo para ${saleData.userEmail}. Erro:`, error);
        await logEmailSend(saleId, 'receipt', saleData.userEmail, false, error.message);
    }
};


// Cloud Function para criar a sessão de checkout do Stripe
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
    console.log('[createCheckoutSession] Forçando a recarga do ambiente com um novo log.');
    console.log('[createCheckoutSession] Iniciando a execução.');
    // Permitir CORS para o frontend
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    // Inicializa Stripe apenas se a chave estiver disponível, para evitar erros se não estivermos usando Stripe
    if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
        stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    }

    // A lógica de qual gateway usar será baseada no produto, não mais em uma variável de ambiente global.
    // console.log(`[createCheckoutSession] Usando Pagar.me: ${usePagarme}`);

    if (req.method !== 'POST') {
        console.log(`[createCheckoutSession] Método não permitido: ${req.method}`);
        return res.status(405).send('Method Not Allowed');
    }

    const { formDataList, productId, totalAmount, couponCode, recommendedItems } = req.body;
    console.log('[createCheckoutSession] Corpo da requisição (req.body):', JSON.stringify(req.body, null, 2));


    if (!formDataList || !totalAmount || formDataList.length === 0) {
        console.error('[createCheckoutSession] Erro: Campos obrigatórios ausentes (formDataList ou totalAmount).');
        return res.status(400).json({ error: 'Missing required fields: formDataList, totalAmount.' });
    }

    // Validação robusta do productId
    if (typeof productId !== 'string' || productId.trim() === '') {
        console.error(`[createCheckoutSession] Erro: productId inválido. Valor recebido: "${productId}"`);
        return res.status(400).json({ error: 'productId must be a non-empty string.' });
    }

    try {
        console.log(`[createCheckoutSession] Buscando produto: ${productId}`);
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();
        if (!productDoc.exists) {
            return res.status(404).send('Product not found.');
        }
        const product = productDoc.data();
        product.id = productDoc.id; // Adiciona o ID do documento ao objeto do produto
        const currency = 'brl';

        // Força o uso do Pagar.me como gateway padrão.
        const usePagarme = true;
        console.log(`[createCheckoutSession] Gateway para o produto ${productId}: Pagar.me (forçado)`);

        const saleDocIds = [];
        for (const formData of formDataList) {
            const saleData = {
                ...formData,
                productId: productId,
                productName: product.name,
                amountTotal: formData.priceData.amount,
                currency: currency,
                paymentStatus: 'pending',
                couponCode: couponCode || null,
                created: admin.firestore.FieldValue.serverTimestamp(),
            };
            const docRef = await db.collection('inscricoesFaixaPreta').add(saleData);
            saleDocIds.push(docRef.id);
        }

        // Process recommended items as separate sales
        if (recommendedItems && recommendedItems.length > 0 && formDataList.length > 0) {
            const primaryBuyerData = formDataList[0]; // Associate with the first buyer

            for (const item of recommendedItems) {
                const recommendedProductRef = db.collection('products').doc(item.productId);
                const recommendedProductDoc = await recommendedProductRef.get();
                const recommendedProductName = recommendedProductDoc.exists ? recommendedProductDoc.data().name : item.productName;

                for (let i = 0; i < item.quantity; i++) {
                    const saleData = {
                        userName: primaryBuyerData.userName,
                        userEmail: primaryBuyerData.userEmail,
                        userPhone: primaryBuyerData.userPhone,
                        userCpf: primaryBuyerData.userCpf,
                        userUnit: primaryBuyerData.userUnit,
                        userId: primaryBuyerData.userId,
                        userPrograma: null,
                        userGraduacao: null,
                        productId: item.productId,
                        productName: recommendedProductName,
                        amountTotal: item.amount / item.quantity,
                        currency: currency,
                        paymentStatus: 'pending',
                        couponCode: couponCode || null,
                        created: admin.firestore.FieldValue.serverTimestamp(),
                    };
                    const docRef = await db.collection('inscricoesFaixaPreta').add(saleData);
                    saleDocIds.push(docRef.id);
                }
            }
        }

        console.log('[createCheckoutSession] Criando pedido no Pagar.me...');
        const pagarmeOrder = await createPagarmeOrder(product, formDataList, totalAmount, saleDocIds);
        console.log('[createCheckoutSession] Pedido Pagar.me criado com sucesso:', JSON.stringify(pagarmeOrder, null, 2));

        // A URL de sucesso é definida no payload de criação do pedido no Pagar.me.
        // A função `verifyPayment` na página de sucesso usará o `pagarme_order_id` da URL
        // para verificar o status do pagamento.
        const successUrl = `https://www.kihap.com.br/compra-success.html?pagarme_order_id=${pagarmeOrder.id}`;

        // Update all sale documents with the Pagar.me order ID
        for (const docId of saleDocIds) {
            await db.collection('inscricoesFaixaPreta').doc(docId).update({ pagarmeOrderId: pagarmeOrder.id });
        }

        const responsePayload = { checkoutUrl: pagarmeOrder.checkouts[0].payment_url, provider: 'pagarme' };
        console.log('[createCheckoutSession] Enviando resposta para o cliente:', JSON.stringify(responsePayload, null, 2));
        res.status(200).json(responsePayload);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        // Log completo do erro para depuração
        console.error('Detalhes completos do erro:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.', details: error.message });
    }
});

// Nova Cloud Function para verificar o pagamento na página de sucesso
exports.verifyPayment = functions.https.onRequest(async (req, res) => {
    if (!stripeClient) {
        stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    }
    // Permitir CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const { sessionId, pagarme_order_id } = req.body;

    if (!sessionId && !pagarme_order_id) {
        return res.status(400).send('Session ID or Pagar.me Order ID is required.');
    }

    try {
        let isPaid = false;
        let firestoreDocIds;
        let paymentProviderId;

        if (sessionId) {
            paymentProviderId = sessionId;
            const session = await stripeClient.checkout.sessions.retrieve(sessionId);
            isPaid = session.payment_status === 'paid';
            if (isPaid) {
                const firestoreDocIdsString = session.metadata.firestoreDocIds;
                if (firestoreDocIdsString) {
                    firestoreDocIds = JSON.parse(firestoreDocIdsString);
                }
            }
        } else if (pagarme_order_id) {
            paymentProviderId = pagarme_order_id;
            const order = await getPagarmeOrder(pagarme_order_id);
            isPaid = order.status === 'paid';
            if (isPaid) {
                const firestoreDocIdsString = order.metadata.firestoreDocIds;
                if (firestoreDocIdsString) {
                    firestoreDocIds = JSON.parse(firestoreDocIdsString);
                }
            }
        }

        if (isPaid) {
            // Fallback to find docs if metadata was not available
            if (!firestoreDocIds || firestoreDocIds.length === 0) {
                const fieldToQuery = sessionId ? 'checkoutSessionId' : 'pagarmeOrderId';
                const querySnapshot = await db.collection('inscricoesFaixaPreta').where(fieldToQuery, '==', paymentProviderId).get();
                if (!querySnapshot.empty) {
                    firestoreDocIds = querySnapshot.docs.map(doc => doc.id);
                }
            }

            if (firestoreDocIds && firestoreDocIds.length > 0) {
                for (const docId of firestoreDocIds) {
                    const docRef = db.collection('inscricoesFaixaPreta').doc(docId);
                    const saleSnap = await docRef.get();

                    if (saleSnap.exists) {
                        const saleData = saleSnap.data();

                        // Check if we need to update status OR if we need to send a missing email
                        if (saleData.paymentStatus === 'pending') {
                            await docRef.update({ paymentStatus: 'paid' });
                            console.log(`Updated payment status to 'paid' for doc ${docId}`);
                        }

                        // Check if ticket email needs to be sent (idempotent check)
                        if (!saleData.emailSent) {
                            const productRef = db.collection('products').doc(saleData.productId);
                            const productSnap = await productRef.get();
                            if (productSnap.exists && productSnap.data().isTicket) {
                                console.log(`[verifyPayment] Sending missing ticket email for ${docId}`);
                                await sendTicketEmail(docId, saleData);
                            }
                        }
                    }
                }
                return res.status(200).json({ status: 'success', saleIds: firestoreDocIds, message: 'All payments verified and statuses updated.' });
            } else {
                console.error(`Critical: Payment success for ID ${paymentProviderId}, but no corresponding Firestore docs found.`);
                return res.status(200).json({ status: 'error_registration', message: 'Payment verified but sale registration failed.' });
            }
        } else {
            return res.status(200).json({ status: 'not_paid', message: 'Payment not completed.' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// Função para criar assinatura no Pagar.me
exports.createSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado para assinar.');
    }

    const { planId, cardData, paymentMethod, courseId } = data;
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;

    if (!planId || !courseId) {
        throw new functions.https.HttpsError('invalid-argument', 'Plan ID e Course ID são obrigatórios.');
    }

    try {
        // 1. Buscar dados do usuário
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.data() || {};

        // 2. Montar dados do cliente
        const customerData = {
            name: userData.name || userEmail,
            email: userEmail,
            document: userData.cpf || '00000000000', // Fallback ou exigir CPF no frontend
            phone: userData.phone || '5511999999999' // Fallback
        };

        // 3. Criar assinatura no Pagar.me
        const subscription = await createPagarmeSubscription(customerData, paymentMethod, planId, cardData);

        // 4. Salvar no Firestore
        await userRef.collection('subscriptions').add({
            courseId: courseId,
            pagarmeSubscriptionId: subscription.id,
            status: subscription.status,
            planId: planId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentMethod: paymentMethod
        });

        // Atualizar status do usuário se necessário (ex: acesso global) ou apenas registrar a assinatura específica
        // Aqui vamos focar na assinatura específica por curso.

        return { success: true, subscriptionId: subscription.id, status: subscription.status };

    } catch (error) {
        console.error("Erro ao criar assinatura:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.cancelSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado.');
    }

    const { courseId } = data;
    const userId = context.auth.uid;

    if (!courseId) {
        throw new functions.https.HttpsError('invalid-argument', 'Course ID é obrigatório.');
    }

    try {
        // 1. Buscar assinatura ativa para este curso
        const subsRef = db.collection('users').doc(userId).collection('subscriptions');
        const q = subsRef.where('courseId', '==', courseId).where('status', '==', 'active').limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'Nenhuma assinatura ativa encontrada para este curso.');
        }

        const subDoc = snapshot.docs[0];
        const subData = subDoc.data();

        // 2. Cancelar no Pagar.me
        await cancelPagarmeSubscription(subData.pagarmeSubscriptionId);

        // 3. Atualizar no Firestore
        await subDoc.ref.update({
            status: 'canceled',
            canceledAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, message: 'Assinatura cancelada com sucesso.' };

    } catch (error) {
        console.error("Erro ao cancelar assinatura:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.adminCancelSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    }

    // Ideal: Check for admin claim
    // if (!context.auth.token.admin) { ... }

    const { userId, courseId } = data;

    if (!userId || !courseId) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID e Course ID são obrigatórios.');
    }

    try {
        const subsRef = db.collection('users').doc(userId).collection('subscriptions');
        const q = subsRef.where('courseId', '==', courseId).where('status', '==', 'active').limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'Nenhuma assinatura ativa encontrada.');
        }

        const subDoc = snapshot.docs[0];
        const subData = subDoc.data();

        await cancelPagarmeSubscription(subData.pagarmeSubscriptionId);

        await subDoc.ref.update({
            status: 'canceled_by_admin',
            canceledAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, message: 'Assinatura cancelada pelo admin.' };

    } catch (error) {
        console.error("Erro ao cancelar assinatura (admin):", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.processFreePurchase = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { formDataList, productId, couponCode, recommendedItems } = req.body;

    if (!formDataList || !productId || formDataList.length === 0) {
        return res.status(400).json({ error: 'Missing required fields: formDataList, productId.' });
    }

    try {
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();
        if (!productDoc.exists) {
            return res.status(404).send('Product not found.');
        }
        const product = productDoc.data();
        const currency = 'brl';

        for (const formData of formDataList) {
            const saleData = {
                ...formData,
                productId: productId,
                productName: product.name,
                amountTotal: 0,
                currency: currency,
                paymentStatus: 'paid',
                couponCode: couponCode || null,
                created: admin.firestore.FieldValue.serverTimestamp(),
            };
            const docRef = await db.collection('inscricoesFaixaPreta').add(saleData);

            // Se o produto for um ingresso, envie o e-mail
            if (product.isTicket) {
                console.log(`[processFreePurchase] Produto gratuito é um ingresso. Enviando e-mail para a venda ${docRef.id}.`);
                await sendTicketEmail(docRef.id, saleData);
            }
        }

        // Process recommended items for free purchases
        if (recommendedItems && recommendedItems.length > 0 && formDataList.length > 0) {
            const primaryBuyerData = formDataList[0]; // Associate with the first buyer

            for (const item of recommendedItems) {
                const recommendedProductRef = db.collection('products').doc(item.productId);
                const recommendedProductDoc = await recommendedProductRef.get();
                const recommendedProductName = recommendedProductDoc.exists ? recommendedProductDoc.data().name : item.productName;

                for (let i = 0; i < item.quantity; i++) {
                    const saleData = {
                        userName: primaryBuyerData.userName,
                        userEmail: primaryBuyerData.userEmail,
                        userPhone: primaryBuyerData.userPhone,
                        userCpf: primaryBuyerData.userCpf,
                        userUnit: primaryBuyerData.userUnit,
                        userId: primaryBuyerData.userId,
                        userPrograma: null,
                        userGraduacao: null,
                        productId: item.productId,
                        productName: recommendedProductName,
                        amountTotal: 0, // Free
                        currency: currency,
                        paymentStatus: 'paid',
                        couponCode: couponCode || null,
                        created: admin.firestore.FieldValue.serverTimestamp(),
                    };
                    await db.collection('inscricoesFaixaPreta').add(saleData);
                }
            }
        }

        res.status(200).json({ status: 'success', message: 'Free purchase processed successfully.' });
    } catch (error) {
        console.error('Error processing free purchase:', error);
        res.status(500).json({ error: error.message });
    }
});

// Função para corrigir o status de pagamentos antigos
exports.fixOldSalesStatus = functions.https.onCall(async (data, context) => {
    if (!stripeClient) {
        stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    }
    // Apenas usuários autenticados podem chamar esta função
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado para executar esta ação.');
    }

    try {
        console.log('Iniciando processo para corrigir status de vendas antigas...');
        const salesRef = db.collection('inscricoesFaixaPreta');

        const pendingSalesSnapshot = await salesRef.where('paymentStatus', '==', 'pending').get();

        if (pendingSalesSnapshot.empty) {
            console.log('Nenhuma venda pendente encontrada para processar.');
            return { message: 'Nenhuma venda pendente encontrada para processar.' };
        }

        const salesBySession = {};
        pendingSalesSnapshot.docs.forEach(doc => {
            const sale = doc.data();
            if (sale.checkoutSessionId) {
                if (!salesBySession[sale.checkoutSessionId]) {
                    salesBySession[sale.checkoutSessionId] = [];
                }
                salesBySession[sale.checkoutSessionId].push({ id: doc.id, ...sale });
            }
        });

        let updatedCount = 0;

        for (const sessionId in salesBySession) {
            try {
                const session = await stripeClient.checkout.sessions.retrieve(sessionId);
                if (session.payment_status === 'paid') {
                    const pendingSalesInSession = salesBySession[sessionId];
                    console.log(`Sessão ${sessionId} tem um pagamento confirmado. Corrigindo ${pendingSalesInSession.length} venda(s) pendente(s).`);

                    for (const pendingSale of pendingSalesInSession) {
                        await salesRef.doc(pendingSale.id).update({ paymentStatus: 'paid' });
                        updatedCount++;
                        console.log(`Status da venda ${pendingSale.id} atualizado para 'pago'.`);
                    }
                }
            } catch (stripeError) {
                console.warn(`Não foi possível verificar a sessão ${sessionId} no Stripe: ${stripeError.message}. Pulando...`);
            }
        }

        const message = `Processo concluído. ${updatedCount} venda(s) foram atualizadas.`;
        console.log(message);
        return { message: message };

    } catch (error) {
        console.error('Erro ao corrigir status de vendas antigas:', error);
        throw new functions.https.HttpsError('internal', 'Ocorreu um erro durante o processo. Verifique os logs da função.');
    }
});

// Função para reenviar e-mail (ingresso ou recibo)
exports.resendEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado para executar esta ação.');
    }

    const { saleId } = data;
    if (!saleId) {
        throw new functions.https.HttpsError('invalid-argument', 'O ID da venda é obrigatório.');
    }

    try {
        const saleRef = db.collection('inscricoesFaixaPreta').doc(saleId);
        const saleSnap = await saleRef.get();

        if (!saleSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Venda não encontrada.');
        }

        const saleData = saleSnap.data();

        if (!saleData.productId) {
            throw new functions.https.HttpsError('failed-precondition', 'Venda sem ID de produto associado.');
        }

        const productRef = db.collection('products').doc(saleData.productId);
        const productSnap = await productRef.get();

        if (productSnap.exists && productSnap.data().isTicket) {
            await sendTicketEmail(saleId, saleData);
            return {
                message: `E-mail de ingresso reenviado com sucesso para ${saleData.userEmail}.`,
                type: 'ticket'
            };
        } else {
            await sendPurchaseReceiptEmail(saleId, saleData);
            return {
                message: `E-mail de recibo reenviado com sucesso para ${saleData.userEmail}.`,
                type: 'receipt'
            };
        }

    } catch (error) {
        console.error('Erro ao reenviar e-mail:', error);
        throw new functions.https.HttpsError('internal', `Erro ao reenviar e-mail: ${error.message}`);
    }
});

// Manter compatibilidade com código antigo - deprecado
exports.resendTicketEmail = exports.resendEmail;

// Função para enviar e-mails de ingressos em massa para um produto específico
exports.sendBulkTicketEmails = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado para executar esta ação.');
    }

    const { productId } = data;
    if (!productId) {
        throw new functions.https.HttpsError('invalid-argument', 'O ID do produto é obrigatório.');
    }

    try {
        const productRef = db.collection('products').doc(productId);
        const productSnap = await productRef.get();

        if (!productSnap.exists || !productSnap.data().isTicket) {
            throw new functions.https.HttpsError('not-found', 'Produto não encontrado ou não é um ingresso.');
        }

        const salesRef = db.collection('inscricoesFaixaPreta');
        const querySnapshot = await salesRef
            .where('productId', '==', productId)
            .where('paymentStatus', '==', 'paid')
            .get();

        const salesToSend = querySnapshot.docs.filter(doc => doc.data().emailSent !== true);

        if (salesToSend.length === 0) {
            return { message: 'Nenhum ingresso pendente de envio para este produto.' };
        }

        let emailCount = 0;
        const emailPromises = salesToSend.map(doc => {
            const saleData = doc.data();
            emailCount++;
            return sendTicketEmail(doc.id, saleData);
        });

        await Promise.all(emailPromises);

        return { message: `${emailCount} e-mails de ingresso foram enviados com sucesso.` };

    } catch (error) {
        console.error('Erro ao enviar e-mails em massa:', error);
        throw new functions.https.HttpsError('internal', 'Ocorreu um erro ao tentar enviar os e-mails em massa.');
    }
});


// Cloud Function para criar uma sessão de checkout para assinatura (versão robusta)
exports.createSubscriptionCheckout = functions.https.onCall(async (data, context) => {
    if (!stripeClient) {
        stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    }
    // 1. Validação de Autenticação e Dados de Entrada
    if (!context.auth || !context.auth.token.email) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado com um e-mail válido para assinar.');
    }
    const { priceId } = data;
    if (!priceId) {
        throw new functions.https.HttpsError('invalid-argument', 'O ID do plano (priceId) é obrigatório.');
    }

    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;

    try {
        // 2. Validação do Usuário no Firestore
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            console.error(`Usuário ${userId} autenticado mas não encontrado no Firestore.`);
            throw new functions.https.HttpsError('not-found', 'Não foi possível encontrar os dados do usuário.');
        }

        const userData = userSnap.data();
        let customerId = userData.stripeCustomerId;

        // 3. Criação de Cliente Stripe (se necessário)
        if (!customerId) {
            console.log(`Criando novo cliente Stripe para o usuário ${userId}`);
            const customer = await stripeClient.customers.create({
                email: userEmail,
                name: userData.name || userEmail,
                metadata: { firebaseUID: userId }
            });
            customerId = customer.id;
            await userRef.update({ stripeCustomerId: customerId });
            console.log(`Cliente Stripe ${customerId} criado e associado ao usuário ${userId}`);
        }

        // 4. Criação da Sessão de Checkout no Stripe
        console.log(`Criando sessão de checkout para o cliente ${customerId} com o plano ${priceId}`);
        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `https://www.kihap.com.br/members/index.html?subscription_success=true`,
            cancel_url: `https://www.kihap.com.br/members/assinatura.html`,
            metadata: {
                firebaseUID: userId,
                type: 'subscription' // Adiciona um tipo para diferenciar no webhook
            }
        });

        return { sessionId: session.id };

    } catch (error) {
        // 5. Tratamento de Erros Detalhado
        console.error("Erro detalhado ao criar sessão de checkout:", error);
        if (error.type) {
            // Erro específico da API do Stripe (ex: priceId inválido)
            console.error("Erro da API do Stripe:", error.message);
            throw new functions.https.HttpsError('aborted', `Erro de pagamento: ${error.message}`);
        } else {
            // Outro erro interno (ex: problema de permissão no Firebase)
            console.error("Erro interno da função:", error.message);
            throw new functions.https.HttpsError('internal', 'Não foi possível criar a sessão de checkout. Verifique os logs da função no Firebase Console.');
        }
    }
});

// Cloud Function para criar uma sessão do Portal do Cliente Stripe
exports.createCustomerPortal = functions.https.onCall(async (data, context) => {
    if (!stripeClient) {
        stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado.');
    }

    const userId = context.auth.uid;

    try {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            console.error(`Usuário ${userId} autenticado mas não encontrado no Firestore ao tentar acessar o portal.`);
            throw new functions.https.HttpsError('not-found', 'Não foi possível encontrar os dados do usuário.');
        }

        const userData = userSnap.data();
        const customerId = userData.stripeCustomerId;

        if (!customerId) {
            throw new functions.https.HttpsError('not-found', 'Nenhum cliente Stripe encontrado para este usuário.');
        }

        const portalSession = await stripeClient.billingPortal.sessions.create({
            customer: customerId,
            return_url: `https://www.kihap.com.br/members/perfil.html`,
        });

        return { url: portalSession.url };

    } catch (error) {
        console.error("Erro ao criar a sessão do portal do cliente:", error);
        throw new functions.https.HttpsError('internal', 'Não foi possível acessar o portal do cliente.');
    }
});

// Webhook UNIFICADO para lidar com eventos do Stripe em tempo real
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    if (!stripeClient) {
        stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    }
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripeClient.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('⚠️  Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lida com o evento
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;

            // Verifica o tipo de checkout (compra de produto ou assinatura)
            if (session.metadata.type === 'product_purchase') {
                // Lógica para compra de produto
                let attempt = 0;
                const maxAttempts = 4;
                let firestoreDocIds;

                while (attempt < maxAttempts) {
                    const firestoreDocIdsString = session.metadata.firestoreDocIds;
                    if (firestoreDocIdsString) {
                        firestoreDocIds = JSON.parse(firestoreDocIdsString);
                        break;
                    }

                    const querySnapshot = await db.collection('inscricoesFaixaPreta').where('checkoutSessionId', '==', session.id).get();
                    if (!querySnapshot.empty) {
                        firestoreDocIds = querySnapshot.docs.map(doc => doc.id);
                        break;
                    }

                    attempt++;
                    if (attempt < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                if (firestoreDocIds && firestoreDocIds.length > 0) {
                    for (const docId of firestoreDocIds) {
                        const docRef = db.collection('inscricoesFaixaPreta').doc(docId);
                        const saleSnap = await docRef.get();

                        if (saleSnap.exists && saleSnap.data().paymentStatus === 'pending') {
                            await docRef.update({ paymentStatus: 'paid' });
                            console.log(`Webhook: Status atualizado para 'pago' para a venda ${docId}`);

                            const saleData = saleSnap.data();
                            const productRef = db.collection('products').doc(saleData.productId);
                            const productSnap = await productRef.get();

                            const isTicket = productSnap.exists && productSnap.data().isTicket;
                            console.log(`[Webhook] Verificando produto ${saleData.productId} para a venda ${docId}. É um ingresso? -> ${isTicket}`);

                            if (isTicket) {
                                console.log(`[Webhook] Condição atendida. Chamando sendTicketEmail para a venda ${docId}.`);
                                await sendTicketEmail(docId, saleData);
                            } else {
                                console.log(`[Webhook] Produto não é um ingresso. E-mail não será enviado para a venda ${docId}.`);
                            }
                        }
                    }
                } else {
                    console.error(`Critical Webhook Error: Checkout session ${session.id} bem-sucedida, mas documentos no Firestore não encontrados.`);
                }

            } else if (session.metadata.type === 'subscription') {
                // Lógica para assinatura
                const userId = session.metadata.firebaseUID;
                const subscriptionId = session.subscription;

                if (userId) {
                    await db.collection('users').doc(userId).update({
                        stripeSubscriptionId: subscriptionId,
                        subscriptionStatus: 'active'
                    });
                    console.log(`Webhook: Assinatura ${subscriptionId} ativada para o usuário ${userId}.`);
                } else {
                    console.error(`Critical Webhook Error: Assinatura para a sessão ${session.id} não possui firebaseUID nos metadados.`);
                }
            }
            break;
        }
        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            const userIdQuery = await db.collection('users').where('stripeCustomerId', '==', subscription.customer).get();
            if (!userIdQuery.empty) {
                const userId = userIdQuery.docs[0].id;
                await db.collection('users').doc(userId).update({
                    subscriptionStatus: subscription.status
                });
                console.log(`Webhook: Status da assinatura ${subscription.id} atualizado para ${subscription.status} para o usuário ${userId}.`);
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const userIdQuery = await db.collection('users').where('stripeCustomerId', '==', subscription.customer).get();
            if (!userIdQuery.empty) {
                const userId = userIdQuery.docs[0].id;
                await db.collection('users').doc(userId).update({
                    subscriptionStatus: 'canceled'
                });
                console.log(`Webhook: Assinatura ${subscription.id} cancelada para o usuário ${userId}.`);
            }
            break;
        }
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).send();
});

// Webhook para lidar com eventos do Pagar.me em tempo real
exports.pagarmeWebhook = functions.https.onRequest(async (req, res) => {
    // TODO: Adicionar verificação de assinatura do Pagar.me para segurança
    // A assinatura geralmente vem no header 'x-hub-signature'

    const eventType = req.body.type;
    const data = req.body.data;

    console.log(`[Pagar.me Webhook] Recebido evento: ${eventType}`, JSON.stringify(req.body, null, 2));

    // Log do evento no Firestore para debug e auditoria
    try {
        await db.collection('webhook_logs').add({
            provider: 'pagarme',
            eventType: eventType || 'unknown',
            payload: req.body,
            receivedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (logError) {
        console.error('[Pagar.me Webhook] Falha ao salvar log no Firestore:', logError);
    }

    const orderData = data.order || data;

    if (!orderData.metadata || !orderData.metadata.firestoreDocIds) {
        console.warn(`[Pagar.me Webhook] Evento ${eventType} recebido, mas sem firestoreDocIds nos metadados do pedido.`);
        return res.status(200).send();
    }

    const firestoreDocIdsString = orderData.metadata.firestoreDocIds;
    if (!firestoreDocIdsString) {
        console.warn(`[Pagar.me Webhook] Evento ${eventType} recebido, mas sem firestoreDocIds nos metadados.`);
        return res.status(200).send();
    }

    let firestoreDocIds;
    try {
        firestoreDocIds = JSON.parse(firestoreDocIdsString);
    } catch (e) {
        console.error('[Pagar.me Webhook] Erro ao fazer parse de firestoreDocIds:', e);
        return res.status(200).send();
    }

    try {
        // Mapeamento de status do Pagar.me para status do Firestore
        // Pagar.me Order Status: paid, canceled, failed
        // Firestore Status: paid, canceled, failed, pending

        // O status final da venda é determinado pelo status do PEDIDO (order),
        // que é a fonte da verdade. O status do charge pode ser transitório.
        const orderStatus = orderData.status;
        let newStatus = null;

        switch (orderStatus) {
            case 'paid':
                newStatus = 'paid';
                break;
            case 'canceled':
                newStatus = 'canceled';
                break;
            case 'failed':
                newStatus = 'failed';
                break;
            default:
                console.log(`[Pagar.me Webhook] Status do pedido '${orderStatus}' (evento ${eventType}) não mapeado para alteração.`);
                return res.status(200).send();
        }

        if (newStatus) {
            for (const docId of firestoreDocIds) {
                const docRef = db.collection('inscricoesFaixaPreta').doc(docId);
                const saleSnap = await docRef.get();

                if (!saleSnap.exists) {
                    console.warn(`[Pagar.me Webhook] Documento de venda ${docId} não encontrado.`);
                    continue;
                }

                const currentStatus = saleSnap.data().paymentStatus;

                // Evitar atualizações desnecessárias ou retrocessos (ex: paid -> pending)
                if (currentStatus === newStatus) {
                    console.log(`[Pagar.me Webhook] Venda ${docId} já está com status '${newStatus}'. Nenhuma ação necessária.`);
                    continue;
                }

                // Atualiza o status
                await docRef.update({ paymentStatus: newStatus });
                console.log(`[Pagar.me Webhook] Status atualizado para '${newStatus}' para a venda ${docId}`);

                // Lógica específica para 'paid'
                if (newStatus === 'paid') {
                    const saleData = saleSnap.data();
                    const productRef = db.collection('products').doc(saleData.productId);
                    const productSnap = await productRef.get();

                    if (productSnap.exists && productSnap.data().isTicket) {
                        // Verifica se o email já foi enviado para não enviar duplicado
                        if (!saleData.emailSent) {
                            await sendTicketEmail(docId, saleData);
                        } else {
                            console.log(`[Pagar.me Webhook] E-mail de ingresso já enviado anteriormente para venda ${docId}.`);
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('[Pagar.me Webhook] Erro ao processar webhook:', error);
        // Retornar 200 mesmo com erro interno para evitar retentativas infinitas do webhook se for um erro de lógica nossa
        // Se for erro de rede/firebase, talvez valha a pena 500, mas por segurança 200 evita loops.
    }

    res.status(200).send();
});


// Função agendada para verificar e reenviar e-mails de ingressos não enviados
exports.scheduledEmailCheck = functions.pubsub.schedule('every 10 minutes').timeZone('America/Sao_Paulo').onRun(async (context) => {
    console.log('[scheduledEmailCheck] Iniciando verificação de e-mails de ingressos não enviados.');

    try {
        const salesRef = db.collection('inscricoesFaixaPreta');
        const querySnapshot = await salesRef
            .where('paymentStatus', '==', 'paid')
            .where('emailSent', '!=', true)
            .get();

        if (querySnapshot.empty) {
            console.log('[scheduledEmailCheck] Nenhum ingresso pendente de envio encontrado.');
            return null;
        }

        console.log(`[scheduledEmailCheck] ${querySnapshot.size} venda(s) encontrada(s) com pagamento confirmado e sem e-mail enviado.`);

        const emailPromises = querySnapshot.docs.map(async (doc) => {
            const saleData = doc.data();
            const saleId = doc.id;

            // Verifica se o produto é um ingresso antes de enviar
            const productRef = db.collection('products').doc(saleData.productId);
            const productSnap = await productRef.get();

            if (productSnap.exists && productSnap.data().isTicket) {
                console.log(`[scheduledEmailCheck] Reenviando e-mail para a venda ${saleId}.`);
                return sendTicketEmail(saleId, saleData);
            }
        });

        await Promise.all(emailPromises);
        console.log('[scheduledEmailCheck] Verificação concluída.');

    } catch (error) {
        console.error('[scheduledEmailCheck] Erro ao executar a verificação agendada:', error);
    }
    return null;
});


// Importa e exporta todas as funções do evo.js
// Importa e exporta todas as funções do evo.js
const evoFunctions = require('./evo.js');
// Itera sobre as chaves do objeto evoFunctions e as exporta individualmente
// Isso garante que o Firebase Functions reconheça cada função corretamente.
Object.keys(evoFunctions).forEach(key => {
    exports[key] = evoFunctions[key];
});

// Função para reenviar TODOS os ingressos pendentes (vendas pagas sem email enviado)
exports.resendAllMissingTickets = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado para executar esta ação.');
    }

    // Opcional: Verificar se é admin
    // if (!context.auth.token.admin) { ... }

    try {
        console.log('[resendAllMissingTickets] Iniciando busca por ingressos não enviados...');
        const salesRef = db.collection('inscricoesFaixaPreta');

        // Busca todas as vendas pagas
        // Nota: Firestore não permite filtrar por 'emailSent == false' facilmente se o campo não existir em todos os docs.
        // Vamos buscar os pagos e filtrar em memória ou usar um índice composto se necessário.
        // Para evitar leituras excessivas, vamos limitar ou fazer em batches se fosse produção massiva.
        // Aqui assumiremos volume razoável.
        const querySnapshot = await salesRef
            .where('paymentStatus', '==', 'paid')
            .get();

        if (querySnapshot.empty) {
            return { message: 'Nenhuma venda paga encontrada.' };
        }

        let processedCount = 0;
        let sentCount = 0;
        let errorCount = 0;

        // Cache de produtos para não ler o mesmo doc repetidamente
        const productCache = {};

        for (const doc of querySnapshot.docs) {
            const saleData = doc.data();

            // Se já foi enviado, pula
            if (saleData.emailSent === true) {
                continue;
            }

            processedCount++;
            const productId = saleData.productId;

            if (!productId) continue;

            // Verifica se o produto é ingresso (usando cache)
            if (!productCache[productId]) {
                const productRef = db.collection('products').doc(productId);
                const productSnap = await productRef.get();
                if (productSnap.exists) {
                    productCache[productId] = productSnap.data();
                } else {
                    productCache[productId] = { isTicket: false }; // Marca como não encontrado/não ingresso
                }
            }

            const product = productCache[productId];

            if (product && product.isTicket) {
                try {
                    console.log(`[resendAllMissingTickets] Enviando ingresso para venda ${doc.id} (${saleData.userEmail})`);
                    await sendTicketEmail(doc.id, saleData);
                    sentCount++;
                } catch (err) {
                    console.error(`[resendAllMissingTickets] Erro ao enviar para ${doc.id}:`, err);
                    errorCount++;
                }
            }
        }

        const message = `Processo finalizado. Verificados: ${processedCount}. Enviados: ${sentCount}. Erros: ${errorCount}.`;
        console.log(`[resendAllMissingTickets] ${message}`);
        return { message, sentCount, errorCount };

    } catch (error) {
        console.error('Erro ao reenviar todos os ingressos:', error);
        throw new functions.https.HttpsError('internal', 'Erro interno ao processar reenvio em massa.');
    }
});

exports.sendWhatsAppMessage = functions.https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { prospectId, phone, message } = data;

    // Validation
    if (!prospectId || !phone || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: prospectId, phone, message.');
    }

    const token = process.env.WHAPI_TOKEN;
    if (!token) {
        console.error('WHAPI_TOKEN not found in environment variables.');
        throw new functions.https.HttpsError('failed-precondition', 'WHAPI_TOKEN checksum failed (not configured).');
    }

    try {
        // Prepare phone number (remove non-digits)
        const cleanPhone = phone.replace(/\D/g, '');

        let targetPhone = cleanPhone;
        // Basic formatting for BR numbers if they come without country code
        if (targetPhone.length >= 10 && targetPhone.length <= 11) {
            targetPhone = '55' + targetPhone;
        }

        console.log(`[sendWhatsAppMessage] Sending to ${targetPhone} for prospect ${prospectId}`);

        // Call Whapi
        const whapiResponse = await axios.post('https://gate.whapi.cloud/messages/text', {
            to: targetPhone,
            body: message
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('[sendWhatsAppMessage] Whapi response:', whapiResponse.data);

        // Log to Firestore
        const userEmail = context.auth.token.email || 'unknown';
        const logEntry = {
            author: userEmail,
            description: message,
            timestamp: new Date(), // Using Client-side timestamp because ArrayUnion doesn't support serverTimestamp
            type: 'whatsapp-sent',
            metadata: {
                destination: targetPhone,
                whapi_id: whapiResponse.data?.messages?.[0]?.id || 'unknown'
            }
        };

        // Try to update prospect first
        let docRef = db.collection('prospects').doc(prospectId);
        let docSnap = await docRef.get();

        if (!docSnap.exists) {
            // Try leads
            docRef = db.collection('leads').doc(prospectId);
            docSnap = await docRef.get();
        }

        if (docSnap.exists) {
            await docRef.update({
                contactLog: admin.firestore.FieldValue.arrayUnion(logEntry)
            });
            console.log(`[sendWhatsAppMessage] Logged to ${docRef.path}`);
        } else {
            console.warn(`[sendWhatsAppMessage] Prospect/Lead ${prospectId} not found to log message.`);
        }

        return { success: true, data: whapiResponse.data };

    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        if (error.response) {
            console.error('Whapi Error Details:', error.response.data);
        }
        const errorMessage = error.response?.data?.message || error.message;
        throw new functions.https.HttpsError('internal', `Failed to send message: ${errorMessage}`);
    }
});

exports.getWhatsAppHistory = functions.https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { phone, limit = 20 } = data;

    if (!phone) {
        throw new functions.https.HttpsError('invalid-argument', 'Phone number is required.');
    }

    const token = process.env.WHAPI_TOKEN;
    if (!token) {
        console.error('WHAPI_TOKEN is missing in environment variables.');
        throw new functions.https.HttpsError('failed-precondition', 'WHAPI_TOKEN not configured.');
    }

    try {
        const cleanPhone = phone.replace(/\D/g, '');
        let targetPhone = cleanPhone;
        // Basic formatting for BR numbers
        if (targetPhone.length >= 10 && targetPhone.length <= 11) {
            targetPhone = '55' + targetPhone;
        }

        // Whapi expects chatId like '554899999999@s.whatsapp.net' for private chats
        const chatId = `${targetPhone}@s.whatsapp.net`;
        console.log(`[getWhatsAppHistory] Fetching history for ${chatId}`);

        // https://whapi.cloud/docs mentions /messages/list/{chatId} or /messages/list with params
        // Let's use the list endpoint with chatId param if supported, or filter.
        // Documentation says: GET /messages/list/{chat_id}
        // Let's try that one first as it is more specific.

        const response = await axios.get(`https://gate.whapi.cloud/messages/list/${chatId}`, {
            params: {
                count: limit
            },
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        // Transform data to a simpler format for frontend
        const messages = response.data.messages.map(msg => ({
            id: msg.id,
            from_me: msg.from_me,
            text: msg.text?.body || msg.caption || '[Media/Other]', // Handle text or caption
            type: msg.type,
            timestamp: msg.timestamp,
            status: msg.status
        }));

        return { success: true, messages: messages };

    } catch (error) {
        console.error('Error fetching WhatsApp history details:', error.response?.data || error.message);
        // Return a clean error to the client even if internal
        if (error.response?.status === 404 || error.response?.status === 400) {
            // Treat 404 as empty history
            return { success: true, messages: [] };
        }
        throw new functions.https.HttpsError('internal', `Whapi Error: ${error.message}`);
    }
});

// Map of Unit Names to Manager Phone Numbers
// TODO: Replace with actual numbers provided by user
const UNIT_MANAGERS = {
    'Kihap - Asa Sul': '5561999999999',
    'Kihap - Sudoeste': '5561999999999',
    'Kihap - Lago Sul': '5561999999999',
    'Kihap - Noroeste': '5561999999999',
    'Kihap - Pontos de Ensino': '5561999999999',
    'Kihap - Jardim Botânico': '5561999999999',
    'Kihap - Centro (Floripa)': '5548992182423',
    'Kihap - Coqueiros': '5548996296941',
    'Kihap - Santa Mônica': '554892172423',
    'Kihap - Dourados': '5567999999999'
};

const CRM_URL = 'https://intranet-kihap.web.app/intranet/prospeccao.html'; // Default Firebase URL

// Helper to notify Unit Manager
async function notifyUnitManager(unitName, leadName, leadPhone) {
    try {
        const managerPhone = UNIT_MANAGERS[unitName];
        if (!managerPhone || managerPhone === '5561999999999') {
            console.log(`[notifyUnitManager] No manager phone configured for ${unitName}`);
            return null;
        }

        const message = `🔔 *Novo Lead para ${unitName}*\n\n👤 Nome: ${leadName}\n📱 Telefone: ${leadPhone}\n\n🔗 Acessar CRM: ${CRM_URL}`;

        console.log(`[notifyUnitManager] Sending notification to ${managerPhone} for unit ${unitName}`);

        // Use the existing sendMessageHelper logic directly roughly or call it if possible.
        // Since sendMessageHelper sends to 'to' and returns a log entry, we can reuse it but we don't need the log entry for the prospect's history.
        // We just want to fire and forget or log internal success.

        const token = process.env.WHAPI_TOKEN || functions.config().whapi?.token;
        if (!token) return null;

        await axios.post('https://gate.whapi.cloud/messages/text', {
            to: `${managerPhone}@s.whatsapp.net`,
            body: message
        }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        return true;
    } catch (error) {
        console.error(`[notifyUnitManager] Failed to notify manager for ${unitName}:`, error.message);
        return false;
    }
}

// Helper to send WhatsApp message via Whapi
async function sendMessageHelper(to, body) {
    try {
        const token = process.env.WHAPI_TOKEN || functions.config().whapi?.token;
        if (!token) {
            console.error('[sendMessageHelper] No WHAPI_TOKEN configured');
            return null;
        }
        await axios.post('https://gate.whapi.cloud/messages/text', {
            to,
            body
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        console.log(`[sendMessageHelper] Sent message to ${to}`);

        return {
            author: 'system',
            description: body,
            timestamp: new Date(),
            type: 'whatsapp-sent',
            metadata: {
                destination: to,
                auto_reply: true
            }
        };
    } catch (error) {
        console.error('[sendMessageHelper] Error:', error.message);
        return null;
    }
}

exports.whapiWebhook = functions.https.onRequest(async (req, res) => {
    // Only accept POST/PUT/PATCH as per Whapi docs
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const payload = req.body;
        // Whapi sends different event types - we only care about messages
        if (!payload.messages || !Array.isArray(payload.messages)) {
            return res.status(200).send('OK - No messages');
        }

        // Process each message in the payload
        for (const message of payload.messages) {
            // Only process incoming messages (from_me: false)
            if (message.from_me) continue;

            // Extract sender phone, name and message text
            const fromPhone = message.from;
            const fromName = message.from_name || null;
            const cleanPhone = fromPhone.replace('@s.whatsapp.net', '').replace('@c.us', '');
            const messageText = message.text?.body || message.caption || '[Media]';
            const timestamp = message.timestamp ? new Date(message.timestamp * 1000) : new Date();

            const prospectTitle = fromName ? fromName : (messageText.substring(0, 100));

            console.log(`[whapiWebhook] Processing message from ${cleanPhone} (${fromName || 'No Name'}): "${messageText}"`);

            // Check if prospect/lead already exists
            const prospectsSnapshot = await db.collection('prospects')
                .where('telefone', '==', cleanPhone)
                .limit(1)
                .get();

            const leadsSnapshot = await db.collection('leads')
                .where('telefone', '==', cleanPhone)
                .limit(1)
                .get();

            let existingDoc = null;
            let existingCollection = null;

            if (!prospectsSnapshot.empty) {
                existingDoc = prospectsSnapshot.docs[0];
                existingCollection = 'prospects';
            } else if (!leadsSnapshot.empty) {
                existingDoc = leadsSnapshot.docs[0];
                existingCollection = 'leads';
            }

            const logEntry = {
                author: cleanPhone,
                description: messageText,
                timestamp: new Date(),
                type: 'whatsapp-received',
                metadata: {
                    whapi_message_id: message.id,
                    received_at: timestamp.toISOString()
                }
            };

            if (existingDoc) {
                const currentData = existingDoc.data();
                const updates = {
                    contactLog: admin.firestore.FieldValue.arrayUnion(logEntry)
                };

                // Smart Routing Logic: Check for City Keywords or Unit if Unit is not set
                let routingLog = null;
                const lowerText = messageText.toLowerCase();

                // 1. Check for specific UNITS first (if user skips city or replies to unit prompt)
                let detectedUnit = null;

                // Brasília Units
                if (lowerText.includes('asa sul')) detectedUnit = 'Kihap - Asa Sul';
                else if (lowerText.includes('sudoeste')) detectedUnit = 'Kihap - Sudoeste';
                else if (lowerText.includes('lago sul')) detectedUnit = 'Kihap - Lago Sul';
                else if (lowerText.includes('noroeste')) detectedUnit = 'Kihap - Noroeste';
                else if (lowerText.includes('pontos de ensino')) detectedUnit = 'Kihap - Pontos de Ensino';
                else if (lowerText.includes('jardim botanico') || lowerText.includes('jardim botânico')) detectedUnit = 'Kihap - Jardim Botânico';

                // Florianópolis Units
                else if (lowerText.includes('centro') && !lowerText.includes('dourados')) detectedUnit = 'Kihap - Centro (Floripa)'; // Disambiguate if needed
                else if (lowerText.includes('coqueiros')) detectedUnit = 'Kihap - Coqueiros';
                else if (lowerText.includes('santa monica') || lowerText.includes('santa mônica')) detectedUnit = 'Kihap - Santa Mônica';

                if (detectedUnit) {
                    updates.unidade = detectedUnit;
                    console.log(`[whapiWebhook] Detected Unit: ${detectedUnit}`);

                    const confirmationMsg = "Você busca arte marcial pra você mesmo ou pra outra pessoa?";
                    routingLog = await sendMessageHelper(cleanPhone, confirmationMsg);

                    // Notify Manager
                    await notifyUnitManager(detectedUnit, prospectTitle, cleanPhone);
                }
                // 2. If no Unit detected, check for CITY keywords (Level 1 routing) 
                else if (!currentData.unidade) {
                    if (lowerText.includes('brasília') || lowerText.includes('brasilia')) {
                        // Sub-menu for Brasília
                        const bsbMsg = "Em Brasília, temos as unidades:\n\n- Asa Sul\n- Sudoeste\n- Lago Sul\n- Noroeste\n- Pontos de Ensino\n- Jardim Botânico\n\nQual fica melhor para você?";
                        routingLog = await sendMessageHelper(cleanPhone, bsbMsg);

                    } else if (lowerText.includes('florianópolis') || lowerText.includes('florianopolis') || lowerText.includes('floripa')) {
                        // Sub-menu for Florianópolis
                        const floripaMsg = "Em Florianópolis temos:\n\n- Centro\n- Coqueiros\n- Santa Mônica\n\nQual fica melhor para você?";
                        routingLog = await sendMessageHelper(cleanPhone, floripaMsg);

                    } else if (lowerText.includes('dourados')) {
                        // Direct routing for Dourados
                        updates.unidade = 'Kihap - Dourados';
                        const douradosMsg = "Perfeito! Você busca arte marcial pra você mesmo ou pra outra pessoa?";
                        routingLog = await sendMessageHelper(cleanPhone, douradosMsg);

                        // Notify Manager
                        await notifyUnitManager('Kihap - Dourados', prospectTitle, cleanPhone);
                    }
                }
                // 3. Logic for Post-Answer Handoff
                // If Unit IS set (from previous interactions), AND we haven't sent the handoff (flag check)
                // AND we didn't just detect/change the unit above (detectedUnit is null)
                else if (currentData.unidade && !currentData.bot_handoff_sent) {
                    // This is likely the answer to "Pra quem é?" or subsequent chat
                    const handoffMsg = "Em breve alguém de nosso time irá continuar o atendimento.";
                    routingLog = await sendMessageHelper(cleanPhone, handoffMsg);

                    updates.bot_handoff_sent = true;
                }

                // If we sent a routing message, add it to the update operation
                if (routingLog) {
                    updates.contactLog = admin.firestore.FieldValue.arrayUnion(logEntry, routingLog);
                } else {
                    updates.contactLog = admin.firestore.FieldValue.arrayUnion(logEntry);
                }

                console.log(`[whapiWebhook] Updating existing ${existingCollection} doc: ${existingDoc.id}`);
                await db.collection(existingCollection).doc(existingDoc.id).update(updates);

            } else {
                // Create new prospect
                console.log(`[whapiWebhook] Creating new prospect for ${cleanPhone}`);

                const welcomeText = "Olá, você deu o primeiro passo em busca do desenvolvimento pessoal através da arte marcial. Em breve alguém de nosso time irá responder sua mensagem.\n\nNós temos unidades nas seguintes cidade:\n- Brasília\n- Florianópolis\n- Dourados\n\n\nPra qual cidade você deseja?";

                const welcomeLog = await sendMessageHelper(cleanPhone, welcomeText);

                const initialLog = [logEntry];
                if (welcomeLog) initialLog.push(welcomeLog);

                const newProspect = {
                    responsavel: prospectTitle,
                    telefone: cleanPhone,
                    status: 'Novo',
                    prioridade: 3,
                    origemLead: 'WhatsApp Inbound',
                    setor: '',
                    email: '',
                    cpf: '',
                    redesSociais: '',
                    observacoes: `Mensagem inicial: ${messageText}`,
                    ticketEstimado: 0,
                    unidade: '',
                    tags: [],
                    contactLog: initialLog,
                    unread: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: 'webhook',
                    type: 'prospect'
                };

                await db.collection('prospects').add(newProspect);
                console.log(`[whapiWebhook] Created new prospect for ${cleanPhone} with routing invite`);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('[whapiWebhook] Error processing webhook:', error);
        res.status(200).send('Error logged');
    }
});
