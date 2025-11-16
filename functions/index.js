// Forçando a atualização do ambiente - v2
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(functions.config().stripe.secret_key);
const nodemailer = require('nodemailer');
const qrcode = require('qrcode');

admin.initializeApp();
const db = admin.firestore();

// Função para enviar o e-mail com o ingresso
const sendTicketEmail = async (saleId, saleData) => {
    // Lazy initialization do transporter para evitar erro de config no deploy
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: functions.config().gmail.email,
            pass: functions.config().gmail.password,
        },
    });

    try {
        const qrCodeDataURL = await qrcode.toDataURL(saleId);
        
        const mailOptions = {
            from: `Kihap <${functions.config().gmail.email}>`,
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

        await transporter.sendMail(mailOptions);
        console.log(`E-mail de ingresso enviado para ${saleData.userEmail} para a venda ${saleId}`);
    } catch (error) {
        console.error(`Erro ao enviar e-mail de ingresso para ${saleData.userEmail}:`, error);
    }
};


// Cloud Function para criar a sessão de checkout do Stripe
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
    // Permitir CORS para o frontend
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

    const { formDataList, productId, totalAmount, couponCode, recommendedItems } = req.body;

    if (!formDataList || !productId || !totalAmount || formDataList.length === 0) {
        return res.status(400).json({ error: 'Missing required fields: formDataList, productId, totalAmount.' });
    }

    try {
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();
        if (!productDoc.exists) {
            return res.status(404).send('Product not found.');
        }
        const product = productDoc.data();
        const currency = 'brl';

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

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: currency,
                    product_data: {
                        name: `${product.name} (x${formDataList.length})`,
                    },
                    unit_amount: totalAmount,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://www.kihap.com.br/compra-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://www.kihap.com.br/produto.html?id=${productId}`,
            metadata: {
                firestoreDocIds: JSON.stringify(saleDocIds),
            },
        });

        // Update all sale documents with the checkout session ID
        for (const docId of saleDocIds) {
            await db.collection('inscricoesFaixaPreta').doc(docId).update({ checkoutSessionId: session.id });
        }

        res.status(200).json({ sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Nova Cloud Function para verificar o pagamento na página de sucesso
exports.verifyPayment = functions.https.onRequest(async (req, res) => {
    // Permitir CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).send('Session ID is required.');
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            let firestoreDocIds;
            let attempt = 0;
            const maxAttempts = 4; // Try for ~3 seconds

            while (attempt < maxAttempts) {
                // Re-fetch session inside the loop to ensure metadata is fresh
                const refreshedSession = await stripe.checkout.sessions.retrieve(sessionId);
                const firestoreDocIdsString = refreshedSession.metadata.firestoreDocIds;

                if (firestoreDocIdsString) {
                    firestoreDocIds = JSON.parse(firestoreDocIdsString);
                    break; // Found via metadata, exit loop
                }

                // Fallback if metadata is not present
                const querySnapshot = await db.collection('inscricoesFaixaPreta').where('checkoutSessionId', '==', sessionId).get();
                if (!querySnapshot.empty) {
                    firestoreDocIds = querySnapshot.docs.map(doc => doc.id);
                    break; // Found via fallback, exit loop
                }

                attempt++;
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                }
            }

            if (firestoreDocIds && firestoreDocIds.length > 0) {
                for (const docId of firestoreDocIds) {
                    const docRef = db.collection('inscricoesFaixaPreta').doc(docId);
                    const saleSnap = await docRef.get();

                    // Only update if status is 'pending' to avoid redundant triggers
                    if (saleSnap.exists() && saleSnap.data().paymentStatus === 'pending') {
                        await docRef.update({ paymentStatus: 'paid' });
                        console.log(`Updated payment status to 'paid' for doc ${docId}`);

                        const saleData = saleSnap.data();
                        const productRef = db.collection('products').doc(saleData.productId);
                        const productSnap = await productRef.get();
                        if (productSnap.exists() && productSnap.data().isTicket) {
                            await sendTicketEmail(docId, saleData);
                        }
                    }
                }
                return res.status(200).json({ status: 'success', saleIds: firestoreDocIds, message: 'All payments verified and statuses updated.' });
            } else {
                console.error(`Critical: Payment success for session ${sessionId}, but no corresponding Firestore docs found after ${maxAttempts} attempts.`);
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

// Webhook para lidar com eventos do Stripe em tempo real
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe.webhook_secret;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('⚠️  Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lida com o evento de checkout bem-sucedido
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // A lógica de repetição para garantir que os documentos do Firestore sejam encontrados
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

                if (saleSnap.exists() && saleSnap.data().paymentStatus === 'pending') {
                    await docRef.update({ paymentStatus: 'paid' });
                    console.log(`Webhook: Status atualizado para 'pago' para a venda ${docId}`);

                    const saleData = saleSnap.data();
                    const productRef = db.collection('products').doc(saleData.productId);
                    const productSnap = await productRef.get();
                    if (productSnap.exists() && productSnap.data().isTicket) {
                        await sendTicketEmail(docId, saleData);
                    }
                }
            }
        } else {
            console.error(`Critical Webhook Error: Checkout session ${session.id} bem-sucedida, mas documentos no Firestore não encontrados.`);
        }
    }

    res.status(200).send();
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
            await db.collection('inscricoesFaixaPreta').add(saleData);
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
                const session = await stripe.checkout.sessions.retrieve(sessionId);
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


// Cloud Function para criar uma sessão de checkout para assinatura (versão robusta)
exports.createSubscriptionCheckout = functions.https.onCall(async (data, context) => {
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
        if (!userSnap.exists()) {
            console.error(`Usuário ${userId} autenticado mas não encontrado no Firestore.`);
            throw new functions.https.HttpsError('not-found', 'Não foi possível encontrar os dados do usuário.');
        }
        
        const userData = userSnap.data();
        let customerId = userData.stripeCustomerId;

        // 3. Criação de Cliente Stripe (se necessário)
        if (!customerId) {
            console.log(`Criando novo cliente Stripe para o usuário ${userId}`);
            const customer = await stripe.customers.create({
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
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `https://www.kihap.com.br/members/index.html?subscription_success=true`,
            cancel_url: `https://www.kihap.com.br/members/assinatura.html`,
            metadata: { firebaseUID: userId }
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
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado.');
    }

    const userId = context.auth.uid;

    try {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists()) {
            console.error(`Usuário ${userId} autenticado mas não encontrado no Firestore ao tentar acessar o portal.`);
            throw new functions.https.HttpsError('not-found', 'Não foi possível encontrar os dados do usuário.');
        }

        const userData = userSnap.data();
        const customerId = userData.stripeCustomerId;

        if (!customerId) {
            throw new functions.https.HttpsError('not-found', 'Nenhum cliente Stripe encontrado para este usuário.');
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `https://www.kihap.com.br/members/perfil.html`,
        });

        return { url: portalSession.url };

    } catch (error) {
        console.error("Erro ao criar a sessão do portal do cliente:", error);
        throw new functions.https.HttpsError('internal', 'Não foi possível acessar o portal do cliente.');
    }
});

// Cloud Function para lidar com os webhooks da Stripe
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe.webhook_secret;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('⚠️  Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lida com o evento
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const userId = session.metadata.firebaseUID;
            const subscriptionId = session.subscription;

            // Atualiza o documento do usuário com o ID da assinatura e o status
            await db.collection('users').doc(userId).update({
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: 'active'
            });
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
            }
            break;
        }
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).send();
});


// Importa e exporta todas as funções do evo.js
const evoFunctions = require('./evo.js');
// Itera sobre as chaves do objeto evoFunctions e as exporta individualmente
// Isso garante que o Firebase Functions reconheça cada função corretamente.
Object.keys(evoFunctions).forEach(key => {
    exports[key] = evoFunctions[key];
});
