const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

// Configuração das credenciais por unidade. No futuro, isso pode vir de secrets ou do Firestore.
const EVO_CREDENTIALS = {
    centro: {
        dns: "atadf",
        token: "08AD03F4-B0A7-4B4B-958C-38C81EA66E48",
        // idbranch: 123 // Exemplo de ID da filial, se necessário
    }
    // Adicionar outras unidades aqui, ex: 'florianopolis': { ... }
};

function getEvoApiClient(unitId, apiVersion = 'v2') {
    const credentials = EVO_CREDENTIALS[unitId];
    if (!credentials) {
        throw new functions.https.HttpsError("not-found", `Credenciais para a unidade '${unitId}' não encontradas.`);
    }

    return axios.create({
        baseURL: `https://evo-integracao-api.w12app.com.br/api/${apiVersion}`,
        headers: {
            "Authorization": `Basic ${Buffer.from(`${credentials.dns}:${credentials.token}`).toString("base64")}`,
            "Content-Type": "application/json"
        }
    });
}

/**
 * Busca os dados de um membro específico na API da EVO.
 */
exports.getMemberData = functions.https.onCall(async (data, context) => {
    // Verifique se o usuário está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado para acessar esta função.");
    }

    const { memberId, unitId = 'centro' } = data;
    if (!memberId) {
        throw new functions.https.HttpsError("invalid-argument", "O ID do membro é obrigatório.");
    }

    try {
        const apiClientV2 = getEvoApiClient(unitId, 'v2');
        // A documentação de listagem sugere vários parâmetros "show...". Vamos tentar um genérico.
        const response = await apiClientV2.get(`/members/${memberId}`, {
            params: { showMemberships: true, showsResponsibles: true } // Parâmetros que podem trazer mais dados
        });
        functions.logger.info(`Resposta da API EVO para getMemberData (ID: ${memberId}):`, response.data);
        return response.data;
    } catch (error) {
        functions.logger.error(`Erro detalhado ao buscar membro ${memberId}:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        throw new functions.https.HttpsError("internal", "Não foi possível buscar os dados do membro.");
    }
});

/**
 * Lista todos os membros (para a visão do professor).
 */
exports.listAllMembers = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { unitId = 'centro' } = data; // Padrão para 'centro' se nenhuma unidade for fornecida

    // Adicionar verificação de permissão de admin/professor aqui
    // ...

    try {
        const apiClientV2 = getEvoApiClient(unitId, 'v2');
        const response = await apiClientV2.get("/members");
        functions.logger.info("Resposta da API EVO:", response.data); // Log da resposta
        return response.data;
    } catch (error) {
        functions.logger.error("Erro detalhado ao listar membros na EVO API:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        throw new functions.https.HttpsError("internal", "Não foi possível listar os membros.");
    }
});

/**
 * Atualiza os dados de um membro na API da EVO.
 */
exports.updateMemberData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { memberId, updatedData, unitId = 'centro' } = data;

    if (!memberId || !updatedData) {
        throw new functions.https.HttpsError("invalid-argument", "ID do membro e dados para atualização são obrigatórios.");
    }

    try {
        const apiClientV1 = getEvoApiClient(unitId, 'v1');
        const response = await apiClientV1.patch(`/members/update-member-data/${memberId}`, updatedData);
        functions.logger.info(`Resposta da API EVO para updateMemberData (ID: ${memberId}):`, response.data);
        return response.data;
    } catch (error) {
        functions.logger.error(`Erro detalhado ao atualizar membro ${memberId}:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        throw new functions.https.HttpsError("internal", "Não foi possível atualizar os dados do membro.");
    }
});

/**
 * Cria um usuário no Firebase Auth para um aluno da EVO e envia um email de redefinição de senha.
 */
exports.inviteStudent = functions.https.onCall(async (data, context) => {
    // Verificação de permissão de admin
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para executar esta ação.");
    }

    const { evoMemberId, email, firstName, lastName } = data;
    if (!evoMemberId || !email || !firstName) {
        throw new functions.https.HttpsError("invalid-argument", "Dados do aluno insuficientes para criar convite.");
    }

    try {
        // 1. Verifica se o usuário já existe no Firebase Auth
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
            functions.logger.info(`Usuário com email ${email} já existe: ${userRecord.uid}`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                // 2. Se não existe, cria o usuário
                userRecord = await admin.auth().createUser({
                    email: email,
                    emailVerified: false,
                    displayName: `${firstName} ${lastName || ''}`,
                });
                functions.logger.info(`Novo usuário criado com email ${email}: ${userRecord.uid}`);
            } else {
                throw error; // Outros erros do admin.auth()
            }
        }

        // 3. Cria ou atualiza o documento no Firestore com o evoMemberId
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            name: `${firstName} ${lastName || ''}`,
            email: email,
            isAdmin: false, // Alunos não são administradores
            evoMemberId: evoMemberId
        }, { merge: true });

        // 4. Gera o link de redefinição de senha (convite)
        const link = await admin.auth().generatePasswordResetLink(email);
        
        // TODO: Enviar o email para o aluno com o link.
        // Por enquanto, retornamos o link para o admin.
        functions.logger.info(`Link de convite para ${email}: ${link}`);
        
        return { success: true, message: `Convite para ${email} gerado. O usuário precisa definir a senha através do link.`, link: link };

    } catch (error) {
        functions.logger.error("Erro ao criar convite de aluno:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível criar o convite do aluno.");
    }
});

/**
 * Atualiza as permissões de conteúdo de um aluno.
 */
exports.updateStudentPermissions = functions.https.onCall(async (data, context) => {
    // Verificação de permissão de admin
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para executar esta ação.");
    }

    const { studentUid, accessibleContent } = data;
    if (!studentUid || !Array.isArray(accessibleContent)) {
        throw new functions.https.HttpsError("invalid-argument", "ID do aluno e lista de conteúdos são obrigatórios.");
    }

    try {
        const studentUserRef = admin.firestore().collection('users').doc(studentUid);
        await studentUserRef.update({
            accessibleContent: accessibleContent
        });
        return { success: true, message: "Permissões atualizadas com sucesso." };
    } catch (error) {
        functions.logger.error(`Erro ao atualizar permissões para o aluno ${studentUid}:`, error);
        throw new functions.https.HttpsError("internal", "Não foi possível atualizar as permissões.");
    }
});
