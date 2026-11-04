const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();

/**
 * Envia notificação Push para o app (Expo / Android / iOS)
 * Suporta envio para:
 * - 'all': Todos os usuários com token registrado
 * - 'unit': Alunos de uma unidade específica
 * - 'student': Um aluno específico (userId)
 */
exports.sendPushNotification = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .https.onCall(async (data, context) => {
        // Verifica autenticação
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
        }

        const {
            title,
            body,
            targetType = 'all', // 'all' | 'unit' | 'student'
            unitName = '',
            studentId = '',
            url = '/(tabs)/notificacoes',
            testMode = false
        } = data;

        if (!title || !title.trim()) {
            throw new functions.https.HttpsError('invalid-argument', 'O título da notificação é obrigatório.');
        }
        if (!body || !body.trim()) {
            throw new functions.https.HttpsError('invalid-argument', 'A mensagem da notificação é obrigatória.');
        }

        const callerEmail = context.auth.token.email || 'Admin';
        console.log(`[Push] Iniciando disparo por ${callerEmail}. Destino: ${targetType} (Unidade: ${unitName}, Aluno: ${studentId}), TestMode: ${testMode}`);

        try {
            // 1. Busca os usuários destinatários
            const recipients = [];
            const usersRef = db.collection('users');

            if (targetType === 'student') {
                if (!studentId) {
                    throw new functions.https.HttpsError('invalid-argument', 'ID do aluno é obrigatório.');
                }
                const userDoc = await usersRef.doc(studentId).get();
                if (userDoc.exists) {
                    recipients.push({ id: userDoc.id, ...userDoc.data() });
                }
            } else if (targetType === 'unit') {
                if (!unitName || unitName === 'all') {
                    const snap = await usersRef.get();
                    snap.forEach(d => recipients.push({ id: d.id, ...d.data() }));
                } else {
                    const normUnit = unitName.trim().toLowerCase();
                    const snap = await usersRef.get();
                    snap.forEach(d => {
                        const u = d.data();
                        const userUnit = String(u.unidade || u.unit || u.unitName || '').trim().toLowerCase();
                        if (userUnit && (userUnit === normUnit || userUnit.includes(normUnit) || normUnit.includes(userUnit))) {
                            recipients.push({ id: d.id, ...u });
                        }
                    });
                }
            } else {
                // 'all'
                const snap = await usersRef.get();
                snap.forEach(d => recipients.push({ id: d.id, ...d.data() }));
            }

            console.log(`[Push] Total de usuários correspondentes: ${recipients.length}`);

            // 2. Extrai tokens de push
            const expoPushTokens = new Set();
            const fcmTokens = new Set();
            const userNotificationMap = new Map(); // userId -> { name, tokens }

            for (const r of recipients) {
                const userTokens = [];
                // Expo tokens
                const pTokens = Array.isArray(r.pushTokens) ? r.pushTokens : (r.pushToken ? [r.pushToken] : []);
                for (const t of pTokens) {
                    if (typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))) {
                        expoPushTokens.add(t);
                        userTokens.push(t);
                    }
                }

                // Native FCM tokens
                const fTokens = Array.isArray(r.fcmTokens) ? r.fcmTokens : (r.fcmToken ? [r.fcmToken] : []);
                for (const f of fTokens) {
                    if (typeof f === 'string' && f.length > 20) {
                        fcmTokens.add(f);
                        userTokens.push(f);
                    }
                }

                if (userTokens.length > 0) {
                    userNotificationMap.set(r.id, {
                        name: r.name || r.nome || 'Aluno',
                        tokens: userTokens
                    });
                }
            }

            const totalTokens = expoPushTokens.size + fcmTokens.size;
            console.log(`[Push] Tokens únicos encontrados: Expo=${expoPushTokens.size}, FCM=${fcmTokens.size}`);

            if (totalTokens === 0 && !testMode) {
                return {
                    success: true,
                    totalRecipients: recipients.length,
                    tokensCount: 0,
                    message: 'Nenhum dispositivo registrado encontrado para os destinatários selecionados.'
                };
            }

            let successCount = 0;
            let errorCount = 0;

            if (!testMode) {
                // 3. Envia via Expo Push API (suporta Android e iOS com canal configurado)
                const expoTokensArray = Array.from(expoPushTokens);
                const CHUNK_SIZE = 100;

                for (let i = 0; i < expoTokensArray.length; i += CHUNK_SIZE) {
                    const chunk = expoTokensArray.slice(i, i + CHUNK_SIZE);
                    const messages = chunk.map(token => ({
                        to: token,
                        sound: 'default',
                        title: title.trim(),
                        body: body.trim(),
                        data: { url: url || '/(tabs)/notificacoes' },
                        channelId: 'default',
                        priority: 'high',
                        badge: 1
                    }));

                    try {
                        const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
                            headers: {
                                'Accept': 'application/json',
                                'Accept-encoding': 'gzip, deflate',
                                'Content-Type': 'application/json',
                            }
                        });

                        const tickets = response.data?.data || [];
                        tickets.forEach(ticket => {
                            if (ticket.status === 'ok') successCount++;
                            else errorCount++;
                        });
                    } catch (err) {
                        console.error('[Push] Erro no lote Expo:', err.message);
                        errorCount += chunk.length;
                    }
                }

                // 4. Se houver tokens FCM diretos, envia via Firebase Admin
                if (fcmTokens.size > 0) {
                    const fcmArray = Array.from(fcmTokens);
                    for (let i = 0; i < fcmArray.length; i += 500) {
                        const fcmChunk = fcmArray.slice(i, i + 500);
                        try {
                            const response = await admin.messaging().sendEachForMulticast({
                                tokens: fcmChunk,
                                notification: {
                                    title: title.trim(),
                                    body: body.trim()
                                },
                                data: {
                                    url: url || '/(tabs)/notificacoes'
                                },
                                android: {
                                    priority: 'high',
                                    notification: {
                                        channelId: 'default',
                                        color: '#eab308'
                                    }
                                }
                            });
                            successCount += response.successCount;
                            errorCount += response.failureCount;
                        } catch (fcmErr) {
                            console.error('[Push] Erro no lote FCM:', fcmErr.message);
                            errorCount += fcmChunk.length;
                        }
                    }
                }

                // 5. Salva na coleção in-app 'notifications' para cada usuário encontrado
                const batch = db.batch();
                let batchCount = 0;
                for (const [userId] of userNotificationMap) {
                    const notifRef = db.collection('notifications').doc();
                    batch.set(notifRef, {
                        userId: userId,
                        title: title.trim(),
                        body: body.trim(),
                        type: 'push',
                        read: false,
                        data: { url: url || '/(tabs)/notificacoes' },
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    batchCount++;
                    if (batchCount >= 450) {
                        await batch.commit();
                        batchCount = 0;
                    }
                }
                if (batchCount > 0) {
                    await batch.commit();
                }
            } else {
                // Simulação modo teste
                successCount = totalTokens;
            }

            // 6. Grava histórico de disparos
            await db.collection('push_dispatches').add({
                title: title.trim(),
                body: body.trim(),
                targetType,
                unitName: unitName || 'Todas as Unidades',
                studentId: studentId || null,
                url: url || '/(tabs)/notificacoes',
                testMode: Boolean(testMode),
                totalRecipients: recipients.length,
                tokensCount: totalTokens,
                successCount,
                errorCount,
                sentBy: callerEmail,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                testMode,
                totalRecipients: recipients.length,
                tokensCount: totalTokens,
                successCount,
                errorCount,
                message: testMode
                    ? `Simulação concluída! ${totalTokens} dispositivos seriam notificados.`
                    : `Disparo realizado com sucesso para ${successCount} dispositivos.`
            };

        } catch (error) {
            console.error('[Push] Erro fatal no disparo:', error);
            throw new functions.https.HttpsError('internal', error.message || 'Erro ao enviar notificação.');
        }
    });

/**
 * Retorna contagem de dispositivos cadastrados por unidade
 */
exports.getPushStats = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    try {
        const snap = await db.collection('users').get();
        let totalDevices = 0;
        let totalUsersWithTokens = 0;
        const byUnit = {};

        snap.forEach(docSnap => {
            const u = docSnap.data();
            const pTokens = Array.isArray(u.pushTokens) ? u.pushTokens : (u.pushToken ? [u.pushToken] : []);
            const fTokens = Array.isArray(u.fcmTokens) ? u.fcmTokens : (u.fcmToken ? [u.fcmToken] : []);
            const count = pTokens.length + fTokens.length;

            if (count > 0) {
                totalUsersWithTokens++;
                totalDevices += count;
                const unit = String(u.unidade || u.unit || u.unitName || 'Sem Unidade').trim();
                byUnit[unit] = (byUnit[unit] || 0) + count;
            }
        });

        return {
            totalDevices,
            totalUsersWithTokens,
            byUnit
        };
    } catch (e) {
        console.error('[Push] Erro ao carregar estatísticas:', e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});

