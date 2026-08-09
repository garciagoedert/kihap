/**
 * Miles Page Controller — Chatbot Dedicado Mobile-First da Kihap
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
// CONFIGURAÇÕES DA IA (GEMINI 2.5 FLASH)
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const UNIDADES = {
    'asa-sul':               { nome: 'Asa Sul (Brasília - DF)',            telefone: '(61) 98300-7146', whatsapp: 'https://wa.me/556183007146', endereco: 'Asa Sul CLS 115 BL C Lj 28 - Asa Sul, Brasília - DF' },
    'sudoeste':              { nome: 'Sudoeste (Brasília - DF)',           telefone: '(61) 98210-7146', whatsapp: 'https://wa.me/556182107146', endereco: 'SIG Quadra 3 Bloco C Lote 38, Ed. Office 300 - Sudoeste, Brasília - DF' },
    'lago-sul':              { nome: 'Lago Sul (Brasília - DF)',           telefone: '(61) 99202-8980', whatsapp: 'https://wa.me/556192028980', endereco: 'SHIS QI 9 - Lago Sul, Brasília - DF' },
    'noroeste':              { nome: 'Noroeste (Brasília - DF)',           telefone: '(61) 98417-0472', whatsapp: 'https://wa.me/556184170472', endereco: 'CLNW 10/11 Bloco A - Noroeste, Brasília - DF' },
    'jardim-botanico':       { nome: 'Jardim Botânico (Brasília - DF)',    telefone: '(61) 98417-1059', whatsapp: 'https://wa.me/556184171059', endereco: 'Av. das Castanheiras, Centro Comercial Jardim Botânico - Brasília - DF' },
    'escola-eleva':          { nome: 'Escola Eleva (Brasília - DF)',       telefone: '(61) 98282-3380', whatsapp: 'https://wa.me/556182823380', endereco: 'SGAS 606 - Asa Sul, Brasília - DF' },
    'escola-kingdom-kids':   { nome: 'Kingdom Kids (Brasília - DF)',       telefone: '(61) 98282-3380', whatsapp: 'https://wa.me/556182823380', endereco: 'SGAS 915 - Asa Sul, Brasília - DF' },
    'escola-kingdom-school': { nome: 'Kingdom School (Brasília - DF)',     telefone: '(61) 98282-3380', whatsapp: 'https://wa.me/556182823380', endereco: 'SGAS 915 - Asa Sul, Brasília - DF' },
    'pontos-de-ensino':      { nome: 'Pontos de Ensino (Brasília - DF)',   telefone: '(61) 98282-3380', whatsapp: 'https://wa.me/556182823380', endereco: 'Pontos parceiros em Brasília - DF' },
    'centro':                { nome: 'Centro (Florianópolis - SC)',        telefone: '(48) 99218-2423', whatsapp: 'https://wa.me/554892182423', endereco: 'Rua Hermann Blumenau, 102 (Casarão) - Centro, Florianópolis - SC' },
    'coqueiros':             { nome: 'Coqueiros (Florianópolis - SC)',     telefone: '(48) 99629-6941', whatsapp: 'https://wa.me/554896296941', endereco: 'Rua Desembargador Pedro Silva, 2644 - Coqueiros, Florianópolis - SC' },
    'santa-monica':          { nome: 'Santa Mônica (Florianópolis - SC)',   telefone: '(48) 99217-2423', whatsapp: 'https://wa.me/554892172423', endereco: 'Av. Madre Benvenuta, 1157 - Santa Mônica, Florianópolis - SC' },
    'dourados':              { nome: 'Dourados (Mato Grosso do Sul)',      telefone: '(67) 99959-7001', whatsapp: 'https://wa.me/556799597001', endereco: 'Rua Toshinobu Katayama, 1420 - Jardim América, Dourados - MS' },
};

const SYSTEM_INSTRUCTION = `Você é o Miles, o simpático, energético e acolhedor assistente virtual da Kihap, uma renomada escola de artes marciais com unidades em Brasília, Florianópolis e Dourados (MS).

Seu objetivo é conversar com alunos, pais e futuros alunos (visitantes), tirar dúvidas sobre horários, turmas, programas, telefones e endereços das unidades, e agendar aulas experimentais GRATUITAS salvando o contato no CRM.

IDENTIDADE IMPORTANTE:
- Você é simplesmente o "Miles".
- Você NÃO deve se referir a si mesmo como "macaco", "primata" ou qualquer termo de animal.
- Você NÃO é um mestre de artes marciais. Na Kihap, o título de "Mestre" é um cargo humano de altíssimo respeito.

DIRETRIZES DE COMUNICAÇÃO:
1. **Acolhedor, Positivo, Profissional e Respeitoso**: Seu tom deve ser encorajador, confiante, empático e de alto nível.
2. **Evite Palavras Negativas**: Evite termos como "não", "infelizmente". Use soluções proativas.
3. **Valores da Kihap**: Reflita os valores: **DISCIPLINA, RESPEITO, AUTOESTIMA, COMUNICAÇÃO, GRATIDÃO e ACREDITAR**.
4. **Linguagem Organizada**: Use negritos (**texto**) para destacar termos importantes e forneça os links de WhatsApp formatados quando solicitado.

PROGRAMAS DA KIHAP:
- **Baby Littles** (1,5 a 3 anos): Desenvolvimento psicomotor e socialização.
- **Littles** (3 a 6 anos): Canalização de energia, disciplina positiva e coordenação.
- **Kids** (7 a 12 anos): Artes marciais, autodefesa, foco escolar e liderança.
- **Adolescentes** (12 a 17 anos): Condicionamento físico, superação e inteligência socioemocional.
- **Adultos** (18+): Defesa pessoal, redução de estresse, foco e alta performance física.
- **Família**: Integração familiar e fortalecimento de laços através do esporte.

CONTATOS E WHATSAPP DAS UNIDADES KIHAP:
Quando o usuário perguntar o número de WhatsApp, telefone ou localização de qualquer unidade, forneça com exatidão:
• **Asa Sul (Brasília)**: WhatsApp/Tel: (61) 98300-7146 | Endereço: CLS 115 BL C Lj 28
• **Sudoeste (Brasília)**: WhatsApp/Tel: (61) 98210-7146 | Endereço: SIG Quadra 3 Bloco C Lote 38
• **Lago Sul (Brasília)**: WhatsApp/Tel: (61) 99202-8980 | Endereço: SHIS QI 9
• **Noroeste (Brasília)**: WhatsApp/Tel: (61) 98417-0472 | Endereço: CLNW 10/11 Bloco A
• **Jardim Botânico (Brasília)**: WhatsApp/Tel: (61) 98417-1059 | Endereço: Av. das Castanheiras
• **Escolas Parceiras/Pontos de Ensino (DF)**: (61) 98282-3380
• **Centro (Florianópolis)**: WhatsApp/Tel: (48) 99218-2423 | Endereço: Rua Hermann Blumenau, 102
• **Coqueiros (Florianópolis)**: WhatsApp/Tel: (48) 99629-6941 | Endereço: Rua Desembargador Pedro Silva, 2644
• **Santa Mônica (Florianópolis)**: WhatsApp/Tel: (48) 99217-2423 | Endereço: Av. Madre Benvenuta, 1157
• **Dourados (MS)**: WhatsApp/Tel: (67) 99959-7001 | Endereço: Rua Toshinobu Katayama, 1420 - Jardim América

FLUXO DE ATENDIMENTO:
1. Cumprimentar e entender o que a pessoa busca (duvida sobre horario? whatsapp da unidade? agendar aula?).
2. Apresentar os programas ou responder com precisao dados das unidades.
3. Para interessados em agendar aula grátis: coletar **nome completo**, **telefone (WhatsApp)** e **unidade de preferência**.
4. Quando tiver nome + telefone + unidade, chamar saveLead() imediatamente.
5. Após salvar o lead (ou se solicitado), chamar getSchedule() para listar horários com vagas disponíveis.
6. Se o visitante escolher um horário específico, chamar bookTrialClass() para agendar.

Mantenha respostas curtas, amigáveis e organizadas.`;

const MILES_TOOLS = [{
    functionDeclarations: [
        {
            name: "getAvailableUnits",
            description: "Retorna a lista de todas as unidades da Kihap disponíveis, organizadas por cidade.",
            parameters: { type: "OBJECT", properties: {} }
        },
        {
            name: "saveLead",
            description: "Salva os dados do lead no sistema CRM da Kihap. Chamar SOMENTE quando tiver coletado nome completo, telefone/WhatsApp e a unidade de preferência.",
            parameters: {
                type: "OBJECT",
                properties: {
                    nome: { type: "STRING", description: "Nome completo." },
                    telefone: { type: "STRING", description: "Telefone ou WhatsApp com DDD." },
                    programaInteresse: { type: "STRING", description: "Programa de interesse (ex: Kids, Adultos)." },
                    unidade: { type: "STRING", description: "Nome da unidade (ex: Asa Sul, Centro, Dourados)." },
                    unidadeKey: { type: "STRING", description: "Chave interna da unidade (ex: asa-sul, centro, dourados)." }
                },
                required: ["nome", "telefone", "unidade"]
            }
        },
        {
            name: "getSchedule",
            description: "Busca a grade de horários da unidade para os próximos 7 dias com vagas disponíveis.",
            parameters: {
                type: "OBJECT",
                properties: {
                    unidadeKey: { type: "STRING", description: "Chave da unidade (ex: asa-sul, centro, dourados)." },
                    categoria: { type: "STRING", description: "Categoria/Programa de interesse (opcional)." }
                },
                required: ["unidadeKey"]
            }
        },
        {
            name: "bookTrialClass",
            description: "Agenda uma aula experimental para o visitante em uma turma específica.",
            parameters: {
                type: "OBJECT",
                properties: {
                    instanceId: { type: "STRING" },
                    templateId: { type: "STRING" },
                    data: { type: "STRING" },
                    unitId: { type: "STRING" },
                    nome: { type: "STRING" },
                    telefone: { type: "STRING" },
                    programa: { type: "STRING" },
                    leadId: { type: "STRING" }
                },
                required: ["instanceId", "templateId", "data", "unitId", "nome", "telefone"]
            }
        }
    ]
}];

// ─────────────────────────────────────────────────────────────────────────────
// EXECUÇÃO DAS FERRAMENTAS DO FIRESTORE
// ─────────────────────────────────────────────────────────────────────────────

function getAvailableUnits() {
    return {
        unidades: UNIDADES,
        message: "Temos 10 unidades ativas em Brasília, Florianópolis e Dourados (MS) com contatos diretos de WhatsApp disponíveis."
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
            'origem do lead': 'Página Chat Miles',
            status: 'Novo',
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'leads'), leadData);

        let whatsappUrl = '';
        const unidadeNorm = (unidade || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (unidadeKey && UNIDADES[unidadeKey]) {
            whatsappUrl = UNIDADES[unidadeKey].whatsapp;
        } else {
            for (const [key, info] of Object.entries(UNIDADES)) {
                const infoNorm = info.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (unidadeNorm.includes(key.replace(/-/g, ' ')) || infoNorm.includes(unidadeNorm)) {
                    whatsappUrl = info.whatsapp;
                    break;
                }
            }
        }

        window._milesLeadWhatsapp = whatsappUrl;
        window._milesLeadSaved = true;
        window._milesLeadId = docRef.id;

        return {
            success: true,
            leadId: docRef.id,
            whatsappUrl: whatsappUrl,
            message: `Lead de ${nome} salvo com sucesso no CRM! Mostre o botão do WhatsApp ou consulte os horários pelo getSchedule().`
        };
    } catch (e) {
        console.error("[Miles] Erro ao salvar lead:", e);
        return { success: false, error: e.message };
    }
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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

        const filtered = categoria
            ? templates.filter(t => (t.category || '').toLowerCase() === categoria.toLowerCase())
            : templates;

        if (filtered.length === 0) {
            return {
                success: true,
                aulasDisponiveis: [],
                message: `Nenhuma turma de "${categoria || 'todas'}" encontrada para a unidade ${unidadeKey}.`
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

        for (const day of days) {
            const dayOfWeek = day.getDay();
            const dateStr = getLocalDateString(day);

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
                    data: dateStr,
                    diaSemana: diasSemana[dayOfWeek],
                    horario: `${template.time} - ${horaFim}`,
                    vagasDisponiveis,
                    unitId: unidadeKey
                });
            }
        }

        return {
            success: true,
            aulasDisponiveis,
            message: `Encontradas ${aulasDisponiveis.length} aulas com vagas para ${unidadeKey}.`
        };

    } catch (e) {
        console.error('[Miles] Erro ao buscar grade:', e);
        return { error: e.message };
    }
}

async function bookTrialClass(args) {
    const { instanceId, templateId, data, unitId, nome, telefone, programa, leadId } = args;
    if (!instanceId || !nome || !telefone) return { error: 'Dados insuficientes para agendamento.' };

    try {
        const instanceRef = doc(db, 'classInstances', instanceId);
        const instanceSnap = await getDoc(instanceRef);
        const trialEntry = { nome, telefone, programa: programa || '', compareceu: false, agendadoEm: new Date() };

        if (instanceSnap.exists()) {
            const existingTrials = instanceSnap.data().trialStudents || [];
            await updateDoc(instanceRef, { trialStudents: [...existingTrials, trialEntry] });
        } else {
            await setDoc(instanceRef, { templateId, date: data, unitId, trialStudents: [trialEntry] });
        }

        const resolvedLeadId = leadId || window._milesLeadId;
        if (resolvedLeadId) {
            try { await updateDoc(doc(db, 'leads', resolvedLeadId), { status: 'Agendado' }); } catch (_) {}
        }

        return {
            success: true,
            message: `Aula experimental de ${nome} agendada com sucesso para a data ${data}!`
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUISIÇÃO GEMINI API
// ─────────────────────────────────────────────────────────────────────────────

async function loadGeminiKey() {
    try {
        const docRef = doc(db, "public_config", "miles");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().geminiKey) {
            return docSnap.data().geminiKey;
        }
    } catch (_) {}

    const local = localStorage.getItem('meta_ads_config');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            if (parsed.geminiKey) return parsed.geminiKey;
        } catch (_) {}
    }
    return null;
}

async function callGeminiMiles(history, apiKey) {
    const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: history,
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            tools: MILES_TOOLS,
            generationConfig: { temperature: 0.8, maxOutputTokens: 700 }
        })
    });
    const json = await response.json();
    if (json.error) throw new Error(json.error.message);
    return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLE DA INTERFACE DE CHAT
// ─────────────────────────────────────────────────────────────────────────────

function formatText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('miles-chat-messages');
    const typingIndicator   = document.getElementById('miles-typing-indicator');
    const form              = document.getElementById('miles-chat-form');
    const input             = document.getElementById('miles-chat-input');
    const sendBtn           = document.getElementById('miles-send-btn');
    const resetBtn          = document.getElementById('miles-reset-btn');
    const chips             = document.querySelectorAll('.miles-chip');

    let chatHistory = [];
    let apiKey = null;

    function scrollToBottom() {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }

    function showTyping() {
        typingIndicator.classList.remove('hidden');
        messagesContainer.appendChild(typingIndicator);
        scrollToBottom();
    }

    function hideTyping() {
        typingIndicator.classList.add('hidden');
    }

    function appendMessage(role, htmlText, whatsappUrl = null) {
        const wrap = document.createElement('div');
        wrap.className = `flex items-start gap-2.5 max-w-[88%] ${role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'}`;

        if (role === 'model') {
            const avatar = document.createElement('div');
            avatar.className = 'w-8 h-8 rounded-xl overflow-hidden bg-amber-50 shrink-0 border border-amber-300/40 shadow-sm mt-1';
            avatar.innerHTML = `<img src="imgs/personagens/perfilpersonagens/avatar_05.png" alt="Miles" class="w-full h-full object-cover">`;
            wrap.appendChild(avatar);
        }

        const bubble = document.createElement('div');
        bubble.className = role === 'user' 
            ? 'miles-user-bubble px-4 py-3 rounded-2xl text-sm leading-relaxed font-semibold'
            : 'miles-bot-bubble px-4 py-3 rounded-2xl text-sm leading-relaxed font-normal';
        
        bubble.innerHTML = htmlText;

        if (whatsappUrl && role === 'model') {
            const waBtn = document.createElement('a');
            waBtn.href = whatsappUrl;
            waBtn.target = '_blank';
            waBtn.rel = 'noopener noreferrer';
            waBtn.className = 'mt-3 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-transform hover:scale-105 active:scale-95 shadow-md text-decoration-none';
            waBtn.innerHTML = `
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                </svg>
                Falar com a Unidade no WhatsApp
            `;
            bubble.appendChild(waBtn);
        }

        wrap.appendChild(bubble);
        messagesContainer.insertBefore(wrap, typingIndicator);
        scrollToBottom();
    }

    async function handleSend(userText) {
        if (!userText.trim()) return;

        input.value = '';
        appendMessage('user', userText);
        sendBtn.disabled = true;
        showTyping();

        chatHistory.push({ role: 'user', parts: [{ text: userText }] });

        try {
            if (!apiKey) apiKey = await loadGeminiKey();
            if (!apiKey) throw new Error("Chave da API não encontrada. Por favor, tente novamente mais tarde.");

            let responseJson = await callGeminiMiles(chatHistory, apiKey);
            let loops = 0;

            while (loops < 5) {
                const candidate = responseJson.candidates?.[0];
                const parts     = candidate?.content?.parts || [];
                const funcCalls = parts.filter(p => p.functionCall);

                if (funcCalls.length === 0) {
                    const aiText = parts.find(p => p.text)?.text || 'Desculpe, pode repetir?';
                    chatHistory.push({ role: 'model', parts: [{ text: aiText }] });
                    hideTyping();

                    const waUrl = (window._milesLeadSaved && window._milesLeadWhatsapp) ? window._milesLeadWhatsapp : null;
                    appendMessage('model', formatText(aiText), waUrl);
                    if (window._milesLeadSaved) window._milesLeadSaved = false;
                    break;
                }

                chatHistory.push({ role: 'model', parts });
                const responseParts = [];

                for (const call of funcCalls) {
                    const fnName = call.functionCall.name;
                    const args   = call.functionCall.args || {};
                    let result   = {};

                    if (fnName === 'getAvailableUnits') result = getAvailableUnits();
                    else if (fnName === 'saveLead') result = await saveLead(args);
                    else if (fnName === 'getSchedule') result = await getSchedule(args);
                    else if (fnName === 'bookTrialClass') result = await bookTrialClass(args);

                    responseParts.push({ functionResponse: { name: fnName, response: result } });
                }

                chatHistory.push({ role: 'user', parts: responseParts });
                responseJson = await callGeminiMiles(chatHistory, apiKey);
                loops++;
            }

        } catch (e) {
            console.error('[Miles Page] Erro:', e);
            hideTyping();
            appendMessage('model', `<span class="text-red-500">Ops! Tive um contratempo de conexão: ${e.message}</span>`);
        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    }

    // Event Listeners
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSend(input.value.trim());
    });

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            if (prompt) handleSend(prompt);
        });
    });

    resetBtn.addEventListener('click', () => {
        chatHistory = [];
        window._milesLeadSaved = false;
        window._milesLeadWhatsapp = null;
        messagesContainer.innerHTML = `
            <div class="flex flex-col items-center text-center my-4 p-6 rounded-3xl bg-white/90 border border-amber-300/40 shadow-sm max-w-lg mx-auto">
                <div class="w-20 h-20 rounded-3xl overflow-hidden ring-4 ring-amber-400/40 mb-3 bg-amber-50 shadow-md">
                    <img src="imgs/personagens/perfilpersonagens/avatar_05.png" alt="Miles" class="w-full h-full object-cover">
                </div>
                <h2 class="text-lg font-black text-gray-900 font-title uppercase tracking-tight">Conversa Reiniciada! 🥋</h2>
                <p class="text-sm text-gray-600 mt-1.5 leading-relaxed">
                    Como posso te ajudar agora? Escolha uma opção abaixo ou digite sua dúvida.
                </p>
            </div>
            <div id="miles-typing-indicator" class="hidden flex items-start gap-2.5 max-w-[85%]">
                <div class="w-8 h-8 rounded-xl overflow-hidden bg-amber-50 shrink-0 border border-amber-300/40 shadow-sm">
                    <img src="imgs/personagens/perfilpersonagens/avatar_05.png" alt="Miles" class="w-full h-full object-cover">
                </div>
                <div class="miles-bot-bubble px-4 py-3 rounded-2xl flex items-center gap-1.5">
                    <span class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
                    <span class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
                    <span class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
                </div>
            </div>
        `;
    });

    // Carrega chave ao abrir a página
    loadGeminiKey().then(key => { apiKey = key; });
});
