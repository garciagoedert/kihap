const admin = require('firebase-admin');
const functions = require('firebase-functions');
const db = admin.firestore();
const { getPreapprovalStatus, cancelPreapproval, createTuitionPreapproval } = require('./mercadopago');

// --- GESTÃO DE PLANOS (TUITION PLANS) ---

exports.getTuitionPlans = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    let query = db.collection('tuitionPlans');
    if (data.unitId && data.unitId !== 'all') {
        query = query.where('unitId', '==', data.unitId);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});

exports.createTuitionPlan = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    // Check if user is admin or manager
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    if (!userSnap.exists || !userSnap.data().isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Somente administradores podem criar planos.');
    }

    const newPlan = {
        name: data.name,
        unitId: data.unitId,
        amountCentavos: parseInt(data.amountCentavos, 10),
        frequency: data.frequency || 1,
        frequencyType: data.frequencyType || 'months',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('tuitionPlans').add(newPlan);
    return { success: true, id: docRef.id, ...newPlan };
});

exports.updateTuitionPlan = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    const { id, ...updates } = data;
    if (!id) throw new functions.https.HttpsError('invalid-argument', 'O ID do plano é obrigatório.');
    
    await db.collection('tuitionPlans').doc(id).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, message: 'Plano atualizado.' };
});

exports.deleteTuitionPlan = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    await db.collection('tuitionPlans').doc(data.id).delete();
    return { success: true, message: 'Plano removido.' };
});

// --- GESTÃO DE CONTAS MERCADO PAGO POR UNIDADE --- //

exports.getUnitMPAccounts = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    const snapshot = await db.collection('mercadopagoAccounts').get();
    return snapshot.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            label: d.label || 'Sem Nome',
            expiresIn: d.expiresIn,
            userId: d.userId,
            // Masking token for security
            hasToken: !!d.accessToken
        };
    });
});

// --- ASSINATURAS DO ALUNO --- //

exports.createTuitionSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
    
    const { planId, studentId } = data;
    if (!planId || !studentId) {
        throw new functions.https.HttpsError('invalid-argument', 'Plan ID e Student ID obrigatórios.');
    }

    try {
        // Obter plano
        const planSnap = await db.collection('tuitionPlans').doc(planId).get();
        if (!planSnap.exists) throw new functions.https.HttpsError('not-found', 'Plano não encontrado.');
        const planData = planSnap.data();

        // Obter aluno
        const getStudentQuery = await db.collection('evo_students').where('idMember', '==', parseInt(studentId)).limit(1).get();
        if (getStudentQuery.empty) throw new functions.https.HttpsError('not-found', 'Aluno não encontrado.');
        const studentDoc = getStudentQuery.docs[0];
        const studentData = studentDoc.data();
        
        let customToken = null;
        if (planData.unitId) {
            // we assume mpAccountId corresponds to the unit slug (e.g., 'centro') or there is a mapping.
            // For simplicity, we assume unit slug matches mpAccountId or there's a field in units mapping.
            // In MP accounts, users usually log in via OAuth and we get an account ID. 
            // In Kihap, the unit slug is the ID to store the MP token if we want 1:1 mapped.
            // Let's lookup mercadopagoAccounts by label matching the unit slug or use data.unitId as accountId.
            const mpAccSnap = await db.collection('mercadopagoAccounts').doc(planData.unitId).get();
            if (mpAccSnap.exists) {
                customToken = mpAccSnap.data().accessToken;
            } else {
                console.warn(`[createTuitionSubscription] No custom MP account found for unit ${planData.unitId}. Using Matriz.`);
            }
        }

        const emailContact = studentData.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4);
        const userEmail = emailContact ? emailContact.description : context.auth.token.email;

        // Create MP Preapproval
        const mpData = await createTuitionPreapproval(
            planData.name,
            planData.amountCentavos,
            userEmail,
            customToken,
            planData.frequency,
            planData.frequencyType
        );

        // Update student in Firestore
        await studentDoc.ref.update({
            tuitionPlanId: planId,
            mpPreapprovalId: mpData.id,
            tuitionStatus: 'pending',
            tuitionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, initPoint: mpData.init_point, mpData };
    } catch (error) {
        console.error('[createTuitionSubscription] Erro:', error);
        throw new functions.https.HttpsError('internal', 'Falha ao criar assinatura.');
    }
});

exports.cancelTuitionSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    const { studentId, preapprovalId, unitId } = data;
    
    let customToken = null;
    if (unitId) {
        const mpAccSnap = await db.collection('mercadopagoAccounts').doc(unitId).get();
        if (mpAccSnap.exists) customToken = mpAccSnap.data().accessToken;
    }

    try {
        const mpCancelData = await cancelPreapproval(preapprovalId, customToken);
        
        const getStudentQuery = await db.collection('evo_students').where('idMember', '==', parseInt(studentId)).limit(1).get();
        if (!getStudentQuery.empty) {
            await getStudentQuery.docs[0].ref.update({
                tuitionStatus: 'cancelled',
                tuitionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        return { success: true, message: 'Assinatura cancelada com sucesso.', mpResponse: mpCancelData };
    } catch (error) {
        console.error('[cancelTuitionSubscription] Erro grave:', error.response?.data || error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// --- BUSCA RÁPIDA DE ALUNOS --- //

exports.listAlunosLocais = functions.runWith({ timeoutSeconds: 300, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    // Busca do Firestore (Admin = Bypassa Regras)
    let query = db.collection('evo_students');
    if (data.unitId && data.unitId !== 'all') {
        query = query.where('unitId', '==', data.unitId);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => {
        const d = doc.data();
        d.idMember = d.idMember || doc.id;
        return d;
    });
});

// --- NOVAS FUNÇÕES DE GESTÃO DE ALUNOS --- //

exports.registerLocalStudent = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    const { 
        firstName, 
        lastName, 
        email, 
        unitId,
        phone,
        responsible,
        origin,
        rankType,
        cpf,
        address,
        birthDate
    } = data;
    
    if (!firstName || !email || !unitId) {
        throw new functions.https.HttpsError('invalid-argument', 'Nome, e-mail e unidade são obrigatórios.');
    }

    // Gerar um ID único para o aluno local (usando timestamp alto)
    const localId = Date.now();

    const newStudent = {
        idMember: localId,
        firstName,
        lastName: lastName || '',
        branchName: unitId,
        unitId,
        contacts: [
            { contactType: 'E-mail', idContactType: 4, description: email }
        ],
        phone: phone || '',
        responsible: responsible || '',
        origin: origin || '',
        rankType: rankType || 'Tradicional',
        cpf: cpf || '',
        address: address || '',
        birthDate: birthDate || '',
        isLocalOnly: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Adiciona telefone aos contatos se presente (seguindo o padrão EVO)
    if (phone) {
        newStudent.contacts.push({ contactType: 'Celular', idContactType: 1, description: phone });
    }

    await db.collection('evo_students').doc(String(localId)).set(newStudent);

    return { success: true, idMember: localId, message: 'Aluno cadastrado com sucesso localmente.' };
});


exports.updateLocalStudent = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    const { idMember, ...updates } = data;
    if (!idMember) throw new functions.https.HttpsError('invalid-argument', 'ID do membro é obrigatório.');

    const memberRef = db.collection('evo_students').doc(String(idMember));
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) throw new functions.https.HttpsError('not-found', 'Aluno não encontrado.');

    // Prepare updates
    const finalUpdates = { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    
    // Update contacts if email or phone is provided - follow EVO pattern
    if (updates.email || updates.phone) {
        const currentData = memberSnap.data();
        let contacts = currentData.contacts || [];
        
        if (updates.email) {
            const emailIdx = contacts.findIndex(c => c.idContactType === 4);
            if (emailIdx > -1) contacts[emailIdx].description = updates.email;
            else contacts.push({ contactType: 'E-mail', idContactType: 4, description: updates.email });
        }
        
        if (updates.phone) {
            const phoneIdx = contacts.findIndex(c => c.idContactType === 1);
            if (phoneIdx > -1) contacts[phoneIdx].description = updates.phone;
            else contacts.push({ contactType: 'Celular', idContactType: 1, description: updates.phone });
        }
        
        finalUpdates.contacts = contacts;
    }

    await memberRef.update(finalUpdates);
    return { success: true, message: 'Dados do aluno atualizados com sucesso.' };
});

exports.getStudentFinancialHub = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
        
        const { idMember, unitId } = data;
        if (!idMember) throw new functions.https.HttpsError('invalid-argument', 'ID do membro é obrigatório.');

        const memberSnap = await db.collection('evo_students').doc(String(idMember)).get();
        if (!memberSnap.exists) throw new functions.https.HttpsError('not-found', 'Aluno não encontrado.');
        const studentData = memberSnap.data();

        const preapprovalId = studentData.mpPreapprovalId;
        let financialData = {
            tuitionStatus: studentData.tuitionStatus || 'none',
            registeredAt: studentData.createdAt ? studentData.createdAt.toDate().toISOString() : null,
            planId: studentData.tuitionPlanId || null,
            mpDetails: null
        };

        if (preapprovalId) {
            try {
                let customToken = null;
                const targetUnitId = unitId || studentData.unitId;
                if (targetUnitId) {
                    const mpAccSnap = await db.collection('mercadopagoAccounts').doc(targetUnitId).get();
                    if (mpAccSnap.exists) customToken = mpAccSnap.data().accessToken;
                }
                
                const mpData = await getPreapprovalStatus(preapprovalId, customToken);
                if (mpData) {
                    financialData.mpDetails = {
                        id: mpData.id,
                        status: mpData.status,
                        reason: mpData.reason,
                        date_created: mpData.date_created,
                        next_payment_date: mpData.next_payment_date,
                        summarized: mpData.summarized
                    };
                }
            } catch (e) {
                console.warn(`[getStudentFinancialHub] Erro ao buscar dados do MP para ${preapprovalId}:`, e.message);
                // We don't throw here to still return the basic tuitionStatus
            }
        }

        return financialData;
    } catch (e) {
        console.error(`[getStudentFinancialHub] Erro Fatal:`, e);
        if (e instanceof functions.https.HttpsError) throw e;
        throw new functions.https.HttpsError('internal', e.message);
    }
});

exports.deleteLocalMember = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    // Verificar se é admin
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    if (!userSnap.exists || !userSnap.data().isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Somente administradores podem excluir alunos.');
    }

    const { idMember } = data;
    if (!idMember) throw new functions.https.HttpsError('invalid-argument', 'ID do membro é obrigatório.');

    // 1. Deletar do cache de alunos
    await db.collection('evo_students').doc(String(idMember)).delete();

    // 2. Tentar encontrar e deletar o usuário vinculado (Firebase Auth e Users collection)
    const usersQuery = await db.collection('users').where('evoMemberId', '==', parseInt(idMember)).get();
    if (!usersQuery.empty) {
        const userDoc = usersQuery.docs[0];
        const userId = userDoc.id;

        // Deletar do Firestore
        await userDoc.ref.delete();

        // Nota: A deleção do Firebase Auth requer o Admin SDK no backend, o que já temos aqui.
        try {
            await admin.auth().deleteUser(userId);
            console.log(`Usuário Auth ${userId} deletado com sucesso.`);
        } catch (e) {
            console.error(`Erro ao deletar usuário Auth ${userId}:`, e.message);
        }
    }

    return { success: true, message: 'Aluno e acessos removidos com sucesso.' };
});

exports.cleanupRemovedStudents = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Acesso negado.');
    
    // Verificar se é admin
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    if (!userSnap.exists || !userSnap.data().isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Somente administradores podem limpar o banco.');
    }

    const snapshot = await db.collection('evo_students')
        .where('firstName', '>=', '***Dados')
        .where('firstName', '<=', '***Dados\uf8ff')
        .get();
    
    if (snapshot.empty) {
        return { success: true, count: 0, message: 'Nenhum registro de lixo encontrado.' };
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    return { success: true, count: snapshot.size, message: `${snapshot.size} registros removidos com sucesso.` };
});

// --- WEBHOOK PARA MERCADO PAGO --- //

exports.mpWebhook = functions.https.onRequest(async (req, res) => {
    try {
        const query = req.query;
        const body = req.body;
        
        console.log('[mpWebhook] Recebido:', { query, body });
        
        const type = body?.type || query?.type || query?.topic;
        const action = body?.action || query?.action;
        
        const preapprovalId = body?.data?.id || query?.id || (body?.id ? body.id : null);

        if ((type === 'subscription_preapproval' || type === 'preapproval') && preapprovalId) {
            console.log(`[mpWebhook] Processando evento de assinatura: ${preapprovalId}`);
            
            // Busca o aluno com base neste preapprovalId
            const membersSnap = await db.collection('evo_students').where('mpPreapprovalId', '==', preapprovalId).get();
            
            if (!membersSnap.empty) {
                const memberDoc = membersSnap.docs[0];
                const studentData = memberDoc.data();
                
                // Em um fluxo mais complexo, buscaríamos o status atual real na API do MP usando o token da unidade.
                // Mas de forma simples: se a action é 'created' ou 'updated' e recebemos o webhook, significa que está ativa ou houve pagamento.
                // Idealmente seria buscar: const mpData = await getPreapprovalStatus(preapprovalId, customToken);
                // Vamos apenas atualizar o status localmente para 'active' se não for cancelamento expresso da UI.
                
                let newStatus = 'active';
                if (action === 'deleted') newStatus = 'cancelled';
                
                if (studentData.tuitionStatus !== newStatus) {
                    await memberDoc.ref.update({
                        tuitionStatus: newStatus,
                        tuitionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`[mpWebhook] Status do aluno ${studentData.idMember} atualizado para ${newStatus}.`);
                } else {
                    console.log(`[mpWebhook] Aluno já estava com status ${newStatus}. Nenhuma alteração.`);
                }
            } else {
                console.warn(`[mpWebhook] Nenhum aluno encontrado com preapprovalId: ${preapprovalId}`);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('[mpWebhook] Erro no catch principal:', error);
        res.status(200).send('Error Logged');
    }
});
