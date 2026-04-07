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

    // Custom Dates Listener (Mock functionality for now)
    const periodSelect = document.getElementById('periodSelect');
    const customControls = document.getElementById('customDateControls');

    periodSelect?.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customControls.classList.remove('hidden');
            customControls.style.display = 'flex';
        } else {
            customControls.classList.add('hidden');
            customControls.style.display = 'none';
            initDashboard();
        }
    });

    document.getElementById('applyCustomDate')?.addEventListener('click', () => {
        initDashboard();
    });

    // AI Listener
    document.getElementById('analyzeBtn')?.addEventListener('click', generateAIAnalysis);
});

// Global state to hold data for AI
let currentDashboardData = null;

import { functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

async function initDashboard() {
    const periodSelect = document.getElementById('periodSelect');
    const dateStart = document.getElementById('dateStart');
    const dateEnd = document.getElementById('dateEnd');

    const requestData = {
        period: periodSelect.value,
        dateStart: dateStart?.value || null,
        dateEnd: dateEnd?.value || null
    };

    console.log("Fetching Google Ads Data...", requestData);

    try {
        const getGoogleAdsData = httpsCallable(functions, 'getGoogleAdsData');
        const result = await getGoogleAdsData(requestData);
        const data = result.data;

        currentDashboardData = data;

        updateOverviewCards(data.overview);
        renderCharts(data.charts);
        renderCampaignsTable(data.campaigns);

        const warning = document.getElementById('configWarning');
        if (warning) warning.remove();

    } catch (error) {
        console.error("Erro ao carregar Google Ads:", error);

        // Soft Fallback for known "Pending Approval" errors
        const isPermissionError = error.message.includes("403") || error.message.includes("PERMISSION_DENIED") || error.message.includes("DEVELOPER_TOKEN_NOT_APPROVED");

        let errorMsg = "Erro na API: " + error.message;
        let alertClass = "bg-red-600/20 border-red-600 text-red-500";
        let icon = "fa-exclamation-circle";

        if (isPermissionError) {
            errorMsg = "Aguardando Aprovação Google (Modo Demonstração Ativo). Dados reais aparecerão após o Basic Access.";
            alertClass = "bg-blue-600/20 border-blue-600 text-blue-400";
            icon = "fa-info-circle";
        }

        // Show Alert
        if (!document.getElementById('apiError')) {
            const warning = document.createElement('div');
            warning.id = 'apiError';
            warning.className = `${alertClass} border p-3 rounded mb-4 text-sm flex items-center gap-2`;
            warning.innerHTML = `<i class="fas ${icon}"></i> ${errorMsg}`;
            document.querySelector('.container').prepend(warning);
        }

        // Load Mock Data so the User can take a Screenshot
        console.warn("Usando Mock Data para Visualização.");
        const data = getMockData();
        currentDashboardData = data;
        updateOverviewCards(data.overview);
        renderCharts(data.charts);
        renderCampaignsTable(data.campaigns);
    }
}

// --- MOCK DATA GENERATOR ---
function getMockData() {
    return {
        overview: {
            spend: 4520.50,
            impressions: 125000,
            clicks: 3200,
            ctr: 2.56,
            conversions: 85,
            cpa: 53.18, // Cost per Acquisition
            impressionShare: 65, // %
            qualityScore: 7.8 // Avg
        },
        charts: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            dailySpend: [500, 480, 520, 600, 750, 800, 870],
            dailyConversions: [10, 8, 12, 15, 18, 12, 10], // Conversions line
            deviceSplit: [65, 30, 5] // Mobile, Desktop, Tablet
        },
        campaigns: [
            { id: 1, name: 'Search - Institucional', type: 'Search', status: 'active', conversions: 45, clicks: 1200, ctr: 5.2, cpc: 1.50, cpa: 40.00, spend: 1800.00 },
            { id: 2, name: 'Search - Aulas Infantis', type: 'Search', status: 'active', conversions: 25, clicks: 900, ctr: 3.1, cpc: 2.10, cpa: 75.60, spend: 1890.00 },
            { id: 3, name: 'Display - Remarketing', type: 'Display', status: 'active', conversions: 10, clicks: 800, ctr: 0.8, cpc: 0.50, cpa: 40.00, spend: 400.00 },
            { id: 4, name: 'Youtube - Awareness', type: 'Video', status: 'paused', conversions: 5, clicks: 300, ctr: 0.4, cpc: 0.30, cpa: 86.10, spend: 430.50 }
        ]
    };
}

// --- GEMINI AI INTEGRATION (Reused logic) ---
async function generateAIAnalysis() {
    if (!currentDashboardData) return;

    const ui = {
        loading: document.getElementById('aiLoading'),
        content: document.getElementById('aiContent'),
        placeholder: document.getElementById('aiPlaceholder'),
        btn: document.getElementById('analyzeBtn')
    };

    ui.loading.classList.remove('hidden');
    ui.content.classList.add('hidden');
    ui.placeholder.classList.add('hidden');
    ui.btn.disabled = true;

    try {
        const summary = {
            spend: currentDashboardData.overview.spend,
            conversions: currentDashboardData.overview.conversions,
            cpa: currentDashboardData.overview.cpa,
            ctr: currentDashboardData.overview.ctr,
            topCampaigns: currentDashboardData.campaigns
                .filter(c => c.status === 'active')
                .sort((a, b) => b.spend - a.spend)
                .slice(0, 3)
                .map(c => `${c.name} (Spend: R$${c.spend}, CPA: R$${c.cpa})`)
        };

        const prompt = `
            Atue como um especialista em Google Ads. Analise estes dados da conta de Artes Marciais (Kihap):
            - Gasto Total (Período): R$ ${summary.spend.toFixed(2)}
            - Conversões: ${summary.conversions}
            - CPA Médio: R$ ${summary.cpa.toFixed(2)}
            - CTR Global: ${summary.ctr}%
            - Top Campanhas Ativas: ${JSON.stringify(summary.topCampaigns)}
            
            Forneça 3 insights estratégicos focados em otimização de busca e display.
            Use formatação HTML simples (<br>, <strong>). Seja direto e profissional.
        `;

        // Using same key from social config
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${socialConfig.geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const json = await response.json();

        if (json.error) throw new Error("API Error: " + json.error.message);
        if (!json.candidates || !json.candidates.length) throw new Error("A IA não retornou resposta válida.");

        const aiText = json.candidates[0].content.parts[0].text;

        ui.content.innerHTML = aiText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        ui.content.classList.remove('hidden');

    } catch (e) {
        console.error("AI Error:", e);
        ui.content.innerHTML = `<span class="text-red-400">Erro ao analisar dados: ${e.message}</span>`;
        ui.content.classList.remove('hidden');
    } finally {
        ui.loading.classList.add('hidden');
        ui.btn.disabled = false;
    }
}


// --- RENDER FUNCTIONS ---

function updateOverviewCards(overview) {
    document.getElementById('totalSpend').textContent = formatCurrency(overview.spend);
    document.getElementById('totalImpressions').textContent = formatNumber(overview.impressions);
    document.getElementById('totalClicks').textContent = formatNumber(overview.clicks);
    document.getElementById('avgCtr').textContent = overview.ctr.toFixed(2) + '%';

    document.getElementById('totalConversions').textContent = overview.conversions;
    document.getElementById('avgCpa').textContent = formatCurrency(overview.cpa);
    document.getElementById('impressionShare').textContent = overview.impressionShare + '%';
    document.getElementById('qualityScore').textContent = overview.qualityScore + '/10';
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

        // Define color for type
        let typeColor = 'text-gray-400';
        if (camp.type === 'Search') typeColor = 'text-blue-400';
        if (camp.type === 'Display') typeColor = 'text-orange-400';
        if (camp.type === 'Video') typeColor = 'text-red-400';

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">${statusBadge}</td>
            <td class="px-4 py-3 font-medium text-white truncate max-w-xs" title="${camp.name}">${camp.name}</td>
            <td class="px-4 py-3 ${typeColor} font-semibold text-xs uppercase">${camp.type}</td>
            <td class="px-4 py-3 font-bold text-green-400">${camp.conversions}</td>
            <td class="px-4 py-3">${formatNumber(camp.clicks)}</td>
            <td class="px-4 py-3 text-gray-400">${camp.ctr.toFixed(2)}%</td>
            <td class="px-4 py-3 text-gray-400">${formatCurrency(camp.cpc)}</td>
            <td class="px-4 py-3 text-gray-400">${formatCurrency(camp.cpa)}</td>
            <td class="px-4 py-3 text-white font-semibold">${formatCurrency(camp.spend)}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderCharts(chartData) {
    // 1. Performance Chart (Line/Bar combo)
    const ctxPerf = document.getElementById('performanceChart').getContext('2d');
    if (window.perfChartInstance) window.perfChartInstance.destroy();

    window.perfChartInstance = new Chart(ctxPerf, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Conversões',
                    data: chartData.dailyConversions,
                    borderColor: '#ef4444', // red-500
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } },
            scales: {
                x: { ticks: { color: '#6b7280' }, grid: { color: '#374151' } },
                y: { type: 'linear', display: true, position: 'left', ticks: { color: '#6b7280' }, grid: { color: '#374151' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#6b7280', callback: (val) => 'R$ ' + val } }
            }
        }
    });

    // 2. Device Split Chart (Doughnut) - Replaces Platform Split
    const ctxDev = document.getElementById('deviceChart').getContext('2d');
    if (window.deviceChartInstance) window.deviceChartInstance.destroy();

    window.deviceChartInstance = new Chart(ctxDev, {
        type: 'doughnut',
        data: {
            labels: ['Celular', 'Computador', 'Tablet'],
            datasets: [{
                data: chartData.deviceSplit,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 20 } } },
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
