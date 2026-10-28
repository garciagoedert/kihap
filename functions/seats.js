const admin = require('firebase-admin');

/**
 * Retorna referência ao documento de reservas de uma sessão específica de um produto.
 * Coleção: productSeatReservations
 * Documento: {productId}_{sessionId}
 */
function getSeatDocRef(productId, sessionId) {
    const db = admin.firestore();
    const docId = `${productId}_${sessionId || 'default'}`;
    return db.collection('productSeatReservations').doc(docId);
}

/**
 * Bloqueia temporariamente uma lista de assentos (15 minutos).
 */
async function lockSeatsHandler(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { productId, sessionId, seatIds, userIdentifier } = req.body;

    if (!productId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userIdentifier) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes: productId, seatIds (array) e userIdentifier.' });
    }

    const db = admin.firestore();
    const docRef = getSeatDocRef(productId, sessionId);
    const lockDurationMs = 15 * 60 * 1000; // 15 minutos
    const now = Date.now();
    const expiresAt = now + lockDurationMs;

    try {
        const result = await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(docRef);
            const currentData = docSnap.exists ? docSnap.data() : { seats: {} };
            const seats = currentData.seats || {};

            const conflicts = [];

            for (const seatId of seatIds) {
                const seat = seats[seatId];
                if (seat) {
                    // Já comprado definitivamente
                    if (seat.status === 'booked') {
                        conflicts.push({ seatId, reason: 'bought', message: `A cadeira ${seatId} já foi comprada.` });
                        continue;
                    }
                    // Bloqueado administrativamente
                    if (seat.status === 'disabled' || seat.status === 'blocked_admin') {
                        conflicts.push({ seatId, reason: 'disabled', message: `A cadeira ${seatId} está indisponível.` });
                        continue;
                    }
                    // Bloqueado por outro usuário e ainda não expirou
                    if (seat.status === 'locked' && seat.lockedUntil && seat.lockedUntil > now && seat.lockedBy !== userIdentifier) {
                        conflicts.push({ seatId, reason: 'locked', message: `A cadeira ${seatId} está reservada por outro cliente.` });
                        continue;
                    }
                }
            }

            if (conflicts.length > 0) {
                return { success: false, conflicts };
            }

            // Aplica o lock para cada cadeira
            for (const seatId of seatIds) {
                seats[seatId] = {
                    status: 'locked',
                    lockedUntil: expiresAt,
                    lockedBy: userIdentifier,
                    updatedAt: now
                };
            }

            transaction.set(docRef, {
                productId,
                sessionId: sessionId || 'default',
                seats,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return { success: true, expiresAt, lockedSeats: seatIds };
        });

        if (!result.success) {
            return res.status(409).json({
                error: 'Algumas cadeiras selecionadas não estão mais disponíveis.',
                conflicts: result.conflicts
            });
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('[lockSeatsHandler] Erro na transação de assentos:', err);
        return res.status(500).json({ error: 'Erro interno ao reservar cadeiras.' });
    }
}

/**
 * Libera cadeiras bloqueadas antes do tempo (se usuário desistir ou remover do carrinho).
 */
async function releaseSeatsHandler(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    const { productId, sessionId, seatIds, userIdentifier } = req.body;

    if (!productId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userIdentifier) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes: productId, seatIds e userIdentifier.' });
    }

    const db = admin.firestore();
    const docRef = getSeatDocRef(productId, sessionId);

    try {
        await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists) return;

            const currentData = docSnap.data();
            const seats = currentData.seats || {};

            for (const seatId of seatIds) {
                const seat = seats[seatId];
                // Só libera se estiver bloqueado pelo próprio usuário (nunca remove assentos comprados)
                if (seat && seat.status === 'locked' && seat.lockedBy === userIdentifier) {
                    delete seats[seatId];
                }
            }

            transaction.set(docRef, {
                seats,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        return res.status(200).json({ success: true, releasedSeats: seatIds });
    } catch (err) {
        console.error('[releaseSeatsHandler] Erro ao liberar assentos:', err);
        return res.status(500).json({ error: 'Erro ao liberar assentos.' });
    }
}

/**
 * Retorna status em tempo real dos assentos de uma sessão.
 */
async function getSeatsStatusHandler(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    const productId = req.query.productId;
    const sessionId = req.query.sessionId || 'default';

    if (!productId) {
        return res.status(400).json({ error: 'productId é obrigatório.' });
    }

    try {
        const docRef = getSeatDocRef(productId, sessionId);
        const docSnap = await docRef.get();

        const now = Date.now();
        const responseSeats = {};

        if (docSnap.exists) {
            const data = docSnap.data();
            const seats = data.seats || {};

            for (const [seatId, info] of Object.entries(seats)) {
                if (info.status === 'booked') {
                    responseSeats[seatId] = {
                        status: 'booked',
                        buyerName: info.buyerName || null
                    };
                } else if (info.status === 'disabled' || info.status === 'blocked_admin') {
                    responseSeats[seatId] = {
                        status: 'disabled'
                    };
                } else if (info.status === 'locked') {
                    // Verifica se o lock expirou
                    if (info.lockedUntil && info.lockedUntil > now) {
                        responseSeats[seatId] = {
                            status: 'locked',
                            lockedUntil: info.lockedUntil,
                            lockedBy: info.lockedBy || null
                        };
                    }
                    // Se expirou, não envia como ocupado (fica available)
                }
            }
        }

        return res.status(200).json({
            productId,
            sessionId,
            seats: responseSeats,
            serverTime: now
        });
    } catch (err) {
        console.error('[getSeatsStatusHandler] Erro ao buscar status dos assentos:', err);
        return res.status(500).json({ error: 'Erro ao buscar status dos assentos.' });
    }
}

/**
 * Marca os assentos permanentemente como comprados após confirmação do pagamento.
 * Chamada internamente pelo webhook ou processamento de venda gratuita.
 */
async function bookSeatsForSale(productId, sessionId, seatIds, saleInfo) {
    if (!productId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        return;
    }

    const db = admin.firestore();
    const docRef = getSeatDocRef(productId, sessionId);

    try {
        await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(docRef);
            const currentData = docSnap.exists ? docSnap.data() : { seats: {} };
            const seats = currentData.seats || {};

            for (const seatId of seatIds) {
                seats[seatId] = {
                    status: 'booked',
                    buyerName: saleInfo.buyerName || saleInfo.userName || 'Cliente Kihap',
                    buyerEmail: saleInfo.buyerEmail || saleInfo.userEmail || null,
                    buyerPhone: saleInfo.buyerPhone || saleInfo.userPhone || null,
                    saleId: saleInfo.saleId || null,
                    bookedAt: Date.now()
                };
            }

            transaction.set(docRef, {
                productId,
                sessionId: sessionId || 'default',
                seats,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        console.log(`[bookSeatsForSale] Assentos ${seatIds.join(', ')} confirmados com sucesso para o produto ${productId} (sessão: ${sessionId})`);
    } catch (err) {
        console.error(`[bookSeatsForSale] Erro ao confirmar assentos para venda ${saleInfo.saleId}:`, err);
    }
}

/**
 * Ação administrativa para bloquear ou liberar assentos na Intranet.
 */
async function adminToggleSeatHandler(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    const { productId, sessionId, seatId, action } = req.body; // action: 'block' | 'free'

    if (!productId || !seatId || !action) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: productId, seatId e action (block|free).' });
    }

    const db = admin.firestore();
    const docRef = getSeatDocRef(productId, sessionId);

    try {
        await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(docRef);
            const currentData = docSnap.exists ? docSnap.data() : { seats: {} };
            const seats = currentData.seats || {};

            if (action === 'block') {
                seats[seatId] = {
                    status: 'disabled',
                    blockedAt: Date.now()
                };
            } else if (action === 'free') {
                delete seats[seatId];
            }

            transaction.set(docRef, {
                productId,
                sessionId: sessionId || 'default',
                seats,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        return res.status(200).json({ success: true, seatId, action });
    } catch (err) {
        console.error('[adminToggleSeatHandler] Erro ao alternar status do assento:', err);
        return res.status(500).json({ error: 'Erro ao alternar status do assento.' });
    }
}

module.exports = {
    lockSeatsHandler,
    releaseSeatsHandler,
    getSeatsStatusHandler,
    bookSeatsForSale,
    adminToggleSeatHandler
};
