/**
 * Miles — Assistente Virtual de Atendimento do Site Público da Kihap
 * Primeiro atendimento e captação de leads para o CRM.
 */

import { db } from '../intranet/firebase-config.js';
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    setDoc,
    query,
    where,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const UNIDADES = {
    'asa-sul':          { nome: 'Asa Sul (Brasília)',         whatsapp: 'https://wa.me/556183007146' },
    'lago-sul':         { nome: 'Lago Sul (Brasília)',        whatsapp: 'https://wa.me/556192028980' },
    'sudoeste':         { nome: 'Sudoeste (Brasília)',        whatsapp: 'https://wa.me/556182107146' },
    'noroeste':         { nome: 'Noroeste (Brasília)',        whatsapp: 'https://wa.me/556184170472' },
    'jardim-botanico':  { nome: 'Jardim Botânico (Brasília)', whatsapp: 'https://wa.me/556184171059' },
    'pontos-de-ensino': { nome: 'Pontos de Ensino (Brasília)',whatsapp: 'https://wa.me/556182823380' },
    'centro':           { nome: 'Centro (Florianópolis)',     whatsapp: 'https://wa.me/554892182423' },
    'coqueiros':        { nome: 'Coqueiros (Florianópolis)',  whatsapp: 'https://wa.me/554896296941' },
    'santa-monica':     { nome: 'Santa Mônica (Florianópolis)', whatsapp: 'https://wa.me/554892172423' },
    'dourados':         { nome: 'Dourados (MS)',              whatsapp: 'https://wa.me/556799597001' },
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM INSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

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


// ─────────────────────────────────────────────────────────────────────────────
// TOOLS (Function Declarations para o Gemini)
// ─────────────────────────────────────────────────────────────────────────────

const MILES_TOOLS = [{
    functionDeclarations: [
        {
            name: "getAvailableUnits",
            description: "Retorna a lista de todas as unidades da Kihap disponíveis, organizadas por cidade, para que o visitante possa escolher a mais próxima.",
            parameters: {
                type: "OBJECT",
                properties: {}
            }
        },
        {
            name: "saveLead",
            description: "Salva os dados do lead (visitante interessado) no sistema CRM da Kihap. Chamar SOMENTE quando tiver coletado nome completo, telefone/WhatsApp e a unidade de preferência do visitante.",
            parameters: {
                type: "OBJECT",
                properties: {
                    nome: {
                        type: "STRING",
                        description: "Nome completo do visitante interessado."
                    },
                    telefone: {
                        type: "STRING",
                        description: "Telefone ou WhatsApp do visitante, com DDD."
                    },
                    programaInteresse: {
                        type: "STRING",
                        description: "Nome do programa de interesse identificado na conversa (ex: Kids, Adultos, Baby Littles, etc.)."
                    },
                    unidade: {
                        type: "STRING",
                        description: "Nome da unidade de preferência selecionada pelo visitante (ex: Asa Sul, Centro, Dourados)."
                    },
                    unidadeKey: {
                        type: "STRING",
                        description: "A chave interna da unidade para obter o link do WhatsApp (ex: asa-sul, centro, dourados)."
                    }
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
                    unidadeKey: {
                        type: "STRING",
                        description: "Chave interna da unidade (ex: asa-sul, centro, dourados)."
                    },
                    categoria: {
                        type: "STRING",
                        description: "Categoria do programa de interesse para filtrar as turmas (ex: Kids, Adultos, Baby Littles). Opcional — se não informado, retorna todas."
                    }
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
                    instanceId: {
                        type: "STRING",
                        description: "ID da instância da aula (templateId_YYYY-MM-DD) retornado pelo getSchedule."
                    },
                    templateId: {
                        type: "STRING",
                        description: "ID do template da aula, retornado pelo getSchedule."
                    },
                    data: {
                        type: "STRING",
                        description: "Data da aula no formato YYYY-MM-DD."
                    },
                    unitId: {
                        type: "STRING",
                        description: "ID da unidade (ex: asa-sul)."
                    },
                    nome: {
                        type: "STRING",
                        description: "Nome completo do visitante que será agendado."
                    },
                    telefone: {
                        type: "STRING",
                        description: "Telefone do visitante."
                    },
                    programa: {
                        type: "STRING",
                        description: "Programa de interesse (categoria da turma)."
                    },
                    leadId: {
                        type: "STRING",
                        description: "ID do lead salvo anteriormente (retornado pelo saveLead). Opcional."
                    }
                },
                required: ["instanceId", "templateId", "data", "unitId", "nome", "telefone"]
            }
        }
    ]
}];


// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES DE TOOL EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

function getAvailableUnits() {
    return {
        unidades: {
            "Brasília": ["Asa Sul", "Lago Sul", "Sudoeste", "Noroeste", "Jardim Botânico", "Pontos de Ensino"],
            "Florianópolis": ["Centro", "Coqueiros", "Santa Mônica"],
            "Mato Grosso do Sul": ["Dourados"]
        },
        message: "Temos unidades em Brasília, Florianópolis e Dourados (MS). Qual cidade fica mais próxima de você?"
    };
}

async function saveLead(args) {
    const { nome, telefone, programaInteresse, unidade, unidadeKey } = args;
    try {
        const leadData = {
            nome: nome || '',
            telefone: telefone || '',
            programaInteresse: programaInteresse || '',
            unidade: unidade || '',
            'origem do lead': 'Chatbot Miles',
            status: 'Novo',
            createdAt: serverTimestamp()
        };

        const leadsRef = collection(db, 'leads');
        const docRef = await addDoc(leadsRef, leadData);

        // Determinar o link do WhatsApp
        let whatsappUrl = '';
        const unidadeNorm = (unidade || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Tenta pelo key primeiro
        if (unidadeKey && UNIDADES[unidadeKey]) {
            whatsappUrl = UNIDADES[unidadeKey].whatsapp;
        } else {
            // Fallback por nome
            for (const [key, info] of Object.entries(UNIDADES)) {
                const infoNorm = info.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (unidadeNorm.includes(key.replace(/-/g, ' ')) || infoNorm.includes(unidadeNorm)) {
                    whatsappUrl = info.whatsapp;
                    break;
                }
            }
        }

        // Resolve unidadeKey caso não tenha sido passado
        const resolvedKey = unidadeKey || Object.keys(UNIDADES).find(k => {
            const infoNorm = UNIDADES[k].nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return unidadeNorm.includes(k.replace(/-/g, ' ')) || infoNorm.includes(unidadeNorm);
        });

        // Guarda estado global para uso no agendamento e botão WhatsApp
        window._milesLeadWhatsapp = whatsappUrl;
        window._milesLeadSaved = true;
        window._milesLeadId = docRef.id;
        window._milesLeadNome = nome;
        window._milesLeadTelefone = telefone;
        window._milesLeadUnidadeKey = resolvedKey;

        return {
            success: true,
            leadId: docRef.id,
            whatsappUrl: whatsappUrl,
            message: `Lead de ${nome} salvo com sucesso! Agora ofereça a grade de horários chamando getSchedule().`
        };
    } catch (e) {
        console.error("[Miles] Erro ao salvar lead:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Busca a grade de horários da unidade para os próximos 7 dias.
 * Leitura pública habilitada nas Firestore Rules.
 */
async function getSchedule(args) {
    const { unidadeKey, categoria } = args;
    if (!unidadeKey) return { error: 'unidadeKey é obrigatório.' };

    try {
        const templatesQuery = query(
            collection(db, 'classTemplates'),
            where('unitId', '==', unidadeKey)
        );
        const templatesSnap = await getDocs(templatesQuery);
        const templates = [];
        templatesSnap.forEach(d => templates.push({ id: d.id, ...d.data() }));

        // Filtra por categoria se fornecida
        const filtered = categoria
            ? templates.filter(t => (t.category || '').toLowerCase() === categoria.toLowerCase())
            : templates;

        if (filtered.length === 0) {
            return {
                success: true,
                aulasDisponiveis: [],
                message: categoria
                    ? `Nenhuma turma de "${categoria}" encontrada na unidade ${unidadeKey}. Mostrando todas as turmas disponíveis.`
                    : `Nenhuma turma cadastrada para a unidade ${unidadeKey}.`
            };
        }

        // Próximos 7 dias
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

        for (const day of days) {
            const dayOfWeek = day.getDay();
            const dateStr = day.toISOString().split('T')[0];

            for (const template of filtered) {
                if (!template.daysOfWeek || !template.daysOfWeek.includes(dayOfWeek)) continue;

                const instanceId = `${template.id}_${dateStr}`;
                const instanceRef = doc(db, 'classInstances', instanceId);
                const instanceSnap = await getDoc(instanceRef);

                const studentsMatriculados = (template.students || []).length;
                const trialStudents = instanceSnap.exists() ? (instanceSnap.data().trialStudents || []) : [];
                const capacity = template.capacity || 10;
                const vagasUsadas = studentsMatriculados + trialStudents.length;
                const vagasDisponiveis = capacity - vagasUsadas;

                if (vagasDisponiveis <= 0) continue; // Sem vagas, não exibe

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
                message: 'Nenhuma aula com vagas disponíveis nos próximos 7 dias. Oriente o visitante a entrar em contato pelo WhatsApp.'
            };
        }

        return {
            success: true,
            aulasDisponiveis,
            message: `Encontradas ${aulasDisponiveis.length} aulas com vagas. Apresente de forma organizada por dia e pergunte qual horário o visitante prefere.`
        };

    } catch (e) {
        console.error('[Miles] Erro ao buscar grade:', e);
        return { error: e.message };
    }
}

/**
 * Agenda uma aula experimental para o visitante.
 * Escreve em trialStudents[] e cria notificação para o professor.
 */
async function bookTrialClass(args) {
    const { instanceId, templateId, data, unitId, nome, telefone, programa, leadId } = args;
    if (!instanceId || !nome || !telefone) {
        return { error: 'Dados insuficientes para o agendamento.' };
    }

    try {
        const instanceRef = doc(db, 'classInstances', instanceId);
        const instanceSnap = await getDoc(instanceRef);

        const trialEntry = {
            nome,
            telefone,
            programa: programa || '',
            compareceu: false,
            agendadoEm: new Date()
        };

        if (instanceSnap.exists()) {
            // Verifica vagas antes de escrever (anti-race condition simples)
            const existingTrials = instanceSnap.data().trialStudents || [];
            const templateSnap = await getDoc(doc(db, 'classTemplates', templateId));
            if (templateSnap.exists()) {
                const t = templateSnap.data();
                const vagasUsadas = (t.students || []).length + existingTrials.length;
                if (vagasUsadas >= (t.capacity || 10)) {
                    return { success: false, error: 'Esta aula não possui mais vagas disponíveis. Por favor, escolha outro horário.' };
                }
            }
            await updateDoc(instanceRef, {
                trialStudents: [...existingTrials, trialEntry]
            });
        } else {
            // Cria a instância com os campos mínimos permitidos pelas Firestore Rules
            await setDoc(instanceRef, {
                templateId,
                date: data,
                unitId,
                trialStudents: [trialEntry]
            });
        }

        // Notifica o professor responsável
        const templateSnap = await getDoc(doc(db, 'classTemplates', templateId));
        if (templateSnap.exists()) {
            const t = templateSnap.data();
            if (t.teacherId) {
                const [h, m] = (t.time || '00:00').split(':');
                const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short', day: 'numeric', month: 'numeric'
                });
                try {
                    await addDoc(collection(db, 'notifications'), {
                        userId: t.teacherId,
                        type: 'trial',
                        title: 'Aula Experimental Agendada',
                        message: `${nome} agendou uma experimental em ${t.name} — ${dataFormatada} às ${h}:${m}.`,
                        link: '/intranet/grade.html',
                        icon: '/imgs/miles-chatbot.png',
                        read: false,
                        createdAt: serverTimestamp()
                    });
                } catch (notifErr) {
                    console.error('[Miles] Não foi possível criar a notificação para o professor:', notifErr);
                }
            }
        }

        // Atualiza status do lead para "Agendado"
        const resolvedLeadId = leadId || window._milesLeadId;
        if (resolvedLeadId) {
            try {
                await updateDoc(doc(db, 'leads', resolvedLeadId), { status: 'Agendado' });
            } catch (_) { /* Silencia — não bloqueia o agendamento */ }
        }

        const dataExibicao = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long'
        });

        return {
            success: true,
            message: `Aula experimental de ${nome} agendada com sucesso para ${dataExibicao}! O professor foi notificado.`
        };

    } catch (e) {
        console.error('[Miles] Erro no agendamento:', e);
        return { success: false, error: e.message };
    }
}



// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API
// ─────────────────────────────────────────────────────────────────────────────

async function loadGeminiKey() {
    // 1. Tenta o cache local (mais rápido)
    const local = localStorage.getItem('meta_ads_config');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            if (parsed.geminiKey) return parsed.geminiKey;
        } catch (_) {}
    }

    // 2. Busca do documento público no Firestore (não requer autenticação)
    try {
        const docRef = doc(db, "public_config", "miles");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().geminiKey) {
            return docSnap.data().geminiKey;
        }
    } catch (e) {
        // Silencia erros de permissão
    }

    // 3. Fallback: lê do atributo data-miles-key no script tag
    const scriptTag = document.querySelector('script[data-miles-key]');
    if (scriptTag) return scriptTag.getAttribute('data-miles-key');

    return null;
}

async function callGeminiMiles(history, apiKey) {
    const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: history,
            systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            tools: MILES_TOOLS,
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 600
            }
        })
    });
    const json = await response.json();
    if (json.error) throw new Error(json.error.message);
    return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI — HTML E ESTILOS
// ─────────────────────────────────────────────────────────────────────────────

function injectMilesStyles() {
    if (document.getElementById('miles-chatbot-styles')) return;
    const style = document.createElement('style');
    style.id = 'miles-chatbot-styles';
    style.textContent = `
        /* Miles Chatbot — Estilos */
        #miles-chat-toggle {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9998;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid #FFC107;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0,0,0,0.15);
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
            outline: none;
            overflow: hidden;
            padding: 0;
        }
        #miles-chat-toggle:hover {
            transform: scale(1.08);
            box-shadow: 0 14px 40px rgba(0, 0, 0, 0.2), 0 4px 14px rgba(0,0,0,0.2);
        }
        #miles-chat-toggle:active { transform: scale(0.95); }

        /* Janela do chat */
        #miles-chat-window {
            position: fixed;
            bottom: 100px;
            right: 24px;
            width: 370px;
            height: 560px;
            z-index: 9999;
            background: #ffffff;
            border-radius: 24px;
            border: 1px solid rgba(0,0,0,0.08);
            box-shadow: 0 24px 64px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform-origin: bottom right;
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
        }
        #miles-chat-window.miles-hidden {
            transform: scale(0.85) translateY(16px);
            opacity: 0;
            pointer-events: none;
        }

        /* Header do chat */
        #miles-chat-header {
            background: linear-gradient(135deg, #FFC107 0%, #FF8F00 100%);
            padding: 14px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }
        #miles-avatar-wrapper {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid rgba(255,255,255,0.6);
            background: rgba(255,255,255,0.2);
            flex-shrink: 0;
        }
        #miles-avatar-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        #miles-header-info { flex: 1; }
        #miles-header-name {
            font-size: 14px;
            font-weight: 800;
            color: #111;
            display: flex;
            align-items: center;
            gap: 6px;
            line-height: 1;
        }
        #miles-header-name .miles-online-dot {
            width: 8px;
            height: 8px;
            background: #22C55E;
            border-radius: 50%;
            display: inline-block;
            animation: miles-online-pulse 2s infinite;
        }
        @keyframes miles-online-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }
        #miles-header-sub {
            font-size: 11px;
            color: rgba(17,17,17,0.65);
            font-weight: 500;
            margin-top: 2px;
        }
        #miles-close-btn {
            background: rgba(0,0,0,0.12);
            border: none;
            cursor: pointer;
            width: 28px;
            height: 28px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #111;
            transition: background 0.15s;
            flex-shrink: 0;
        }
        #miles-close-btn:hover { background: rgba(0,0,0,0.22); }

        /* Área de mensagens */
        #miles-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            scroll-behavior: smooth;
        }
        #miles-messages::-webkit-scrollbar { width: 4px; }
        #miles-messages::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.12);
            border-radius: 4px;
        }

        /* Bolhas de mensagem */
        .miles-msg {
            display: flex;
            max-width: 85%;
            animation: miles-msg-in 0.2s ease;
        }
        @keyframes miles-msg-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .miles-msg.miles-user { align-self: flex-end; }
        .miles-msg.miles-model { align-self: flex-start; }
        .miles-bubble {
            padding: 10px 14px;
            border-radius: 18px;
            font-size: 13.5px;
            line-height: 1.5;
        }
        .miles-msg.miles-user .miles-bubble {
            background: linear-gradient(135deg, #FFC107, #FF8F00);
            color: #111;
            font-weight: 600;
            border-bottom-right-radius: 4px;
        }
        .miles-msg.miles-model .miles-bubble {
            background: #F3F4F6;
            color: #1F2937;
            border-bottom-left-radius: 4px;
            border: 1px solid rgba(0,0,0,0.06);
        }

        /* Typing indicator */
        #miles-typing {
            display: none;
            align-self: flex-start;
        }
        #miles-typing.visible { display: flex; }
        #miles-typing .miles-bubble {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 12px 16px;
        }
        .miles-dot {
            width: 7px;
            height: 7px;
            background: #9CA3AF;
            border-radius: 50%;
            animation: miles-bounce 1.2s infinite;
        }
        .miles-dot:nth-child(2) { animation-delay: 0.2s; }
        .miles-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes miles-bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-6px); }
        }

        /* Botão de WhatsApp pós-lead */
        .miles-whatsapp-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #25D366;
            color: white;
            font-weight: 700;
            font-size: 13px;
            padding: 8px 14px;
            border-radius: 10px;
            text-decoration: none;
            margin-top: 8px;
            transition: background 0.15s;
        }
        .miles-whatsapp-btn:hover { background: #1EBE5A; }

        /* Input area */
        #miles-form {
            padding: 10px 12px;
            border-top: 1px solid rgba(0,0,0,0.07);
            background: #FAFAFA;
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }
        #miles-input {
            flex: 1;
            padding: 10px 14px;
            font-size: 13.5px;
            border: 1.5px solid #E5E7EB;
            border-radius: 14px;
            outline: none;
            background: white;
            color: #111;
            transition: border-color 0.15s;
            font-family: inherit;
        }
        #miles-input:focus { border-color: #FFC107; }
        #miles-send-btn {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: linear-gradient(135deg, #FFC107, #FF8F00);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.15s, box-shadow 0.15s;
            box-shadow: 0 2px 8px rgba(255, 193, 7, 0.35);
            flex-shrink: 0;
        }
        #miles-send-btn:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(255, 193, 7, 0.5); }
        #miles-send-btn:active { transform: scale(0.92); }
        #miles-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        #miles-send-btn svg { width: 18px; height: 18px; fill: #111; }

        /* Mobile */
        @media (max-width: 480px) {
            #miles-chat-window {
                right: 0;
                left: 0;
                bottom: 0;
                top: 0;
                width: 100%;
                height: 100%;
                height: 100dvh;
                border-radius: 0;
                border: none;
            }
            #miles-chat-toggle {
                bottom: 16px;
                right: 16px;
            }
            #miles-form {
                padding-bottom: calc(10px + env(safe-area-inset-bottom));
            }
        }
    `;
    document.head.appendChild(style);
}

function buildMilesHTML() {
    const container = document.createElement('div');
    container.id = 'miles-chatbot-container';
    container.innerHTML = `
        <!-- Botão Flutuante Miles -->
        <button id="miles-chat-toggle" aria-label="Falar com o Miles - Assistente Virtual Kihap">
            <img src="/imgs/personagens/perfilpersonagens/avatar_05.png"
                 alt="Miles"
                 style="width: 100%; height: 100%; object-fit: cover; display: block;"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <svg style="display:none;width:28px;height:28px;color:#111;" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
        </button>

        <!-- Janela do Chat -->
        <div id="miles-chat-window" class="miles-hidden" role="dialog" aria-label="Chat com Miles - Assistente Kihap">
            <!-- Header -->
            <div id="miles-chat-header">
                <div id="miles-avatar-wrapper">
                    <img src="/imgs/personagens/perfilpersonagens/avatar_05.png" alt="Miles">
                </div>
                <div id="miles-header-info">
                    <div id="miles-header-name">
                        Miles
                        <span class="miles-online-dot" aria-hidden="true"></span>
                    </div>
                    <div id="miles-header-sub">Assistente Virtual · Kihap</div>
                </div>
                <button id="miles-close-btn" aria-label="Fechar chat">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>

            <!-- Mensagens -->
            <div id="miles-messages" role="log" aria-live="polite" aria-label="Mensagens do chat">
                <!-- Typing indicator -->
                <div class="miles-msg miles-model" id="miles-typing">
                    <div class="miles-bubble">
                        <span class="miles-dot"></span>
                        <span class="miles-dot"></span>
                        <span class="miles-dot"></span>
                    </div>
                </div>
            </div>

            <!-- Input -->
            <form id="miles-form" autocomplete="off">
                <input
                    type="text"
                    id="miles-input"
                    placeholder="Digite sua mensagem..."
                    autocomplete="off"
                    aria-label="Mensagem para o Miles"
                    maxlength="500"
                >
                <button type="submit" id="miles-send-btn" aria-label="Enviar mensagem">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(container);
}

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA PRINCIPAL DO CHATBOT
// ─────────────────────────────────────────────────────────────────────────────

function formatMilesText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function setupMilesChatbot() {
    const toggle     = document.getElementById('miles-chat-toggle');
    const chatWindow = document.getElementById('miles-chat-window');
    const closeBtn   = document.getElementById('miles-close-btn');
    const form       = document.getElementById('miles-form');
    const input      = document.getElementById('miles-input');
    const messages   = document.getElementById('miles-messages');
    const typing     = document.getElementById('miles-typing');
    const sendBtn    = document.getElementById('miles-send-btn');

    let chatHistory = [];
    let isOpen = false;
    let hasShownWelcome = false;
    let apiKey = null;

    // Carrega chave Gemini antecipadamente
    loadGeminiKey().then(key => { apiKey = key; });

    function scrollBottom() {
        messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
        typing.classList.add('visible');
        scrollBottom();
    }

    function hideTyping() {
        typing.classList.remove('visible');
    }

    function appendMessage(role, html, extraEl = null) {
        const wrap = document.createElement('div');
        wrap.className = `miles-msg ${role === 'user' ? 'miles-user' : 'miles-model'}`;
        const bubble = document.createElement('div');
        bubble.className = 'miles-bubble';
        bubble.innerHTML = html;
        wrap.appendChild(bubble);
        if (extraEl) wrap.appendChild(extraEl);
        // Insert before typing indicator
        messages.insertBefore(wrap, typing);
        scrollBottom();
    }

    function appendWhatsappButton(url) {
        const btn = document.createElement('a');
        btn.href = url;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.className = 'miles-whatsapp-btn';
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.563 4.14 1.545 5.873L0 24l6.335-1.52A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.37l-.36-.213-3.76.902.946-3.667-.234-.374A9.785 9.785 0 012.182 12c0-5.422 4.396-9.818 9.818-9.818S21.818 6.578 21.818 12 17.422 21.818 12 21.818z"/>
            </svg>
            Falar no WhatsApp
        `;
        // Append inside last model bubble
        const allBubbles = messages.querySelectorAll('.miles-msg.miles-model .miles-bubble');
        const lastBubble = allBubbles[allBubbles.length - 1];
        if (lastBubble) {
            const div = document.createElement('div');
            div.appendChild(btn);
            lastBubble.appendChild(div);
        }
    }

    async function triggerWelcomeMessage() {
        showTyping();
        try {
            if (!apiKey) apiKey = await loadGeminiKey();
            if (!apiKey) throw new Error("Chave não configurada");

            const welcomePrompt = `Olá! Se apresente como o Miles, o assistente virtual de atendimento da Kihap. 
Faça uma saudação calorosa e breve, transmitindo energia positiva. 
Mencione que pode ajudar a encontrar o programa ideal e agendar uma aula experimental gratuita.
Termine perguntando se a pessoa está buscando para si mesma, para um filho ou para a família.
Seja curto e convidativo — máximo 3 frases.`;

            const resp = await callGeminiMiles(
                [{ role: 'user', parts: [{ text: welcomePrompt }] }],
                apiKey
            );

            const aiText = resp.candidates?.[0]?.content?.parts?.[0]?.text || 
                           'Olá! Eu sou o Miles, assistente virtual da Kihap! 🥋 Que ótimo ter você aqui. Posso te ajudar a conhecer nossos programas e agendar uma **aula experimental gratuita**. Você busca para si mesmo, para um filho ou para toda a família?';

            chatHistory.push({ role: 'user', parts: [{ text: welcomePrompt }] });
            chatHistory.push({ role: 'model', parts: [{ text: aiText }] });

            hideTyping();
            appendMessage('model', formatMilesText(aiText));

        } catch (e) {
            console.warn('[Miles] Erro na saudação:', e);
            hideTyping();
            appendMessage('model', formatMilesText(
                'Olá! Eu sou o **Miles**, assistente virtual da Kihap! 🥋 Que ótimo ter você aqui.\n\nPosso te ajudar a conhecer nossos programas e agendar uma **aula experimental gratuita**. Você busca para si mesmo, para um filho ou para toda a família?'
            ));
        }
    }

    async function handleSend(userText) {
        if (!userText.trim()) return;

        // Atualiza UI
        input.value = '';
        appendMessage('user', userText);
        sendBtn.disabled = true;
        showTyping();

        chatHistory.push({ role: 'user', parts: [{ text: userText }] });

        try {
            if (!apiKey) apiKey = await loadGeminiKey();
            if (!apiKey) throw new Error("Chave da API não configurada. Entre em contato pelo WhatsApp.");

            let responseJson = await callGeminiMiles(chatHistory, apiKey);

            // Loop de function calling
            let loops = 0;
            while (loops < 5) {
                const candidate  = responseJson.candidates?.[0];
                const parts      = candidate?.content?.parts || [];
                const funcCalls  = parts.filter(p => p.functionCall);

                if (funcCalls.length === 0) {
                    // Resposta de texto final
                    const aiText = parts.find(p => p.text)?.text || 'Desculpe, tente novamente.';
                    chatHistory.push({ role: 'model', parts: [{ text: aiText }] });
                    hideTyping();
                    appendMessage('model', formatMilesText(aiText));

                    // Se acabou de salvar lead, mostra botão WhatsApp
                    if (window._milesLeadSaved && window._milesLeadWhatsapp) {
                        appendWhatsappButton(window._milesLeadWhatsapp);
                        window._milesLeadSaved = false;
                    }
                    break;
                }

                // Modelo quer chamar funções
                chatHistory.push({ role: 'model', parts });

                const responseParts = [];
                for (const call of funcCalls) {
                    const fnName = call.functionCall.name;
                    const args   = call.functionCall.args || {};
                    let result   = {};

                    if (fnName === 'getAvailableUnits') {
                        result = getAvailableUnits();
                    } else if (fnName === 'saveLead') {
                        result = await saveLead(args);
                    } else if (fnName === 'getSchedule') {
                        result = await getSchedule(args);
                    } else if (fnName === 'bookTrialClass') {
                        result = await bookTrialClass(args);
                    } else {
                        result = { error: 'Função desconhecida.' };
                    }

                    responseParts.push({
                        functionResponse: { name: fnName, response: result }
                    });
                }

                chatHistory.push({ role: 'user', parts: responseParts });
                responseJson = await callGeminiMiles(chatHistory, apiKey);
                loops++;
            }

            if (loops >= 5) {
                hideTyping();
                appendMessage('model', 'Desculpe, houve um problema. Por favor, tente novamente.');
            }

        } catch (e) {
            console.error('[Miles] Erro no chat:', e);
            hideTyping();
            appendMessage('model', `<span style="color:#ef4444">Ops! Tive um problema de conexão: ${e.message}</span>`);
            chatHistory.pop(); // Remove user msg com erro
        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    }

    // ── Event Listeners ──────────────────────────────────────────────────────

    toggle.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
            chatWindow.classList.remove('miles-hidden');
            if (!hasShownWelcome) {
                hasShownWelcome = true;
                triggerWelcomeMessage();
            }
            setTimeout(() => input.focus(), 300);
        } else {
            chatWindow.classList.add('miles-hidden');
        }
    });

    closeBtn.addEventListener('click', () => {
        isOpen = false;
        chatWindow.classList.add('miles-hidden');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) handleSend(text);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

function initMilesChatbot() {
    if (document.getElementById('miles-chatbot-container')) return; // Já iniciado
    injectMilesStyles();
    buildMilesHTML();
    setupMilesChatbot();
}

// Aguarda o DOM estar pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMilesChatbot);
} else {
    initMilesChatbot();
}
