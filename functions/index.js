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
                    const firstDoc = querySnapshot.docs[0];
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
        }
        return res.status(200).json({ status: 'not_paid', message: 'Payment not completed.' });
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

// Importa e exporta todas as funções do evo.js
const evoFunctions = require('./evo.js');
Object.assign(exports, evoFunctions);
