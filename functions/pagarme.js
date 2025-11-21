const functions = require('firebase-functions');
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
                }
            }
        }],
        metadata: {
            firestoreDocIds: JSON.stringify(saleDocIds),
            type: 'product_purchase'
        }
    };

    console.log('[createPagarmeOrder] Payload do pedido a ser enviado:', JSON.stringify(orderPayload, null, 2));

    try {
        const response = await client.post('/orders', orderPayload);
        const order = response.data;
        console.log('[createPagarmeOrder] Pedido criado com sucesso no Pagar.me. Resposta:', JSON.stringify(order, null, 2));
        return order;
    } catch (error) {
        console.error('Erro detalhado ao criar pedido no Pagar.me:');
        if (error.response) {
            console.error('Dados do Erro:', JSON.stringify(error.response.data, null, 2));
            console.error('Status do Erro:', error.response.status);
            console.error('Headers do Erro:', JSON.stringify(error.response.headers, null, 2));
        } else {
            console.error('Mensagem de Erro:', error.message);
        }
        throw new functions.https.HttpsError('internal', 'Não foi possível criar a sessão de pagamento no Pagar.me.');
    }
};

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

module.exports = {
    createPagarmeOrder,
    getPagarmeOrder,
    syncPagarmeSalesStatus
};
