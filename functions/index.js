const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const stripe = require('stripe');
let stripeClient; // Lazily initialize
const nodemailer = require('nodemailer');
const qrcode = require('qrcode');
const { createPagarmeOrder, getPagarmeOrder, syncPagarmeSalesStatus } = require('./pagarme.js');
const db = admin.firestore();

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

    // Lazy initialization do transporter para evitar erro de config no deploy
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailEmail,
            pass: gmailPassword,
        },
    });

    try {
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

    } catch (error) {
        console.error(`[sendTicketEmail] Falha ao enviar e-mail de ingresso para ${saleData.userEmail}. Erro:`, error);
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


    if (!formDataList || !productId || !totalAmount || formDataList.length === 0) {
        console.error('[createCheckoutSession] Erro: Campos obrigatórios ausentes.');
        return res.status(400).json({ error: 'Missing required fields: formDataList, productId, totalAmount.' });
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

                    if (saleSnap.exists && saleSnap.data().paymentStatus === 'pending') {
                        await docRef.update({ paymentStatus: 'paid' });
                        console.log(`Updated payment status to 'paid' for doc ${docId}`);

                        const saleData = saleSnap.data();
                        const productRef = db.collection('products').doc(saleData.productId);
                        const productSnap = await productRef.get();
                        if (productSnap.exists && productSnap.data().isTicket) {
                            await sendTicketEmail(docId, saleData);
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

// Função para reenviar o e-mail do ingresso
exports.resendTicketEmail = functions.https.onCall(async (data, context) => {
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
        
        const productRef = db.collection('products').doc(saleData.productId);
        const productSnap = await productRef.get();

        if (productSnap.exists && productSnap.data().isTicket) {
            await sendTicketEmail(saleId, saleData);
            return { message: `E-mail de ingresso reenviado com sucesso para ${saleData.userEmail}.` };
        } else {
            return { message: 'Este produto não é um ingresso, nenhum e-mail foi enviado.' };
        }

    } catch (error) {
        console.error('Erro ao reenviar e-mail de ingresso:', error);
        throw new functions.https.HttpsError('internal', 'Ocorreu um erro ao tentar reenviar o e-mail.');
    }
});

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
// const evoFunctions = require('./evo.js');
// Itera sobre as chaves do objeto evoFunctions e as exporta individualmente
// Isso garante que o Firebase Functions reconheça cada função corretamente.
// Object.keys(evoFunctions).forEach(key => {
//     exports[key] = evoFunctions[key];
// });
