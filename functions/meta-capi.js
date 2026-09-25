const crypto = require('crypto');
const axios = require('axios');

/**
 * Normaliza e gera hash SHA-256 para strings (email, nome, etc)
 */
function hashString(val) {
    if (!val || typeof val !== 'string') return undefined;
    const clean = val.trim().toLowerCase();
    if (!clean) return undefined;
    return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Normaliza telefone para formato E.164 sem o '+' e gera hash SHA-256
 */
function hashPhone(phone) {
    if (!phone) return undefined;
    let clean = String(phone).replace(/\D/g, '');
    if (!clean) return undefined;
    // Se não tiver DDI 55 do Brasil e tiver 10 ou 11 dígitos, adiciona 55
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }
    return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Extrai primeiro e último nome
 */
function parseName(fullName) {
    if (!fullName || typeof fullName !== 'string') return { firstName: undefined, lastName: undefined };
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
    return { firstName, lastName };
}

/**
 * Envia evento para a Meta Conversions API (CAPI)
 * 
 * @param {Object} params
 * @param {Object} params.db - Instância do Firebase Firestore Admin DB
 * @param {string} params.eventName - Nome do evento Meta (Lead, Contact, Schedule, CompleteRegistration, Purchase)
 * @param {string} [params.prospectId] - ID do documento do prospect
 * @param {Object} params.prospectData - Dados do prospect (telefone, email, responsavel, ctwaClid, unidade, etc)
 * @param {Object} [params.customData] - Dados customizados adicionais (currency, value, content_name)
 * @param {string} [params.eventId] - ID único para deduplicação (default: prospectId_eventName)
 * @param {string} [params.testEventCode] - Código de teste do Meta Events Manager (ex: TEST12345)
 */
async function sendMetaCapiEvent({ db, eventName, prospectId, prospectData = {}, customData = {}, eventId, testEventCode }) {
    try {
        // 1. Buscar credenciais no Firestore (public_config/miles)
        let pixelId = process.env.META_PIXEL_ID;
        let accessToken = process.env.META_ACCESS_TOKEN;

        if (db) {
            try {
                const configSnap = await db.collection('public_config').doc('miles').get();
                if (configSnap.exists) {
                    const config = configSnap.data();
                    pixelId = pixelId || config.metaPixelId || config.pixelId;
                    accessToken = accessToken || config.metaAccessToken || config.whatsappToken;
                }
            } catch (err) {
                console.warn('[Meta CAPI] Aviso ao buscar credenciais em public_config/miles:', err.message);
            }
        }

        if (!pixelId) {
            console.warn('[Meta CAPI] Pixel ID não configurado em public_config/miles ou env var META_PIXEL_ID.');
            return { success: false, error: 'Pixel ID ausente' };
        }

        if (!accessToken) {
            console.warn('[Meta CAPI] Access Token do Meta não configurado.');
            return { success: false, error: 'Meta Access Token ausente' };
        }

        // 2. Extrair e criptografar dados do usuário (user_data)
        const phoneHash = hashPhone(prospectData.telefone || prospectData.phone);
        const emailHash = hashString(prospectData.email);
        const { firstName, lastName } = parseName(prospectData.responsavel || prospectData.nome);
        const fnHash = hashString(firstName);
        const lnHash = hashString(lastName);

        // ctwa_clid (Click to WhatsApp Click ID)
        const ctwaClid = prospectData.ctwaClid || 
                         prospectData.ctwa_clid || 
                         prospectData.metaReferral?.ctwa_clid || 
                         undefined;

        // fbp, fbc cookies & IP / User Agent para Event Match Quality 100%
        const fbp = prospectData.fbp || prospectData.metaFbp || undefined;
        const fbc = prospectData.fbc || prospectData.metaFbc || undefined;
        const clientIp = prospectData.clientIp || prospectData.ip || undefined;
        const userAgent = prospectData.userAgent || prospectData.clientUserAgent || undefined;

        const userData = {};
        if (phoneHash) userData.ph = [phoneHash];
        if (emailHash) userData.em = [emailHash];
        if (fnHash) userData.fn = [fnHash];
        if (lnHash) userData.ln = [lnHash];
        if (ctwaClid) userData.ctwa_clid = ctwaClid;
        if (fbp) userData.fbp = fbp;
        if (fbc) userData.fbc = fbc;
        if (clientIp) userData.client_ip_address = clientIp;
        if (userAgent) userData.client_user_agent = userAgent;


        // 3. ID de Deduplicação
        const finalEventId = eventId || (prospectId ? `${prospectId}_${eventName}` : `event_${Date.now()}`);

        // 4. Payload CAPI
        const payload = {
            data: [
                {
                    event_name: eventName,
                    event_time: Math.floor(Date.now() / 1000),
                    event_id: finalEventId,
                    action_source: "system_generated",
                    user_data: userData,
                    custom_data: {
                        content_name: prospectData.unidade || "Kihap Martial Arts",
                        currency: "BRL",
                        lead_status: prospectData.status || "Novo",
                        ...customData
                    }
                }
            ]
        };

        if (testEventCode) {
            payload.test_event_code = testEventCode;
        }

        console.log(`[Meta CAPI] Enviando evento ${eventName} (ID: ${finalEventId}) para Pixel ${pixelId}...`);

        // 5. Requisição HTTP para a Graph API
        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        console.log(`[Meta CAPI] Resposta Meta CAPI (${eventName}):`, response.data);

        // 6. Log no Firestore
        if (db && prospectId) {
            const logEntry = {
                eventName,
                eventId: finalEventId,
                status: 'success',
                timestamp: new Date(),
                metaResponse: response.data
            };

            const arrayUnion = db.constructor ? require('firebase-admin').firestore.FieldValue.arrayUnion : null;

            await db.collection('prospects').doc(prospectId).update({
                capiLastEvent: eventName,
                capiSyncedAt: new Date(),
                ...(arrayUnion ? { capiLog: arrayUnion(logEntry) } : {})
            }).catch(e => console.warn('[Meta CAPI] Erro ao atualizar status CAPI no prospect:', e.message));

            await db.collection('meta_capi_logs').add({
                prospectId,
                eventName,
                eventId: finalEventId,
                payloadSent: payload,
                metaResponse: response.data,
                createdAt: new Date()
            }).catch(e => console.warn('[Meta CAPI] Erro ao salvar log em meta_capi_logs:', e.message));
        }

        return { success: true, eventId: finalEventId, data: response.data };

    } catch (error) {
        const errorDetails = error.response?.data || error.message;
        console.error('[Meta CAPI] Erro no envio de evento CAPI:', errorDetails);

        if (db && prospectId) {
            await db.collection('meta_capi_logs').add({
                prospectId,
                eventName,
                error: errorDetails,
                createdAt: new Date()
            }).catch(() => {});
        }

        return { success: false, error: errorDetails };
    }
}

module.exports = {
    sendMetaCapiEvent,
    hashString,
    hashPhone
};
