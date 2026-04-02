const axios = require('axios');
const admin = require('firebase-admin');

const getMPClient = (customToken = null) => {
    const MP_ACCESS_TOKEN = customToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
        throw new Error("A variável de ambiente MERCADOPAGO_ACCESS_TOKEN não está definida e nenhum token foi providenciado.");
    }
    return axios.create({
        baseURL: 'https://api.mercadopago.com',
        headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
};

const exchangeOAuthCode = async (code, redirectUri) => {
    const MP_APP_ID = process.env.MERCADOPAGO_APP_ID;
    const MP_CLIENT_SECRET = process.env.MERCADOPAGO_CLIENT_SECRET;
    
    if (!MP_APP_ID || !MP_CLIENT_SECRET) {
        throw new Error("MERCADOPAGO_APP_ID ou MERCADOPAGO_CLIENT_SECRET não definidos no .env.");
    }
    
    const response = await axios.post('https://api.mercadopago.com/oauth/token', {
        client_secret: MP_CLIENT_SECRET,
        client_id: MP_APP_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
    }, {
        headers: { 'Content-Type': 'application/json' }
    });

    return response.data;
};

const createMercadoPagoPreference = async (product, formDataList, totalAmount, saleDocIds, notificationUrl = null) => {
    console.log('[createMercadoPagoPreference] Iniciando criação da preferência...');
    
    // Suporte a Split / Multi-Contas
    let clientToken = null;
    let marketplaceFee = 0;

    if (product.mpAccountId && product.mpAccountId !== 'default') {
        try {
            const accountDoc = await admin.firestore().collection('mercadopagoAccounts').doc(product.mpAccountId).get();
            if (accountDoc.exists) {
                clientToken = accountDoc.data().accessToken;
                console.log(`[createMercadoPagoPreference] Usando conta MP customizada: ${product.mpAccountId}`);
                
                // Se definiu split para a conta Matriz
                if (product.mpSplitPercentage && product.mpSplitPercentage > 0) {
                    marketplaceFee = (totalAmount / 100) * (product.mpSplitPercentage / 100);
                    console.log(`[createMercadoPagoPreference] Split aplicado: ${product.mpSplitPercentage}% (${marketplaceFee} BRL) para a Matriz HQ.`);
                }
            } else {
                console.warn(`[createMercadoPagoPreference] Conta MP customizada '${product.mpAccountId}' não encontrada. Usando Matriz.`);
            }
        } catch (e) {
            console.error(`[createMercadoPagoPreference] Erro ao buscar conta customizada: ${e.message}`);
        }
    }

    const client = getMPClient(clientToken);

    if (product.isSubscription) {
        console.log('[createMercadoPagoPreference] Produto é uma assinatura. Roteando para a API Preapproval.');
        const primaryBuyerData = formDataList[0];
        
        const preapprovalData = {
            reason: product.name,
            external_reference: saleDocIds.join(','),
            payer_email: primaryBuyerData.userEmail,
            auto_recurring: {
                frequency: product.subscriptionFrequency || 1,
                frequency_type: product.subscriptionPeriod || 'months',
                transaction_amount: totalAmount / 100, // Preço convertido de centavos
                currency_id: 'BRL'
            },
            back_url: "https://www.kihap.com.br/compra-success.html",
            status: "pending"
        };

        if (notificationUrl) preapprovalData.notification_url = notificationUrl;

        try {
            const response = await client.post('/preapproval', preapprovalData);
            console.log('[createMercadoPagoPreference] Assinatura/Preapproval criada com sucesso:', response.data.id);
            return response.data; // contém o init_point
        } catch (error) {
            console.error('[createMercadoPagoPreference] Erro na Assinatura:', error.response?.data || error.message);
            throw error;
        }

    } else {
        // Fluxo normal de Compra Avulsa (Checkout Pro)
        const items = formDataList.map(formData => {
            return {
                id: product.id,
                title: product.name,
                unit_price: formData.priceData.amount / 100,
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
                success: "https://kihap.com.br/compra-success",
                failure: "https://kihap.com.br/cart",
                pending: "https://kihap.com.br/compra-success"
            },
            auto_return: "approved"
        };

        if (notificationUrl) preferenceData.notification_url = notificationUrl;

        if (marketplaceFee > 0) {
            preferenceData.marketplace_fee = marketplaceFee;
        }

        try {
            const response = await client.post('/checkout/preferences', preferenceData);
            console.log('[createMercadoPagoPreference] Preferência criada com sucesso:', response.data.id);
            return response.data; // contém o init_point
        } catch (error) {
            console.error('[createMercadoPagoPreference] Erro:', error.response?.data || error.message);
            throw error;
        }
    }
};

const createCartMercadoPagoPreference = async (cartItems, totalAmount, saleDocIds, notificationUrl = null, globalUserData = null) => {
    console.log('[createCartMercadoPagoPreference] Iniciando...');
    
    // Simplificamos sem o split para diferentes contas no carrinho
    const client = getMPClient(); 
    
    const items = [];
    
    cartItems.forEach(cartItem => {
        if(cartItem.formDataList) {
            cartItem.formDataList.forEach(formData => {
                items.push({
                    id: cartItem.productId,
                    title: cartItem.productName,
                    unit_price: formData.priceData.amount / 100,
                    quantity: 1,
                    currency_id: 'BRL',
                    description: (formData.priceData && formData.priceData.variantName) ? formData.priceData.variantName : 'Item da Loja'
                });
            });
        }
        
        if (cartItem.recommendedItems) {
            cartItem.recommendedItems.forEach(rec => {
                items.push({
                    id: rec.productId,
                    title: rec.productName,
                    unit_price: (rec.amount / rec.quantity) / 100,
                    quantity: rec.quantity,
                    currency_id: 'BRL',
                    description: 'Comprado Junto'
                });
            });
        }
    });

    let primaryBuyerName = "Cliente";
    let primaryBuyerEmail = "contato@kihap.com.br";

    if (globalUserData) {
        primaryBuyerName = globalUserData.userName || "Cliente";
        primaryBuyerEmail = globalUserData.userEmail || "contato@kihap.com.br";
    } else if (cartItems.length > 0 && cartItems[0].formDataList && cartItems[0].formDataList.length > 0) {
        primaryBuyerName = cartItems[0].formDataList[0].userName || "Cliente";
        primaryBuyerEmail = cartItems[0].formDataList[0].userEmail || "contato@kihap.com.br";
    }

    const preferenceData = {
        items: items,
        payer: {
            name: primaryBuyerName,
            email: primaryBuyerEmail,
        },
        external_reference: saleDocIds.join(','),
        metadata: {
            firestoreDocIds: saleDocIds.join(',')
        },
        back_urls: {
            success: "https://kihap.com.br/compra-success",
            failure: "https://kihap.com.br/cart",
            pending: "https://kihap.com.br/compra-success"
        },
        auto_return: "approved"
    };

    if (notificationUrl) preferenceData.notification_url = notificationUrl;

    try {
        const response = await client.post('/checkout/preferences', preferenceData);
        console.log('[createCartMercadoPagoPreference] Preferência do carrinho criada:', response.data.id);
        return response.data;
    } catch (error) {
        console.error('[createCartMercadoPagoPreference] Erro:', error.response?.data || error.message);
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

const searchMercadoPagoPayments = async (externalReference) => {
    const client = getMPClient();
    try {
        // Busca pagamentos por external_reference
        const response = await client.get(`/v1/payments/search`, {
            params: {
                external_reference: externalReference
            }
        });
        return response.data.results; // array de pagamentos
    } catch (error) {
        console.error(`[searchMercadoPagoPayments] Erro ao buscar pagamentos para ${externalReference}:`, error.response?.data || error.message);
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

const getPreapprovalStatus = async (preapprovalId, customToken = null) => {
    const client = getMPClient(customToken);
    try {
        const response = await client.get(`/preapproval/${preapprovalId}`);
        return response.data;
    } catch (error) {
        console.error(`[getPreapprovalStatus] Erro ao buscar preapproval ${preapprovalId}:`, error.response?.data || error.message);
        throw error;
    }
};

const cancelPreapproval = async (preapprovalId, customToken = null) => {
    const client = getMPClient(customToken);
    try {
        const response = await client.put(`/preapproval/${preapprovalId}`, { status: 'cancelled' });
        return response.data;
    } catch (error) {
        console.error(`[cancelPreapproval] Erro ao cancelar preapproval ${preapprovalId}:`, error.response?.data || error.message);
        throw error;
    }
};

const createTuitionPreapproval = async (planName, amountCentavos, userEmail, customToken, frequency = 1, frequencyType = 'months', notificationUrl = null) => {
    const client = getMPClient(customToken);
    
    const preapprovalData = {
        reason: planName,
        payer_email: userEmail,
        auto_recurring: {
            frequency: frequency,
            frequency_type: frequencyType,
            transaction_amount: amountCentavos / 100, // Preço convertido de centavos
            currency_id: 'BRL'
        },
        back_url: "https://www.kihap.com.br/members/assinatura.html",
        status: "pending"
    };

    if (notificationUrl) preapprovalData.notification_url = notificationUrl;

    try {
        const response = await client.post('/preapproval', preapprovalData);
        console.log('[createTuitionPreapproval] Assinatura criada com sucesso:', response.data.id);
        return response.data; // contém o init_point
    } catch (error) {
        console.error('[createTuitionPreapproval] Erro:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = {
    createMercadoPagoPreference,
    createCartMercadoPagoPreference,
    getMercadoPagoPayment,
    searchMercadoPagoPayments,
    getMercadoPagoPreference,
    exchangeOAuthCode,
    cancelPreapproval,
    getPreapprovalStatus,
    createTuitionPreapproval
};
