const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();

const OFFICIAL_UNITS = [
    { id: 'centro', name: 'Centro' },
    { id: 'coqueiros', name: 'Coqueiros' },
    { id: 'santa-monica', name: 'Santa Mônica' },
    { id: 'asa-sul', name: 'Asa Sul' },
    { id: 'sudoeste', name: 'Sudoeste' },
    { id: 'lago-sul', name: 'Lago Sul' },
    { id: 'jardim-botanico', name: 'Jardim Botânico' },
    { id: 'noroeste', name: 'Noroeste' },
    { id: 'pontos-de-ensino', name: 'Pontos de Ensino' },
    { id: 'dourados', name: 'Dourados' },
];

const OFFICIAL_UNIT_IDS = new Set(OFFICIAL_UNITS.map((u) => u.id));

const WEEKLY_MISSION_REWARDS = {
    train_2x: 20,
    tatame_study: 10,
    weekly_quiz: 15,
    social_cheer: 10,
};

const VALID_LITTLES_CHARACTERS = new Set([
    'miles',
    'jun',
    'eddy',
    'sachi',
    'kobe',
    'hye',
    'hope',
    'jeong',
    'benny',
]);

const DEFAULT_REWARDS_MAP = {
    streak_shield: {
        id: 'streak_shield',
        title: 'Escudo de Chama',
        description: 'Protege sua ofensiva caso você fique até 10 dias sem conseguir treinar.',
        cost: 50,
        type: 'streak_shield',
        active: true,
    },
    frame_gold: {
        id: 'frame_gold',
        title: 'Moldura Dourada Kihap',
        description: 'Borda dourada exclusiva no seu avatar no Perfil e no Ranking.',
        cost: 80,
        type: 'avatar_frame',
        frameId: 'gold',
        active: true,
    },
    frame_flame: {
        id: 'frame_flame',
        title: 'Moldura Chama Suprema',
        description: 'Aura em chamas no seu avatar para destacar sua constância no tatame.',
        cost: 120,
        type: 'avatar_frame',
        frameId: 'flame',
        active: true,
    },
    littles_pack: {
        id: 'littles_pack',
        title: 'Pacote Figurinha Littles',
        description: 'Desbloqueia uma figurinha especial da turma Kihap Littles no seu álbum.',
        cost: 60,
        type: 'littles_pack',
        active: true,
    },
    coupon_10: {
        id: 'coupon_10',
        title: 'Cupom 10% na Loja Kihap',
        description: 'Cupom de uso único de 10% de desconto para compras na Loja Oficial.',
        cost: 150,
        type: 'coupon',
        discountPercent: 10,
        active: true,
    },
    chaveiro_kihap: {
        id: 'chaveiro_kihap',
        title: 'Chaveiro / Adesivo Kihap',
        description: 'Brinde exclusivo Kihap para retirar na recepção da sua unidade.',
        cost: 100,
        type: 'physical',
        active: true,
    },
    vip_friend_pass: {
        id: 'vip_friend_pass',
        title: 'Passe VIP Aula Experimental',
        description: 'Convite especial para trazer um amigo ou familiar para treinar com você.',
        cost: 80,
        type: 'experience',
        active: true,
    },
};

function getSaoPauloParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = fmt.formatToParts(date);
    const map = {};
    parts.forEach((p) => {
        map[p.type] = p.value;
    });
    const dateStr = `${map.year}-${map.month}-${map.day}`;
    const monthKey = `${map.year}-${map.month}`;
    return { dateStr, monthKey };
}

function getWeekKeyFromDateStr(dateStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekBounds(dateStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const day = d.getUTCDay(); // 0 Sunday .. 6 Saturday
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const fmt = (dt) => dt.toISOString().slice(0, 10);
    return { start: fmt(monday), end: fmt(sunday) };
}

function normalizeUnitSlug(val) {
    if (!val || typeof val !== 'string') return '';
    return val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^kihap\s*-\s*/i, '')
        .replace(/^kihap\s+/i, '')
        .replace(/^unidade\s+/i, '')
        .replace(/\s*\(.*\)\s*/g, '')
        .trim()
        .replace(/[\s_]+/g, '-');
}

function getEffectiveBalance(uData) {
    const base = Number(uData?.totalFitCoins ?? uData?.fitCoins ?? 0) || 0;
    const delta = Number(uData?.kihapcoinsDelta ?? 0) || 0;
    return Math.max(0, Math.round(base + delta));
}

function generateVoucherCode(prefix = 'KHP') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${suffix}`;
}

async function sendDirectExpoPush(recipientUserData, title, body, url = '/(tabs)/notificacoes') {
    if (!recipientUserData) return;
    const pTokens = Array.isArray(recipientUserData.pushTokens)
        ? recipientUserData.pushTokens
        : recipientUserData.pushToken
            ? [recipientUserData.pushToken]
            : [];

    const validTokens = Array.from(
        new Set(
            pTokens.filter(
                (t) => typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
            )
        )
    );

    if (validTokens.length > 0) {
        const messages = validTokens.map((token) => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: { url },
            channelId: 'default',
            priority: 'high',
        }));

        try {
            await axios.post('https://exp.host/--/api/v2/push/send', messages, {
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                timeout: 8000,
            });
        } catch (err) {
            console.warn('[engagement] Expo push warning:', err.message);
        }
    }

    const fTokens = Array.isArray(recipientUserData.fcmTokens)
        ? recipientUserData.fcmTokens
        : recipientUserData.fcmToken
            ? [recipientUserData.fcmToken]
            : [];
    const validFcm = Array.from(new Set(fTokens.filter((f) => typeof f === 'string' && f.length > 20)));
    if (validFcm.length > 0) {
        try {
            await admin.messaging().sendEachForMulticast({
                tokens: validFcm,
                notification: { title, body },
                data: { url },
                android: {
                    priority: 'high',
                    notification: { channelId: 'default', color: '#eab308' },
                },
            });
        } catch (err) {
            console.warn('[engagement] FCM push warning:', err.message);
        }
    }
}

/**
 * 1. Envia "Dar um Kihap!" (parabéns) ou "Incentivar chama" para um colega/amigo
 */
exports.sendKihapCheer = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const senderUid = context.auth.uid;
    const receiverUid = String(data?.receiverUid || '').trim();
    const kind = data?.kind === 'nudge' ? 'nudge' : 'kihap';

    if (!receiverUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Destinatário obrigatório.');
    }
    if (receiverUid === senderUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Você não pode enviar um Kihap para si mesmo.');
    }

    const { dateStr } = getSaoPauloParts();
    const weekKey = getWeekKeyFromDateStr(dateStr);
    const docId = `${senderUid}_${receiverUid}_${dateStr}`;
    const cheerRef = db.collection('kihap_cheers').doc(docId);

    const existing = await cheerRef.get();
    if (existing.exists) {
        return { success: true, alreadySent: true };
    }

    const [senderSnap, receiverSnap] = await Promise.all([
        db.collection('users').doc(senderUid).get(),
        db.collection('users').doc(receiverUid).get(),
    ]);

    if (!receiverSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Aluno destinatário não encontrado.');
    }

    const senderData = senderSnap.exists ? senderSnap.data() : {};
    const receiverData = receiverSnap.data() || {};
    const senderName = senderData.name || senderData.nome || senderData.displayName || 'Um colega da Kihap';
    const receiverName = receiverData.name || receiverData.nome || receiverData.displayName || 'Aluno Kihap';

    const title = kind === 'nudge' ? '🔥 Chama em alerta!' : '🥋 Você recebeu um Kihap!';
    const message =
        kind === 'nudge'
            ? `${senderName} mandou um incentivo para você manter sua ofensiva acesa esta semana na Kihap!`
            : `${senderName} mandou um Kihap! para parabenizar sua dedicação no tatame!`;

    const senderRef = db.collection('users').doc(senderUid);
    const receiverRef = db.collection('users').doc(receiverUid);
    const notifRef = db.collection('notifications').doc();

    await db.runTransaction(async (tx) => {
        const snapCheck = await tx.get(cheerRef);
        if (snapCheck.exists) {
            return;
        }
        tx.set(cheerRef, {
            senderUid,
            senderName,
            receiverUid,
            receiverName,
            kind,
            dateStr,
            weekKey,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(
            receiverRef,
            { kihapsReceived: admin.firestore.FieldValue.increment(1) },
            { merge: true }
        );
        tx.set(
            senderRef,
            {
                weeklyProgress: {
                    [weekKey]: {
                        cheerSent: true,
                    },
                },
            },
            { merge: true }
        );
        tx.set(notifRef, {
            userId: receiverUid,
            type: 'award',
            title,
            message,
            body: message,
            read: false,
            url: '/(tabs)/notificacoes',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    await sendDirectExpoPush(receiverData, title, message, '/(tabs)/notificacoes');

    return { success: true, alreadySent: false };
});

/**
 * 2. Resgata recompensas idempotentes de Missões Semanais, Quiz do Tatame e Missões Littles
 */
exports.claimMissionReward = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const uid = context.auth.uid;
    const claimType = String(data?.claimType || '').trim();
    const periodKey = String(data?.periodKey || '').trim();
    const itemId = String(data?.itemId || '').trim();
    const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata : {};

    if (!claimType || !periodKey || !itemId) {
        throw new functions.https.HttpsError('invalid-argument', 'Parâmetros obrigatórios ausentes.');
    }

    let coinsToAward = 0;
    let reason = '';
    let quizAnswerIsCorrect = null;

    if (claimType === 'weekly_mission') {
        if (!WEEKLY_MISSION_REWARDS[itemId]) {
            throw new functions.https.HttpsError('invalid-argument', 'Missão semanal desconhecida.');
        }
        coinsToAward = WEEKLY_MISSION_REWARDS[itemId];
        reason = `Missão semanal concluída (${itemId})`;
    } else if (claimType === 'weekly_quiz') {
        let baseReward = 15;
        let isCorrect = Boolean(metadata.isCorrect);
        const quizSnap = await db.collection('weekly_quizzes').doc(itemId).get();
        if (quizSnap.exists) {
            const qData = quizSnap.data() || {};
            const cfgReward = Number(qData.rewardCoins);
            if (cfgReward >= 5 && cfgReward <= 50) {
                baseReward = cfgReward;
            }
            if (typeof qData.correctIndex === 'number' && typeof metadata.selectedIndex === 'number') {
                isCorrect = metadata.selectedIndex === qData.correctIndex;
            }
        }
        quizAnswerIsCorrect = isCorrect;
        coinsToAward = baseReward;
        reason = 'Quiz semanal do Tatame';
    } else if (claimType === 'littles_week') {
        if (!VALID_LITTLES_CHARACTERS.has(itemId)) {
            throw new functions.https.HttpsError('invalid-argument', 'Personagem Littles inválido.');
        }
        coinsToAward = 15;
        reason = `Missão Littles em Casa (${itemId})`;
    } else {
        throw new functions.https.HttpsError('invalid-argument', 'Tipo de resgate inválido.');
    }

    const safeClaimId = `${uid}_${claimType}_${periodKey}_${itemId}`.replace(/[/\\]/g, '_');
    const claimRef = db.collection('mission_claims').doc(safeClaimId);
    const userRef = db.collection('users').doc(uid);
    const txRef = db.collection('kihapcoin_transactions').doc();

    const result = await db.runTransaction(async (tx) => {
        const existingClaim = await tx.get(claimRef);
        if (existingClaim.exists) {
            return { success: true, alreadyClaimed: true, coinsAwarded: 0 };
        }

        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists ? userSnap.data() : {};

        tx.set(claimRef, {
            userId: uid,
            claimType,
            periodKey,
            itemId,
            coinsAwarded: coinsToAward,
            metadata,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const userUpdate = {
            kihapcoinsDelta: admin.firestore.FieldValue.increment(coinsToAward),
        };

        if (claimType === 'littles_week') {
            userUpdate.unlockedLittlesStickers = admin.firestore.FieldValue.arrayUnion(itemId);
        }
        if (claimType === 'weekly_quiz') {
            userUpdate.weeklyProgress = {
                [periodKey]: {
                    quizAnswered: true,
                },
            };
        }

        tx.set(userRef, userUpdate, { merge: true });

        tx.set(txRef, {
            userId: uid,
            amount: coinsToAward,
            type: 'earn',
            reason,
            claimType,
            periodKey,
            itemId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (claimType === 'weekly_quiz') {
            const attemptRef = db.collection('quiz_attempts').doc(`${uid}_${periodKey}`);
            tx.set(attemptRef, {
                userId: uid,
                quizId: itemId,
                periodKey,
                selectedIndex: typeof metadata.selectedIndex === 'number' ? metadata.selectedIndex : null,
                isCorrect: quizAnswerIsCorrect,
                coinsAwarded: coinsToAward,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        const newBalance = getEffectiveBalance(userData) + coinsToAward;
        return { success: true, alreadyClaimed: false, coinsAwarded: coinsToAward, newBalance };
    });

    return result;
});

/**
 * 3. Resgata recompensas no Clube de Kihapcoins
 */
exports.redeemCoinReward = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const uid = context.auth.uid;
    const rewardId = String(data?.rewardId || '').trim();
    if (!rewardId) {
        throw new functions.https.HttpsError('invalid-argument', 'Recompensa obrigatória.');
    }

    const customRewardSnap = await db.collection('coin_rewards').doc(rewardId).get();
    const reward = customRewardSnap.exists
        ? { id: customRewardSnap.id, ...customRewardSnap.data() }
        : DEFAULT_REWARDS_MAP[rewardId];

    if (!reward || reward.active === false) {
        throw new functions.https.HttpsError('not-found', 'Recompensa não encontrada ou indisponível.');
    }

    const cost = Number(reward.cost);
    if (!cost || cost <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Custo da recompensa inválido.');
    }

    const userRef = db.collection('users').doc(uid);
    const redemptionRef = db.collection('coin_redemptions').doc();
    const txRef = db.collection('kihapcoin_transactions').doc();

    const needsVoucher = ['coupon', 'physical', 'experience'].includes(reward.type);
    const voucherCode = needsVoucher ? generateVoucherCode('KHP') : null;
    const isInstant = ['streak_shield', 'avatar_frame', 'littles_pack', 'coupon'].includes(reward.type);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    const couponExpiryStr = expiryDate.toISOString().slice(0, 10);

    const resData = await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Perfil do usuário não encontrado.');
        }

        const uData = userSnap.data() || {};
        const currentBalance = getEffectiveBalance(uData);

        if (currentBalance < cost) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `Saldo insuficiente. Você tem ${currentBalance} Kihapcoins e precisa de ${cost}.`
            );
        }

        const userUpdate = {
            kihapcoinsDelta: admin.firestore.FieldValue.increment(-cost),
        };

        if (reward.type === 'streak_shield') {
            const currentShields = Number(uData.streakShields || 0);
            if (currentShields >= 3) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Você já possui o limite máximo de 3 Escudos de Chama.'
                );
            }
            userUpdate.streakShields = admin.firestore.FieldValue.increment(1);
        } else if (reward.type === 'avatar_frame') {
            const frameId = reward.frameId || 'gold';
            const unlocked = Array.isArray(uData.unlockedFrames) ? uData.unlockedFrames : [];
            if (unlocked.includes(frameId)) {
                throw new functions.https.HttpsError('failed-precondition', 'Você já possui esta moldura.');
            }
            userUpdate.unlockedFrames = admin.firestore.FieldValue.arrayUnion(frameId);
            userUpdate.avatarFrame = frameId;
        } else if (reward.type === 'littles_pack') {
            const existingStickers = Array.isArray(uData.unlockedLittlesStickers) ? uData.unlockedLittlesStickers : [];
            const locked = Array.from(VALID_LITTLES_CHARACTERS).filter((id) => !existingStickers.includes(id));
            const picked =
                locked.length > 0
                    ? locked[Math.floor(Math.random() * locked.length)]
                    : Array.from(VALID_LITTLES_CHARACTERS)[0];
            userUpdate.unlockedLittlesStickers = admin.firestore.FieldValue.arrayUnion(picked);
        }

        tx.set(userRef, userUpdate, { merge: true });

        if (reward.type === 'coupon' && voucherCode) {
            const couponRef = db.collection('coupons').doc();
            tx.set(couponRef, {
                code: voucherCode,
                type: 'percentage',
                value: Number(reward.discountPercent) || 10,
                expiry: couponExpiryStr,
                active: true,
                singleUse: true,
                maxUses: 1,
                currentUses: 0,
                source: 'kihapcoins',
                userId: uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        const unitId = normalizeUnitSlug(uData.unitId || uData.unidadeId || uData.unidade || uData.unit || '') || 'kihap';
        const userName = uData.name || uData.nome || uData.displayName || 'Aluno Kihap';

        tx.set(redemptionRef, {
            userId: uid,
            userName,
            unitId,
            rewardId: reward.id,
            rewardTitle: reward.title,
            rewardType: reward.type,
            cost,
            voucherCode,
            status: isInstant ? 'delivered' : 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(txRef, {
            userId: uid,
            amount: -cost,
            type: 'spend',
            reason: `Resgate: ${reward.title}`,
            rewardId: reward.id,
            voucherCode,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            redemptionId: redemptionRef.id,
            voucherCode,
            newBalance: currentBalance - cost,
            rewardTitle: reward.title,
            rewardType: reward.type,
        };
    });

    return resData;
});

/**
 * 4. Calcula / retorna o ranking coletivo mensal "Copa das Unidades"
 */
exports.getCopaUnidades = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const { monthKey: currentMonth } = getSaoPauloParts();
    const monthKey = typeof data?.monthKey === 'string' && /^\d{4}-\d{2}$/.test(data.monthKey)
        ? data.monthKey
        : currentMonth;
    const forceRefresh = Boolean(data?.forceRefresh);

    const snapshotRef = db.collection('copa_unidades_snapshots').doc(monthKey);

    if (!forceRefresh) {
        const cached = await snapshotRef.get();
        if (cached.exists) {
            const cData = cached.data() || {};
            const updatedMs = cData.updatedAtMs || 0;
            if (Date.now() - updatedMs < 10 * 60 * 1000 && Array.isArray(cData.standings)) {
                return {
                    monthKey,
                    updatedAtMs: updatedMs,
                    standings: cData.standings,
                    cached: true,
                };
            }
        }
    }

    const startDate = `${monthKey}-01`;
    const endDate = `${monthKey}-31`;

    const [instancesSnap, usersSnap] = await Promise.all([
        db
            .collection('classInstances')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get(),
        db.collection('users').get(),
    ]);

    const unitStats = {};
    OFFICIAL_UNITS.forEach((u) => {
        unitStats[u.id] = {
            unitId: u.id,
            unitName: u.name,
            totalCheckins: 0,
            participatingSet: new Set(),
            studentKeysSet: new Set(),
        };
    });

    usersSnap.forEach((docSnap) => {
        const u = docSnap.data() || {};
        const slug = normalizeUnitSlug(u.unitId || u.unidadeId || u.unit || u.unidade || u.branchName || '');
        if (OFFICIAL_UNIT_IDS.has(slug)) {
            const memberKey = String(u.evoMemberId || u.matricula || docSnap.id);
            unitStats[slug].studentKeysSet.add(memberKey);
        }
    });

    instancesSnap.forEach((docSnap) => {
        const inst = docSnap.data() || {};
        const slug = normalizeUnitSlug(inst.unitId || inst.unidadeId || inst.unit || '');
        if (!OFFICIAL_UNIT_IDS.has(slug)) return;
        const present = Array.isArray(inst.presentStudents) ? inst.presentStudents : [];
        unitStats[slug].totalCheckins += present.length;
        present.forEach((pId) => {
            if (pId !== null && pId !== undefined) {
                unitStats[slug].participatingSet.add(String(pId));
            }
        });
    });

    const standings = OFFICIAL_UNITS.map((u) => {
        const st = unitStats[u.id];
        const activeStudents = Math.max(st.studentKeysSet.size, st.participatingSet.size);
        const denominator = Math.max(activeStudents, 10);
        const score = Math.round((st.totalCheckins / denominator) * 1000) / 10;
        return {
            unitId: u.id,
            unitName: u.name,
            totalCheckins: st.totalCheckins,
            participatingStudents: st.participatingSet.size,
            activeStudents,
            score,
        };
    }).sort((a, b) => b.score - a.score || b.totalCheckins - a.totalCheckins || a.unitName.localeCompare(b.unitName));

    const updatedAtMs = Date.now();
    await snapshotRef.set({
        monthKey,
        updatedAtMs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        standings,
    });

    return {
        monthKey,
        updatedAtMs,
        standings,
        cached: false,
    };
});

/**
 * 5. Registra termômetro pós-treino (+5 Kihapcoins no primeiro registro do dia)
 */
exports.submitWorkoutFeedback = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const uid = context.auth.uid;
    const mood = String(data?.mood || '').trim();
    if (!['incrivel', 'desafiador', 'tranquilo'].includes(mood)) {
        throw new functions.https.HttpsError('invalid-argument', 'Humor do treino inválido.');
    }

    const { dateStr: defaultToday } = getSaoPauloParts();
    const dateStr =
        typeof data?.dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.dateStr)
            ? data.dateStr
            : defaultToday;

    const focusTags = Array.isArray(data?.focusTags)
        ? data.focusTags.slice(0, 5).map((t) => String(t).trim()).filter(Boolean)
        : [];
    const className = String(data?.className || '').trim().slice(0, 80);

    const feedbackRef = db.collection('workout_feedback').doc(`${uid}_${dateStr}`);
    const userRef = db.collection('users').doc(uid);
    const txRef = db.collection('kihapcoin_transactions').doc();

    const result = await db.runTransaction(async (tx) => {
        const [fbSnap, userSnap] = await Promise.all([tx.get(feedbackRef), tx.get(userRef)]);
        const uData = userSnap.exists ? userSnap.data() : {};
        const unitId = normalizeUnitSlug(uData.unitId || uData.unidadeId || uData.unidade || uData.unit || '') || 'kihap';
        const userName = uData.name || uData.nome || uData.displayName || 'Aluno';

        const isFirstToday = !fbSnap.exists;
        const coinsAwarded = isFirstToday ? 5 : 0;

        tx.set(
            feedbackRef,
            {
                userId: uid,
                userName,
                unitId,
                dateStr,
                mood,
                focusTags,
                className,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                ...(isFirstToday ? { createdAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
            },
            { merge: true }
        );

        if (isFirstToday) {
            tx.set(
                userRef,
                { kihapcoinsDelta: admin.firestore.FieldValue.increment(5) },
                { merge: true }
            );
            tx.set(txRef, {
                userId: uid,
                amount: 5,
                type: 'earn',
                reason: 'Diário pós-treino',
                dateStr,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        return { success: true, coinsAwarded, isFirstToday };
    });

    return result;
});

/**
 * 6. Gerencia Ofensiva em Dupla / Família ("Parceiro de Tatame")
 */
exports.manageStreakDuo = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const uid = context.auth.uid;
    const action = String(data?.action || '').trim();
    const { dateStr } = getSaoPauloParts();
    const weekKey = getWeekKeyFromDateStr(dateStr);

    if (action === 'invite') {
        const partnerUid = String(data?.partnerUid || '').trim();
        if (!partnerUid || partnerUid === uid) {
            throw new functions.https.HttpsError('invalid-argument', 'Parceiro inválido.');
        }

        const [mySnap, partnerSnap, existingDuosSnap] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('users').doc(partnerUid).get(),
            db.collection('streak_duos').where('memberIds', 'array-contains', uid).get(),
        ]);

        if (!partnerSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Usuário parceiro não encontrado.');
        }

        const hasActiveOrPending = existingDuosSnap.docs.some((d) => {
            const st = d.data().status;
            return st === 'active' || st === 'pending';
        });
        if (hasActiveOrPending) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Você já possui um convite ou parceiro de tatame ativo.'
            );
        }

        const partnerDuosSnap = await db
            .collection('streak_duos')
            .where('memberIds', 'array-contains', partnerUid)
            .get();
        if (partnerDuosSnap.docs.some((d) => d.data().status === 'active')) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Este colega já possui um parceiro de tatame ativo.'
            );
        }

        const myData = mySnap.exists ? mySnap.data() : {};
        const partnerData = partnerSnap.data() || {};

        const isFamily =
            myData.parentUid === partnerUid ||
            partnerData.parentUid === uid ||
            (myData.parentUid && myData.parentUid === partnerData.parentUid) ||
            (Array.isArray(myData.linkedUids) && myData.linkedUids.includes(partnerUid)) ||
            (Array.isArray(partnerData.linkedUids) && partnerData.linkedUids.includes(uid));

        const sortedIds = [uid, partnerUid].sort();
        const duoId = `${sortedIds[0]}_${sortedIds[1]}`;

        await db.collection('streak_duos').doc(duoId).set({
            memberIds: sortedIds,
            members: {
                [uid]: {
                    uid,
                    name: myData.name || myData.nome || 'Aluno',
                    photoURL: myData.photoURL || myData.profilePicture || '',
                },
                [partnerUid]: {
                    uid: partnerUid,
                    name: partnerData.name || partnerData.nome || 'Aluno',
                    photoURL: partnerData.photoURL || partnerData.profilePicture || '',
                },
            },
            initiatedBy: uid,
            status: isFamily ? 'active' : 'pending',
            isFamily: Boolean(isFamily),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const myName = myData.name || myData.nome || 'Um colega';
        const title = isFamily ? '🤝 Dupla em Família ativada!' : '🤝 Convite de Parceiro de Tatame!';
        const message = isFamily
            ? `${myName} ativou a Ofensiva em Família com você! Treinem juntos esta semana.`
            : `${myName} convidou você para serem Parceiros de Tatame nesta semana!`;

        await db.collection('notifications').add({
            userId: partnerUid,
            type: 'award',
            title,
            message,
            body: message,
            read: false,
            url: '/(tabs)/notificacoes',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await sendDirectExpoPush(partnerData, title, message, '/(tabs)/notificacoes');

        return { success: true, duoId, status: isFamily ? 'active' : 'pending' };
    }

    const duoId = String(data?.duoId || '').trim();
    if (!duoId) {
        throw new functions.https.HttpsError('invalid-argument', 'ID da dupla obrigatório.');
    }

    const duoRef = db.collection('streak_duos').doc(duoId);
    const duoSnap = await duoRef.get();
    if (!duoSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Dupla não encontrada.');
    }
    const duoData = duoSnap.data() || {};
    if (!Array.isArray(duoData.memberIds) || !duoData.memberIds.includes(uid)) {
        throw new functions.https.HttpsError('permission-denied', 'Você não faz parte desta dupla.');
    }

    if (action === 'accept') {
        await duoRef.update({
            status: 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, status: 'active' };
    }

    if (action === 'decline' || action === 'remove') {
        await duoRef.delete();
        return { success: true, status: 'removed' };
    }

    if (action === 'claim_weekly_bonus') {
        if (duoData.status !== 'active') {
            throw new functions.https.HttpsError('failed-precondition', 'Esta dupla ainda não está ativa.');
        }

        const { start, end } = getWeekBounds(dateStr);
        const [m1Snap, m2Snap, weekInstancesSnap] = await Promise.all([
            db.collection('users').doc(duoData.memberIds[0]).get(),
            db.collection('users').doc(duoData.memberIds[1]).get(),
            db.collection('classInstances')
                .where('date', '>=', start)
                .where('date', '<=', end)
                .get(),
        ]);

        const m1Data = m1Snap.exists ? m1Snap.data() : {};
        const m2Data = m2Snap.exists ? m2Snap.data() : {};

        const didMemberTrainThisWeek = (memberUid, mData) => {
            if (mData?.lastAttendanceDate && mData.lastAttendanceDate >= start && mData.lastAttendanceDate <= end) {
                return true;
            }
            const candidateIds = new Set(
                [memberUid, mData?.evoMemberId, mData?.matricula]
                    .filter((v) => v !== null && v !== undefined && v !== '')
                    .map((v) => String(v))
            );
            for (const instDoc of weekInstancesSnap.docs) {
                const present = instDoc.data().presentStudents || [];
                if (present.some((p) => candidateIds.has(String(p)))) {
                    return true;
                }
            }
            return false;
        };

        const m1Trained = didMemberTrainThisWeek(duoData.memberIds[0], m1Data);
        const m2Trained = didMemberTrainThisWeek(duoData.memberIds[1], m2Data);

        if (!m1Trained || !m2Trained) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Ambos os parceiros precisam registrar presença nesta semana para resgatar o bônus.'
            );
        }

        const claimRef = db.collection('mission_claims').doc(`${uid}_streak_duo_${weekKey}_${duoId}`);
        const userRef = db.collection('users').doc(uid);
        const txRef = db.collection('kihapcoin_transactions').doc();

        const bonusResult = await db.runTransaction(async (tx) => {
            const cSnap = await tx.get(claimRef);
            if (cSnap.exists) {
                return { success: true, alreadyClaimed: true, coinsAwarded: 0 };
            }
            tx.set(claimRef, {
                userId: uid,
                claimType: 'streak_duo',
                periodKey: weekKey,
                itemId: duoId,
                coinsAwarded: 15,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.set(userRef, { kihapcoinsDelta: admin.firestore.FieldValue.increment(15) }, { merge: true });
            tx.set(txRef, {
                userId: uid,
                amount: 15,
                type: 'earn',
                reason: 'Bônus semanal Parceiro de Tatame',
                claimType: 'streak_duo',
                periodKey: weekKey,
                itemId: duoId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true, alreadyClaimed: false, coinsAwarded: 15 };
        });

        return bonusResult;
    }

    throw new functions.https.HttpsError('invalid-argument', 'Ação desconhecida.');
});
