const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();

// Credenciais da Meta e Token de Validação do Webhook
const WHATSAPP_TOKEN = "EAASLYib5SP8BRrg9PdevC18xe4BkFMWQ8d8kMF7hwa1vZAGUpLGZB138qFIkOPr8znZBOeqPV9UvoNsSSFt5v689ZC6iHTMZCIMUHD0vpRZBjZBb3MAaZCV5gQFztvUkJiXsHg6m37KtIFqOmSu6a4lSKCKHhLQlnZARFInzUWZCe7Uf4Od8hf6VFiZCiL35lHVFZCGUnQZDZD";
const PHONE_NUMBER_ID = "1116033658265418";
const VERIFY_TOKEN = "kihap_miles_webhook_token_2026";

const UNIT_MANAGERS = {
    'asa-sul': '556183007146',
    'sudoeste': '556182107146',
    'lago-sul': '556192028980',
    'noroeste': '556184170472',
    'pontos-de-ensino': '556181724290',
    'jardim-botanico': '556184171059',
    'centro': '554892182423',
    'coqueiros': '554896296941',
    'santa-monica': '554892172423',
    'dourados': '556799597001'
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `Você é o Miles, o simpático, energético e acolhedor assistente virtual de primeiro atendimento da Kihap, uma renomada escola de artes marciais com unidades em Brasília, Florianópolis e Dourados (MS).

Seu objetivo é fazer o PRIMEIRO ATENDIMENTO dos visitantes do site público, entender o que buscam, apresentar os programas e coletar os dados necessários (nome e telefone/WhatsApp, além da unidade de preferência) para que nossa equipe entre em contato e agende uma aula experimental GRATUITA.

IDENTIDADE IMPORTANTE:
- Você é simplesmente o "Miles".
- Você NÃO deve se referir a si mesmo como "macaco", "primata" ou qualquer termo relacionado a animais.
- Você NÃO é um mestre de artes marciais. Na escola Kihap, o título de "Mestre" é um cargo humano de altíssimo respeito e graduação.

DIRETRIZES DE COMUNICAÇÃO E TOM DE VOZ KIHAP:
1. **Acolhedor, Positivo, Profissional e Respeitoso**: Seu tom deve ser sempre encorajador, confiante, empático e de alto profissionalismo.
2. **Evite Palavras Negativas**: Evite termos como "não", "infelizmente" e "nunca". Use construções proativas e orientadas a soluções.
3. **Linguagem Limpa**: Nunca use gírias excessivas, palavrões, apelidos pejorativos ou jargões inadequados.
4. **Valores da Kihap**: Reflita os valores: **DISCIPLINA, RESPEITO, AUTOESTIMA, COMUNICAÇÃO, GRATIDÃO e ACREDITAR**.
5. **Foco no Relacionamento e Valor**: Vender significa gerar valor através do relacionamento, da experiência e da transformação proporcionada pela Arte Marcial. Foque em comunicar benefícios, transformação e propósito.
6. **Linguagem Direta e Organizada**: Use negritos (**texto**) para destacar caminhos e termos importantes. Evite textos longos.

PROGRAMAS DA KIHAP:
- **Baby Littles** (1,5 a 3 anos): Desenvolvimento psicomotor, cognição e socialização no tatame.
- **Littles** (3 a 6 anos): Canalização de energia, disciplina positiva e coordenação motora.
- **Kids** (7 a 12 anos): Artes marciais, autodefesa, foco escolar e liderança.
- **Adolescentes** (12 a 17 anos): Condicionamento físico, superação e inteligência socioemocional.
- **Adultos** (18+): Defesa pessoal, redução de estresse, foco e alta performance física.
- **Família**: Integração familiar e fortalecimento de laços através do esporte.

UNIDADES DISPONÍVEIS:
Brasília: Asa Sul, Lago Sul, Sudoeste, Noroeste, Jardim Botânico, Pontos de Ensino.
Florianópolis: Centro, Coqueiros, Santa Mônica.
Mato Grosso do Sul: Dourados.

FLUXO DE ATENDIMENTO OBRIGATÓRIO:
1. Cumprimentar calorosamente e perguntar o que o visitante busca (para filho? adulto? família?)
2. Identificar o programa mais adequado e apresentá-lo brevemente com entusiasmo
3. Convidar para conhecer pessoalmente com uma aula experimental 100% gratuita
4. Coletar o **nome completo** e **telefone (WhatsApp)** do visitante, e a **unidade de preferência**
5. Quando tiver nome + telefone + unidade, chamar a ferramenta saveLead() imediatamente para registrar o interesse
6. Após salvar o lead, OFERECER verificar a grade de horários: chame getSchedule(unidadeKey, categoria) para mostrar as aulas disponíveis com vagas
7. Se o visitante escolher um horário específico e confirmar, chame bookTrialClass() para agendar a aula experimental diretamente
8. Após o agendamento, confirmar o horário e informar que a equipe entrará em contato

IMPORTANTE:
- Só chame saveLead() quando tiver coletado nome, telefone E unidade.
- Só chame getSchedule() após salvar o lead (ou se o visitante pedir para ver os horários).
- Só chame bookTrialClass() quando o visitante confirmar explicitamente que quer agendar naquele horário.
- Para listar as unidades disponíveis, chame getAvailableUnits().
- Seja proativo: se o visitante estiver em dúvida sobre qual unidade, pergunte a cidade ou bairro.
- Mantenha respostas curtas e diretas — máximo 3 parágrafos por mensagem.
- Ao exibir a grade de horários, mostre os dias e horários de forma organizada. NÃO mostre turmas sem vagas disponíveis.`;

const MILES_TOOLS = [{
    functionDeclarations: [
        {
            name: "getAvailableUnits",
            description: "Retorna a lista de todas as unidades da Kihap disponíveis, organizadas por cidade, para que o visitante possa escolher a mais próxima.",
            parameters: { type: "OBJECT", properties: {} }
        },
        {
            name: "saveLead",
            description: "Salva os dados do lead (visitante interessado) no sistema CRM da Kihap. Chamar SOMENTE quando tiver coletado nome completo, telefone/WhatsApp e a unidade de preferência do visitante.",
            parameters: {
                type: "OBJECT",
                properties: {
                    nome: { type: "STRING", description: "Nome completo do visitante interessado." },
                    telefone: { type: "STRING", description: "Telefone ou WhatsApp do visitante, com DDD." },
                    programaInteresse: { type: "STRING", description: "Nome do programa de interesse (ex: Kids, Adultos, Baby Littles)." },
                    unidade: { type: "STRING", description: "Nome da unidade (ex: Asa Sul, Centro, Dourados)." },
                    unidadeKey: { type: "STRING", description: "A chave interna da unidade (ex: asa-sul, centro, dourados)." }
                },
                required: ["nome", "telefone", "unidade"]
            }
        },
        {
            name: "getSchedule",
            description: "Busca a grade de horários da unidade para os próximos 7 dias, filtrando pela categoria/programa de interesse. Retorna as aulas com vagas disponíveis para aulas experimentais.",
            parameters: {
                type: "OBJECT",
                properties: {
                    unidadeKey: { type: "STRING", description: "Chave interna da unidade (ex: asa-sul, centro)." },
                    categoria: { type: "STRING", description: "Categoria da turma (ex: Kids, Adultos). Opcional." }
                },
                required: ["unidadeKey"]
            }
        },
        {
            name: "bookTrialClass",
            description: "Agenda uma aula experimental para o visitante em uma turma específica com vaga disponível. Chamar SOMENTE quando o visitante confirmar explicitamente que deseja agendar naquele horário.",
            parameters: {
                type: "OBJECT",
                properties: {
                    instanceId: { type: "STRING", description: "ID da instância da aula retornado pelo getSchedule." },
                    templateId: { type: "STRING", description: "ID do template da aula retornado pelo getSchedule." },
                    data: { type: "STRING", description: "Data da aula no formato YYYY-MM-DD." },
                    unitId: { type: "STRING", description: "ID da unidade (ex: asa-sul)." },
                    nome: { type: "STRING", description: "Nome completo do visitante." },
                    telefone: { type: "STRING", description: "Telefone do visitante." },
                    programa: { type: "STRING", description: "Programa de interesse (categoria)." },
                    leadId: { type: "STRING", description: "ID do lead gerado no saveLead. Opcional." }
                },
                required: ["instanceId", "templateId", "data", "unitId", "nome", "telefone"]
            }
        }
    ]
}];

function getAvailableUnits() {
    return {
        success: true,
        unidades: [
            { key: 'asa-sul', nome: 'Asa Sul (Brasília)' },
            { key: 'lago-sul', nome: 'Lago Sul (Brasília)' },
            { key: 'sudoeste', nome: 'Sudoeste (Brasília)' },
            { key: 'noroeste', nome: 'Noroeste (Brasília)' },
            { key: 'jardim-botanico', nome: 'Jardim Botânico (Brasília)' },
            { key: 'pontos-de-ensino', nome: 'Pontos de Ensino (Brasília)' },
            { key: 'centro', nome: 'Centro (Florianópolis)' },
            { key: 'coqueiros', nome: 'Coqueiros (Florianópolis)' },
            { key: 'santa-monica', nome: 'Santa Mônica (Florianópolis)' },
            { key: 'dourados', nome: 'Dourados (MS)' }
        ]
    };
}

async function saveLeadBackend(args, customerPhone, existingLeadId = null) {
    const { nome, telefone, programaInteresse, unidade, unidadeKey } = args;
    try {
        const leadData = {
            nome: nome || '',
            telefone: telefone || customerPhone || '',
            programaInteresse: programaInteresse || '',
            unidade: unidade || '',
            unidadeKey: unidadeKey || '',
            origem: 'Chatbot Miles',
            'origem do lead': 'Chatbot Miles',
            status: 'Novo',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (existingLeadId) {
            try {
                await db.collection('leads').doc(existingLeadId).update(leadData);
                return {
                    success: true,
                    leadId: existingLeadId,
                    message: `Lead de ${nome} atualizado com sucesso no CRM! Agora ofereça a grade de horários chamando getSchedule().`
                };
            } catch (err) {
                console.warn(`[Miles WhatsApp] Lead ${existingLeadId} não encontrado para atualizar. Criando novo...`);
            }
        }

        const docRef = await db.collection('leads').add({
            ...leadData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            leadId: docRef.id,
            message: `Lead de ${nome} criado com sucesso no CRM! Agora ofereça a grade de horários chamando getSchedule().`
        };
    } catch (e) {
        console.error("[Miles WhatsApp] Erro ao salvar lead:", e);
        return { success: false, error: e.message };
    }
}

async function getScheduleBackend(args) {
    const { unidadeKey, categoria } = args;
    if (!unidadeKey) return { error: 'unidadeKey é obrigatório.' };

    try {
        const templatesQuery = db.collection('classTemplates').where('unitId', '==', unidadeKey);
        const templatesSnap = await templatesQuery.get();
        const templates = [];
        templatesSnap.forEach(d => templates.push({ id: d.id, ...d.data() }));

        const filtered = categoria
            ? templates.filter(t => (t.category || '').toLowerCase() === categoria.toLowerCase())
            : templates;

        if (filtered.length === 0) {
            return {
                success: true,
                aulasDisponiveis: [],
                message: categoria
                    ? `Nenhuma turma de "${categoria}" encontrada na unidade ${unidadeKey}. Mostrando todas as turmas.`
                    : `Nenhuma turma cadastrada para a unidade ${unidadeKey}.`
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            days.push(d);
        }

        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const aulasDisponiveis = [];

        function getLocalDateString(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        for (const day of days) {
            const dayOfWeek = day.getDay();
            const dateStr = getLocalDateString(day);

            for (const template of filtered) {
                if (!template.daysOfWeek || !template.daysOfWeek.includes(dayOfWeek)) continue;

                const instanceId = `${template.id}_${dateStr}`;
                const instanceSnap = await db.collection('classInstances').doc(instanceId).get();

                const studentsMatriculados = (template.students || []).length;
                const trialStudents = instanceSnap.exists ? (instanceSnap.data().trialStudents || []) : [];
                const capacity = template.capacity || 10;
                const vagasUsadas = studentsMatriculados + trialStudents.length;
                const vagasDisponiveis = capacity - vagasUsadas;

                if (vagasDisponiveis <= 0) continue;

                const [h, m] = (template.time || '08:00').split(':');
                const startDate = new Date(day);
                startDate.setHours(parseInt(h), parseInt(m), 0, 0);
                const endDate = new Date(startDate.getTime() + (template.duration || 60) * 60000);
                const horaFim = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                aulasDisponiveis.push({
                    instanceId,
                    templateId: template.id,
                    nome: template.name,
                    categoria: template.category || '',
                    professor: template.teacherName,
                    professorId: template.teacherId,
                    data: dateStr,
                    diaSemana: diasSemana[dayOfWeek],
                    horario: `${template.time} - ${horaFim}`,
                    vagasDisponiveis,
                    capacidade: capacity,
                    unitId: unidadeKey
                });
            }
        }

        if (aulasDisponiveis.length === 0) {
            return {
                success: true,
                aulasDisponiveis: [],
                message: 'Nenhuma aula com vagas nos próximos 7 dias. Oriente o visitante a entrar em contato com um atendente.'
            };
        }

        return {
            success: true,
            aulasDisponiveis,
            message: `Encontradas ${aulasDisponiveis.length} aulas. Apresente de forma organizada por dia e pergunte o horário preferido.`
        };

    } catch (e) {
        console.error('[Miles WhatsApp] Erro ao buscar grade:', e);
        return { error: e.message };
    }
}

async function bookTrialClassBackend(args) {
    const { instanceId, templateId, data, unitId, nome, telefone, programa, leadId } = args;
    if (!instanceId || !nome || !telefone) {
        return { error: 'Dados insuficientes para o agendamento.' };
    }

    try {
        const instanceRef = db.collection('classInstances').doc(instanceId);
        const instanceSnap = await instanceRef.get();

        const trialEntry = {
            nome,
            telefone,
            programa: programa || '',
            compareceu: false,
            agendadoEm: new Date()
        };

        if (instanceSnap.exists) {
            const dataDoc = instanceSnap.data();
            const existingTrials = dataDoc.trialStudents || [];
            const templateSnap = await db.collection('classTemplates').doc(templateId).get();
            if (templateSnap.exists) {
                const t = templateSnap.data();
                const vagasUsadas = (t.students || []).length + existingTrials.length;
                if (vagasUsadas >= (t.capacity || 10)) {
                    return { success: false, error: 'Esta aula não possui mais vagas disponíveis. Por favor, escolha outro horário.' };
                }
            }
            await instanceRef.update({
                trialStudents: admin.firestore.FieldValue.arrayUnion(trialEntry)
            });
        } else {
            await instanceRef.set({
                templateId,
                date: data,
                unitId,
                trialStudents: [trialEntry]
            });
        }

        // Notifica o professor responsável
        const templateSnap = await db.collection('classTemplates').doc(templateId).get();
        if (templateSnap.exists) {
            const t = templateSnap.data();
            if (t.teacherId) {
                const [h, m] = (t.time || '00:00').split(':');
                const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short', day: 'numeric', month: 'numeric'
                });
                try {
                    await db.collection('notifications').add({
                        userId: t.teacherId,
                        type: 'trial',
                        title: 'Aula Experimental Agendada (WhatsApp)',
                        message: `${nome} agendou pelo WhatsApp em ${t.name} — ${dataFormatada} às ${h}:${m}.`,
                        link: '/intranet/grade.html',
                        icon: '/imgs/miles-chatbot.png',
                        read: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (notifErr) {
                    console.error('[Miles WhatsApp] Não foi possível criar a notificação para o professor:', notifErr);
                }
            }
        }

        // Atualiza status do lead para "Aula experimental" no CRM
        if (leadId) {
            try {
                await db.collection('leads').doc(leadId).update({ status: 'Aula experimental' });
            } catch (_) {}
        }

        // Notifica o gerente da unidade via WhatsApp Oficial
        const managerPhone = UNIT_MANAGERS[unitId];
        if (managerPhone) {
            try {
                const configSnap = await db.collection('public_config').doc('miles').get();
                if (configSnap.exists) {
                    const configData = configSnap.data();
                    const whatsappToken = configData.whatsappToken;
                    const phoneNumberId = configData.phoneNumberId;

                    if (whatsappToken && phoneNumberId) {
                        const templateSnap = await db.collection('classTemplates').doc(templateId).get();
                        const t = templateSnap.exists ? templateSnap.data() : null;
                        const className = t ? t.name : 'Aula Experimental';
                        const classTime = t ? t.time : '';
                        
                        const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'long', day: 'numeric', month: 'long'
                        });

                        await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                            messaging_product: "whatsapp",
                            to: managerPhone,
                            type: "template",
                            template: {
                                name: "notificacaoaula",
                                language: {
                                    code: "pt_BR"
                                },
                                components: [
                                    {
                                        type: "body",
                                        parameters: [
                                            { type: "text", text: nome },
                                            { type: "text", text: telefone },
                                            { type: "text", text: programa || className },
                                            { type: "text", text: dataFormatada },
                                            { type: "text", text: classTime || "Horário a combinar" }
                                        ]
                                    }
                                ]
                            }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${whatsappToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        console.log(`[Miles WhatsApp] Notificação (Template) enviada para o gerente da unidade ${unitId} (${managerPhone})`);
                    }
                }
            } catch (managerErr) {
                console.error(`[Miles WhatsApp] Erro ao notificar o gerente da unidade ${unitId} via WhatsApp:`, managerErr.response?.data || managerErr.message);
            }
        }

        const dataExibicao = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long'
        });

        return {
            success: true,
            message: `Aula experimental de ${nome} agendada com sucesso para ${dataExibicao}! O professor foi notificado.`
        };

    } catch (e) {
        console.error('[Miles WhatsApp] Erro no agendamento:', e);
        return { success: false, error: e.message };
    }
}

async function callGeminiMiles(history, apiKey) {
    const response = await axios.post(`${GEMINI_API_BASE}?key=${apiKey}`, {
        contents: history,
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        tools: MILES_TOOLS,
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 600
        }
    }, {
        headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
}

function formatWhatsAppText(text) {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '*$1*');
}

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    // 1. Validação do Webhook (GET)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('Webhook do WhatsApp Validado com Sucesso!');
                return res.status(200).send(challenge);
            } else {
                return res.sendStatus(403);
            }
        }
    }

    // 2. Recebimento de Mensagem (POST)
    if (req.method === 'POST') {
        const body = req.body;

        if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messageData = body.entry[0].changes[0].value.messages[0];
            const contactData = body.entry[0].changes[0].value.contacts[0];

            const customerPhone = messageData.from;
            const customerName = contactData.profile.name || "Visitante";
            
            if (messageData.type === 'text') {
                const messageText = messageData.text.body;
                console.log(`[WhatsApp Webhook] Mensagem de ${customerName} (${customerPhone}): ${messageText}`);

                try {
                    // Carrega chave Gemini dinamicamente do Firestore
                    const configSnap = await db.collection('public_config').doc('miles').get();
                    if (!configSnap.exists) {
                        throw new Error("Chave do Gemini (public_config/miles) não encontrada no Firestore.");
                    }
                    const configData = configSnap.data();
                    const geminiApiKey = configData.geminiKey || configData.apiKey;
                    const whatsappToken = configData.whatsappToken || WHATSAPP_TOKEN;
                    const phoneNumberId = configData.phoneNumberId || PHONE_NUMBER_ID;

                    // Verifica se é um comando de reset
                    const cleanText = messageText.trim().toLowerCase();
                    if (cleanText === '/reset' || cleanText === '/limpar' || cleanText === '/restart') {
                        // Limpa o histórico no Firestore
                        const chatRef = db.collection('whatsapp_chats').doc(customerPhone);
                        await chatRef.delete();

                        console.log(`[WhatsApp Webhook] Conversa de ${customerPhone} reiniciada via comando.`);

                        // Envia resposta de confirmação
                        const replyText = "Conversa reiniciada com sucesso! Como posso te ajudar hoje?";
                        await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                            messaging_product: "whatsapp",
                            to: customerPhone,
                            type: "text",
                            text: { body: replyText }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${whatsappToken}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        return res.status(200).send('EVENT_RECEIVED');
                    }

                    // Busca histórico da conversa no Firestore
                    const chatRef = db.collection('whatsapp_chats').doc(customerPhone);
                    const chatSnap = await chatRef.get();
                    let history = [];
                    let lastLeadId = null;

                    if (chatSnap.exists) {
                        const dataDoc = chatSnap.data();
                        history = dataDoc.history || [];
                        lastLeadId = dataDoc.lastLeadId || null;
                    }

                    // Cria um lead preliminar no CRM caso ainda não exista
                    if (!lastLeadId) {
                        try {
                            const leadRef = await db.collection('leads').add({
                                nome: customerName || 'Visitante WhatsApp',
                                telefone: customerPhone,
                                status: 'Novo',
                                'origem do lead': 'Chatbot Miles',
                                origem: 'Chatbot Miles',
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            lastLeadId = leadRef.id;
                            console.log(`[WhatsApp Webhook] Lead preliminar criado no CRM para ${customerPhone}: ${lastLeadId}`);
                        } catch (leadErr) {
                            console.error("[WhatsApp Webhook] Erro ao criar lead preliminar:", leadErr);
                        }
                    }

                    // Limita histórico a 20 mensagens para evitar tokens excessivos
                    if (history.length > 20) {
                        history = history.slice(-20);
                    }

                    // Adiciona mensagem do usuário
                    history.push({ role: 'user', parts: [{ text: messageText }] });

                    let responseJson = await callGeminiMiles(history, geminiApiKey);

                    // Loop de function calling
                    let loops = 0;
                    let finalReplyText = '';

                    while (loops < 5) {
                        const candidate = responseJson.candidates?.[0];
                        const parts = candidate?.content?.parts || [];
                        const funcCalls = parts.filter(p => p.functionCall);

                        if (funcCalls.length === 0) {
                            finalReplyText = parts.find(p => p.text)?.text || 'Desculpe, não entendi.';
                            history.push({ role: 'model', parts: [{ text: finalReplyText }] });
                            break;
                        }

                        history.push({ role: 'model', parts });

                        const responseParts = [];
                        for (const call of funcCalls) {
                            const fnName = call.functionCall.name;
                            const args = call.functionCall.args || {};
                            let result = {};

                            if (fnName === 'getAvailableUnits') {
                                result = getAvailableUnits();
                            } else if (fnName === 'saveLead') {
                                result = await saveLeadBackend(args, customerPhone, lastLeadId);
                                if (result.success && result.leadId) {
                                    lastLeadId = result.leadId;
                                }
                            } else if (fnName === 'getSchedule') {
                                result = await getScheduleBackend(args);
                            } else if (fnName === 'bookTrialClass') {
                                // Injeta o leadId salvo anteriormente se disponível
                                if (lastLeadId && !args.leadId) {
                                    args.leadId = lastLeadId;
                                }
                                result = await bookTrialClassBackend(args);
                            } else {
                                result = { error: 'Função desconhecida.' };
                            }

                            responseParts.push({
                                functionResponse: { name: fnName, response: result }
                            });
                        }

                        history.push({ role: 'user', parts: responseParts });
                        responseJson = await callGeminiMiles(history, geminiApiKey);
                        loops++;
                    }

                    if (loops >= 5) {
                        finalReplyText = "Desculpe, tive uma lentidão interna. Poderia repetir ou me dizer qual unidade prefere?";
                    }

                    // Atualiza o histórico e o leadId no Firestore (reseta flag de lembrete)
                    await chatRef.set({
                        history,
                        lastLeadId,
                        reminderSent: false,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    // Envia resposta formatada de volta para o cliente no WhatsApp
                    const formattedText = formatWhatsAppText(finalReplyText);
                    await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                        messaging_product: "whatsapp",
                        to: customerPhone,
                        type: "text",
                        text: { body: formattedText }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${whatsappToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                } catch (err) {
                    console.error("[WhatsApp Webhook] Erro fatal:", err.response?.data || err.message);
                }
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    }

    return res.sendStatus(404);
});

// Agendador de Lembrete de Inatividade (Janela de menos de 24h)
exports.milesInactivityReminder = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
    console.log('[Miles Reminder] Iniciando verificação de inatividade de leads (janela < 24h)...');

    const now = new Date();
    
    // Filtro para achar inatividade entre 4 e 23 horas
    const minTime = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 23h atrás
    const maxTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);  // 4h atrás

    try {
        // Carrega as credenciais da Meta do Firestore
        const configSnap = await db.collection('public_config').doc('miles').get();
        if (!configSnap.exists) {
            console.error('[Miles Reminder] Configuração public_config/miles não encontrada no Firestore.');
            return null;
        }
        const configData = configSnap.data();
        const whatsappToken = configData.whatsappToken;
        const phoneNumberId = configData.phoneNumberId;

        if (!whatsappToken || !phoneNumberId) {
            console.error('[Miles Reminder] Credenciais do WhatsApp ausentes em public_config/miles.');
            return null;
        }

        // Busca conversas que foram atualizadas na janela [23h, 4h] atrás
        const chatsQuery = db.collection('whatsapp_chats')
            .where('updatedAt', '>=', minTime)
            .where('updatedAt', '<=', maxTime);

        const chatsSnap = await chatsQuery.get();
        console.log(`[Miles Reminder] Encontradas ${chatsSnap.size} conversas atualizadas na janela de tempo.`);

        let sentCount = 0;

        for (const docSnap of chatsSnap.docs) {
            const chatPhone = docSnap.id;
            const chatData = docSnap.data();

            // Pula se já enviamos o lembrete
            if (chatData.reminderSent === true) {
                continue;
            }

            const lastLeadId = chatData.lastLeadId;
            if (!lastLeadId) {
                continue; // Sem lead associado, nada a fazer
            }

            // Verifica o status do lead no CRM
            const leadSnap = await db.collection('leads').doc(lastLeadId).get();
            if (!leadSnap.exists) {
                continue; // Lead foi apagado
            }

            const leadData = leadSnap.data();
            const leadStatus = leadData.status;

            // Só envia lembrete se o lead estiver na coluna 'Novo' (ainda não agendado/contactado)
            if (leadStatus === 'Novo') {
                const leadName = leadData.nome || '';
                const cleanName = leadName.trim() ? leadName.trim().split(' ')[0] : '';
                const salutation = cleanName ? `, ${cleanName}` : '';

                // Mensagem amigável de lembrete
                const reminderText = `Oi${salutation}! 😊 Notei que não finalizamos o agendamento da sua aula experimental gratuita na Kihap. Gostaria de ver os horários disponíveis novamente para escolhermos o seu?`;

                try {
                    // Envia mensagem pelo WhatsApp
                    await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                        messaging_product: "whatsapp",
                        to: chatPhone,
                        type: "text",
                        text: { body: reminderText }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${whatsappToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`[Miles Reminder] Lembrete enviado com sucesso para ${chatPhone} (Lead ID: ${lastLeadId})`);

                    // Atualiza o histórico do chat com o lembrete enviado e a flag reminderSent
                    const updatedHistory = chatData.history || [];
                    updatedHistory.push({
                        role: 'model',
                        parts: [{ text: reminderText }]
                    });

                    await db.collection('whatsapp_chats').doc(chatPhone).update({
                        history: updatedHistory,
                        reminderSent: true,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    sentCount++;

                } catch (sendErr) {
                    console.error(`[Miles Reminder] Erro ao enviar lembrete para ${chatPhone}:`, sendErr.response?.data || sendErr.message);
                }
            }
        }

        console.log(`[Miles Reminder] Concluído. Lembretes enviados: ${sentCount}`);
        return null;

    } catch (err) {
        console.error('[Miles Reminder] Erro fatal no agendador:', err);
        return null;
    }
});
