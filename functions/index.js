const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')('sk_test_51SL5x1FzkLWBAYFuXrxzbncorzQSCGlyqHg04GAF2jEBMrfnAvXe78JGaB2AFzEKhXzYRpreZJXcYsaxn5O1IDkh00cPcfOYtn'); // Substitua pela sua chave secreta do Stripe

admin.initializeApp();
const db = admin.firestore();

// Cloud Function para criar a sessão de checkout do Stripe
// Forçando a reimplementação para atualizar as permissões
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

    const { userName, userEmail, userPhone, userId, amount, currency, productName } = req.body;

    if (!amount || !currency || !productName) {
        return res.status(400).send('Missing required payment details.');
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency,
                        product_data: {
                            name: productName,
                        },
                        unit_amount: amount, // amount in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: 'https://kihap.com.br/faixa-preta-success.html?session_id={CHECKOUT_SESSION_ID}', // Substitua pelo seu domínio
            cancel_url: 'https://kihap.com.br/faixa-preta.html', // Substitua pelo seu domínio
            metadata: {
                userId: userId,
                userName: userName,
                userEmail: userEmail,
                userPhone: userPhone,
                productName: productName,
            },
        });

        res.status(200).json({ sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cloud Function (webhook) para lidar com eventos do Stripe
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, 'whsec_ZPO25QQbdYRxBr9Faa5CS03EgFFKan7J'); // Substitua pelo seu endpoint secret
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('Checkout session completed:', session);

            // Salvar os dados da inscrição no Firestore
            const inscriptionData = {
                userId: session.metadata.userId,
                userName: session.metadata.userName,
                userEmail: session.metadata.userEmail,
                userPhone: session.metadata.userPhone,
                productName: session.metadata.productName,
                amountTotal: session.amount_total,
                currency: session.currency,
                paymentStatus: session.payment_status,
                checkoutSessionId: session.id,
                created: admin.firestore.FieldValue.serverTimestamp(),
            };

            try {
                await db.collection('inscricoesFaixaPreta').add(inscriptionData);
                console.log('Inscription saved to Firestore:', inscriptionData);
            } catch (error) {
                console.error('Error saving inscription to Firestore:', error);
                return res.status(500).send('Error saving inscription');
            }
            break;
        // Outros tipos de eventos podem ser tratados aqui
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).send('OK');
});
