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
                recommendedItems: recommendedItems || [],
                created: admin.firestore.FieldValue.serverTimestamp(),
            };
            const docRef = await db.collection('inscricoesFaixaPreta').add(saleData);
            saleDocIds.push(docRef.id);
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
            const firestoreDocIdsString = session.metadata.firestoreDocIds;
            if (firestoreDocIdsString) {
                const firestoreDocIds = JSON.parse(firestoreDocIdsString);
                for (const docId of firestoreDocIds) {
                    const docRef = db.collection('inscricoesFaixaPreta').doc(docId);
                    await docRef.update({ paymentStatus: 'paid' });
                    console.log(`Updated payment status to 'paid' for doc ${docId}`);

                    // Após confirmar o pagamento, verifica se é um ingresso e envia o e-mail
                    const saleSnap = await docRef.get();
                    if (saleSnap.exists()) {
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
                // Fallback for older sessions
                const querySnapshot = await db.collection('inscricoesFaixaPreta').where('checkoutSessionId', '==', sessionId).get();
                if (!querySnapshot.empty) {
                    for (const doc of querySnapshot.docs) {
                        await doc.ref.update({ paymentStatus: 'paid' });
                        console.log(`Updated payment status to 'paid' for doc ${doc.id} (fallback)`);
                        
                        // Envia e-mail de ingresso no fallback também
                        const saleData = doc.data();
                        const productRef = db.collection('products').doc(saleData.productId);
                        const productSnap = await productRef.get();
                        if (productSnap.exists() && productSnap.data().isTicket) {
                            await sendTicketEmail(doc.id, saleData);
                        }
                    }
                    const allDocIds = querySnapshot.docs.map(doc => doc.id);
                    return res.status(200).json({ status: 'success', saleIds: allDocIds, message: 'Payment verified and status updated (fallback).' });
                }
            }
        } else {
            return res.status(200).json({ status: 'not_paid', message: 'Payment not completed.' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// A função de webhook não está sendo utilizada e pode ser removida.

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
                recommendedItems: recommendedItems || [],
                created: admin.firestore.FieldValue.serverTimestamp(),
            };
            await db.collection('inscricoesFaixaPreta').add(saleData);
        }

        res.status(200).json({ status: 'success', message: 'Free purchase processed successfully.' });
    } catch (error) {
        console.error('Error processing free purchase:', error);
        res.status(500).json({ error: error.message });
    }
});

// Função para corrigir o status de pagamentos antigos
exports.fixOldSalesStatus = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*'); // Permitir CORS para ser chamado do navegador

    // Uma chave secreta simples para evitar execuções acidentais.
    const SECRET_KEY = "kihap-corrige"; // Você pode mudar isso se quiser
    if (req.query.secret !== SECRET_KEY) {
        return res.status(403).send('Acesso não autorizado.');
    }

    try {
        console.log('Iniciando processo para corrigir status de vendas antigas...');
        const salesRef = db.collection('inscricoesFaixaPreta');
        
        // 1. Encontrar todas as vendas pendentes que têm um ID de sessão do Stripe
        const pendingSalesSnapshot = await salesRef.where('paymentStatus', '==', 'pending').get();

        if (pendingSalesSnapshot.empty) {
            console.log('Nenhuma venda pendente encontrada para processar.');
            return res.status(200).send('Nenhuma venda pendente encontrada para processar.');
        }

        // 2. Agrupar vendas pendentes por checkoutSessionId
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

        // 3. Iterar sobre cada sessão que tem vendas pendentes
        for (const sessionId in salesBySession) {
            // 4. Verificar se existe PELO MENOS UMA venda paga para esta mesma sessão
            const paidSaleSnapshot = await salesRef
                .where('checkoutSessionId', '==', sessionId)
                .where('paymentStatus', '==', 'paid')
                .limit(1)
                .get();

            // 5. Se encontrarmos uma venda paga, significa que o pagamento da sessão foi bem-sucedido
            if (!paidSaleSnapshot.empty) {
                const pendingSalesInSession = salesBySession[sessionId];
                console.log(`Sessão ${sessionId} tem um pagamento confirmado. Corrigindo ${pendingSalesInSession.length} venda(s) pendente(s).`);

                // Atualiza todas as vendas pendentes desta sessão para "pago"
                for (const pendingSale of pendingSalesInSession) {
                    await salesRef.doc(pendingSale.id).update({ paymentStatus: 'paid' });
                    updatedCount++;
                    console.log(`Status da venda ${pendingSale.id} atualizado para 'pago'.`);
                }
            }
        }

        const message = `Processo concluído. ${updatedCount} venda(s) foram atualizadas.`;
        console.log(message);
        return res.status(200).send(message);

    } catch (error) {
        console.error('Erro ao corrigir status de vendas antigas:', error);
        return res.status(500).send('Ocorreu um erro durante o processo. Verifique os logs da função.');
    }
});


// Importa e exporta todas as funções do evo.js
const evoFunctions = require('./evo.js');
// Itera sobre as chaves do objeto evoFunctions e as exporta individualmente
// Isso garante que o Firebase Functions reconheça cada função corretamente.
Object.keys(evoFunctions).forEach(key => {
    exports[key] = evoFunctions[key];
});
