const axios = require('axios');
const admin = require('firebase-admin');

const getMPClient = () => {
    const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
        throw new Error("A variável de ambiente MERCADOPAGO_ACCESS_TOKEN não está definida.");
    }
    return axios.create({
        baseURL: 'https://api.mercadopago.com',
        headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
};

const createMercadoPagoPreference = async (product, formDataList, totalAmount, saleDocIds) => {
    console.log('[createMercadoPagoPreference] Iniciando criação da preferência...');
    const client = getMPClient();

    // Map items
    const items = formDataList.map(formData => {
        return {
            id: product.id,
            title: product.name,
            unit_price: formData.priceData.amount / 100, // O valor no Firebase (amount) está em centavos, MP espera decimal (Ex: 50.00)
            quantity: 1,
            currency_id: 'BRL',
            description: formData.variantName || 'Item da Loja'
        };
    });

    const primaryBuyerData = formDataList[0];

    const preferenceData = {
        items: items,
        payer: {
            name: primaryBuyerData.userName,
            email: primaryBuyerData.userEmail,
        },
        external_reference: saleDocIds.join(','),
        metadata: {
            firestoreDocIds: saleDocIds.join(',')
        },
        back_urls: {
            success: "https://www.kihap.com.br/compra-success.html",
            failure: "https://www.kihap.com.br/compra-error.html",
            pending: "https://www.kihap.com.br/compra-success.html"
        },
        auto_return: "approved"
        // notification_url is set via Webhook separately if needed
    };

    try {
        const response = await client.post('/checkout/preferences', preferenceData);
        console.log('[createMercadoPagoPreference] Preferência criada com sucesso:', response.data.id);
        return response.data;
    } catch (error) {
        console.error('[createMercadoPagoPreference] Erro:', error.response?.data || error.message);
        throw error;
    }
};

const getMercadoPagoPayment = async (paymentId) => {
    const client = getMPClient();
    try {
        const response = await client.get(`/v1/payments/${paymentId}`);
        return response.data;
    } catch (error) {
        console.error(`[getMercadoPagoPayment] Erro ao buscar pagamento ${paymentId}:`, error.response?.data || error.message);
        throw error;
    }
};

const getMercadoPagoPreference = async (preferenceId) => {
    const client = getMPClient();
    try {
        const response = await client.get(`/checkout/preferences/${preferenceId}`);
        return response.data;
    } catch (error) {
        console.error(`[getMercadoPagoPreference] Erro ao buscar preferência ${preferenceId}:`, error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    createMercadoPagoPreference,
    getMercadoPagoPayment,
    getMercadoPagoPreference
};
