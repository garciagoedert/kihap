const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});
const https = require("https");

// A inicialização do Admin SDK é feita no index.js

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

    // Força o uso de IPv4. O Node.js 18+ pode priorizar IPv6 por padrão,
    // o que pode causar problemas de conexão com algumas APIs.
    const httpsAgent = new https.Agent({ family: 4 });

    return axios.create({
        baseURL: `https://172.64.151.155/api/${apiVersion}`,
        headers: {
            "Authorization": `Basic ${Buffer.from(`${credentials.dns}:${credentials.token}`).toString("base64")}`,
            "Content-Type": "application/json",
            "Host": "evo-integracao-api.w12app.com.br"
        },
        httpsAgent: httpsAgent
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

    const { memberId, unitId } = data;
    if (!memberId) {
        throw new functions.https.HttpsError("invalid-argument", "O ID do membro é obrigatório.");
    }

    // Valida a unitId para garantir que ela existe em nossas credenciais.
    // Se for inválida ou não fornecida, usa 'centro' como fallback.
    const validUnitId = unitId && EVO_CREDENTIALS[unitId] ? unitId : 'centro';

    try {
        const apiClientV2 = getEvoApiClient(validUnitId, 'v2');
        const response = await apiClientV2.get(`/members/${memberId}`, {
            params: { showMemberships: true, showsResponsibles: true }
        });
        
        const memberData = response.data;

        // Se o aluno tiver um instrutor associado, busca o nome do instrutor.
        if (memberData && memberData.idEmployeeInstructor) {
            try {
                const employeeResponse = await apiClientV2.get(`/employees/${memberData.idEmployeeInstructor}`);
                const employeeData = employeeResponse.data;
                if (employeeData) {
                    memberData.nameEmployeeInstructor = `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim();
                }
            } catch (employeeError) {
                functions.logger.warn(`Não foi possível buscar o instrutor com ID ${memberData.idEmployeeInstructor}.`, employeeError.message);
                // A função continua mesmo que o instrutor não seja encontrado.
            }
        }
        
        functions.logger.info(`Resposta da API EVO para getMemberData (ID: ${memberId}):`, memberData);
        return memberData;
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
 * Lista todos os membros (para a visão do professor), lidando com paginação.
 */
exports.listAllMembers = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { unitId = 'centro', status = 1 } = data;
    const PAGE_SIZE = 500; // Um tamanho de página alto e seguro para a API.

    try {
        const apiClientV2 = getEvoApiClient(unitId, 'v2');
        const apiParams = { page: 1, take: PAGE_SIZE };

        // Apenas adiciona o filtro de status se ele for diferente de 0 (Todos).
        if (status !== 0) {
            apiParams.status = status;
        }


        const firstPageResponse = await apiClientV2.get("/members", { params: apiParams });
        const totalMembers = parseInt(firstPageResponse.headers["total"] || "0", 10);
        let allMembers = firstPageResponse.data || [];

        if (totalMembers > PAGE_SIZE) {
            const totalPages = Math.ceil(totalMembers / PAGE_SIZE);
            for (let page = 2; page <= totalPages; page++) {
                try {
                    apiParams.page = page;
                    const subsequentPageResponse = await apiClientV2.get("/members", { params: apiParams });
                    if (subsequentPageResponse.data) {
                        allMembers = allMembers.concat(subsequentPageResponse.data);
                    }
                } catch (pageError) {
                    functions.logger.error(`Erro ao buscar a página ${page} para a unidade ${unitId}:`, pageError.message);
                }
            }
        }
        
        functions.logger.info(`Total de ${allMembers.length} membros carregados para a unidade ${unitId} com status ${status}.`);
        return allMembers;

    } catch (error) {
        // Log a estrutura completa do erro para depuração nos logs do Firebase.
        functions.logger.error(`Erro completo ao listar membros na EVO API para unidade ${unitId}:`, error);

        const status = error.response?.status;
        const errorData = error.response?.data;
        
        let errorMessage = `Erro na unidade '${unitId}'.`;
        if (status) {
            errorMessage += ` Status da API: ${status}.`;
        } else if (error.code) {
            // Captura erros de rede de baixo nível (ex: ECONNRESET, ETIMEDOUT).
            errorMessage += ` Erro de rede: ${error.code}.`;
        } else {
            errorMessage += " Não foi possível conectar à API.";
        }

        // Passa o código de erro de rede para o cliente.
        throw new functions.https.HttpsError("unavailable", errorMessage, { unitId, status, errorCode: error.code, errorData });
    }
});

/**
 * Função auxiliar para remover membros duplicados da lista
 * @param {Array} members - Lista de membros que pode conter duplicatas
 * @return {Array} Lista de membros sem duplicatas
 */

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
    const userData = userDoc.data();
    if (!userDoc.exists || (!userData.isAdmin && !userData.isInstructor)) {
        throw new functions.https.HttpsError("permission-denied", "Apenas administradores ou instrutores podem executar esta ação.");
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
 * Busca o número de contratos ativos para uma ou todas as unidades, com cache para resiliência.
 */
exports.getActiveContractsCount = functions.runWith({ timeoutSeconds: 120 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { unitId } = data;
    const executionId = Math.random().toString(36).substring(2, 10);
    functions.logger.info(`[${executionId}] Iniciando getActiveContractsCount para unitId: ${unitId || 'geral'}`);

    const db = admin.firestore();
    const CACHE_DURATION_HOURS = 4;

    const getCountForUnit = async (id) => {
        const cacheRef = db.collection('evo_cache').doc(id);
        const MAX_RETRIES = 3;
        let lastError = null;

        // 1. Tenta ler do cache primeiro
        try {
            const cacheDoc = await cacheRef.get();
            if (cacheDoc.exists) {
                const cacheData = cacheDoc.data();
                const cacheAgeHours = (Date.now() - cacheData.timestamp.toMillis()) / (1000 * 60 * 60);
                if (cacheAgeHours < CACHE_DURATION_HOURS) {
                    functions.logger.info(`[${executionId}] Usando cache para '${id}'. Contagem: ${cacheData.count}. Idade: ${cacheAgeHours.toFixed(2)}h.`);
                    return cacheData.count;
                }
            }
        } catch (cacheError) {
            functions.logger.error(`[${executionId}] Erro ao ler cache para '${id}':`, cacheError);
        }

        // 2. Se o cache não existir ou estiver expirado, busca na API
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const apiClient = getEvoApiClient(id, 'v2');
                const response = await apiClient.get("/members", { params: { status: 1, take: 1 } });
                const count = parseInt(response.headers['total'] || '0', 10);
                
                functions.logger.info(`[${executionId}] API | Tentativa ${attempt} para '${id}': Sucesso com contagem ${count}.`);

                // Se a API retornar um valor válido, atualiza o cache e retorna o valor.
                if (count > 0) {
                    await cacheRef.set({
                        count: count,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                    return count;
                }

                // Se a API retornar 0, mas não for a última tentativa, tenta novamente.
                if (attempt < MAX_RETRIES) {
                    const delay = 250 * attempt;
                    functions.logger.warn(`[${executionId}] API | Tentativa ${attempt} para '${id}' retornou 0. Tentando novamente em ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // É a última tentativa e o resultado é 0. Não atualiza o cache com 0.
                    functions.logger.warn(`[${executionId}] API | Última tentativa para '${id}' retornou 0. Não atualizando o cache.`);
                }

            } catch (unitError) {
                lastError = unitError;
                functions.logger.error(`[${executionId}] API | Tentativa ${attempt} para '${id}' falhou:`, unitError.message);
                if (attempt < MAX_RETRIES) {
                    const delay = 500 * attempt;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // 3. Se todas as tentativas da API falharem, usa o cache antigo se existir.
        functions.logger.error(`[${executionId}] Todas as ${MAX_RETRIES} tentativas de API falharam para a unidade '${id}'.`, lastError?.message);
        const finalCacheDoc = await cacheRef.get();
        if (finalCacheDoc.exists) {
            const staleCount = finalCacheDoc.data().count;
            functions.logger.warn(`[${executionId}] Usando valor de cache antigo para '${id}' como fallback: ${staleCount}`);
            return staleCount;
        }

        // 4. Se não houver nem API nem cache, retorna 0.
        functions.logger.error(`[${executionId}] Sem resposta da API e sem cache para '${id}'. Retornando 0.`);
        return 0;
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
                if (result.count !== undefined) {
                    acc.counts[result.id] = result.count;
                    acc.totalGeral += result.count;
                }
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
 * Retorna a lista de unidades configuradas para a API EVO (versão pública).
 */
exports.getPublicEvoUnits = functions.https.onCall(async (data, context) => {
    // Esta função é pública e não requer autenticação.
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

/**
 * Busca as entradas (check-ins) de alunos em uma unidade para uma data específica.
 */
exports.getDailyEntries = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado para consultar as entradas.");
    }

    const { unitId, date } = data; // A data deve estar no formato 'YYYY-MM-DD'
    if (!unitId || !date) {
        throw new functions.https.HttpsError("invalid-argument", "O ID da unidade e a data são obrigatórios.");
    }

    // Define o intervalo de tempo para o dia inteiro.
    const registerDateStart = `${date}T00:00:00Z`;
    const registerDateEnd = `${date}T23:59:59Z`;

    try {
        // O endpoint de 'entries' utiliza a v1 da API.
        const apiClient = getEvoApiClient(unitId, 'v1');
        
        const response = await apiClient.get("/entries", {
            params: {
                registerDateStart,
                registerDateEnd,
                take: 1000 // Valor máximo para buscar todas as entradas do dia.
            }
        });
        
        functions.logger.info(`Resposta da API EVO para getDailyEntries (unidade: ${unitId}, data: ${date})`, response.data);

        // Calcula o número de membros únicos que fizeram entrada.
        const uniqueMemberIds = new Set();
        if (response.data && Array.isArray(response.data)) {
            response.data.forEach(entry => {
                if (entry.idMember) {
                    uniqueMemberIds.add(entry.idMember);
                }
            });
        }

        return { 
            totalEntries: response.data ? response.data.length : 0,
            uniqueMembersCount: uniqueMemberIds.size,
        };

    } catch (error) {
        functions.logger.error(`Erro ao buscar entradas da unidade ${unitId} para a data ${date}:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        throw new functions.https.HttpsError("internal", "Não foi possível buscar as entradas de alunos.");
    }
});

/**
 * Busca a evolução do número de contratos ativos ao longo do tempo.
 */
exports.getContractsEvolution = functions.runWith({ timeoutSeconds: 120, memory: "1GB" }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const db = admin.firestore();
    const snapshotsRef = db.collection('evo_daily_snapshots');
    const snapshot = await snapshotsRef.orderBy('timestamp', 'desc').limit(12).get();

    if (snapshot.empty) {
        return { labels: [], data: [] };
    }

    const labels = [];
    const evolutionData = [];
    
    // Os snapshots são ordenados do mais recente para o mais antigo, então revertemos para o gráfico
    snapshot.docs.reverse().forEach(doc => {
        const docData = doc.data();
        const date = docData.timestamp.toDate();
        labels.push(date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }));
        
        // Lógica para decidir qual dado usar (geral ou específico da unidade)
        if (data.unitId && data.unitId !== 'geral') {
            evolutionData.push(docData[data.unitId] || 0);
        } else {
            evolutionData.push(docData.totalGeral || 0);
        }
    });

    return { labels, data: evolutionData };
});

const _snapshotDailyEvoData = async () => {
    functions.logger.info("Iniciando snapshot diário de dados do EVO...");
    const db = admin.firestore();
    
    // Corrigido para usar o fuso horário de São Paulo
    const nowInSaoPaulo = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const year = nowInSaoPaulo.getFullYear();
    const month = String(nowInSaoPaulo.getMonth() + 1).padStart(2, '0');
    const day = String(nowInSaoPaulo.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const getUnitData = async (id) => {
        try {
            const apiClientV2 = getEvoApiClient(id, 'v2');
            const contractsResponse = await apiClientV2.get("/members", { params: { status: 1, take: 1 } });
            const contractsCount = parseInt(contractsResponse.headers['total'] || '0', 10);

            const apiClientV1 = getEvoApiClient(id, 'v1');
            const entriesResponse = await apiClientV1.get("/entries", {
                params: {
                    registerDateStart: `${today}T00:00:00Z`,
                    registerDateEnd: `${today}T23:59:59Z`,
                    take: 1000
                }
            });
            const entriesData = entriesResponse.data || [];
            const uniqueMemberIds = Array.isArray(entriesData) ? new Set(entriesData.map(entry => entry.idMember)) : new Set();
            const dailyActivesCount = uniqueMemberIds.size;

            return { id, contractsCount, dailyActivesCount };
        } catch (error) {
            functions.logger.error(`Erro ao buscar dados para snapshot da unidade '${id}':`, error.message);
            return { id, contractsCount: 0, dailyActivesCount: 0 };
        }
    };

    try {
        const unitIds = Object.keys(EVO_CREDENTIALS);
        const promises = unitIds.map(id => getUnitData(id));
        const results = await Promise.all(promises);

        const snapshotData = results.reduce((acc, result) => {
            acc.units[result.id] = {
                contracts: result.contractsCount,
                dailyActives: result.dailyActivesCount
            };
            acc.totalContracts += result.contractsCount;
            acc.totalDailyActives += result.dailyActivesCount;
            return acc;
        }, { totalContracts: 0, totalDailyActives: 0, units: {} });

        snapshotData.timestamp = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('evo_daily_snapshots').add(snapshotData);
        functions.logger.info("Snapshot diário do EVO salvo com sucesso:", snapshotData);
    } catch (error) {
        functions.logger.error("Falha ao criar snapshot diário do EVO:", error);
        throw error; // Lança o erro para a função chamadora
    }
};

exports.snapshotDailyEvoData = functions.pubsub.schedule('0 23 * * *').timeZone('America/Sao_Paulo').onRun(async (context) => {
    await _snapshotDailyEvoData();
});

exports.triggerSnapshot = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        // Verificação de autenticação e permissão para onRequest
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
            functions.logger.error("Não autorizado: Sem token de autorização.");
            res.status(403).send('Unauthorized');
            return;
        }

        const idToken = req.headers.authorization.split('Bearer ')[1];

        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const uid = decodedToken.uid;
            const userDoc = await admin.firestore().collection('users').doc(uid).get();

            if (!userDoc.exists || !userDoc.data().isAdmin) {
                functions.logger.error(`Permissão negada para UID: ${uid}.`);
                res.status(403).send('Permission Denied');
                return;
            }

            // Lógica principal da função
            await _snapshotDailyEvoData();
            res.status(200).send({ data: { success: true, message: "Snapshot manual gerado com sucesso!" } });

        } catch (error) {
            functions.logger.error("Falha ao acionar snapshot manual:", error);
            if (error.code === 'auth/id-token-expired') {
                res.status(401).send('Token expired');
            } else {
                res.status(500).send('Internal Server Error');
            }
        }
    });
});

exports.deleteEvoSnapshot = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para executar esta ação.");
    }

    const { snapshotId } = data;
    if (!snapshotId) {
        throw new functions.https.HttpsError("invalid-argument", "O ID do snapshot é obrigatório.");
    }

    try {
        await admin.firestore().collection('evo_daily_snapshots').doc(snapshotId).delete();
        functions.logger.info(`Snapshot ${snapshotId} deletado com sucesso pelo usuário ${context.auth.uid}.`);
        return { success: true, message: "Snapshot deletado com sucesso." };
    } catch (error) {
        functions.logger.error(`Erro ao deletar o snapshot ${snapshotId}:`, error);
        throw new functions.https.HttpsError("internal", "Não foi possível deletar o snapshot.");
    }
});

/**
 * Busca e retorna os dados do ranking de forma pública, sem necessidade de autenticação.
 * Lógica alinhada com listAllMembers para garantir consistência dos dados.
 */
exports.getPublicRanking = functions.https.onCall(async (data, context) => {
    const unitIds = Object.keys(EVO_CREDENTIALS);
    let allMembers = [];
    const PAGE_SIZE = 500; // Padronizado com listAllMembers para eficiência

    try {
        const allUnitPromises = unitIds.map(async (unitId) => {
            // Lógica de busca e paginação robusta, copiada de listAllMembers
            const apiClientV2 = getEvoApiClient(unitId, 'v2');
            const apiParams = { page: 1, take: PAGE_SIZE, status: 1 }; // Sempre status 1 (ativos) para o ranking

            const firstPageResponse = await apiClientV2.get("/members", { params: apiParams });
            const totalMembers = parseInt(firstPageResponse.headers["total"] || "0", 10);
            let unitMembers = firstPageResponse.data || [];

            if (totalMembers > PAGE_SIZE) {
                const totalPages = Math.ceil(totalMembers / PAGE_SIZE);
                // Loop sequencial para evitar sobrecarregar a API com muitas requisições simultâneas
                for (let page = 2; page <= totalPages; page++) {
                    try {
                        apiParams.page = page;
                        const subsequentPageResponse = await apiClientV2.get("/members", { params: apiParams });
                        if (subsequentPageResponse.data) {
                            unitMembers = unitMembers.concat(subsequentPageResponse.data);
                        }
                    } catch (pageError) {
                        functions.logger.error(`Erro ao buscar a página ${page} para a unidade ${unitId} no ranking público:`, pageError.message);
                        // Continua para as próximas páginas mesmo que uma falhe
                    }
                }
            }
            return unitMembers;
        });

        const results = await Promise.all(allUnitPromises);
        allMembers = results.flatMap(result => result || []);
        
        functions.logger.info(`Total de ${allMembers.length} membros carregados para o ranking público.`);
        return allMembers;

    } catch (error) {
        functions.logger.error(`Erro detalhado ao gerar ranking público:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        throw new functions.https.HttpsError("internal", "Não foi possível gerar o ranking.");
    }
});


/**
 * Busca o total de entries (check-ins) de hoje para uma unidade específica ou para todas.
 */
exports.getTodaysTotalEntries = functions.runWith({ timeoutSeconds: 120 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { unitId } = data; // Recebe o unitId do frontend

    const nowInSaoPaulo = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const year = nowInSaoPaulo.getFullYear();
    const month = String(nowInSaoPaulo.getMonth() + 1).padStart(2, '0');
    const day = String(nowInSaoPaulo.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const getUnitEntries = async (unitId) => {
        try {
            const apiClient = getEvoApiClient(unitId, 'v1');
            const response = await apiClient.get("/entries", {
                params: {
                    registerDateStart: `${today}T00:00:00Z`,
                    registerDateEnd: `${today}T23:59:59Z`,
                    take: 1000
                }
            });
            const entriesData = response.data || [];
            return Array.isArray(entriesData) ? entriesData.length : 0;
        } catch (error) {
            functions.logger.error(`Erro ao buscar entries da unidade '${unitId}' para hoje:`, error.message);
            return 0; // Retorna 0 em caso de erro para não quebrar a soma total.
        }
    };

    try {
        const unitIdsToFetch = (unitId && unitId !== 'geral') ? [unitId] : Object.keys(EVO_CREDENTIALS);

        const promises = unitIdsToFetch.map(id => getUnitEntries(id));
        const results = await Promise.all(promises);

        const totalEntries = results.reduce((sum, count) => sum + count, 0);
        
        const logMessage = (unitId && unitId !== 'geral') 
            ? `Total de entries para ${unitId} hoje (${today}): ${totalEntries}`
            : `Total de entries de hoje (${today}): ${totalEntries}`;
        functions.logger.info(logMessage);

        return { totalEntries };

    } catch (error) {
        functions.logger.error("Falha geral ao buscar o total de entries de hoje:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível buscar o total de check-ins de hoje.");
    }
});
