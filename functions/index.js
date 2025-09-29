const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.setUserRole = functions.https.onCall(async (data, context) => {
  // 1. Verifica se o usuário que chama a função está autenticado.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Você precisa estar autenticado para realizar esta operação."
    );
  }

  // 2. Verifica se o usuário que chama a função é um administrador.
  const requesterUid = context.auth.uid;
  const requesterUserRecord = await admin.auth().getUser(requesterUid);
  const requesterCustomClaims = requesterUserRecord.customClaims || {};

  if (!requesterCustomClaims.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas administradores podem definir papéis de usuário."
    );
  }

  // 3. Pega o UID do usuário alvo e o papel a ser definido.
  const targetUid = data.uid;
  const isAdmin = data.isAdmin;

  try {
    // 4. Define a custom claim para o usuário alvo.
    await admin.auth().setCustomUserClaims(targetUid, { admin: isAdmin });

    // 5. Retorna uma mensagem de sucesso.
    return {
      message: `Sucesso! O usuário ${targetUid} agora tem o papel de admin: ${isAdmin}.`,
    };
  } catch (error) {
    console.error("Erro ao definir custom claim:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Ocorreu um erro interno ao tentar definir o papel do usuário."
    );
  }
});
