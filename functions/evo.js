const functions = require("firebase-functions/v1");
const axios = require("axios");
const admin = require("firebase-admin");
// const cors = require("cors")({origin: true}); // Replaced with manual CORS handling
const https = require("https");

// A inicialização do Admin SDK é feita no index.js
const db = admin.firestore();

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
    },
    store: {
        dns: "atadf",
        token: "F5389AF2-DEA8-49E4-850F-7365A5077CC6",
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
        baseURL: `https://evo-integracao-api.w12app.com.br/api/${apiVersion}`,
        headers: {
            "Authorization": `Basic ${Buffer.from(`${credentials.dns}:${credentials.token}`).toString("base64")}`,
            "Content-Type": "application/json"
        },
        httpsAgent: httpsAgent
    });
}

/**
 * Busca alunos ativos de uma unidade específica.
 * Usada internamente e por outras funções (como a integração Olist).
 */
async function getActiveStudentsFromUnit(unitId) {
    const apiClientV2 = getEvoApiClient(unitId, 'v2');
    const PAGE_SIZE = 500;
    let allMembers = [];

    // Função auxiliar para buscar páginas
    const fetchAllPages = async (status) => {
        let currentPage = 1;
        let hasMorePages = true;
        let members = [];

        while (hasMorePages) {
            try {
                const response = await apiClientV2.get("/members", {
                    params: {
                        page: currentPage,
                        take: PAGE_SIZE,
                        status: status, // 1 = Ativo
                        showMemberships: false, // Não precisamos de detalhes de contrato para essa sync, economiza banda
                        showContacts: true // Precisamos dos contatos para extrair email e telefone
                    }
                });
                const pageMembers = response.data || [];

                if (pageMembers.length > 0) {
                    members = members.concat(pageMembers);
                }

                if (pageMembers.length < PAGE_SIZE) {
                    hasMorePages = false;
                }
                currentPage++;
            } catch (error) {
                console.error(`Erro ao buscar página ${currentPage} da unidade ${unitId}:`, error.message);
                hasMorePages = false;
            }
        }
        return members;
    };

    // Busca apenas ativos (status 1)
    allMembers = await fetchAllPages(1);

    return allMembers;
}

exports.getActiveStudentsFromUnit = getActiveStudentsFromUnit;

/**
 * Busca os dados de um membro específico na API da EVO.
 */
exports.getMemberDetails = functions.https.onRequest(async (req, res) => {
    // Manual CORS handling
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    // Authentication check
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        functions.logger.error("Unauthorized: No authorization token.");
        return res.status(403).send('Unauthorized');
    }

    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        functions.logger.error("Invalid token:", error);
        return res.status(403).send('Unauthorized');
    }

    const { memberId, unitId } = req.body.data;
    if (!memberId) {
        return res.status(400).send({ error: "O ID do membro é obrigatório." });
    }
    const memberIdInt = parseInt(memberId, 10);

    const validUnitId = unitId && EVO_CREDENTIALS[unitId] ? unitId : 'centro';

    try {
        const apiClientV2 = getEvoApiClient(validUnitId, 'v2');
        const response = await apiClientV2.get(`/members/${memberIdInt}`, {
            params: { showMemberships: true, showsResponsibles: true }
        });

        const memberData = response.data;

        if (memberData && memberData.idEmployeeInstructor) {
            try {
                const employeeResponse = await apiClientV2.get(`/employees/${memberData.idEmployeeInstructor}`);
                const employeeData = employeeResponse.data;
                if (employeeData) {
                    memberData.nameEmployeeInstructor = `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim();
                }
            } catch (employeeError) {
                functions.logger.warn(`Could not fetch instructor with ID ${memberData.idEmployeeInstructor}.`, employeeError.message);
            }
        }

        let totalCoins = 0;
        if (memberData.hasOwnProperty('totalFitCoins')) {
            totalCoins = memberData.totalFitCoins;
        } else if (memberData.hasOwnProperty('fitCoins')) {
            totalCoins = memberData.fitCoins;
        } else if (Array.isArray(memberData.memberships) && memberData.memberships.length > 0) {
            totalCoins = memberData.memberships.reduce((sum, m) => sum + (m.fitCoins || 0), 0);
        }
        memberData.totalFitCoins = totalCoins;

        functions.logger.info(`EVO API response for getMemberDetails (ID: ${memberId}):`, memberData);
        return res.status(200).send({ data: memberData });
    } catch (error) {
        functions.logger.error(`Detailed error fetching member ${memberId}:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        return res.status(500).send({ error: "Could not fetch member data." });
    }
});

/**
 * Sincroniza dados de alunos do EVO para o cache no Firestore
 * Pode ser chamada manualmente ou agendada
 */
exports.syncEvoStudentsToCache = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    // Apenas admins podem sincronizar
    const token = context.auth.token;
    if (!token.isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Apenas administradores podem sincronizar o cache.");
    }

    const { unitId } = data;
    const unitIdsToSync = (unitId && unitId !== 'all') ? [unitId] : Object.keys(EVO_CREDENTIALS);

    functions.logger.info(`Iniciando sincronização do cache para ${unitIdsToSync.length} unidades`);

    const results = {
        success: [],
        failed: [],
        totalStudents: 0
    };

    try {
        for (const currentUnitId of unitIdsToSync) {
            try {
                functions.logger.info(`Sincronizando unidade: ${currentUnitId}`);
                const apiClientV2 = getEvoApiClient(currentUnitId, 'v2');
                let unitMembers = [];
                let fetchSuccess = false;

                // Função auxiliar para buscar todas as páginas de um determinado status
                const fetchAllPages = async (status, showMemberships) => {
                    const PAGE_SIZE = 500;
                    const apiParams = { page: 1, take: PAGE_SIZE, showMemberships, status };
                    let currentPage = 1;
                    let hasMorePages = true;
                    let members = [];

                    while (hasMorePages) {
                        apiParams.page = currentPage;
                        const response = await apiClientV2.get("/members", { params: apiParams });
                        const pageMembers = response.data || [];
                        if (pageMembers.length > 0) members = members.concat(pageMembers);
                        if (pageMembers.length < PAGE_SIZE) hasMorePages = false;
                        currentPage++;
                    }
                    return members;
                };

                // Tenta primeiro COM memberships para pegar moedas extras (FitCoins)
                try {
                    functions.logger.info(`  -> Tentando com memberships para ${currentUnitId}...`);
                    const active = await fetchAllPages(1, true);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const inactive = await fetchAllPages(2, true);
                    unitMembers = active.concat(inactive);
                    fetchSuccess = true;
                    functions.logger.info(`  ✓ Sucesso com memberships para ${currentUnitId}`);
                } catch (error) {
                    // Se falhar (provavelmente 500 ou timeout), tenta SEM memberships
                    functions.logger.warn(`  ⚠️ Falha com memberships em ${currentUnitId} (${error.message}). Tentando sem...`);
                    const active = await fetchAllPages(1, false);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const inactive = await fetchAllPages(2, false);
                    unitMembers = active.concat(inactive);
                    fetchSuccess = true;
                    functions.logger.info(`  ✓ Sucesso (fallback sem memberships) para ${currentUnitId}`);
                }

                if (fetchSuccess) {
                    // Normaliza dados e prepara para salvar
                    functions.logger.info(`  💾 Salvando ${unitMembers.length} alunos no Firestore para a unidade ${currentUnitId}...`);

                    // Salvamento em lotes (max 500 por lote)
                    const BATCH_SIZE = 500;
                    for (let i = 0; i < unitMembers.length; i += BATCH_SIZE) {
                        const batch = db.batch();
                        const currentBatch = unitMembers.slice(i, i + BATCH_SIZE);

                        currentBatch.forEach(member => {
                            member.branchName = member.branchName || currentUnitId;
                            member.unitId = currentUnitId;

                            // Normalização de FitCoins
                            let totalCoins = 0;
                            if (member.hasOwnProperty('totalFitCoins')) {
                                totalCoins = member.totalFitCoins;
                            } else if (member.hasOwnProperty('fitCoins')) {
                                totalCoins = member.fitCoins;
                            } else if (Array.isArray(member.memberships) && member.memberships.length > 0) {
                                totalCoins = member.memberships.reduce((sum, m) => sum + (m.fitCoins || 0), 0);
                            }
                            member.totalFitCoins = totalCoins;
                            member.lastUpdated = admin.firestore.FieldValue.serverTimestamp();

                            // Referência única por membro
                            const memberRef = db.collection('evo_students').doc(String(member.idMember));
                            batch.set(memberRef, member, { merge: true });
                        });

                        await batch.commit();
                        functions.logger.info(`    ✓ Processados ${Math.min(i + BATCH_SIZE, unitMembers.length)}/${unitMembers.length}`);
                    }

                    // Salva status da sincronização por unidade
                    await db.collection('evo_sync_status').doc(currentUnitId).set({
                        lastSync: admin.firestore.FieldValue.serverTimestamp(),
                        totalStudents: unitMembers.length,
                        status: 'success'
                    });

                    results.success.push(currentUnitId);
                    results.totalStudents += unitMembers.length;

                    // Delay para respeitar rate limit do EVO se houver mais unidades
                    if (unitIdsToSync.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

            } catch (unitError) {
                functions.logger.error(`✗ Erro fatal na unidade ${currentUnitId}:`, unitError);

                await db.collection('evo_sync_status').doc(currentUnitId).set({
                    lastSync: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'error',
                    errorMessage: unitError.message
                }, { merge: true });

                results.failed.push({ unitId: currentUnitId, error: unitError.message });
            }
        }

        functions.logger.info(`Sincronização concluída: ${results.success.length} sucesso, ${results.failed.length} falhas, ${results.totalStudents} alunos totais`);
        return results;

    } catch (error) {
        functions.logger.error("Erro na sincronização:", error);
        throw new functions.https.HttpsError("internal", "Erro ao sincronizar cache de alunos.");
    }
});

/**
 * Lista todos os membros - AGORA COM CACHE!
 * Busca do cache primeiro, fallback para API se necessário
 */
exports.listAllMembers = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { unitId, name, forceRefresh } = data;
    functions.logger.info(`Buscando alunos com filtros: unitId=${unitId}, name=${name}, forceRefresh=${forceRefresh}`);

    const unitIdsToFetch = (unitId && unitId !== 'all') ? [unitId] : Object.keys(EVO_CREDENTIALS);
    const CACHE_TTL_HOURS = 24;
    const PAGE_SIZE = 500;

    try {
        let allMembers = [];
        let usedCache = false;

        // Se não forçar refresh, tenta usar o cache do Firestore
        if (!forceRefresh) {
            functions.logger.info("Verificando status do cache por unidade...");

            const syncStatusPromises = unitIdsToFetch.map(id => db.collection('evo_sync_status').doc(id).get());
            const syncStatusSnaps = await Promise.all(syncStatusPromises);

            const validUnitIds = [];

            syncStatusSnaps.forEach((snap, index) => {
                const unitId = unitIdsToFetch[index];
                if (snap.exists) {
                    const statusData = snap.data();
                    const lastSync = statusData.lastSync?.toDate();
                    const now = new Date();
                    const hoursSinceSync = lastSync ? (now - lastSync) / (1000 * 60 * 60) : 999;

                    if (hoursSinceSync < CACHE_TTL_HOURS && statusData.status === 'success') {
                        validUnitIds.push(unitId);
                    }
                }
            });

            if (validUnitIds.length === unitIdsToFetch.length) {
                functions.logger.info(`Buscando todas as ${validUnitIds.length} unidades do Firestore`);

                const memberQueries = validUnitIds.map(uid =>
                    db.collection('evo_students').where('unitId', '==', uid).get()
                );

                const memberSnaps = await Promise.all(memberQueries);
                memberSnaps.forEach(snap => {
                    snap.forEach(doc => allMembers.push(doc.data()));
                });

                usedCache = true;
                functions.logger.info(`✓ Carregados ${allMembers.length} alunos do Firestore`);
            }
        }

        if (!usedCache) {
            functions.logger.info("Buscando dados via API do EVO e atualizando Firestore...");
            const results = [];

            for (const currentUnitId of unitIdsToFetch) {
                functions.logger.info(`Processando unidade via API: ${currentUnitId}`);

                try {
                    const apiClientV2 = getEvoApiClient(currentUnitId, 'v2');
                    let unitMembers = [];

                    const fetchAllPagesForStatus = async (status) => {
                        const PAGE_SIZE = 500;
                        const apiParams = { page: 1, take: PAGE_SIZE, showMemberships: false, status: status };
                        if (name && name.trim() !== '') {
                            apiParams.name = name.trim();
                        }

                        let currentPage = 1;
                        let hasMorePages = true;
                        let statusMembers = [];

                        while (hasMorePages) {
                            apiParams.page = currentPage;
                            const response = await apiClientV2.get("/members", { params: apiParams });
                            const members = response.data || [];
                            if (members.length > 0) statusMembers = statusMembers.concat(members);
                            if (members.length < PAGE_SIZE) hasMorePages = false;
                            currentPage++;
                        }
                        return statusMembers;
                    };

                    const activeMembers = await fetchAllPagesForStatus(1);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const inactiveMembers = await fetchAllPagesForStatus(2);

                    unitMembers = (activeMembers || []).concat(inactiveMembers || []);

                    // Normaliza e Salva em Lote
                    const batch = db.batch();
                    unitMembers.forEach(member => {
                        member.branchName = member.branchName || currentUnitId;
                        member.unitId = currentUnitId;

                        let totalCoins = 0;
                        if (member.hasOwnProperty('totalFitCoins')) {
                            totalCoins = member.totalFitCoins;
                        } else if (member.hasOwnProperty('fitCoins')) {
                            totalCoins = member.fitCoins;
                        } else if (Array.isArray(member.memberships) && member.memberships.length > 0) {
                            totalCoins = member.memberships.reduce((sum, m) => sum + (m.fitCoins || 0), 0);
                        }
                        member.totalFitCoins = totalCoins;
                        member.lastUpdated = admin.firestore.FieldValue.serverTimestamp();

                        const memberRef = db.collection('evo_students').doc(String(member.idMember));
                        batch.set(memberRef, member, { merge: true });
                    });

                    // Nota: Se houver mais de 500 membros, o batch falhará. 
                    // Mas para listAllMembers (geralmente filtrado ou unitário) deve servir.
                    // Para segurança total em listAllMembers síncrono, talvez não salvar tudo se for muito grande.
                    if (unitMembers.length <= 500) {
                        await batch.commit();
                    }

                    results.push(unitMembers);
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (unitError) {
                    functions.logger.error(`Erro na unidade ${currentUnitId}:`, unitError);
                    results.push([]);
                }
            }

            allMembers = results.flatMap(result => result || []);
        }

        // Filtra por nome se especificado E se usou cache (API já filtra)
        if (name && name.trim() !== '' && usedCache) {
            const searchTerm = name.trim().toLowerCase();
            allMembers = allMembers.filter(member => {
                const fullName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
                return fullName.includes(searchTerm);
            });
        }

        // Remove duplicatas e garante números corretos para moedas
        const uniqueStudentsMap = new Map();
        allMembers.forEach(student => {
            const studentCoins = Number(student.totalFitCoins) || 0;
            student.totalFitCoins = studentCoins;
            const existingStudent = uniqueStudentsMap.get(student.idMember);
            if (!existingStudent || studentCoins > existingStudent.totalFitCoins) {
                uniqueStudentsMap.set(student.idMember, student);
            }
        });

        const finalMembers = Array.from(uniqueStudentsMap.values());
        functions.logger.info(`Retornando ${finalMembers.length} alunos (fonte: ${usedCache ? 'CACHE' : 'API'})`);
        return { data: finalMembers };

    } catch (error) {
        functions.logger.error("Erro fatal em listAllMembers:", error);
        throw new functions.https.HttpsError("internal", error.message);
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
exports.getActiveContractsCountHttp = functions.runWith({ timeoutSeconds: 120 }).https.onRequest((req, res) => {
    // Manual CORS handling
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    (async () => {
        try {
            // O cliente pode enviar os dados diretamente no corpo ou dentro de um objeto 'data'.
            const { unitId } = req.body.data || req.body;
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

                        if (count > 0) {
                            await cacheRef.set({
                                count: count,
                                timestamp: admin.firestore.FieldValue.serverTimestamp()
                            });
                            return count;
                        }

                        if (attempt < MAX_RETRIES) {
                            const delay = 250 * attempt;
                            functions.logger.warn(`[${executionId}] API | Tentativa ${attempt} para '${id}' retornou 0. Tentando novamente em ${delay}ms...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        } else {
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

                functions.logger.error(`[${executionId}] Todas as ${MAX_RETRIES} tentativas de API falharam para a unidade '${id}'.`, lastError?.message);
                const finalCacheDoc = await cacheRef.get();
                if (finalCacheDoc.exists) {
                    const staleCount = finalCacheDoc.data().count;
                    functions.logger.warn(`[${executionId}] Usando valor de cache antigo para '${id}' como fallback: ${staleCount}`);
                    return staleCount;
                }

                functions.logger.error(`[${executionId}] Sem resposta da API e sem cache para '${id}'. Retornando 0.`);
                return 0;
            };

            let result;
            if (unitId && unitId !== 'geral') {
                const count = await getCountForUnit(unitId);
                functions.logger.info(`[${executionId}] Retornando contagem única para '${unitId}': ${count}`);
                result = { [unitId]: count };
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
                result = { totalGeral: finalCounts.totalGeral, ...finalCounts.counts };
            }
            res.status(200).send({ data: result });

        } catch (error) {
            functions.logger.error("Erro geral ao buscar contagem de contratos:", error);
            const message = error.message || "Não foi possível buscar a contagem de contratos ativos.";
            res.status(500).send({ error: { message } });
        }
    })();
});

/**
 * Verifica se um aluno com um determinado e-mail existe em qualquer uma das unidades EVO.
 * Busca os dados de um aluno no EVO pelo e-mail.
 * Retorna os dados do aluno se encontrado, ou null caso contrário.
 */
exports.getStudentDataByEmail = functions.https.onCall(async (data, context) => {
    const { email } = data;
    if (!email) {
        throw new functions.https.HttpsError("invalid-argument", "O e-mail é obrigatório.");
    }
    const normalizedEmail = email.toLowerCase().trim();

    const unitIds = Object.keys(EVO_CREDENTIALS);

    // Tenta encontrar o aluno em qualquer unidade.
    for (const unitId of unitIds) {
        try {
            const apiClientV2 = getEvoApiClient(unitId, 'v2');
            const PAGE_SIZE = 500;
            let currentPage = 1;
            let hasMorePages = true;

            while (hasMorePages) {
                const response = await apiClientV2.get("/members", {
                    params: { page: currentPage, take: PAGE_SIZE, status: 0 } // status 0 = todos
                });
                const members = response.data || [];

                const foundMember = members.find(member =>
                    member.contacts?.some(contact =>
                        (contact.idContactType === 4 || contact.contactType === 'E-mail') &&
                        contact.description?.toLowerCase().trim() === normalizedEmail
                    )
                );

                if (foundMember) {
                    functions.logger.info(`Aluno encontrado para o e-mail ${normalizedEmail} na unidade ${unitId}.`, foundMember);
                    // Retorna os dados essenciais para criar o perfil
                    return {
                        exists: true,
                        evoMemberId: foundMember.idMember,
                        firstName: foundMember.firstName,
                        lastName: foundMember.lastName,
                        email: normalizedEmail,
                        unitId: unitId // Retorna a unidade onde o aluno foi encontrado
                    };
                }

                if (members.length < PAGE_SIZE) {
                    hasMorePages = false;
                }
                currentPage++;
            }
        } catch (error) {
            functions.logger.error(`Erro ao buscar membros na unidade ${unitId} para o email ${normalizedEmail}:`, error.message);
            // Continua para a próxima unidade em caso de erro
        }
    }

    // Se o loop terminar sem encontrar o aluno
    functions.logger.warn(`Nenhum aluno encontrado para o e-mail: ${normalizedEmail}`);
    return { exists: false };
});

/**
 * Define a senha de um usuário do Firebase Auth e cria seu perfil no Firestore.
 * Recebe todos os dados do aluno para garantir a criação completa do perfil.
 */
exports.setStudentPassword = functions.https.onCall(async (data, context) => {
    const { email, newPassword, evoMemberId, firstName, lastName, unitId } = data;

    // Validação mais flexível: firstName não é mais obrigatório.
    if (!email || !newPassword || !evoMemberId || !unitId) {
        throw new functions.https.HttpsError("invalid-argument", "Dados essenciais (email, senha, id, unidade) são obrigatórios.");
    }

    if (newPassword.length < 6) {
        throw new functions.https.HttpsError("invalid-argument", "A senha deve ter pelo menos 6 caracteres.");
    }

    try {
        let userRecord;
        try {
            // Tenta buscar o usuário existente
            userRecord = await admin.auth().getUserByEmail(email);
            functions.logger.info(`Usuário encontrado (${userRecord.uid}). Atualizando senha para: ${email}`);
            // Se o usuário existe, apenas atualiza a senha
            await admin.auth().updateUser(userRecord.uid, {
                password: newPassword,
            });
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                // Se o usuário não existe, cria um novo com o e-mail e a senha
                functions.logger.info(`Usuário não encontrado. Criando novo usuário para: ${email}`);
                const displayName = (`${firstName || ''} ${lastName || ''}`.trim()) || email.split('@')[0];
                userRecord = await admin.auth().createUser({
                    email: email,
                    password: newPassword,
                    displayName: displayName,
                    emailVerified: true,
                });
            } else {
                // Propaga outros erros
                throw error;
            }
        }

        // Após garantir que o usuário Auth existe, cria/atualiza o documento no Firestore
        const userDocRef = db.collection('users').doc(userRecord.uid);
        const name = (`${firstName || ''} ${lastName || ''}`.trim()) || email.split('@')[0];
        await userDocRef.set({
            name: name,
            email: email,
            isAdmin: false,
            evoMemberId: evoMemberId,
            unitId: unitId
        }, { merge: true }); // Usa merge: true para não sobrescrever outros campos se o doc já existir

        functions.logger.info(`Perfil do Firestore criado/atualizado para o usuário: ${userRecord.uid}`);

        // Retorna sucesso e o UID do usuário para o cliente poder fazer o login
        return { success: true, uid: userRecord.uid };

    } catch (error) {
        functions.logger.error(`Erro ao criar/atualizar senha para o e-mail ${email}:`, error);
        throw new functions.https.HttpsError("internal", "Ocorreu um erro ao processar a solicitação de senha.");
    }
});

/**
 * Retorna a lista de unidades configuradas para a API EVO.
 */
exports.getEvoUnitsHttp = functions.https.onRequest((req, res) => {
    // Manual CORS handling
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    (async () => {
        try {
            const units = Object.keys(EVO_CREDENTIALS);
            res.status(200).send({ data: units });
        } catch (error) {
            functions.logger.error("Erro em getEvoUnitsHttp:", error);
            res.status(500).send({ error: { message: "Erro interno ao buscar unidades." } });
        }
    })();
});


/**
 * Retorna a lista de unidades configuradas para a API EVO (versão pública).
 */
exports.getPublicEvoUnits = functions.https.onCall(async (data, context) => {
    // Esta função é pública e não requer autenticação.
    return Object.keys(EVO_CREDENTIALS);
});

/**
 * Alias para getPublicEvoUnits (para compatibilidade com código existente).
 */
exports.getEvoUnits = functions.https.onCall(async (data, context) => {
    return Object.keys(EVO_CREDENTIALS);
});

/**
 * Busca o número de contratos ativos para uma ou todas as unidades (versão callable).
 */
exports.getActiveContractsCount = functions.runWith({ timeoutSeconds: 120 }).https.onCall(async (data, context) => {
    const { unitId } = data || {};
    const executionId = Math.random().toString(36).substring(2, 10);
    functions.logger.info(`[${executionId}] Iniciando getActiveContractsCount (callable) para unitId: ${unitId || 'geral'}`);

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

                if (count > 0) {
                    await cacheRef.set({
                        count: count,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                    return count;
                }

                if (attempt < MAX_RETRIES) {
                    const delay = 250 * attempt;
                    functions.logger.warn(`[${executionId}] API | Tentativa ${attempt} para '${id}' retornou 0. Tentando novamente em ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    functions.logger.warn(`[${executionId}] API | Última tentativa para '${id}' retornou 0.`);
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

        // Fallback para cache antigo se disponível
        try {
            const finalCacheDoc = await cacheRef.get();
            if (finalCacheDoc.exists) {
                const staleCount = finalCacheDoc.data().count;
                functions.logger.warn(`[${executionId}] Usando cache antigo para '${id}' após falha: ${staleCount}`);
                return staleCount;
            }
        } catch (e) {
            // Ignorar erro de cache
        }

        functions.logger.error(`[${executionId}] Sem resposta da API e sem cache para '${id}'. Retornando 0.`);
        return 0;
    };

    try {
        if (unitId && unitId !== 'geral') {
            const count = await getCountForUnit(unitId);
            functions.logger.info(`[${executionId}] Retornando contagem única para '${unitId}': ${count}`);
            return { unitId, count };
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
        functions.logger.error(`[${executionId}] Erro em getActiveContractsCount:`, error);
        throw new functions.https.HttpsError("internal", `Erro ao buscar contratos: ${error.message}`);
    }
});

/**
 * Busca o total de entries (check-ins) de hoje (versão callable).
 */
exports.getTodaysTotalEntries = functions.runWith({ timeoutSeconds: 120 }).https.onCall(async (data, context) => {
    const { unitId } = data || {};

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
            return 0;
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

        return { totalEntries, date: today };
    } catch (error) {
        functions.logger.error("Erro em getTodaysTotalEntries:", error);
        throw new functions.https.HttpsError("internal", `Erro ao buscar entries: ${error.message}`);
    }
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

        let snapshotData = results.reduce((acc, result) => {
            acc.units[result.id] = {
                contracts: result.contractsCount,
                dailyActives: result.dailyActivesCount
            };
            acc.totalContracts += result.contractsCount;
            acc.totalDailyActives += result.dailyActivesCount;
            return acc;
        }, { totalContracts: 0, totalDailyActives: 0, units: {} });

        // Buscar dados de vendas da loja para o dia
        const todayStart = new Date(nowInSaoPaulo);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(nowInSaoPaulo);
        todayEnd.setHours(23, 59, 59, 999);

        const salesQuery = db.collection('inscricoesFaixaPreta')
            .where('created', '>=', todayStart)
            .where('created', '<=', todayEnd);

        const salesSnapshot = await salesQuery.get();
        const sales = salesSnapshot.docs
            .map(doc => doc.data())
            .filter(sale => sale.paymentStatus === 'paid');

        const totalSales = sales.length;
        const totalRevenue = sales.reduce((acc, sale) => acc + (sale.amountTotal || 0), 0);

        // Calcula a receita por unidade
        const revenueByUnit = sales.reduce((acc, sale) => {
            const unitId = sale.userUnit || 'desconhecida';
            if (!acc[unitId]) {
                acc[unitId] = 0;
            }
            acc[unitId] += sale.amountTotal || 0;
            return acc;
        }, {});

        // Adiciona a receita da loja a cada unidade no snapshot
        for (const unitId in revenueByUnit) {
            if (snapshotData.units[unitId]) {
                snapshotData.units[unitId].storeRevenue = revenueByUnit[unitId];
            } else {
                // Caso a unidade da venda não exista na lista de unidades EVO (ex: 'store')
                snapshotData.units[unitId] = {
                    contracts: 0,
                    dailyActives: 0,
                    storeRevenue: revenueByUnit[unitId]
                };
            }
        }

        // Adicionar totais da loja ao snapshot
        snapshotData.storeTotalSales = totalSales;
        snapshotData.storeTotalRevenue = totalRevenue;

        snapshotData.timestamp = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('evo_daily_snapshots').add(snapshotData);
        functions.logger.info("Snapshot diário do EVO e da Loja salvo com sucesso:", snapshotData);
    } catch (error) {
        functions.logger.error("Falha ao criar snapshot diário:", error);
        throw error;
    }
};

exports.snapshotDailyEvoData = functions.pubsub.schedule('0 23 * * *').timeZone('America/Sao_Paulo').onRun(async (context) => {
    await _snapshotDailyEvoData();
});

exports.triggerSnapshot = functions.https.onCall(async (data, context) => {
    // Verificação de autenticação e permissão para onCall
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const uid = context.auth.uid;
    const userDoc = await admin.firestore().collection('users').doc(uid).get();

    if (!userDoc.exists || !userDoc.data().isAdmin) {
        functions.logger.error(`Permissão negada para UID: ${uid}.`);
        throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para executar esta ação.");
    }

    try {
        // Lógica principal da função
        await _snapshotDailyEvoData();
        return { success: true, message: "Snapshot manual gerado com sucesso!" };
    } catch (error) {
        functions.logger.error("Falha ao acionar snapshot manual:", error);
        throw new functions.https.HttpsError("internal", "Falha ao gerar snapshot.", error.message);
    }
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
 * Agora busca todos os alunos (status 0) e seus detalhes de membresia para garantir a precisão dos FitCoins.
 */
exports.getPublicRanking = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    try {
        functions.logger.info("Iniciando busca do Ranking Público no Firestore");
        const db = admin.firestore();

        // Busca apenas quem tem moedas, ordenado de forma decrescente
        const rankingQuery = await db.collection('evo_students')
            .where('totalFitCoins', '>', 0)
            .orderBy('totalFitCoins', 'desc')
            .limit(200)
            .get();

        if (rankingQuery.empty) {
            functions.logger.warn("Nenhum aluno com moedas encontrado.");
            return [];
        }

        const sortedRanking = [];
        rankingQuery.forEach(doc => {
            sortedRanking.push(doc.data());
        });

        functions.logger.info(`Ranking carregado: ${sortedRanking.length} alunos retornados.`);
        return sortedRanking;

    } catch (error) {
        functions.logger.error("Erro ao carregar ranking do Firestore:", error);
        throw new functions.https.HttpsError("internal", "Erro ao carregar ranking.");
    }
});



/**
 * Busca o total de entries (check-ins) de hoje para uma unidade específica ou para todas.
 */
exports.getTodaysTotalEntriesHttp = functions.runWith({ timeoutSeconds: 120 }).https.onRequest(async (req, res) => {
    // Manual CORS handling
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const { unitId } = req.body.data || req.body;

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
                return 0;
            }
        };

        const unitIdsToFetch = (unitId && unitId !== 'geral') ? [unitId] : Object.keys(EVO_CREDENTIALS);

        const promises = unitIdsToFetch.map(id => getUnitEntries(id));
        const results = await Promise.all(promises);

        const totalEntries = results.reduce((sum, count) => sum + count, 0);

        const logMessage = (unitId && unitId !== 'geral')
            ? `Total de entries para ${unitId} hoje (${today}): ${totalEntries}`
            : `Total de entries de hoje (${today}): ${totalEntries}`;
        functions.logger.info(logMessage);

        const result = { totalEntries };
        res.status(200).send({ data: result });

    } catch (error) {
        functions.logger.error("Falha geral ao buscar o total de entries de hoje:", error);
        const message = error.message || "Não foi possível buscar o total de check-ins de hoje.";
        res.status(500).send({ error: { message } });
    }
});


/**
 * Busca prospects de uma unidade específica na API EVO (v1).
 */
async function getProspectsFromUnit(unitId) {
    console.log(`[getProspectsFromUnit] Iniciando busca para unidade: ${unitId}`);

    const apiClientV1 = getEvoApiClient(unitId, 'v1');
    const PAGE_SIZE = 50; // Use a smaller page size for prospects as they might be heavier? Or standard 50. Docs example uses 'take'
    let allProspects = [];

    // Helper to fetch all pages
    const fetchAllPages = async () => {
        let currentSkip = 0;
        let hasMore = true;
        let prospects = [];

        // Safety limit to avoid infinite loops in mass fetch
        const MAX_PAGES = 100; // 5000 prospects max per fetch? Let's be careful.
        let pagesFetched = 0;

        while (hasMore && pagesFetched < MAX_PAGES) {
            try {
                console.log(`[getProspectsFromUnit] Fetching page ${pagesFetched + 1} (skip: ${currentSkip})...`);
                // Params: take, skip
                // Docs: curl .../api/v1/prospects?take&skip
                const response = await apiClientV1.get("/prospects", {
                    params: {
                        take: PAGE_SIZE,
                        skip: currentSkip
                    }
                });

                const pageData = response.data || [];
                console.log(`[getProspectsFromUnit] Page ${pagesFetched + 1} returned ${pageData.length} items.`);

                if (pageData.length > 0) {
                    prospects = prospects.concat(pageData);
                    currentSkip += PAGE_SIZE;
                }

                if (pageData.length < PAGE_SIZE) {
                    hasMore = false;
                }
                pagesFetched++;

            } catch (error) {
                console.error(`[getProspectsFromUnit] Erro ao buscar prospects (skip: ${currentSkip}):`, error.message);
                if (error.response) {
                    console.error('[getProspectsFromUnit] Response Status:', error.response.status);
                    console.error('[getProspectsFromUnit] Response Data:', JSON.stringify(error.response.data));
                }
                hasMore = false; // Stop on error
                throw error; // Re-throw to be caught by index.js
            }
        }
        return prospects;
    };

    allProspects = await fetchAllPages();
    return allProspects;
}

exports.getProspectsFromUnit = getProspectsFromUnit;

/**
 * Verifica quais desses IDs de membros EVO possuem cadastro no Firebase.
 * Recebe uma lista de IDs e retorna os IDs que possuem cadastro.
 */
exports.getRegisteredUsersByEvoId = functions.https.onCall(async (data, context) => {
    // Autenticação opcional para visualização, mas recomendada para evitar abuso.
    // Vamos permitir que instrutores/admins vejam.
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
    }

    const { evoIds } = data;
    if (!evoIds || !Array.isArray(evoIds)) {
        throw new functions.https.HttpsError("invalid-argument", "A lista 'evoIds' é obrigatória e deve ser um array.");
    }

    if (evoIds.length === 0) {
        return { registeredEvoIds: [] };
    }

    const db = admin.firestore();
    const registeredEvoIds = [];

    // O Firestore suporta 'in' queries com no máximo 10 valores (antes era 10, agora 30).
    // Para ser seguro e escalável, vamos fazer em batches de 30.
    const BATCH_SIZE = 30;
    const chunks = [];
    for (let i = 0; i < evoIds.length; i += BATCH_SIZE) {
        chunks.push(evoIds.slice(i, i + BATCH_SIZE));
    }

    try {
        const promises = chunks.map(async (chunk) => {
            const q = db.collection('users').where('evoMemberId', 'in', chunk);
            const snapshot = await q.get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.evoMemberId) {
                    registeredEvoIds.push(data.evoMemberId);
                }
            });
        });

        await Promise.all(promises);
        return { registeredEvoIds };

    } catch (error) {
        functions.logger.error("Erro ao verificar usuários registrados:", error);
        throw new functions.https.HttpsError("internal", "Erro ao verificar status de registro dos alunos.");
    }
});
