const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

// Configuração das credenciais por unidade. No futuro, isso pode vir de secrets ou do Firestore.
const EVO_CREDENTIALS = {
    centro: {
        dns: "atadf",
        token: "08AD03F4-B0A7-4B4B-958C-38C81EA66E48",
    },
    coqueiros: {
        dns: "atadf",
        token: "9409BA4A-CA49-45ED-86D5-35BF336ECFAF",
    },
    "asa-sul": {
        dns: "atadf",
        token: "79D29584-14EB-4E13-8C06-E55A4BC7FD8E",
    },
    sudoeste: {
        dns: "atadf",
        token: "F33EBA37-367A-42A8-B598-3DDF0387F997",
    },
    "lago-sul": {
        dns: "atadf",
        token: "3FABB904-BE55-474F-99CE-C1901962679B",
    },
    "pontos-de-ensino": {
        dns: "atadf",
        token: "0543427D-8C44-4150-B5AB-F15761F63B8B",
    },
    "jardim-botanico": {
        dns: "atadf",
        token: "9F34BB72-1368-4E97-B933-323BE40C54CC",
    },
    dourados: {
        dns: "atadf",
        token: "7A515FA0-3C34-465C-B5B7-9D60DECB9882",
    },
    "santa-monica": {
        dns: "atadf",
        token: "78C3EA0E-3757-4FE0-A40C-E0C9E3E4D79B",
    },
    noroeste: {
        dns: "atadf",
        token: "EB5D8DDB-7263-476D-9491-2DD3F4BB7414",
    }
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

    const { unitId = 'centro', status = 1 } = data; // Padrão para 'centro' e status 'ativo'

    // Adicionar verificação de permissão de admin/professor aqui
    // ...

    try {
        const apiClientV2 = getEvoApiClient(unitId, 'v2');
        const response = await apiClientV2.get("/members", {
            params: { status: status }
        });
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

    const { evoMemberId, email, firstName, lastName, unitId } = data; // Adiciona unitId
    if (!evoMemberId || !email || !firstName || !unitId) { // Valida unitId
        throw new functions.https.HttpsError("invalid-argument", "Dados do aluno (incluindo unidade) insuficientes para criar convite.");
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

        // 3. Cria ou atualiza o documento no Firestore com o evoMemberId e unitId
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            name: `${firstName} ${lastName || ''}`,
            email: email,
            isAdmin: false, // Alunos não são administradores
            evoMemberId: evoMemberId,
            unitId: unitId // Salva a unidade do aluno
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

/**
 * Busca o número de contratos ativos para uma ou todas as unidades.
 */
exports.getActiveContractsCount = functions.runWith({ timeoutSeconds: 120 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { unitId } = data;
    const executionId = Math.random().toString(36).substring(2, 10);
    functions.logger.info(`[${executionId}] Iniciando getActiveContractsCount para unitId: ${unitId || 'geral'}`);

    const getCountForUnit = async (id) => {
        const MAX_RETRIES = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const apiClient = getEvoApiClient(id, 'v2');
                const response = await apiClient.get("/members", { params: { status: 1, take: 1 } });
                const count = parseInt(response.headers['total'] || '0', 10);
                
                functions.logger.info(`[${executionId}] Tentativa ${attempt} para '${id}': Sucesso com contagem ${count}.`);

                // A API às vezes retorna 0 incorretamente. Se não for a última tentativa, tratamos 0 como um erro transitório.
                if (count > 0 || attempt === MAX_RETRIES) {
                    return count;
                }
                
                // Se count for 0 e ainda houver tentativas, espera antes de tentar novamente.
                const delay = 250 * attempt; // 250ms, 500ms, 750ms
                functions.logger.warn(`[${executionId}] Tentativa ${attempt} para '${id}' retornou 0. Tentando novamente em ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (unitError) {
                lastError = unitError;
                functions.logger.error(`[${executionId}] Tentativa ${attempt} para '${id}' falhou:`, unitError.message);
                if (attempt < MAX_RETRIES) {
                    const delay = 500 * attempt; // Espera mais em caso de erro real
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        functions.logger.error(`[${executionId}] Todas as ${MAX_RETRIES} tentativas falharam para a unidade '${id}'.`, lastError?.message);
        return 0; // Retorna 0 se todas as tentativas falharem.
    };

    try {
        if (unitId && unitId !== 'geral') {
            const count = await getCountForUnit(unitId);
            functions.logger.info(`[${executionId}] Retornando contagem única para '${unitId}': ${count}`);
            return { [unitId]: count };
        } else {
            const unitIds = Object.keys(EVO_CREDENTIALS);
            functions.logger.info(`[${executionId}] Buscando contagem para todas as ${unitIds.length} unidades.`);

            const promises = unitIds.map(async (id) => {
                const count = await getCountForUnit(id);
                return { id, count };
            });

            const results = await Promise.all(promises);
            functions.logger.info(`[${executionId}] Resultados individuais recebidos:`, results);

            const finalCounts = results.reduce((acc, result) => {
                acc.counts[result.id] = result.count;
                acc.totalGeral += result.count;
                return acc;
            }, { totalGeral: 0, counts: {} });

            functions.logger.info(`[${executionId}] Contagem final calculada. Total: ${finalCounts.totalGeral}`, finalCounts.counts);
            return { totalGeral: finalCounts.totalGeral, ...finalCounts.counts };
        }
    } catch (error) {
        functions.logger.error("Erro geral ao buscar contagem de contratos:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível buscar a contagem de contratos ativos.");
    }
});

/**
 * Retorna a lista de unidades configuradas para a API EVO.
 */
exports.getEvoUnits = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    return Object.keys(EVO_CREDENTIALS);
});

/**
 * Busca a agenda de atividades de uma unidade específica para uma data.
 */
exports.getActivitiesSchedule = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado para ver as atividades.");
    }

    const { unitId, date } = data; // Adiciona o parâmetro de data
    if (!unitId || !date) {
        throw new functions.https.HttpsError("invalid-argument", "O ID da unidade e a data são obrigatórios.");
    }

    try {
        const apiClient = getEvoApiClient(unitId, 'v1');
        // Tenta passar a data usando o parâmetro 'date'
        const response = await apiClient.get("/activities/schedule", {
            params: { date: date }
        });
        
        functions.logger.info(`Resposta da API EVO para getActivitiesSchedule (unidade: ${unitId}, data: ${date}):`, response.data);
        return response.data;

    } catch (error) {
        functions.logger.error(`Erro ao buscar agenda da unidade ${unitId}:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        throw new functions.https.HttpsError("internal", "Não foi possível buscar a agenda de atividades.");
    }
});
