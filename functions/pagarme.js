const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios'); // Usaremos axios para as chamadas à API do Pagar.me

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

/**
 * Cria um pedido no Pagar.me para uma compra de produto.
 * @param {object} product - O objeto do produto do Firestore.
 * @param {Array} formDataList - Lista de dados dos compradores.
 * @param {number} totalAmount - O valor total da compra em centavos.
 * @param {Array} saleDocIds - Os IDs dos documentos de venda criados no Firestore.
 * @returns {object} - O objeto da sessão de checkout do Pagar.me.
 */
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
        }],
        payments: [{
            payment_method: 'checkout',
            checkout: {
                expires_in: 1800, // 30 minutos para expirar
                billing_address_editable: false,
                customer_editable: true,
                accepted_payment_methods: ['credit_card', 'pix', 'boleto'],
                success_url: `https://www.kihap.com.br/compra-success.html`,
                boleto: {
                    due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // Vencimento em 3 dias
                },
                pix: {
                    expires_in: 1800 // 30 minutos para expirar
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
        } else if (error.request) {
            console.error('Requisição do Erro:', error.request);
        } else {
            console.error('Mensagem de Erro:', error.message);
        }
        throw new functions.https.HttpsError('internal', 'Não foi possível criar a sessão de pagamento no Pagar.me.');
    }
};

/**
 * Busca um pedido no Pagar.me pelo ID.
 * @param {string} orderId - O ID do pedido no Pagar.me.
 * @returns {object} - O objeto do pedido.
 */
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

module.exports = {
    createPagarmeOrder,
    getPagarmeOrder
};
