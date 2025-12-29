import { loadComponents, setupUIListeners } from './common-ui.js';
import { socialConfig } from './social-config.js';

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

    document.getElementById('periodSelect')?.addEventListener('change', (e) => {
        console.log(`Período alterado para: ${e.target.value}`);
        initDashboard();
    });
});

async function initDashboard() {
    // Verificar se temos credenciais configuradas
    if (!socialConfig.accessToken || socialConfig.accessToken === "SEU_ACCESS_TOKEN_AQUI") {
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
            warning.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Modo Demonstração. Configure <code>intranet/social-config.js</code> para ver dados reais.';
            document.querySelector('#main-content > div').prepend(warning);
        }
        return;
    }

    try {
        const data = await fetchMetaAdsData();
        updateOverviewCards(data.overview);
        renderCharts(data.charts);
        renderCampaignsTable(data.campaigns);

        const warning = document.getElementById('configWarning');
        if (warning) warning.remove();

    } catch (error) {
        console.error("Erro ao carregar dados do Meta:", error);
        alert("Falha ao carregar dados do Facebook Ads. Verifique o console ou suas credenciais.");
    }
}

// --- META API INTEGRATION ---
async function fetchMetaAdsData() {
    const { accessToken, adAccountId, apiVersion } = socialConfig;
    const baseUrl = `https://graph.facebook.com/${apiVersion}/act_${adAccountId}`;

    // 1. Fetch Insights (Overview & Charts)
    // Agrupado por dia para o gráfico, e somado para os cards
    const datePreset = getDatePreset();

    // URL para métricas gerais
    const insightsFields = 'spend,impressions,clicks,cpc,cpm,cpp,ctr,actions,reach';
    const insightsUrl = `${baseUrl}/insights?level=account&date_preset=${datePreset}&fields=${insightsFields}&access_token=${accessToken}`;

    // URL para gráfico (breakdown por dia) - Se necessário, faremos uma segunda chamada ou processaremos os dados
    // Para simplificar, vamos pegar o total primeiro:
    const overviewResponse = await fetch(insightsUrl);
    const overviewJson = await overviewResponse.json();

    if (overviewJson.error) throw new Error(overviewJson.error.message);

    const accountData = overviewJson.data[0] || {};

    // 2. Fetch Chart Data (Daily Breakdown)
    const chartFields = 'spend,actions,reach,date_start';
    const chartUrl = `${baseUrl}/insights?level=account&date_preset=${datePreset}&time_increment=1&fields=${chartFields}&access_token=${accessToken}`;

    // Arrays para o gráfico
    let dailyLabels = [];
    let dailySpend = [];
    let dailyResults = [];

    try {
        const chartRes = await fetch(chartUrl);
        const chartJson = await chartRes.json();
        const dailyData = (chartJson.data || []).reverse(); // API retorna do mais recente pro antigo as vezes, ou o contrário. Insights costuma ser cronológico. Vamos garantir.

        // Sort by date just in case
        dailyData.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

        dailyLabels = dailyData.map(d => formatDateLabel(d.date_start));
        dailySpend = dailyData.map(d => parseFloat(d.spend || 0));
        dailyResults = dailyData.map(d => countActions(d.actions)); // Total actions as proxy for results
    } catch (err) {
        console.error("Erro ao carregar gráfico:", err);
    }

    // Fetch Campanhas (Active & Paused)
    // Fix: Re-adding insights with simple syntax first.
    // Note: 'spend' is inside insights, not root.
    const campaignsFields = 'name,status,insights{spend,reach,actions,clicks,cpc,ctr,frequency,impressions,inline_link_clicks}';
    const campaignsUrl = `${baseUrl}/campaigns?fields=${campaignsFields}&effective_status=["ACTIVE","PAUSED"]&limit=50&access_token=${accessToken}&date_preset=${datePreset}`;

    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsJson = await campaignsResponse.json();

    console.log("--- DEBUG META API ---");
    console.log("Account Overview Full:", overviewJson);
    console.log("Campaigns Raw:", campaignsJson);

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

    // Processar Campanhas
    const campaigns = (campaignsJson.data || []).map(camp => {
        const insight = camp.insights?.data?.[0] || {};
        const spend = parseFloat(insight.spend || 0);
        const reach = parseInt(insight.reach || 0);
        const clicks = parseInt(insight.inline_link_clicks || insight.clicks || 0); // Preferir cliques no link
        const ctr = parseFloat(insight.ctr || 0);
        const cpc = parseFloat(insight.cpc || 0);
        // const actions = countActions(insight.actions); // Generic logic replaced by specific columns

        // Parse Specific Actions - Expanding search terms
        // 'onsite_conversion.messaging_conversation_started_7d' is standard, but sometimes it's under other keys depending on attribution window
        const msgs = getActionValue(insight.actions, [
            'onsite_conversion.messaging_conversation_started_7d',
            'messaging_conversation_started_7d',
            'onsite_conversion.messaging_conversation_started_28d',
            'contact_total',
            'leads' // sometimes messaging campaigns track as leads
        ]);

        const visits = getActionValue(insight.actions, ['instagram_profile_visits']);

        // Custo por Resultado (Total Gasto / Mensagens) -- Priorizando Mensagens como "Resultado" principal conforme pedido
        const finalResult = msgs > 0 ? msgs : (clicks > 0 ? clicks : 0); // Fallback to clicks if no msgs
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

    // Calcular Totais do Overview
    const totalSpend = parseFloat(accountData.spend || 0);
    const totalClicks = parseInt(accountData.clicks || 0);

    // Sumarizing total messages from campaigns instead of account overview to be consistent
    const totalMsgs = campaigns.reduce((acc, curr) => acc + curr.msgs, 0);
    const avgCpr = totalMsgs > 0 ? (totalSpend / totalMsgs) : 0;

    return {
        overview: {
            spend: totalSpend,
            impressions: parseInt(accountData.impressions || 0),
            clicks: totalClicks,
            cpr: avgCpr,
            // Hardcoded list for now since we can't easily discover them without IDs
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

    // Update Folowers (List)
    const igEl = document.getElementById('igFollowers');
    // const igUserEl = document.getElementById('igUsername'); // Removed single user el usage

    if (igEl && overview.igAccounts) {
        igEl.innerHTML = '';
        igEl.className = 'text-sm text-gray-300 space-y-1 mt-2'; // Reset style

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
        row.className = 'hover:bg-gray-700/50 transition-colors border-b border-gray-800 last:border-0';

        let statusBadge = '';
        if (camp.status === 'active') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">Ativa</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-gray-600/50 text-gray-400 text-xs font-semibold">Pausada</span>`;
        }

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">${statusBadge}</td>
            <td class="px-4 py-3 font-medium text-white truncate max-w-xs" title="${camp.name}">${camp.name}</td>
            <td class="px-4 py-3 font-bold text-blue-400">${formatNumber(camp.msgs)}</td>
            <td class="px-4 py-3">${formatNumber(camp.clicks)}</td>
            <td class="px-4 py-3 text-gray-400">${camp.ctr.toFixed(2)}%</td>
            <td class="px-4 py-3 text-gray-400">${formatCurrency(camp.cpc)}</td>
            <td class="px-4 py-3">${formatNumber(camp.reach)}</td>
            <td class="px-4 py-3">${formatNumber(camp.visits)}</td>
            <td class="px-4 py-3 text-white font-semibold">${formatCurrency(camp.spend)}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderCharts(chartData) {
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
                legend: { position: 'bottom', labels: { color: '#9ca3af' } }
            },
            scales: {
                x: { ticks: { color: '#6b7280' }, grid: { color: '#374151' } },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { color: '#6b7280' },
                    grid: { color: '#374151' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false }, // only want the grid lines for one axis to show up
                    ticks: { color: '#6b7280', callback: (val) => 'R$ ' + val }
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
                legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 20 } }
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
