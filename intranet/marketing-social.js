import { loadComponents, setupUIListeners } from './common-ui.js';
import { socialConfig } from './social-config.js';
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Local cache for configuration
let activeConfig = { ...socialConfig };

async function loadConfig() {
    // 1. Fallback 1: hardcoded config (already in activeConfig)
    
    // 2. Fallback 2: localStorage (client-specific/developer override)
    const local = localStorage.getItem('meta_ads_config');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            activeConfig = { ...activeConfig, ...parsed };
        } catch (e) {
            console.error("Erro ao ler config do localStorage:", e);
        }
    }

    // 3. Fallback 3: Firestore config (shared admin config)
    try {
        const docRef = doc(db, "config", "meta_ads");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            activeConfig = { ...activeConfig, ...firestoreData };
            console.log("Configurações do Meta Ads carregadas do Firestore.");
        } else {
            console.log("Nenhum documento de configuração encontrado no Firestore. Usando defaults.");
        }
    } catch (e) {
        console.warn("Não foi possível carregar configurações do Firestore (pode requerer permissões):", e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carregar componentes padrão (sidebar, header)
    await loadComponents(() => {
        setupUIListeners();
    });

    // 2. Inicializar Dashboard
    initDashboard();

    // 3. Listeners da página
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        const btn = document.getElementById('refreshBtn');
        const icon = btn.querySelector('i');
        icon.classList.add('fa-spin');

        initDashboard().then(() => {
            setTimeout(() => icon.classList.remove('fa-spin'), 500);
        });
    });

    const periodSelect = document.getElementById('periodSelect');
    const customControls = document.getElementById('customDateControls');

    periodSelect?.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customControls.classList.remove('hidden');
            customControls.style.display = 'flex'; // Force display
        } else {
            customControls.classList.add('hidden');
            customControls.style.display = 'none';
            initDashboard();
        }
    });

    document.getElementById('applyCustomDate')?.addEventListener('click', () => {
        initDashboard();
    });

    // 5. Chatbot IA Flutuante Listeners
    const aiChatToggle = document.getElementById('aiChatToggle');
    const aiChatWindow = document.getElementById('aiChatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatForm = document.getElementById('chatForm');

    aiChatToggle?.addEventListener('click', () => {
        const isHidden = aiChatWindow.classList.contains('hidden');
        if (isHidden) {
            // Mostrar janela
            aiChatWindow.classList.remove('hidden');
            setTimeout(() => {
                aiChatWindow.classList.remove('scale-95', 'opacity-0');
                aiChatWindow.classList.add('scale-100', 'opacity-100');
            }, 10);

            // Se for a primeira vez que abre (histórico vazio), dispara análise inicial
            if (chatHistory.length === 0) {
                triggerInitialAnalysis();
            }
        } else {
            // Ocultar janela
            aiChatWindow.classList.remove('scale-100', 'opacity-100');
            aiChatWindow.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                aiChatWindow.classList.add('hidden');
            }, 300);
        }
    });

    closeChatBtn?.addEventListener('click', () => {
        aiChatWindow.classList.remove('scale-100', 'opacity-100');
        aiChatWindow.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            aiChatWindow.classList.add('hidden');
        }, 300);
    });

    chatForm?.addEventListener('submit', sendChatMessage);

    // 6. Exportar Relatório Listeners
    const exportReportBtn = document.getElementById('exportReportBtn');
    const exportMenu = document.getElementById('exportMenu');

    exportReportBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = exportMenu.classList.contains('hidden');
        if (isHidden) {
            exportMenu.classList.remove('hidden');
            setTimeout(() => {
                exportMenu.classList.remove('scale-95', 'opacity-0');
                exportMenu.classList.add('scale-100', 'opacity-100');
            }, 10);
        } else {
            closeExportMenu();
        }
    });

    function closeExportMenu() {
        if (!exportMenu || exportMenu.classList.contains('hidden')) return;
        exportMenu.classList.remove('scale-100', 'opacity-100');
        exportMenu.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            exportMenu.classList.add('hidden');
        }, 200);
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (exportMenu && !exportMenu.classList.contains('hidden')) {
            if (!document.getElementById('exportDropdownContainer')?.contains(e.target)) {
                closeExportMenu();
            }
        }
    });

    document.querySelectorAll('.export-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const days = parseInt(e.target.getAttribute('data-days'));
            closeExportMenu();
            exportTrafficReport(days);
        });
    });

    // 4. Modal de Configurações do Meta
    const configModal = document.getElementById('meta-config-modal');
    const configForm = document.getElementById('meta-config-form');

    document.getElementById('connectMetaBtn')?.addEventListener('click', () => {
        // Preencher os campos com os valores atuais da activeConfig
        document.getElementById('meta-token').value = activeConfig.accessToken || '';
        document.getElementById('meta-account').value = activeConfig.adAccountId || '';
        document.getElementById('meta-version').value = activeConfig.apiVersion || 'v19.0';
        document.getElementById('meta-gemini').value = activeConfig.geminiKey || '';

        configModal.classList.remove('hidden');
    });

    document.getElementById('cancel-meta-btn')?.addEventListener('click', () => {
        configModal.classList.add('hidden');
    });

    configForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveBtn = configForm.querySelector('button[type="submit"]');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';

        const newConfig = {
            accessToken: document.getElementById('meta-token').value.trim(),
            adAccountId: document.getElementById('meta-account').value.trim(),
            apiVersion: document.getElementById('meta-version').value.trim(),
            geminiKey: document.getElementById('meta-gemini').value.trim()
        };

        try {
            // Salvar no localStorage
            localStorage.setItem('meta_ads_config', JSON.stringify(newConfig));

            // Salvar no Firestore
            const docRef = doc(db, "config", "meta_ads");
            await setDoc(docRef, newConfig, { merge: true });

            console.log("Configurações atualizadas com sucesso!");
            configModal.classList.add('hidden');
            
            // Recarregar dashboard
            await initDashboard();

        } catch (err) {
            console.error("Erro ao salvar configurações:", err);
            alert("Erro ao salvar no Firestore (suas alterações foram salvas localmente): " + err.message);
            // Fecha mesmo assim para usar a config local
            configModal.classList.add('hidden');
            await initDashboard();
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    });
});

// Global state to hold data for AI
let currentDashboardData = null;
let chatHistory = [];

const systemInstruction = `Você é um especialista em tráfego pago (Meta Ads) sênior contratado pela Kihap, uma renomada escola de artes marciais.
Seu objetivo é ajudar a analisar o desempenho das campanhas de tráfego pago, sugerir otimizações, explicar métricas (como CPR, CTR, CPC, cliques, impressões) e responder dúvidas estratégicas em linguagem natural.
Mantenha suas respostas diretas, úteis e focadas em conversões (como mensagens iniciadas no WhatsApp ou formulários de leads).
Sempre use formatação amigável (como negritos simples com **texto** e listas de itens se necessário). Evite respostas muito longas e prolixas.`;

async function initDashboard() {
    // Carregar configurações dinâmicas
    await loadConfig();

    // Verificar se temos credenciais configuradas
    if (!activeConfig.accessToken || activeConfig.accessToken === "SEU_ACCESS_TOKEN_AQUI") {
        console.warn("Meta Access Token não configurado. Usando Mock Data.");
        const data = getMockData();
        updateOverviewCards(data.overview);
        renderCharts(data.charts);
        renderCampaignsTable(data.campaigns);

        // Aviso visual
        if (!document.getElementById('configWarning')) {
            const warning = document.createElement('div');
            warning.id = 'configWarning';
            warning.className = 'bg-yellow-600/20 border border-yellow-600 text-yellow-500 p-3 rounded mb-4 text-sm';
            warning.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Modo Demonstração. Configure clicando em <strong>Conectar Meta</strong> para ver dados reais.';
            document.querySelector('#main-content > div').prepend(warning);
        }
        return;
    }

    try {
        const data = await fetchMetaAdsData();
        currentDashboardData = data; // Save for AI
        updateOverviewCards(data.overview);
        renderCharts(data.charts);
        renderCampaignsTable(data.campaigns);

        const warning = document.getElementById('configWarning');
        if (warning) warning.remove();

    } catch (error) {
        console.error("Erro ao carregar dados do Meta:", error);
        alert("Falha ao carregar dados do Facebook Ads: " + error.message);
    }
}

// --- META API INTEGRATION ---
async function fetchMetaAdsData() {
    const { accessToken, adAccountId, apiVersion } = activeConfig;
    const baseUrl = `https://graph.facebook.com/${apiVersion}/act_${adAccountId}`;

    // Date Logic
    const preset = getDatePreset();
    let dateParams = '';

    if (preset) {
        dateParams = `date_preset=${preset}`;
    } else {
        const start = document.getElementById('dateStart').value;
        const end = document.getElementById('dateEnd').value;
        if (!start || !end) {
            alert("Selecione data inicial e final.");
            throw new Error("Datas inválidas");
        }
        // Meta API needs format YYYY-MM-DD
        const timeRange = JSON.stringify({ since: start, until: end });
        dateParams = `time_range=${timeRange}`;
    }

    // 1. Fetch Insights (Overview) & Chart Data (Same call with time_increment=1)
    // Agrupado por dia
    const chartFields = 'spend,actions,reach,date_start,clicks,impressions';
    const chartUrl = `${baseUrl}/insights?level=account&${dateParams}&time_increment=1&fields=${chartFields}&access_token=${accessToken}`;

    // Fetch Campanhas
    // Re-adding insights with simple syntax first.
    // Note: 'spend' is inside insights, not root.
    const campaignsFields = 'name,status,insights{spend,reach,actions,clicks,cpc,ctr,frequency,impressions,inline_link_clicks}';
    const campaignsUrl = `${baseUrl}/campaigns?fields=${campaignsFields}&effective_status=["ACTIVE","PAUSED"]&limit=50&access_token=${accessToken}&${dateParams}`;

    // Parallel Fetch
    const [chartRes, campaignsRes] = await Promise.all([
        fetch(chartUrl),
        fetch(campaignsUrl)
    ]);

    const chartJson = await chartRes.json();
    const campaignsJsonData = await campaignsRes.json(); // Helper due to long existing implementation... actually let's just inline json()

    if (chartJson.error) throw new Error(chartJson.error.message);

    // --- Process Chart & Overview ---
    const dailyData = (chartJson.data || []).reverse();
    dailyData.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    let dailyLabels = dailyData.map(d => formatDateLabel(d.date_start));
    let dailySpend = dailyData.map(d => parseFloat(d.spend || 0));
    let dailyResults = dailyData.map(d => countActions(d.actions));

    // Calculate Overview Totals from Daily Data (More accurate matching chart)
    const totalSpend = dailyData.reduce((acc, d) => acc + parseFloat(d.spend || 0), 0);
    const totalClicks = dailyData.reduce((acc, d) => acc + parseInt(d.clicks || 0), 0);
    const totalImpressions = dailyData.reduce((acc, d) => acc + parseInt(d.impressions || 0), 0);
    const totalActions = dailyData.reduce((acc, d) => acc + countActions(d.actions), 0);
    const avgCpr = totalActions > 0 ? (totalSpend / totalActions) : 0;

    // --- NEW: Calculate Messages & Likes from Daily Data for Consistency ---
    // Previously we summed from campaigns, which caused date mismatch issues if campaigns endpoint didn't filter perfectly

    const msgActionTypes = [
        'onsite_conversion.messaging_conversation_started_7d',
        'messaging_conversation_started_7d',
        'onsite_conversion.messaging_conversation_started_28d',
        'contact_total',
        'leads'
    ];

    const totalMsgs = dailyData.reduce((acc, day) => {
        return acc + getActionValue(day.actions || [], msgActionTypes);
    }, 0);

    const totalLikes = dailyData.reduce((acc, day) => {
        return acc + getActionValue(day.actions || [], ['like', 'follow']); // Added follow just in case
    }, 0);

    const costPerLike = totalLikes > 0 ? (totalSpend / totalLikes) : 0;
    const costPerMsg = totalMsgs > 0 ? (totalSpend / totalMsgs) : 0; // Useful internal metric

    // --- Process Campaigns ---
    // Note: Campaigns are still fetched to populate the table

    console.log("--- DEBUG META API ---");
    console.log("Daily Chart Data:", dailyData);

    // Fetch Instagram Info (Followers)
    let igInfo = { count: '-', username: '@...' };
    try {
        const pagesUrl = `https://graph.facebook.com/${apiVersion}/me/accounts?fields=instagram_business_account{id,username,followers_count}&access_token=${accessToken}`;
        const pagesRes = await fetch(pagesUrl);
        const pagesJson = await pagesRes.json();
        const igAccount = pagesJson.data?.[0]?.instagram_business_account;

        if (igAccount) {
            igInfo.count = igAccount.followers_count;
            igInfo.username = '@' + igAccount.username;
        }
    } catch (e) {
        console.warn("Não foi possível carregar Instagram:", e);
    }

    const campaigns = (campaignsJsonData.data || []).map(camp => {
        const insight = camp.insights?.data?.[0] || {};
        const spend = parseFloat(insight.spend || 0);
        const reach = parseInt(insight.reach || 0);
        const clicks = parseInt(insight.inline_link_clicks || insight.clicks || 0);
        const ctr = parseFloat(insight.ctr || 0);
        const cpc = parseFloat(insight.cpc || 0);

        const msgs = getActionValue(insight.actions, msgActionTypes);
        const visits = getActionValue(insight.actions, ['instagram_profile_visits']);

        // Custo por Resultado (Individual Campanha)
        const finalResult = msgs > 0 ? msgs : (clicks > 0 ? clicks : 0);
        const cpr = finalResult > 0 ? (spend / finalResult) : 0;

        return {
            id: camp.id,
            name: camp.name,
            status: camp.status.toLowerCase() === 'active' ? 'active' : 'paused',
            msgs: msgs,
            clicks: clicks,
            ctr: ctr,
            cpc: cpc,
            reach: reach,
            visits: visits,
            spend: spend,
            costPerResult: cpr
        };
    });

    return {
        overview: {
            spend: totalSpend,
            impressions: totalImpressions,
            clicks: totalClicks,
            cpr: avgCpr,
            msgs: totalMsgs,
            likes: totalLikes,
            costPerLike: costPerLike,
            igAccounts: ['kihap.martialarts', 'kihap.florianopolis', 'kihap.dourados']
        },
        charts: {
            labels: dailyLabels,
            dailySpend: dailySpend,
            dailyResults: dailyResults,
            platformSplit: [50, 50]
        },
        campaigns: campaigns
    };
}

// Helper para pegar valor de ação específica
function getActionValue(actionsArray, types) {
    if (!actionsArray || !Array.isArray(actionsArray)) return 0;
    let total = 0;
    actionsArray.forEach(item => {
        // Check if action_type contains any of our keywords to be safer
        const type = item.action_type;
        if (types.some(t => type === t || type.includes(t))) {
            total += parseInt(item.value);
        }
    });
    return total;
}

// Helper para somar ações (leads, compras, etc)
function countActions(actionsArray) {
    if (!actionsArray || !Array.isArray(actionsArray)) return 0;

    // DEBUG: Ver quais ações estão disponíveis
    // console.log("Actions available:", actionsArray.map(a => a.action_type));

    // Novas tentativas de achar "Resultados"
    const targetActions = [
        'lead',
        'contact',
        'purchase',
        'submit_application',
        'complete_registration',
        'link_click',
        'onsite_conversion.messaging_conversation_started_7d', // Mensagens iniciadas
        'landing_page_view'
    ];

    let total = 0;
    // Soma tudo que for relevante
    actionsArray.forEach(item => {
        if (targetActions.includes(item.action_type)) {
            total += parseInt(item.value);
        }
    });

    // Se ainda zero, pega qualquer clique
    if (total === 0) {
        let anyClick = actionsArray.find(a => a.action_type.includes('click'));
        if (anyClick) total = parseInt(anyClick.value);
    }

    return total;
}

function formatDateLabel(dateString) {
    const date = new Date(dateString + 'T12:00:00'); // avoid timezone offset issues
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getDatePreset() {
    const select = document.getElementById('periodSelect');
    if (select.value === 'custom') return null;
    // Map dropdown values to Meta API constants
    const map = {
        'today': 'today',
        'yesterday': 'yesterday',
        'last7': 'last_7d',
        'last30': 'last_30d',
        'thisMonth': 'this_month'
    };
    return map[select.value] || 'last_30d';
}

// --- GEMINI AI INTEGRATION ---
function formatMessageText(text) {
    // Converter **negrito** para <strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Converter *itálico* para <em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Converter quebras de linha para <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function appendMessage(role, text) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start');

    const innerDiv = document.createElement('div');
    if (role === 'user') {
        innerDiv.className = 'bg-primary text-black font-semibold px-4 py-2.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm';
    } else {
        innerDiv.className = 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2.5 rounded-2xl rounded-tl-none max-w-[85%] border border-gray-200 dark:border-gray-700/50 shadow-sm';
    }

    innerDiv.innerHTML = formatMessageText(text);
    messageDiv.appendChild(innerDiv);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function triggerInitialAnalysis() {
    // Se por acaso os dados não estiverem prontos ainda, tentamos carregar
    if (!currentDashboardData) {
        await initDashboard();
    }
    
    const messagesContainer = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('chatTypingIndicator');
    
    if (typingIndicator) {
        typingIndicator.classList.remove('hidden');
    }
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    try {
        const data = currentDashboardData || getMockData();
        const summary = {
            spend: data.overview.spend || 0,
            cpr: data.overview.cpr || 0,
            clicks: data.overview.clicks || 0,
            msgs: data.overview.msgs || 0,
            likes: data.overview.likes || 0,
            topCampaigns: (data.campaigns || [])
                .filter(c => c.status === 'active')
                .sort((a, b) => b.spend - a.spend)
                .slice(0, 3)
                .map(c => `${c.name} (Gasto: R$${c.spend.toFixed(2)}, CPR/Resultado: R$${c.costPerResult.toFixed(2)}, Cliques: ${c.clicks})`)
        };

        const prompt = `
Olá! Faça uma análise inicial de boas-vindas baseada nos seguintes dados de tráfego pago da Kihap:
- Investimento Total: R$ ${summary.spend.toFixed(2)}
- Custo por Resultado (CPR) Médio: R$ ${summary.cpr.toFixed(2)}
- Cliques: ${summary.clicks}
- Mensagens Iniciadas: ${summary.msgs}
- Novos Seguidores (Ads): ${summary.likes}
- Top 3 Campanhas Ativas por Investimento: ${JSON.stringify(summary.topCampaigns)}

Por favor, faça uma saudação amigável e forneça um resumo rápido do desempenho atual da conta com 2 insights principais e 1 recomendação de ação imediata. Mantenha a resposta concisa.
`;

        const apiKey = activeConfig.geminiKey || '';
        if (!apiKey) {
            throw new Error("Chave da API do Gemini não configurada nas configurações do Meta.");
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                }
            })
        });

        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        
        const aiText = json.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui gerar a análise inicial.";
        
        chatHistory.push({
            role: 'user',
            parts: [{ text: "Analise o desempenho recente da minha conta." }]
        });
        chatHistory.push({
            role: 'model',
            parts: [{ text: aiText }]
        });

        appendMessage('model', aiText);

    } catch (e) {
        console.error("Erro na análise inicial da IA:", e);
        appendMessage('model', `<span class="text-red-500 font-medium">Erro ao gerar análise inicial: ${e.message}</span><br><br>Por favor, certifique-se de configurar uma chave da API do Gemini válida clicando no botão "Conectar Meta".`);
    } finally {
        if (typingIndicator) {
            typingIndicator.classList.add('hidden');
        }
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}

async function sendChatMessage(e) {
    e.preventDefault();
    
    const inputEl = document.getElementById('chatInput');
    if (!inputEl) return;
    
    const text = inputEl.value.trim();
    if (!text) return;
    
    // Clear input
    inputEl.value = '';
    
    // Append user message
    appendMessage('user', text);
    
    // Push user message to history
    chatHistory.push({
        role: 'user',
        parts: [{ text: text }]
    });
    
    const messagesContainer = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('chatTypingIndicator');
    
    if (typingIndicator) {
        typingIndicator.classList.remove('hidden');
    }
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    try {
        const apiKey = activeConfig.geminiKey || '';
        if (!apiKey) {
            throw new Error("Chave da API do Gemini não configurada.");
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: chatHistory,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                }
            })
        });
        
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        
        const aiText = json.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui obter uma resposta.";
        
        chatHistory.push({
            role: 'model',
            parts: [{ text: aiText }]
        });
        
        appendMessage('model', aiText);
        
    } catch (e) {
        console.error("Erro no chat da IA:", e);
        appendMessage('model', `<span class="text-red-500 font-medium">Erro na comunicação com a IA: ${e.message}</span>`);
        chatHistory.pop(); // Remove o último envio para não quebrar a sequência
    } finally {
        if (typingIndicator) {
            typingIndicator.classList.add('hidden');
        }
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}


function getMockData() {
    return {
        overview: {
            spend: 12450.00,
            impressions: 452000,
            clicks: 8540,
            cpr: 3.45 // Custo por resultado (ex: lead)
        },
        charts: {
            dailySpend: [400, 420, 380, 450, 500, 600, 580], // Last 7 days or points
            dailyResults: [15, 18, 12, 20, 25, 30, 28],
            platformSplit: [60, 40] // Insta vs FB
        },
        campaigns: []
    };
}

// --- RENDER FUNCTIONS ---

function updateOverviewCards(overview) {
    document.getElementById('totalSpend').textContent = formatCurrency(overview.spend);
    document.getElementById('totalImpressions').textContent = formatNumber(overview.impressions);
    document.getElementById('totalClicks').textContent = formatNumber(overview.clicks);
    document.getElementById('avgCpr').textContent = formatCurrency(overview.cpr);

    // New cards
    document.getElementById('totalMsgs').textContent = formatNumber(overview.msgs);
    document.getElementById('totalLikes').textContent = formatNumber(overview.likes);
    document.getElementById('costPerLike').textContent = formatCurrency(overview.costPerLike);

    // Update Folowers (List)
    const igEl = document.getElementById('igFollowers');

    if (igEl && overview.igAccounts) {
        igEl.innerHTML = '';
        igEl.className = 'text-sm text-gray-700 dark:text-gray-300 space-y-1.5 mt-2'; // Reset style

        overview.igAccounts.forEach(acc => {
            const div = document.createElement('div');
            div.innerHTML = `<i class="fab fa-instagram text-pink-500 mr-2"></i> ${acc}`;
            igEl.appendChild(div);
        });
    } else if (igEl) {
        igEl.textContent = '--';
    }
}

function renderCampaignsTable(campaigns) {
    const tbody = document.getElementById('campaignsTableBody');
    tbody.innerHTML = '';

    campaigns.forEach(camp => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0';

        let statusBadge = '';
        if (camp.status === 'active') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">Ativa</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-bold">Pausada</span>`;
        }

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">${statusBadge}</td>
            <td class="px-4 py-3 font-bold text-gray-900 dark:text-white truncate max-w-xs" title="${camp.name}">${camp.name}</td>
            <td class="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">${formatNumber(camp.msgs)}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">${formatNumber(camp.clicks)}</td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400">${camp.ctr.toFixed(2)}%</td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400">${formatCurrency(camp.cpc)}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">${formatNumber(camp.reach)}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">${formatNumber(camp.visits)}</td>
            <td class="px-4 py-3 text-gray-900 dark:text-white font-bold">${formatCurrency(camp.spend)}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderCharts(chartData) {
    const isDark = document.documentElement.classList.contains('dark');
    
    // 1. Performance Chart (Line/Bar combo)
    const ctxPerf = document.getElementById('performanceChart').getContext('2d');

    // Destruir chart anterior se existir (para evitar sobreposição no refresh)
    if (window.perfChartInstance) window.perfChartInstance.destroy();

    window.perfChartInstance = new Chart(ctxPerf, {
        type: 'line',
        data: {
            labels: chartData.labels || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'], // Use API labels
            datasets: [
                {
                    label: 'Resultados (Ações)',
                    data: chartData.dailyResults,
                    borderColor: '#3b82f6', // blue-500
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Investimento (R$)',
                    data: chartData.dailySpend,
                    borderColor: '#22c55e', // green-500
                    borderDash: [5, 5],
                    yAxisID: 'y1',
                    tension: 0.4,
                    pointStyle: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: isDark ? '#9ca3af' : '#4b5563' } }
            },
            scales: {
                x: { ticks: { color: isDark ? '#9ca3af' : '#4b5563' }, grid: { color: isDark ? '#374151' : '#e5e7eb' } },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { color: isDark ? '#9ca3af' : '#4b5563' },
                    grid: { color: isDark ? '#374151' : '#e5e7eb' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false }, // only want the grid lines for one axis to show up
                    ticks: { color: isDark ? '#9ca3af' : '#4b5563', callback: (val) => 'R$ ' + val }
                },
            }
        }
    });

    // 2. Platform Split Chart (Doughnut)
    const ctxPlat = document.getElementById('platformChart').getContext('2d');

    if (window.platChartInstance) window.platChartInstance.destroy();

    window.platChartInstance = new Chart(ctxPlat, {
        type: 'doughnut',
        data: {
            labels: ['Instagram', 'Facebook'],
            datasets: [{
                data: chartData.platformSplit,
                backgroundColor: ['#E1306C', '#1877F2'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: isDark ? '#9ca3af' : '#4b5563', padding: 20 } }
            },
            cutout: '70%'
        }
    });
}

// --- UTILS ---
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value);
}

async function exportTrafficReport(days) {
    const btn = document.getElementById('exportReportBtn');
    if (!btn) return;
    const originalText = btn.innerHTML;
    
    // Show spinner and disable button
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin text-red-500"></i> Gerando PDF...`;
    
    try {
        let overview, campaigns, dailyLabels, dailySpend, dailyResults;
        
        // 1. Fetch data based on config mode
        if (!activeConfig.accessToken || activeConfig.accessToken === "SEU_ACCESS_TOKEN_AQUI") {
            // Mock data mode
            console.log(`[Export] Gerando dados mockados para ${days} dias...`);
            const scaleFactor = days / 30;
            overview = {
                spend: 12450.00 * scaleFactor,
                impressions: Math.round(452000 * scaleFactor),
                clicks: Math.round(8540 * scaleFactor),
                cpr: 3.45,
                msgs: Math.round(125 * scaleFactor),
                likes: Math.round(669 * scaleFactor),
                costPerLike: (12450.00 * scaleFactor) / Math.round(669 * scaleFactor)
            };
            campaigns = [
                { name: "Kihap FLN - Reconhecimento e Marca", status: "active", msgs: Math.round(42 * scaleFactor), clicks: Math.round(1240 * scaleFactor), ctr: 1.85, cpc: 0.85, reach: Math.round(45000 * scaleFactor), impressions: Math.round(120000 * scaleFactor), visits: Math.round(580 * scaleFactor), spend: 1054.00 * scaleFactor, costPerResult: (1054.00 * scaleFactor) / Math.round(42 * scaleFactor) },
                { name: "Kihap Dourados - Mensagens WhatsApp", status: "active", msgs: Math.round(58 * scaleFactor), clicks: Math.round(850 * scaleFactor), ctr: 2.10, cpc: 1.20, reach: Math.round(28000 * scaleFactor), impressions: Math.round(95000 * scaleFactor), visits: Math.round(410 * scaleFactor), spend: 1020.00 * scaleFactor, costPerResult: (1020.00 * scaleFactor) / Math.round(58 * scaleFactor) },
                { name: "Matrículas Abertas - Adulto e Infantil", status: "active", msgs: Math.round(25 * scaleFactor), clicks: Math.round(410 * scaleFactor), ctr: 1.45, cpc: 1.60, reach: Math.round(18000 * scaleFactor), impressions: Math.round(55000 * scaleFactor), visits: Math.round(220 * scaleFactor), spend: 656.00 * scaleFactor, costPerResult: (656.00 * scaleFactor) / Math.round(25 * scaleFactor) },
                { name: "Campanha Institucional - Kihap 2026", status: "paused", msgs: 0, clicks: Math.round(3100 * scaleFactor), ctr: 0.95, cpc: 0.45, reach: Math.round(120000 * scaleFactor), impressions: Math.round(180000 * scaleFactor), visits: Math.round(1200 * scaleFactor), spend: 1395.00 * scaleFactor, costPerResult: 0 }
            ];
            
            // Mock daily data
            dailyLabels = [];
            dailySpend = [];
            dailyResults = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                dailyLabels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
                
                const spendBase = 400 * scaleFactor;
                const resultBase = 15 * scaleFactor;
                dailySpend.push(parseFloat((spendBase + (Math.random() - 0.5) * (100 * scaleFactor)).toFixed(2)));
                dailyResults.push(Math.round(resultBase + (Math.random() - 0.5) * (8 * scaleFactor)));
            }
        } else {
            // Real Meta Ads API Mode
            console.log(`[Export] Buscando dados da API do Meta Ads para os últimos ${days} dias...`);
            const { accessToken, adAccountId, apiVersion } = activeConfig;
            const baseUrl = `https://graph.facebook.com/${apiVersion}/act_${adAccountId}`;
            
            // Calculate date range parameters
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - days);
            const formatDate = (date) => date.toISOString().split('T')[0];
            const timeRange = JSON.stringify({ since: formatDate(start), until: formatDate(end) });
            const dateParams = `time_range=${timeRange}`;
            
            // Fetch Insights & Campaigns
            const chartFields = 'spend,actions,reach,clicks,impressions,date_start';
            const insightsUrl = `${baseUrl}/insights?level=account&${dateParams}&time_increment=1&fields=${chartFields}&access_token=${accessToken}`;
            
            const campaignsFields = 'name,status,insights{spend,reach,actions,clicks,cpc,ctr,frequency,impressions,inline_link_clicks}';
            const campaignsUrl = `${baseUrl}/campaigns?fields=${campaignsFields}&effective_status=["ACTIVE","PAUSED"]&limit=50&access_token=${accessToken}&${dateParams}`;
            
            const [insightsRes, campaignsRes] = await Promise.all([
                fetch(insightsUrl),
                fetch(campaignsUrl)
            ]);
            
            const insightsJson = await insightsRes.json();
            const campaignsJson = await campaignsRes.json();
            
            if (insightsJson.error) throw new Error(insightsJson.error.message);
            if (campaignsJson.error) throw new Error(campaignsJson.error.message);
            
            const dailyData = (insightsJson.data || []).reverse();
            dailyData.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
            
            dailyLabels = dailyData.map(d => formatDateLabel(d.date_start));
            dailySpend = dailyData.map(d => parseFloat(d.spend || 0));
            
            const msgActionTypes = [
                'onsite_conversion.messaging_conversation_started_7d',
                'messaging_conversation_started_7d',
                'onsite_conversion.messaging_conversation_started_28d',
                'contact_total',
                'leads'
            ];
            
            dailyResults = dailyData.map(d => countActions(d.actions));
            
            const totalSpend = dailyData.reduce((acc, d) => acc + parseFloat(d.spend || 0), 0);
            const totalClicks = dailyData.reduce((acc, d) => acc + parseInt(d.clicks || 0), 0);
            const totalImpressions = dailyData.reduce((acc, d) => acc + parseInt(d.impressions || 0), 0);
            const totalMsgs = dailyData.reduce((acc, d) => acc + getActionValue(d.actions || [], msgActionTypes), 0);
            const totalLikes = dailyData.reduce((acc, d) => acc + getActionValue(d.actions || [], ['like', 'follow']), 0);
            const avgCpr = totalMsgs > 0 ? (totalSpend / totalMsgs) : (totalClicks > 0 ? (totalSpend / totalClicks) : 0);
            
            overview = {
                spend: totalSpend,
                impressions: totalImpressions,
                clicks: totalClicks,
                cpr: avgCpr,
                msgs: totalMsgs,
                likes: totalLikes,
                costPerLike: totalLikes > 0 ? (totalSpend / totalLikes) : 0
            };
            
            campaigns = (campaignsJson.data || []).map(camp => {
                const inst = camp.insights?.data?.[0] || {};
                const spend = parseFloat(inst.spend || 0);
                const reach = parseInt(inst.reach || 0);
                const clicks = parseInt(inst.inline_link_clicks || inst.clicks || 0);
                const ctr = parseFloat(inst.ctr || 0);
                const cpc = parseFloat(inst.cpc || 0);
                const impressions = parseInt(inst.impressions || 0);
                const msgs = getActionValue(inst.actions, msgActionTypes);
                const visits = getActionValue(inst.actions, ['instagram_profile_visits']);
                const cpr = msgs > 0 ? (spend / msgs) : 0;
                
                return {
                    name: camp.name,
                    status: camp.status.toLowerCase() === 'active' ? 'active' : 'paused',
                    msgs: msgs,
                    clicks: clicks,
                    ctr: ctr,
                    cpc: cpc,
                    reach: reach,
                    impressions: impressions,
                    visits: visits,
                    spend: spend,
                    costPerResult: cpr
                };
            });
        }
        
        // 2. Fetch AI analysis from Gemini
        console.log(`[Export] Buscando análise estratégica da IA do Gemini para ${days} dias...`);
        const prompt = `
Como um especialista sênior em tráfego pago (Meta Ads) para a Kihap, analise estes dados consolidados das campanhas para os últimos ${days} dias:
- Investimento Total: R$ ${overview.spend.toFixed(2)}
- Cliques Totais: ${overview.clicks}
- Conversas Iniciadas (Leads): ${overview.msgs}
- Custo por Conversa Médio (CPR): R$ ${overview.cpr.toFixed(2)}
- Novos Seguidores de Anúncios: ${overview.likes}
- Campanhas Individuais: ${JSON.stringify(campaigns.map(c => ({ name: c.name, status: c.status, spend: c.spend, msgs: c.msgs, cpr: c.costPerResult })))}

Forneça uma análise de desempenho executiva de 2 parágrafos.
No primeiro parágrafo, destaque os pontos fortes e fracos gerais do período.
No segundo parágrafo, dê 3 recomendações táticas prioritárias e acionáveis para otimizar o orçamento e as conversões.
Não use formatação complexa além de **negrito** nas palavras-chave importantes.
`;

        const apiKey = activeConfig.geminiKey || '';
        if (!apiKey) {
            throw new Error("Chave da API do Gemini não configurada nas configurações do Meta.");
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                }
            })
        });
        
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        
        const aiAnalysis = json.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível obter a análise automatizada para este período.";
        
        // 3. Build HTML Report layout
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        
        let campaignsTableRows = "";
        campaigns.forEach(camp => {
            campaignsTableRows += `
                <tr>
                    <td class="p-2 border font-semibold ${camp.status === 'active' ? 'text-green-600' : 'text-gray-500'}">${camp.status === 'active' ? 'Ativa' : 'Pausada'}</td>
                    <td class="p-2 border font-bold">${camp.name}</td>
                    <td class="p-2 border font-bold">R$ ${formatNumber(camp.spend.toFixed(2))}</td>
                    <td class="p-2 border">${formatNumber(camp.clicks)}</td>
                    <td class="p-2 border">${camp.ctr.toFixed(2)}%</td>
                    <td class="p-2 border">R$ ${formatNumber(camp.cpc.toFixed(2))}</td>
                    <td class="p-2 border">${formatNumber(camp.reach)}</td>
                    <td class="p-2 border font-bold text-blue-600">${formatNumber(camp.msgs)}</td>
                    <td class="p-2 border font-bold">R$ ${formatNumber(camp.costPerResult.toFixed(2))}</td>
                </tr>
            `;
        });
        
        const reportHtml = `
            <div class="p-8 max-w-4xl mx-auto bg-white text-black font-sans">
                <!-- Header -->
                <div class="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-center">
                    <div>
                        <h1 class="text-2xl font-extrabold tracking-tight uppercase flex items-center gap-2">
                            <span class="text-orange-500">Kihap</span> Martial Arts
                        </h1>
                        <p class="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Relatório de Performance - Meta Ads</p>
                    </div>
                    <div class="text-right text-[11px] text-gray-500">
                        <p><strong>Período:</strong> Últimos ${days} dias (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})</p>
                        <p><strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
                    </div>
                </div>

                <!-- Summary metrics -->
                <div class="grid grid-cols-5 gap-4 mb-8">
                    <div class="border border-gray-200 p-3 rounded-lg bg-gray-50 text-center print-card">
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Investimento</p>
                        <p class="text-base font-bold mt-1 text-gray-900">R$ ${formatNumber(overview.spend.toFixed(2))}</p>
                    </div>
                    <div class="border border-gray-200 p-3 rounded-lg bg-gray-50 text-center print-card">
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Impressões</p>
                        <p class="text-base font-bold mt-1 text-gray-900">${formatNumber(overview.impressions)}</p>
                    </div>
                    <div class="border border-gray-200 p-3 rounded-lg bg-gray-50 text-center print-card">
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Cliques</p>
                        <p class="text-base font-bold mt-1 text-gray-900">${formatNumber(overview.clicks)}</p>
                    </div>
                    <div class="border border-gray-200 p-3 rounded-lg bg-gray-50 text-center print-card">
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Conversas</p>
                        <p class="text-base font-bold mt-1 text-gray-900">${formatNumber(overview.msgs)}</p>
                    </div>
                    <div class="border border-gray-200 p-3 rounded-lg bg-gray-50 text-center print-card">
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">CPR Médio</p>
                        <p class="text-base font-bold mt-1 text-gray-900">R$ ${formatNumber(overview.cpr.toFixed(2))}</p>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="grid grid-cols-2 gap-6 mb-8 print-chart-container">
                    <div class="border border-gray-200 p-4 rounded-lg bg-white">
                        <h3 class="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-wider">Evolução de Tráfego</h3>
                        <div class="h-44 relative">
                            <canvas id="printPerfChart"></canvas>
                        </div>
                    </div>
                    <div class="border border-gray-200 p-4 rounded-lg bg-white">
                        <h3 class="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-wider">Divisão de Canais</h3>
                        <div class="h-44 relative flex justify-center">
                            <canvas id="printPlatChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Campaigns list -->
                <div class="mb-8 print-table-container">
                    <h3 class="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-wider">Métricas por Campanha</h3>
                    <table class="print-table text-[10px] text-left w-full border border-gray-200">
                        <thead class="bg-gray-100 text-gray-700 font-bold uppercase text-[8px] tracking-wider">
                            <tr>
                                <th class="p-2 border">Status</th>
                                <th class="p-2 border">Campanha</th>
                                <th class="p-2 border">Investido</th>
                                <th class="p-2 border">Cliques</th>
                                <th class="p-2 border">CTR</th>
                                <th class="p-2 border">CPC</th>
                                <th class="p-2 border">Alcance</th>
                                <th class="p-2 border">Mensagens</th>
                                <th class="p-2 border">CPR</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${campaignsTableRows}
                        </tbody>
                    </table>
                </div>

                <!-- AI Insights Section -->
                <div class="border border-gray-200 p-4 rounded-lg bg-gray-50 print-card">
                    <h3 class="text-[10px] font-bold text-gray-800 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fas fa-magic text-purple-600"></i> Análise Estratégica AI (Gemini)
                    </h3>
                    <div class="text-[11px] leading-relaxed text-gray-700 space-y-2">
                        ${formatMessageText(aiAnalysis)}
                    </div>
                </div>
            </div>
        `;
        
        const printContainer = document.getElementById('printableReport');
        printContainer.innerHTML = reportHtml;
        
        // 4. Render Chart.js in the print container synchronously
        const ctxPerf = document.getElementById('printPerfChart').getContext('2d');
        new Chart(ctxPerf, {
            type: 'line',
            data: {
                labels: dailyLabels,
                datasets: [
                    {
                        label: 'Resultados',
                        data: dailyResults,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Investido',
                        data: dailySpend,
                        borderColor: '#22c55e',
                        borderDash: [4, 4],
                        tension: 0.3,
                        pointStyle: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { font: { size: 8 }, maxRotation: 0 } },
                    y: { ticks: { font: { size: 8 } } }
                }
            }
        });

        const ctxPlat = document.getElementById('printPlatChart').getContext('2d');
        new Chart(ctxPlat, {
            type: 'doughnut',
            data: {
                labels: ['Instagram', 'Facebook'],
                datasets: [{
                    data: [Math.round(overview.spend * 0.58), Math.round(overview.spend * 0.42)],
                    backgroundColor: ['#E1306C', '#1877F2'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { position: 'right', labels: { font: { size: 8 } } } }
            }
        });
        
        // 5. Open Native Print Dialog
        setTimeout(() => {
            window.print();
            // Clear content after dialog closes
            printContainer.innerHTML = '';
        }, 300);
        
    } catch (e) {
        console.error("Erro ao exportar PDF:", e);
        alert("Erro ao gerar relatório em PDF do Meta Ads: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

