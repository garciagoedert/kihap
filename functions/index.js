const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    // Verifica se o usuário que chama a função é um administrador.
    if (!context.auth.token.isAdmin) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Apenas administradores podem alterar senhas."
        );
    }

    const { userId, password } = data;

    if (!userId || !password) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "O ID do usuário e a nova senha são obrigatórios."
        );
    }

    try {
        await admin.auth().updateUser(userId, {
            password: password,
        });
        return { success: true, message: "Senha atualizada com sucesso." };
    } catch (error) {
        console.error("Erro ao atualizar a senha:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Ocorreu um erro ao atualizar a senha."
        );
    }
});

// Ponto de entrada principal para as Firebase Functions.

// Carrega as funções da API EVO
const evoFunctions = require('./evo.js');

// Exporta todas as funções encontradas em evo.js
Object.keys(evoFunctions).forEach(key => {
  exports[key] = evoFunctions[key];
});

// Você pode adicionar outras funções aqui no futuro, se necessário.
// Exemplo:
// const outrasFuncoes = require('./outras.js');
// Object.keys(outrasFuncoes).forEach(key => {
//   exports[key] = outrasFuncoes[key];
// });

exports.getRegisteredUsersByEvoId = functions.https.onCall(
    async (data, context) => {
      // Apenas administradores podem chamar esta função.
      if (!context.auth.token.isAdmin) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Apenas administradores podem consultar os status de registro.",
        );
      }

      const {evoIds} = data;

      if (!Array.isArray(evoIds) || evoIds.length === 0) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Um array de 'evoIds' é obrigatório.",
        );
      }

      try {
        const usersRef = admin.firestore().collection("users");
        // O Firestore limita o operador 'in' a 10 itens por query.
        // Se houver mais de 10, precisaremos dividir em múltiplos chunks.
        const chunks = [];
        for (let i = 0; i < evoIds.length; i += 10) {
          chunks.push(evoIds.slice(i, i + 10));
        }

        const registeredIds = new Set();

        for (const chunk of chunks) {
          const snapshot = await usersRef.where("evoMemberId", "in", chunk).get();
          snapshot.forEach((doc) => {
            registeredIds.add(doc.data().evoMemberId);
          });
        }

        return {registeredEvoIds: Array.from(registeredIds)};
      } catch (error) {
        console.error("Erro ao buscar usuários registrados:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Ocorreu um erro ao buscar os usuários.",
        );
      }
    },
);

exports.updateStudentBadges = functions.https.onCall(async (data, context) => {
    // Verifica se o usuário está autenticado.
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "Você precisa estar autenticado para realizar esta ação."
        );
    }

    const { studentUid, earnedBadges } = data;

    if (!studentUid || !Array.isArray(earnedBadges)) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "O ID do aluno e um array de emblemas são obrigatórios."
        );
    }

    try {
        const userRef = admin.firestore().collection("users").doc(studentUid);
        await userRef.set({
            earnedBadges: earnedBadges,
        }, { merge: true });
        return { success: true, message: "Emblemas atualizados com sucesso." };
    } catch (error) {
        console.error("Erro ao atualizar emblemas:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Ocorreu um erro ao atualizar os emblemas do aluno."
        );
    }
});

exports.grantAdminRole = functions.https.onCall(async (data, context) => {
    // Idealmente, verifique se o chamador já é um administrador
    // if (!context.auth.token.isAdmin) {
    //     throw new functions.https.HttpsError(
    //         "permission-denied",
    //         "Apenas administradores podem conceder privilégios."
    //     );
    // }

    const { email } = data;
    if (!email) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "O e-mail é obrigatório."
        );
    }

    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
        return { message: `Sucesso! ${email} agora é um administrador.` };
    } catch (error) {
        console.error("Erro ao conceder privilégio de administrador:", error);
        throw new functions.https.HttpsError("internal", "Ocorreu um erro.");
    }
});
