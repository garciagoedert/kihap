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
