const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const db = admin.firestore();

// --- Configuration ---
// Using existing environment variables for consistency, but can be adapted for Zoho/AWS.
// Lazy load transporter to prevent init errors
const getTransporter = () => {
    const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
    const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD;

    if (!GMAIL_EMAIL || !GMAIL_PASSWORD) {
        throw new Error('Credenciais de e-mail não configuradas (GMAIL_EMAIL/GMAIL_PASSWORD).');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_EMAIL,
            pass: GMAIL_PASSWORD,
        },
    });
};

// --- Public Function: Subscribe User ---
const subscribeUser = functions.https.onCall(async (data, context) => {
    const { email, name, source } = data;

    console.log(`[subscribeUser] Iniciando inscrição para: ${email}`);

    if (!email) {
        console.warn('[subscribeUser] E-mail não fornecido.');

        if (!email) {
            throw new functions.https.HttpsError('invalid-argument', 'O email é obrigatório.');
        }

        try {
            const subscriberRef = db.collection('subscribers').doc(email);
            const doc = await subscriberRef.get();

            if (doc.exists) {
                // If already exists, ensure status is active if it was bounced? 
                // Or just update name/source?
                // Negocio: "O sistema deve ignorar duplicatas automaticamente" (for import).
                // For manual subscribe, maybe re-activate if unsubscribed?
                // Let's just update for now.
                await subscriberRef.update({
                    name: name || doc.data().name,
                    status: 'active', // Reactivate
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
                return { message: 'Inscrição atualizada com sucesso.' };
            } else {
                await subscriberRef.set({
                    email: email,
                    name: name || '',
                    status: 'active',
                    source: source || 'site_form',
                    tags: ['lead-site'], // Default tag
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                return { message: 'Inscrição realizada com sucesso.' };
            }
        } catch (error) {
            console.error("[subscribeUser] ERRO CRÍTICO:", error);
            // Retornar o erro original se for HttpsError, senão genérico
            if (error.code) { throw error; }
            throw new functions.https.HttpsError('internal', `Erro interno: ${error.message}`);
        }
    });

// --- Public Function: Unsubscribe User ---
const unsubscribeUser = functions.https.onCall(async (data, context) => {
    const { email } = data;
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'O email é obrigatório.');
    }

    try {
        await db.collection('subscribers').doc(email).update({
            status: 'unsubscribed',
            unsubscribed_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return { message: 'Você foi descadastrado com sucesso.' };
    } catch (error) {
        console.error("Erro ao descadastrar usuário:", error);
        throw new functions.https.HttpsError('internal', 'Erro ao processar descadastro.');
    }
});

// --- Admin Function: Import Subscribers ---
const importSubscribers = functions.https.onCall(async (data, context) => {
    // Check Auth
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas administradores podem importar inscritos.');
    }

    const { subscribers } = data; // Expects array of { email, name, tags }
    if (!subscribers || !Array.isArray(subscribers)) {
        throw new functions.https.HttpsError('invalid-argument', 'Lista de inscritos inválida.');
    }

    let successCount = 0;
    let errorCount = 0;
    const batchSize = 500;
    let batch = db.batch();
    let counter = 0;

    for (const sub of subscribers) {
        if (!sub.email) continue;

        const ref = db.collection('subscribers').doc(sub.email);
        // We use set with merge: true to avoid overwriting existing data completely, but update/create
        batch.set(ref, {
            email: sub.email,
            name: sub.name || '',
            status: 'active', // Assume active on import
            source: 'import_csv',
            tags: sub.tags || [],
            created_at: admin.firestore.FieldValue.serverTimestamp() // This will update timestamp on re-import, acceptable
        }, { merge: true });

        counter++;
        if (counter >= batchSize) {
            await batch.commit();
            batch = db.batch();
            counter = 0;
        }
        successCount++;
    }

    if (counter > 0) {
        await batch.commit();
    }

    return { success: true, count: successCount };
});

// --- Admin Function: Send Campaign ---
const sendCampaign = functions.https.onCall(async (data, context) => {
    // Check Auth
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas administradores podem enviar campanhas.');
    }

    const { campaignId, mode } = data; // mode: 'test' | 'broadcast'
    if (!campaignId) {
        throw new functions.https.HttpsError('invalid-argument', 'ID da campanha é obrigatório.');
    }

    try {
        const campaignRef = db.collection('campaigns').doc(campaignId);
        const campaignDoc = await campaignRef.get();

        if (!campaignDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Campanha não encontrada.');
        }

        const campaign = campaignDoc.data();

        // --- Template Processing ---
        const wrapContent = (content, unsubLink) => {
            return `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <div style="text-align: center; padding: 20px; background-color: #000;">
                        <img src="https://kihap.com.br/imgs/logo-kihap-white.png" alt="Kihap Martial Arts" style="height: 50px;">
                    </div>
                    <div style="padding: 20px; background-color: #fff;">
                        ${content}
                    </div>
                    <div style="text-align: center; padding: 20px; font-size: 12px; color: #777; background-color: #f4f4f4;">
                        <p>Kihap Martial Arts - Todos os direitos reservados.</p>
                        <p><a href="${unsubLink}">Clique aqui para cancelar o recebimento</a></p>
                    </div>
                </div>
            `;
        };


        if (mode === 'test') {
            const adminEmail = context.auth.token.email;
            // Mock unsub link for test
            const html = wrapContent(campaign.content_html, "#");

            await getTransporter().sendMail({
                from: `"Kihap Martial Arts" <${process.env.GMAIL_EMAIL}>`,
                to: adminEmail,
                subject: `[TESTE] ${campaign.subject}`,
                html: html
            });

            return { success: true, message: `Teste enviado para ${adminEmail}` };
        }

        if (mode === 'broadcast') {
            // Check status to prevent double send?
            if (campaign.status === 'sent' || campaign.status === 'sending') {
                // throw new functions.https.HttpsError('failed-precondition', 'Campanha já enviada ou em envio.');
                // Allow retry for now? No, safer to block.
            }

            await campaignRef.update({ status: 'sending', sent_at: admin.firestore.FieldValue.serverTimestamp() });

            // Fetch active subscribers
            // TODO: Pagination for large bases (using cursor). For now, simpler implementation.
            const snapshot = await db.collection('subscribers')
                .where('status', '==', 'active')
                .get();

            let sentCount = 0;
            let failedCount = 0;

            // Loop and send
            // Note: Cloud Functions has execution time limits (default 60s, max 9m). 
            // For large lists, this needs to be a background scheduled task or split into chunks.
            // Assuming small base for < 500 users.

            const results = [];
            for (const doc of snapshot.docs) {
                const sub = doc.data();
                const unsubLink = `https://kihap.com.br/unsubscribe?email=${encodeURIComponent(sub.email)}`; // Frontend route needed
                const html = wrapContent(campaign.content_html, unsubLink); // Can replace [Nome] here

                try {
                    await getTransporter().sendMail({
                        from: `"Kihap Martial Arts" <${process.env.GMAIL_EMAIL}>`,
                        to: sub.email,
                        subject: campaign.subject,
                        html: html
                    });
                    sentCount++;
                } catch (err) {
                    console.error(`Falha ao enviar para ${sub.email}:`, err);
                    failedCount++;
                }
            }

            await campaignRef.update({
                status: 'sent',
                stats: { sent: sentCount, failed: failedCount }
            });

            return { success: true, sent: sentCount, failed: failedCount };
        }

    } catch (error) {
        console.error("Erro na campanha:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

module.exports = {
    subscribeUser,
    unsubscribeUser,
    importSubscribers,
    sendCampaign
};
