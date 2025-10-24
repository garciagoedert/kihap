const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')('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'); // Chave Secreta de Produção

admin.initializeApp();
const db = admin.firestore();

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

    const { userName, userEmail, userPhone, userCpf, userUnit, userId, productId } = req.body;

    if (!userName || !userEmail || !productId || !userCpf || !userUnit) {
        return res.status(400).send('Missing required fields: userName, userEmail, productId, userCpf, userUnit.');
    }

    try {
        // 1. Buscar o produto no Firestore
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            return res.status(404).send('Product not found.');
        }

        const product = productDoc.data();
        const amount = product.price; // price in cents from Firestore
        const productName = product.name;
        const currency = 'brl'; // Assuming BRL, or you can add it to the product data

        // 2. Salvar os dados da inscrição/venda no Firestore
        const saleData = {
            userId: userId,
            userName: userName,
            userEmail: userEmail,
            userPhone: userPhone,
            userCpf: userCpf,
            userUnit: userUnit,
            productId: productId,
            productName: productName,
            amountTotal: amount,
            currency: currency,
            paymentStatus: 'pending',
            created: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('inscricoesFaixaPreta').add(saleData);
        console.log('Sale saved to Firestore with ID:', docRef.id);

        // 3. Criar a sessão de checkout do Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency,
                        product_data: {
                            name: productName,
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `https://www.kihap.com.br/compra-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: 'https://www.kihap.com.br/produto.html?id=${productId}',
            metadata: {
                firestoreDocId: docRef.id,
                userId: userId,
                userName: userName,
                userEmail: userEmail,
                userPhone: userPhone,
                productName: productName,
            },
        });

        // Atualiza o documento no Firestore com o ID da sessão do Stripe
        await docRef.update({ checkoutSessionId: session.id });

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
            const firestoreDocId = session.metadata.firestoreDocId;
            if (firestoreDocId) {
                const docRef = db.collection('inscricoesFaixaPreta').doc(firestoreDocId);
                await docRef.update({ paymentStatus: 'paid' });
                console.log(`Updated payment status to 'paid' for doc ${firestoreDocId}`);
                return res.status(200).json({ status: 'success', message: 'Payment verified and status updated.' });
            } else {
                // Fallback para sessões antigas sem o ID do documento nos metadados
                const querySnapshot = await db.collection('inscricoesFaixaPreta').where('checkoutSessionId', '==', sessionId).limit(1).get();
                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    await doc.ref.update({ paymentStatus: 'paid' });
                    console.log(`Updated payment status to 'paid' for doc ${doc.id} (fallback)`);
                    return res.status(200).json({ status: 'success', message: 'Payment verified and status updated.' });
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
