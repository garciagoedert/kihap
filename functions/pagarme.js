const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios'); // Revertendo para axios

const db = admin.firestore();

const getPagarmeClient = () => {
    console.log('[getPagarmeClient] Criando uma nova instância do cliente Pagar.me (axios)...');
    const PAGARME_API_KEY = process.env.PAGARME_API_KEY;
    if (!PAGARME_API_KEY) {
        console.error('[getPagarmeClient] Erro Crítico: A variável de ambiente PAGARME_API_KEY não está definida.');
        throw new Error("A variável de ambiente PAGARME_API_KEY não está definida.");
    }
    console.log('[getPagarmeClient] Chave da API Pagar.me carregada com sucesso para esta requisição.');

    return axios.create({
        baseURL: 'https://api.pagar.me/core/v5',
        headers: {
            'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json'
        }
    });
};

// Helper to send WhatsApp message via Whapi (Duplicated from index.js to avoid circular dependency)
async function sendMessageHelper(to, body) {
    try {
        const token = process.env.WHAPI_TOKEN || (functions.config().whapi ? functions.config().whapi.token : null);
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
        return true;
    } catch (error) {
        console.error('[sendMessageHelper] Error:', error.message);
        return null;
    }
}

const createPagarmeOrder = async (product, formDataList, totalAmount, saleDocIds) => {
    console.log('[createPagarmeOrder] Iniciando a criação do pedido no Pagar.me.');
    const client = getPagarmeClient();
    const primaryBuyer = formDataList[0];

    const orderPayload = {
        customer: {
            name: primaryBuyer.userName,
            email: primaryBuyer.userEmail,
            document: primaryBuyer.userCpf.replace(/\D/g, '').padStart(11, '0'),
            type: 'individual',
            phones: {
                mobile_phone: {
                    country_code: '55',
                    area_code: primaryBuyer.userPhone.replace(/\D/g, '').substring(0, 2),
                    number: primaryBuyer.userPhone.replace(/\D/g, '').substring(2)
                }
            }
        },
        items: [{
            amount: totalAmount,
            description: `${product.name} (x${formDataList.length})`.substring(0, 64),
            quantity: 1,
            code: product.id // Correção para o erro "item.code"
        }],
        payments: [{
            payment_method: 'checkout',
            checkout: {
                expires_in: 1800, // 30 minutos
                billing_address_editable: false,
                customer_editable: true,
                accepted_payment_methods: ['credit_card', 'pix', 'boleto'],
                success_url: `https://www.kihap.com.br/compra-success.html`,
                boleto: {
                    due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // Vencimento em 3 dias
                },
                pix: {
                    expires_in: 1800 // 30 minutos
                },
                credit_card: {
                    installments: [
                        {
                            number: 1,
                            total: totalAmount
                        },
                        {
                            number: 2,
                            total: totalAmount
                        },
                        {
                            number: 3,
                            total: totalAmount
                        }
                    ]
                }
            }
        }],
        metadata: {
            firestoreDocIds: JSON.stringify(saleDocIds),
            type: 'product_purchase'
        }
    };

    // --- SPLIT PAYMENT LOGIC ---
    try {
        const primaryBuyer = formDataList[0];
        const userUnit = primaryBuyer.userUnit;

        console.log(`[createPagarmeOrder] Verificando regras de split para a unidade: ${userUnit}`);

        const splitConfigDoc = await db.collection('config').doc('payment_splits').get();
        if (splitConfigDoc.exists) {
            const splitConfig = splitConfigDoc.data();

            // Check if we have a recipient for this unit and for HQ
            const unitRecipientId = splitConfig.units && splitConfig.units[userUnit];
            const hqRecipientId = splitConfig.hq_recipient_id;
            const hqPercentage = splitConfig.hq_percentage || 10; // Default 10% if not set

            if (unitRecipientId && hqRecipientId) {
                console.log(`[createPagarmeOrder] Aplicando split: Unit (${unitRecipientId}) / HQ (${hqRecipientId} - ${hqPercentage}%)`);

                // Calculate split rules
                // IMPORTANT: Pagar.me expects rules that sum up to 100% OR total amount.
                // Using percentage is safer for consistency.

                orderPayload.items[0].code = product.id; // Ensure code is set correctly

                // Add split rules to the payment object
                // Note: Split rules are added specifically to the payment method in V5
                orderPayload.payments[0].split = [
                    {
                        recipient_id: hqRecipientId,
                        percentage: hqPercentage,
                        liable: true, // HQ is usually liable
                        charge_processing_fee: true // HQ pays fees? Or split? Configurable.
                    },
                    {
                        recipient_id: unitRecipientId,
                        percentage: 100 - hqPercentage,
                        liable: false, // Unit is not liable
                        charge_processing_fee: false // Unit receives net value
                    }
                ];
            } else {
                console.log('[createPagarmeOrder] Configuração de split incompleta ou não encontrada para esta unidade. Processando sem split.');
            }
        } else {
            console.log('[createPagarmeOrder] Documento de configuração de split (config/payment_splits) não encontrado.');
        }
    } catch (splitError) {
        console.error('[createPagarmeOrder] Erro ao aplicar regras de split:', splitError);
        // We continue without split to avoid blocking the sale, but log the error
    }
    // ---------------------------

    const orderPayloadToLog = { ...orderPayload };
    // Hide sensitive data if necessary
    console.log('[createPagarmeOrder] Payload do pedido a ser enviado:', JSON.stringify(orderPayloadToLog, null, 2));

    return axios.create({ // Re-create client inside here to ensure fresh config if needed or just use the helper
        baseURL: 'https://api.pagar.me/core/v5',
        headers: {
            'Authorization': `Basic ${Buffer.from(process.env.PAGARME_API_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json'
        }
    }).post('/orders', orderPayload)
        .then(response => {
            const order = response.data;
            console.log('[createPagarmeOrder] Pedido criado com sucesso no Pagar.me. Resposta:', JSON.stringify(order, null, 2));
            return order;
        })
        .catch(error => {
            console.error('Erro detalhado ao criar pedido no Pagar.me:');
            if (error.response) {
                console.error('Dados do Erro:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        });
}; // End of function replacement to encompass the return which was slightly different in original code usage structure vs my edit


const getPagarmeOrder = async (orderId) => {
    const client = getPagarmeClient();
    try {
        const response = await client.get(`/orders/${orderId}`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao buscar pedido ${orderId} no Pagar.me:`, error.response ? error.response.data : error.message);
        throw new functions.https.HttpsError('internal', 'Não foi possível verificar o status do pagamento.');
    }
};

const syncPagarmeSalesStatus = async () => {
    console.log('[syncPagarmeSalesStatus] Iniciando a sincronização de status de vendas do Pagar.me.');
    try {
        const salesRef = db.collection('inscricoesFaixaPreta');
        const snapshot = await salesRef.where('paymentStatus', '==', 'pending').get();

        // Fetch WhatsApp Config for Welcome Message
        let whatsappConfig = {};
        try {
            const configDoc = await db.collection('config').doc('whatsapp_auto_reply').get();
            if (configDoc.exists) {
                whatsappConfig = configDoc.data();
            }
        } catch (e) {
            console.warn('[syncPagarmeSalesStatus] Could not fetch whatsapp config:', e);
        }

        const enrollmentIds = [
            whatsappConfig.enrollment_product_id_brasilia,
            whatsappConfig.enrollment_product_id_floripa,
            whatsappConfig.enrollment_product_id_dourados
        ].filter(id => id); // Filter out empty strings

        if (snapshot.empty) {
            console.log('[syncPagarmeSalesStatus] Nenhuma venda pendente encontrada para sincronizar.');
            return { message: 'Nenhuma venda pendente para sincronizar.' };
        }

        console.log(`[syncPagarmeSalesStatus] ${snapshot.size} vendas pendentes encontradas. Verificando...`);

        let updatedCount = 0;
        const promises = snapshot.docs.map(async (doc) => {
            const sale = doc.data();
            if (sale.pagarmeOrderId) {
                try {
                    console.log(`[syncPagarmeSalesStatus] Verificando pedido ${sale.pagarmeOrderId} para venda ${doc.id}`);
                    const order = await getPagarmeOrder(sale.pagarmeOrderId);
                    let newStatus = null;

                    if (order.status === 'paid') newStatus = 'paid';
                    else if (order.status === 'canceled') newStatus = 'canceled';
                    else if (order.status === 'failed') newStatus = 'failed';

                    if (newStatus && sale.paymentStatus !== newStatus) {
                        await doc.ref.update({ paymentStatus: newStatus });
                        updatedCount++;
                        console.log(`[syncPagarmeSalesStatus] Venda ${doc.id} atualizada para '${newStatus}'.`);

                        // CHECK IF ENROLLMENT AND SEND WELCOME MESSAGE
                        if (newStatus === 'paid' && enrollmentIds.includes(sale.productId)) {
                            console.log(`[syncPagarmeSalesStatus] Venda ${doc.id} identificada como MATRÍCULA. Enviando boas-vindas...`);
                            if (sale.userPhone) {
                                // Clean phone
                                let targetPhone = sale.userPhone.replace(/\D/g, '');
                                if (targetPhone.length >= 10 && targetPhone.length <= 11) {
                                    targetPhone = '55' + targetPhone; // Assume BR if not present
                                }

                                const welcomeMsg = whatsappConfig.welcome_new_student_message || "Parabéns pela matrícula! Seja bem-vindo!";
                                await sendMessageHelper(targetPhone, welcomeMsg);
                            } else {
                                console.warn(`[syncPagarmeSalesStatus] Venda ${doc.id} sem telefone para enviar mensagem.`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`[syncPagarmeSalesStatus] Erro ao verificar o pedido ${sale.pagarmeOrderId}:`, error);
                }
            }
        });

        await Promise.all(promises);
        const message = `Sincronização concluída. ${updatedCount} vendas foram atualizadas.`;
        console.log(`[syncPagarmeSalesStatus] ${message}`);
        return { message };
    } catch (error) {
        console.error('[syncPagarmeSalesStatus] Erro fatal na função de sincronização:', error);
        throw new functions.https.HttpsError('internal', `Erro ao sincronizar: ${error.message}`);
    }
};

const cancelPagarmeSubscription = async (subscriptionId) => {
    console.log(`[cancelPagarmeSubscription] Cancelando assinatura ${subscriptionId}`);
    const client = getPagarmeClient();

    try {
        const response = await client.delete(`/subscriptions/${subscriptionId}`);
        console.log(`[cancelPagarmeSubscription] Assinatura ${subscriptionId} cancelada com sucesso.`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao cancelar assinatura ${subscriptionId}:`, error.response ? error.response.data : error.message);
        throw new functions.https.HttpsError('internal', 'Não foi possível cancelar a assinatura no Pagar.me.');
    }
};

const createPagarmeSubscription = async (customerData, paymentMethod, planId, cardData) => {
    console.log('[createPagarmeSubscription] Iniciando criação de assinatura.');
    const client = getPagarmeClient();

    // 1. Criar ou atualizar cliente no Pagar.me (simplificado: sempre tenta criar, se falhar por duplicidade, busca - mas aqui vamos assumir criação direta ou passar ID se já tivermos)
    // Na verdade, para simplificar e garantir, vamos passar os dados do cliente na criação da assinatura se não tivermos o ID dele no Pagar.me.
    // Mas a API v5 permite passar o objeto customer completo.

    const subscriptionPayload = {
        customer: {
            name: customerData.name,
            email: customerData.email,
            document: customerData.document.replace(/\D/g, ''),
            type: 'individual',
            phones: {
                mobile_phone: {
                    country_code: '55',
                    area_code: customerData.phone.replace(/\D/g, '').substring(0, 2),
                    number: customerData.phone.replace(/\D/g, '').substring(2)
                }
            }
        },
        plan_id: planId,
        payment_method: paymentMethod, // 'credit_card'
        card: cardData, // Objeto com dados do cartão (criptografados ou não, dependendo se usarmos token. Aqui assumiremos dados brutos por enquanto conforme pedido, mas o ideal é token)
        // Se for boleto, não tem card.
    };

    if (paymentMethod === 'credit_card') {
        subscriptionPayload.card = cardData;
    }

    console.log('[createPagarmeSubscription] Payload:', JSON.stringify(subscriptionPayload, null, 2));

    try {
        const response = await client.post('/subscriptions', subscriptionPayload);
        const subscription = response.data;
        console.log('[createPagarmeSubscription] Assinatura criada:', subscription.id);
        return subscription;
    } catch (error) {
        console.error('Erro ao criar assinatura no Pagar.me:');
        if (error.response) {
            console.error('Dados do Erro:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Mensagem de Erro:', error.message);
        }
        throw new functions.https.HttpsError('internal', 'Não foi possível criar a assinatura no Pagar.me.');
    }
};

module.exports = {
    createPagarmeOrder,
    getPagarmeOrder,
    syncPagarmeSalesStatus,
    createPagarmeSubscription,
    cancelPagarmeSubscription
};
