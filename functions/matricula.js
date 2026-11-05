const admin = require('firebase-admin');
const axios = require('axios');

/**
 * Retorna o valor da matrícula em centavos baseado na unidade.
 * Brasília: R$ 677,00 (67700 centavos)
 * Florianópolis: R$ 507,00 (50700 centavos)
 * Dourados e outras: R$ 507,00 (50700 centavos)
 */
function getMatriculaPriceByUnit(unidade) {
    if (!unidade) return 67700;
    const u = String(unidade).trim().toLowerCase();

    const unidadesBsb = [
        'asa sul', 'lagosul', 'lago sul', 'sudoeste', 'noroeste',
        'jardim botânico', 'jardim botanico', 'pontos de ensino',
        'atadf', 'brasília', 'brasilia'
    ];

    const unidadesFln = [
        'centro', 'coqueiros', 'santa mônica', 'santa monica',
        'florianópolis', 'florianopolis'
    ];

    if (unidadesBsb.some(b => u.includes(b))) {
        return 67700; // R$ 677,00
    }
    if (unidadesFln.some(f => u.includes(f))) {
        return 50700; // R$ 507,00
    }

    return 50700; // Fallback padrão
}

/**
 * Cria a sessão de checkout da matrícula com Mercado Pago e salva no Firestore
 */
async function processMatriculaCheckout(data) {
    const db = admin.firestore();

    const {
        alunoNome,
        alunoDataNascimento,
        alunoPrograma,
        isMenor,
        responsavelNome,
        responsavelEmail,
        responsavelTelefone,
        responsavelCpf,
        unidade,
        paymentMethod
    } = data;

    if (!alunoNome || !alunoNome.trim()) {
        throw new Error('O nome do aluno é obrigatório.');
    }
    if (!responsavelEmail || !responsavelEmail.trim()) {
        throw new Error('O e-mail é obrigatório.');
    }
    if (!responsavelTelefone || !responsavelTelefone.trim()) {
        throw new Error('O WhatsApp de contato é obrigatório.');
    }
    if (!unidade || !unidade.trim()) {
        throw new Error('A unidade de preferência é obrigatória.');
    }

    const priceCents = getMatriculaPriceByUnit(unidade);
    const priceReais = priceCents / 100;
    const payerName = (isMenor && responsavelNome && responsavelNome.trim()) 
        ? responsavelNome.trim() 
        : alunoNome.trim();

    // 1. Cria ou atualiza o Lead no CRM (coleção 'leads') para acompanhamento no Kanban da Intranet
    let leadRef;
    try {
        leadRef = await db.collection('leads').add({
            nome: alunoNome.trim(),
            responsavel: payerName,
            email: responsavelEmail.trim().toLowerCase(),
            telefone: responsavelTelefone.trim(),
            cpf: (responsavelCpf || '').trim(),
            unidade: unidade.trim(),
            setor: alunoPrograma || 'Geral',
            dataNascimento: alunoDataNascimento || null,
            status: 'Novo', // Entra na primeira coluna do Kanban
            ticketEstimado: priceReais,
            'origem do lead': 'Site - Matrícula Online',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (leadErr) {
        console.warn('[processMatriculaCheckout] Aviso ao criar lead no CRM:', leadErr);
    }

    // 2. Cria o registro na coleção 'inscricoesFaixaPreta'
    // Esta é a coleção central que alimenta a tabela "Log de Vendas" da Kihap Store na Intranet
    const saleData = {
        userName: alunoNome.trim(),
        payerName: payerName,
        userEmail: responsavelEmail.trim().toLowerCase(),
        userPhone: responsavelTelefone.trim(),
        userCpf: (responsavelCpf || '').trim(),
        userUnit: unidade.trim(),
        userPrograma: alunoPrograma || 'Geral',
        userAge: alunoDataNascimento || null,
        productId: 'matricula-online',
        productName: `Matrícula Kihap - ${unidade.trim()}`,
        amountTotal: priceCents,
        currency: 'BRL',
        paymentStatus: 'pending',
        fulfillmentStatus: 'pending',
        saleType: 'online',
        source: 'matricula_site',
        isMatricula: true,
        leadId: leadRef ? leadRef.id : null,
        created: admin.firestore.FieldValue.serverTimestamp()
    };

    const saleRef = await db.collection('inscricoesFaixaPreta').add(saleData);
    const saleDocId = saleRef.id;

    // Se temos lead, vincula o ID da venda nele
    if (leadRef) {
        try {
            await leadRef.update({ saleId: saleDocId });
        } catch (_) {}
    }

    // 3. Cria a preferência de pagamento no Mercado Pago
    const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
        throw new Error('Chave de integração do Mercado Pago não configurada no servidor.');
    }

    const notificationUrl = 'https://us-central1-intranet-kihap.cloudfunctions.net/mercadopagoWebhook';

    const preferencePayload = {
        items: [
            {
                id: 'matricula-online',
                title: `Matrícula Kihap - ${unidade.trim()}`,
                description: `Matrícula de ${alunoNome.trim()} na unidade ${unidade.trim()} (Kihap Martial Arts)`,
                unit_price: priceReais,
                quantity: 1,
                currency_id: 'BRL'
            }
        ],
        payer: {
            name: payerName,
            email: responsavelEmail.trim().toLowerCase(),
            phone: {
                number: responsavelTelefone.replace(/\D/g, '')
            },
            identification: responsavelCpf ? {
                type: 'CPF',
                number: responsavelCpf.replace(/\D/g, '')
            } : undefined
        },
        external_reference: saleDocId,
        metadata: {
            firestoreDocIds: saleDocId,
            saleId: saleDocId,
            isMatricula: true,
            unit: unidade.trim()
        },
        notification_url: notificationUrl,
        back_urls: {
            success: 'https://kihap.com.br/compra-success.html',
            failure: 'https://kihap.com.br/matricula.html',
            pending: 'https://kihap.com.br/compra-success.html'
        },
        auto_return: 'approved'
    };

    if (paymentMethod === 'pix') {
        preferencePayload.payment_methods = {
            default_payment_method_id: 'pix',
            excluded_payment_types: [
                { id: 'credit_card' },
                { id: 'debit_card' },
                { id: 'ticket' }
            ]
        };
    }

    const mpClient = axios.create({
        baseURL: 'https://api.mercadopago.com',
        headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    const mpRes = await mpClient.post('/checkout/preferences', preferencePayload);
    const preference = mpRes.data;

    const isSandbox = MP_ACCESS_TOKEN.startsWith('TEST-');
    const checkoutUrl = isSandbox 
        ? (preference.sandbox_init_point || preference.init_point) 
        : preference.init_point;

    // Atualiza o documento de venda com o ID da preferência e a URL de pagamento
    await saleRef.update({
        mercadoPagoPreferenceId: preference.id,
        checkoutUrl: checkoutUrl
    });

    return {
        success: true,
        saleId: saleDocId,
        preferenceId: preference.id,
        checkoutUrl: checkoutUrl,
        amount: priceReais,
        unidade: unidade.trim()
    };
}

module.exports = {
    getMatriculaPriceByUnit,
    processMatriculaCheckout
};
