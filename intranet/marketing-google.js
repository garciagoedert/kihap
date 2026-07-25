import { loadComponents, setupUIListeners } from './common-ui.js';
import { socialConfig } from './social-config.js';
import { functions, db } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global state
let currentDashboardData = null;
let rawCampaignsData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carregar componentes padrão (sidebar, header)
    await loadComponents(() => {
        setupUIListeners();
    });

    // 2. Inicializar Dashboard
    await initDashboard();

    // 3. Listeners dos Filtros e Botões
    setupEventListeners();
});

function setupEventListeners() {
    // Refresh Button
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        const btn = document.getElementById('refreshBtn');
        const icon = btn.querySelector('i');
        icon.classList.add('fa-spin');

        initDashboard().then(() => {
            setTimeout(() => icon.classList.remove('fa-spin'), 500);
        });
    });

    // Period Select Listener
    const periodSelect = document.getElementById('periodSelect');
    const customControls = document.getElementById('customDateControls');

    periodSelect?.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customControls.classList.remove('hidden');
            customControls.classList.add('flex');
        } else {
            customControls.classList.add('hidden');
            customControls.classList.remove('flex');
            initDashboard();
        }
    });

    document.getElementById('applyCustomDate')?.addEventListener('click', () => {
        initDashboard();
    });

    // Gemini AI Listener
    document.getElementById('analyzeBtn')?.addEventListener('click', generateAIAnalysis);

    // Export PDF Listener
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportToPDF);

    // Campaign Search & Filter
    document.getElementById('searchCampaignInput')?.addEventListener('input', applyCampaignFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyCampaignFilters);

    // Config Modal Listeners
    document.getElementById('openConfigBtn')?.addEventListener('click', openGoogleConfigModal);
    document.getElementById('cancel-google-cfg-btn')?.addEventListener('click', closeGoogleConfigModal);
    document.getElementById('google-config-form')?.addEventListener('submit', saveGoogleConfig);
}

async function initDashboard() {
    const periodSelect = document.getElementById('periodSelect');
    const dateStart = document.getElementById('dateStart');
    const dateEnd = document.getElementById('dateEnd');

    let savedLocalConfig = null;
    try {
        const cached = localStorage.getItem('google_ads_config');
        if (cached) savedLocalConfig = JSON.parse(cached);
    } catch (e) {}

    const requestData = {
        period: periodSelect ? periodSelect.value : 'last30',
        dateStart: dateStart?.value || null,
        dateEnd: dateEnd?.value || null,
        googleConfig: savedLocalConfig
    };

    console.log("Fetching Google Ads Data...", requestData);

    const alertContainer = document.getElementById('apiAlertContainer');
    if (alertContainer) alertContainer.innerHTML = '';

    try {
        const getGoogleAdsData = httpsCallable(functions, 'getGoogleAdsData');
        const result = await getGoogleAdsData(requestData);
        const data = result.data;

        currentDashboardData = data;
        rawCampaignsData = data.campaigns || [];

        showAlert("Conectado à Google Ads API (Dados Reais em Tempo Real)", "success");

        updateOverviewCards(data.overview);
        renderCharts(data.charts);
        applyCampaignFilters();

    } catch (error) {
        console.warn("Retorno da Cloud Function Google Ads:", error);

        const errorMsgStr = error.message || String(error);
        const isCredentialsMissing = errorMsgStr.includes("GOOGLE_CREDENTIALS_MISSING") || errorMsgStr.includes("não configuradas");
        const isPermissionError = errorMsgStr.includes("403") || errorMsgStr.includes("PERMISSION_DENIED") || errorMsgStr.includes("DEVELOPER_TOKEN_NOT_APPROVED") || errorMsgStr.includes("Pending Approval") || errorMsgStr.includes("Google Ads Query Failed");

        if (isCredentialsMissing) {
            showAlert("Credenciais do Google Ads não configuradas. Exibindo dados de demonstração. Clique em 'Conectar Google' para vincular sua conta.", "info");
        } else if (isPermissionError) {
            showAlert("Aguardando Aprovação da Google Ads API (Modo Demonstração Ativo). Os dados reais carregarão automaticamente após a liberação do Basic Access.", "info");
        } else {
            showAlert(`Erro na API Google Ads: ${errorMsgStr}. Exibindo dados de demonstração para análise de layout.`, "warning");
        }

        // Carregar Mock Data para visualização perfeita
        const data = getMockData();
        currentDashboardData = data;
        rawCampaignsData = data.campaigns || [];

        updateOverviewCards(data.overview);
        renderCharts(data.charts);
        applyCampaignFilters();
    }
}

function showAlert(message, type = "info") {
    const alertContainer = document.getElementById('apiAlertContainer');
    if (!alertContainer) return;

    let bgBorderText = "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400";
    let icon = "fa-info-circle";

    if (type === "success") {
        bgBorderText = "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
        icon = "fa-check-circle";
    } else if (type === "warning") {
        bgBorderText = "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
        icon = "fa-exclamation-triangle";
    }

    alertContainer.innerHTML = `
        <div class="border rounded-2xl p-4 text-xs md:text-sm font-medium flex items-center justify-between gap-3 shadow-sm ${bgBorderText}">
            <div class="flex items-center gap-2.5">
                <i class="fas ${icon} text-base"></i>
                <span>${message}</span>
            </div>
            <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

// --- MOCK DATA GENERATOR ---
function getMockData() {
    return {
        isRealData: false,
        overview: {
            spend: 4520.50,
            impressions: 125000,
            clicks: 3200,
            ctr: 2.56,
            conversions: 85,
            cpa: 53.18,
            impressionShare: 65,
            qualityScore: 7.8
        },
        charts: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            dailySpend: [500, 480, 520, 600, 750, 800, 870],
            dailyConversions: [10, 8, 12, 15, 18, 12, 10],
            deviceSplit: [65, 30, 5]
        },
        campaigns: [
            { id: 1, name: 'Search - Institucional Kihap', type: 'Search', status: 'active', conversions: 45, clicks: 1200, ctr: 5.2, cpc: 1.50, cpa: 40.00, spend: 1800.00 },
            { id: 2, name: 'Search - Aulas Infantis Taekwondo', type: 'Search', status: 'active', conversions: 25, clicks: 900, ctr: 3.1, cpc: 2.10, cpa: 75.60, spend: 1890.00 },
            { id: 3, name: 'Display - Remarketing Alunos', type: 'Display', status: 'active', conversions: 10, clicks: 800, ctr: 0.8, cpc: 0.50, cpa: 40.00, spend: 400.00 },
            { id: 4, name: 'Youtube - Institucional Brand Video', type: 'Youtube', status: 'paused', conversions: 5, clicks: 300, ctr: 0.4, cpc: 0.30, cpa: 86.10, spend: 430.50 }
        ]
    };
}

// --- RENDER OVERVIEW CARDS ---
function updateOverviewCards(overview) {
    if (!overview) return;

    document.getElementById('totalSpend').textContent = formatCurrency(overview.spend);
    document.getElementById('totalImpressions').textContent = formatNumber(overview.impressions);
    document.getElementById('totalClicks').textContent = formatNumber(overview.clicks);
    document.getElementById('avgCtr').textContent = overview.ctr.toFixed(2) + '%';

    document.getElementById('totalConversions').textContent = formatNumber(overview.conversions);
    document.getElementById('avgCpa').textContent = formatCurrency(overview.cpa);
    document.getElementById('impressionShare').textContent = overview.impressionShare + '%';
    document.getElementById('qualityScore').textContent = overview.qualityScore + '/10';
}

// --- CAMPAIGNS FILTER & RENDER ---
function applyCampaignFilters() {
    if (!rawCampaignsData) return;

    const query = (document.getElementById('searchCampaignInput')?.value || '').toLowerCase().trim();
    const status = document.getElementById('statusFilter')?.value || 'all';

    const filtered = rawCampaignsData.filter(camp => {
        const matchesQuery = camp.name.toLowerCase().includes(query) || camp.type.toLowerCase().includes(query);
        const matchesStatus = status === 'all' || camp.status === status;
        return matchesQuery && matchesStatus;
    });

    renderCampaignsTable(filtered);
}

function renderCampaignsTable(campaigns) {
    const tbody = document.getElementById('campaignsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!campaigns || campaigns.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-4 py-8 text-center text-gray-400">
                    Nenhuma campanha encontrada para os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    campaigns.forEach(camp => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800/60 transition-colors';

        let statusBadge = '';
        if (camp.status === 'active') {
            statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">Ativa</span>`;
        } else {
            statusBadge = `<span class="px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-500 dark:text-gray-400 text-[11px] font-bold">Pausada</span>`;
        }

        let typeBadgeColor = 'text-gray-500 bg-gray-500/10';
        if (camp.type === 'Search') typeBadgeColor = 'text-blue-600 dark:text-blue-400 bg-blue-500/10';
        if (camp.type === 'Display') typeBadgeColor = 'text-amber-600 dark:text-amber-400 bg-amber-500/10';
        if (camp.type === 'Youtube' || camp.type === 'Video') typeBadgeColor = 'text-rose-600 dark:text-rose-400 bg-rose-500/10';
        if (camp.type === 'PMax') typeBadgeColor = 'text-purple-600 dark:text-purple-400 bg-purple-500/10';

        row.innerHTML = `
            <td class="px-4 py-3.5 whitespace-nowrap">${statusBadge}</td>
            <td class="px-4 py-3.5 font-bold text-gray-900 dark:text-white truncate max-w-xs" title="${camp.name}">${camp.name}</td>
            <td class="px-4 py-3.5"><span class="px-2 py-0.5 rounded ${typeBadgeColor} font-bold text-[10px] uppercase">${camp.type}</span></td>
            <td class="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">${formatNumber(camp.conversions)}</td>
            <td class="px-4 py-3.5 font-medium">${formatNumber(camp.clicks)}</td>
            <td class="px-4 py-3.5 text-gray-500 dark:text-gray-400">${camp.ctr.toFixed(2)}%</td>
            <td class="px-4 py-3.5 text-gray-500 dark:text-gray-400">${formatCurrency(camp.cpc)}</td>
            <td class="px-4 py-3.5 text-gray-500 dark:text-gray-400">${formatCurrency(camp.cpa)}</td>
            <td class="px-4 py-3.5 font-extrabold text-gray-900 dark:text-white">${formatCurrency(camp.spend)}</td>
        `;
        tbody.appendChild(row);
    });
}

// --- CHARTS RENDERING ---
function renderCharts(chartData) {
    if (!chartData) return;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    // 1. Performance Chart
    const ctxPerf = document.getElementById('performanceChart')?.getContext('2d');
    if (ctxPerf) {
        if (window.perfChartInstance) window.perfChartInstance.destroy();

        window.perfChartInstance = new Chart(ctxPerf, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Conversões',
                        data: chartData.dailyConversions,
                        borderColor: '#f43f5e',
                        backgroundColor: 'rgba(244, 63, 94, 0.12)',
                        yAxisID: 'y',
                        tension: 0.35,
                        fill: true
                    },
                    {
                        label: 'Investimento (R$)',
                        data: chartData.dailySpend,
                        borderColor: '#10b981',
                        borderDash: [4, 4],
                        yAxisID: 'y1',
                        tension: 0.35,
                        pointStyle: 'circle'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 11 } } } },
                scales: {
                    x: { ticks: { color: textColor, font: { family: 'Inter', size: 10 } }, grid: { color: gridColor } },
                    y: { type: 'linear', display: true, position: 'left', ticks: { color: textColor, font: { family: 'Inter', size: 10 } }, grid: { color: gridColor } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: textColor, font: { family: 'Inter', size: 10 }, callback: (val) => 'R$ ' + val } }
                }
            }
        });
    }

    // 2. Device Split Chart
    const ctxDev = document.getElementById('deviceChart')?.getContext('2d');
    if (ctxDev) {
        if (window.deviceChartInstance) window.deviceChartInstance.destroy();

        window.deviceChartInstance = new Chart(ctxDev, {
            type: 'doughnut',
            data: {
                labels: ['Celular', 'Computador', 'Tablet'],
                datasets: [{
                    data: chartData.deviceSplit,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 16, font: { family: 'Inter', size: 11 } } } },
                cutout: '72%'
            }
        });
    }
}

// --- GEMINI AI INTEGRATION ---
async function generateAIAnalysis() {
    if (!currentDashboardData) return;

    const ui = {
        loading: document.getElementById('aiLoading'),
        content: document.getElementById('aiContent'),
        placeholder: document.getElementById('aiPlaceholder'),
        btn: document.getElementById('analyzeBtn')
    };

    ui.loading?.classList.remove('hidden');
    ui.content?.classList.add('hidden');
    ui.placeholder?.classList.add('hidden');
    if (ui.btn) ui.btn.disabled = true;

    try {
        const summary = {
            spend: currentDashboardData.overview.spend,
            conversions: currentDashboardData.overview.conversions,
            cpa: currentDashboardData.overview.cpa,
            ctr: currentDashboardData.overview.ctr,
            topCampaigns: (currentDashboardData.campaigns || [])
                .filter(c => c.status === 'active')
                .sort((a, b) => b.spend - a.spend)
                .slice(0, 3)
                .map(c => `${c.name} (Gasto: R$${c.spend.toFixed(2)}, CPA: R$${c.cpa.toFixed(2)})`)
        };

        const prompt = `
            Atue como um gestor sênior de tráfego pago especialista em Google Ads para academias de artes marciais (Kihap).
            Analise os dados atuais de performance da conta:
            - Investimento Total: R$ ${summary.spend.toFixed(2)}
            - Conversões (Matrículas/Leads): ${summary.conversions}
            - CPA Médio: R$ ${summary.cpa.toFixed(2)}
            - CTR Médio: ${summary.ctr.toFixed(2)}%
            - Principais Campanhas: ${JSON.stringify(summary.topCampaigns)}
            
            Forneça 3 recomendações acionáveis e diretas para otimização de taxa de conversão (CRO), lances de palavras-chave no Search e remarketing no Display/Youtube.
            Use formatação HTML simples com <strong> e <br> para destacar tópicos e números. Seja profissional e encorajador.
        `;

        const apiKey = socialConfig.geminiKey;
        if (!apiKey) throw new Error("Chave do Gemini AI não configurada.");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Erro na API do Gemini.");
        if (!json.candidates || !json.candidates.length) throw new Error("Sem resposta da IA.");

        const aiText = json.candidates[0].content.parts[0].text;

        if (ui.content) {
            ui.content.innerHTML = aiText
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            ui.content.classList.remove('hidden');
        }

    } catch (e) {
        console.error("Gemini AI Error:", e);
        if (ui.content) {
            ui.content.innerHTML = `<span class="text-rose-500 font-semibold">Erro ao gerar análise: ${e.message}</span>`;
            ui.content.classList.remove('hidden');
        }
    } finally {
        ui.loading?.classList.add('hidden');
        if (ui.btn) ui.btn.disabled = false;
    }
}

// --- GOOGLE ADS CONFIG MODAL ---
async function openGoogleConfigModal() {
    const modal = document.getElementById('google-config-modal');
    if (!modal) return;

    try {
        const cached = localStorage.getItem('google_ads_config');
        if (cached) {
            const data = JSON.parse(cached);
            if (document.getElementById('cfg-customer-id')) document.getElementById('cfg-customer-id').value = data.customer_id || '';
            if (document.getElementById('cfg-client-id')) document.getElementById('cfg-client-id').value = data.client_id || '';
            if (document.getElementById('cfg-client-secret')) document.getElementById('cfg-client-secret').value = data.client_secret || '';
            if (document.getElementById('cfg-refresh-token')) document.getElementById('cfg-refresh-token').value = data.refresh_token || '';
            if (document.getElementById('cfg-developer-token')) document.getElementById('cfg-developer-token').value = (data.developer_token === 'DEFAULT_DEV_TOKEN' ? '' : data.developer_token) || '';
            if (document.getElementById('cfg-login-customer-id')) document.getElementById('cfg-login-customer-id').value = data.login_customer_id || '';
        }

        const docRef = doc(db, 'settings', 'google_ads');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (document.getElementById('cfg-customer-id') && !document.getElementById('cfg-customer-id').value) document.getElementById('cfg-customer-id').value = data.customer_id || data.customerId || '';
            if (document.getElementById('cfg-client-id') && !document.getElementById('cfg-client-id').value) document.getElementById('cfg-client-id').value = data.client_id || data.clientId || '';
            if (document.getElementById('cfg-client-secret') && !document.getElementById('cfg-client-secret').value) document.getElementById('cfg-client-secret').value = data.client_secret || data.clientSecret || '';
            if (document.getElementById('cfg-refresh-token') && !document.getElementById('cfg-refresh-token').value) document.getElementById('cfg-refresh-token').value = data.refresh_token || data.refreshToken || '';
            if (document.getElementById('cfg-developer-token') && !document.getElementById('cfg-developer-token').value) document.getElementById('cfg-developer-token').value = (data.developer_token === 'DEFAULT_DEV_TOKEN' ? '' : data.developer_token) || '';
            if (document.getElementById('cfg-login-customer-id') && !document.getElementById('cfg-login-customer-id').value) document.getElementById('cfg-login-customer-id').value = data.login_customer_id || data.loginCustomerId || '';
        }
    } catch (err) {
        console.warn("Aviso ao buscar configurações no Firestore:", err);
    }

    modal.classList.remove('hidden');
}

function closeGoogleConfigModal() {
    const modal = document.getElementById('google-config-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveGoogleConfig(e) {
    e.preventDefault();

    const saveBtn = document.getElementById('save-google-cfg-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Salvando...`;
    }

    const configData = {
        customer_id: document.getElementById('cfg-customer-id')?.value.trim(),
        client_id: document.getElementById('cfg-client-id')?.value.trim(),
        client_secret: document.getElementById('cfg-client-secret')?.value.trim(),
        refresh_token: document.getElementById('cfg-refresh-token')?.value.trim(),
        developer_token: document.getElementById('cfg-developer-token')?.value.trim() || 'DEFAULT_DEV_TOKEN',
        login_customer_id: document.getElementById('cfg-login-customer-id')?.value.trim() || '',
        updatedAt: new Date().toISOString()
    };

    // 1. Sempre salva no LocalStorage primeiro (garante acesso local/offline instantâneo)
    localStorage.setItem('google_ads_config', JSON.stringify(configData));

    // 2. Tenta salvar no Firestore em background (se falhar regra, salva silenciosamente sem bloquear)
    try {
        const docRef = doc(db, 'settings', 'google_ads');
        await setDoc(docRef, configData, { merge: true });
    } catch (err) {
        console.warn("Aviso ao salvar no Firestore (usando LocalStorage fallback):", err.message);
    }

    closeGoogleConfigModal();

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fas fa-save"></i> Salvar e Testar`;
    }

    showAlert("Configurações salvas com sucesso! Testando conexão com a API...", "success");
    await initDashboard();
}

// --- EXPORT PDF / PRINT ---
function exportToPDF() {
    const printable = document.getElementById('printableReport');
    if (!printable) return;

    const overview = currentDashboardData?.overview || {};
    const campaigns = rawCampaignsData || [];

    let rowsHtml = campaigns.map(c => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.type}</td>
            <td>${c.status.toUpperCase()}</td>
            <td>${c.conversions}</td>
            <td>${formatNumber(c.clicks)}</td>
            <td>${c.ctr.toFixed(2)}%</td>
            <td>${formatCurrency(c.cpc)}</td>
            <td>${formatCurrency(c.cpa)}</td>
            <td>${formatCurrency(c.spend)}</td>
        </tr>
    `).join('');

    printable.innerHTML = `
        <div style="padding: 20px; font-family: sans-serif;">
            <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">Relatório de Performance - Google Ads Kihap</h1>
            <p style="color: #666; font-size: 12px; margin-bottom: 20px;">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>

            <div class="print-card">
                <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Resumo Geral</h2>
                <table class="print-table">
                    <tr>
                        <td><strong>Investimento Total:</strong> ${formatCurrency(overview.spend || 0)}</td>
                        <td><strong>Impressões:</strong> ${formatNumber(overview.impressions || 0)}</td>
                        <td><strong>Cliques:</strong> ${formatNumber(overview.clicks || 0)}</td>
                    </tr>
                    <tr>
                        <td><strong>CTR Médio:</strong> ${(overview.ctr || 0).toFixed(2)}%</td>
                        <td><strong>Conversões:</strong> ${formatNumber(overview.conversions || 0)}</td>
                        <td><strong>CPA Médio:</strong> ${formatCurrency(overview.cpa || 0)}</td>
                    </tr>
                </table>
            </div>

            <div class="print-card">
                <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Campanhas</h2>
                <table class="print-table">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th>Campanha</th>
                            <th>Tipo</th>
                            <th>Status</th>
                            <th>Conversões</th>
                            <th>Cliques</th>
                            <th>CTR</th>
                            <th>CPC</th>
                            <th>CPA</th>
                            <th>Custo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    printable.classList.remove('hidden');
    window.print();
    setTimeout(() => printable.classList.add('hidden'), 1000);
}

// --- UTILS ---
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
}
