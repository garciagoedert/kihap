const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.getSwitchProfileToken = functions.https.onCall(async (data, context) => {
    // 1. Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar autenticado.");
    }

    const callerUid = context.auth.uid;
    const { targetUid } = data;

    if (!targetUid) {
        throw new functions.https.HttpsError("invalid-argument", "UID de destino é obrigatório.");
    }

    if (callerUid === targetUid) {
        throw new functions.https.HttpsError("invalid-argument", "UID de destino não pode ser o mesmo do chamador.");
    }

    try {
        // 2. Fetch both profiles from Firestore
        const [callerSnap, targetSnap] = await Promise.all([
            db.collection('users').doc(callerUid).get(),
            db.collection('users').doc(targetUid).get()
        ]);

        if (!callerSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Perfil do chamador não encontrado.");
        }

        if (!targetSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Perfil de destino não encontrado.");
        }

        const callerUser = callerSnap.data();
        const targetUser = targetSnap.data();

        // 3. Verify family relationship
        const isCallerParentOfTarget = (targetUser.parentUid === callerUid) || 
                                       (Array.isArray(callerUser.linkedUids) && callerUser.linkedUids.includes(targetUid));

        const isCallerChildOfTarget = (callerUser.parentUid === targetUid) ||
                                      (Array.isArray(targetUser.linkedUids) && targetUser.linkedUids.includes(callerUid));

        const areSiblings = (callerUser.parentUid && callerUser.parentUid === targetUser.parentUid);

        const isAuthorized = isCallerParentOfTarget || isCallerChildOfTarget || areSiblings;

        if (!isAuthorized) {
            throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para alternar para este perfil.");
        }

        // 4. Generate custom auth token for the target user
        const customToken = await admin.auth().createCustomToken(targetUid);
        return { success: true, customToken };

    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        functions.logger.error("Erro em getSwitchProfileToken:", error);
        throw new functions.https.HttpsError("internal", error.message || "Erro ao processar alternância de perfil.");
    }
});
