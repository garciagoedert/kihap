import { onAuthReady } from './auth.js';
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents, getUnidades } from './common-ui.js';

// Estado global do Analytics
let allLogs = [];
let allUsers = [];
let filteredLogs = [];
let unitsList = [];
let accessChartInstance = null;
let currentTab = 'recent';
let selectedUnit = 'all';
let selectedPeriod = 15;
let searchQuery = '';

/**
 * Formata data e hora relativa (ex: "há 5 min", "Hoje às 14:30")
 */
function formatRelativeTime(date) {
    if (!date) return 'Nunca';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `há ${diffMin} min`;
    if (diffHours < 24 && now.getDate() === date.getDate()) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `Hoje às ${hh}:${mm}`;
    }
    if (diffDays === 1) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `Ontem às ${hh}:${mm}`;
    }
    if (diffDays < 7) return `há ${diffDays} dias`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + 
           ' às ' + 
           date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Retorna o nome formatado da unidade
 */
function getUnitName(unitId) {
    if (!unitId || unitId === 'geral') return 'Geral';
    const found = unitsList.find(u => u.id === unitId || u.name.toLowerCase() === unitId.toLowerCase());
    if (found) return found.name;
    return unitId.charAt(0).toUpperCase() + unitId.slice(1);
}

/**
 * Inicialização dos Filtros de Unidade
 */
async function initUnitFilter() {
    const unitSelect = document.getElementById('unit-filter');
    try {
        unitsList = await getUnidades();
        unitsList.forEach(unit => {
            const opt = document.createElement('option');
            opt.value = unit.id;
            opt.textContent = unit.name;
            unitSelect.appendChild(opt);
        });
    } catch (e) {
        console.warn('Falha ao carregar unidades:', e);
    }

    unitSelect.addEventListener('change', (e) => {
        selectedUnit = e.target.value;
        applyFilters();
    });

    const periodSelect = document.getElementById('period-filter');
    periodSelect.addEventListener('change', (e) => {
        selectedPeriod = parseInt(e.target.value, 10);
        applyFilters();
    });

    const tabSearchInput = document.getElementById('tab-search');
    tabSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderActiveTab();
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
        const icon = document.getElementById('refresh-icon');
        icon.classList.add('fa-spin');
        applyFilters();
        setTimeout(() => icon.classList.remove('fa-spin'), 600);
    });

    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

    // Navegação de abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;

            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
            const targetPane = document.getElementById(`tab-content-${currentTab}`);
            if (targetPane) targetPane.classList.remove('hidden');

            renderActiveTab();
        });
    });
}

/**
 * Busca de Dados do Firestore
 */
async function loadData() {
    try {
        // 1. Escuta em tempo real os últimos logs de acesso
        const logsQuery = query(
            collection(db, 'app_access_logs'),
            orderBy('timestamp', 'desc'),
            limit(1500)
        );

        onSnapshot(logsQuery, (snapshot) => {
            allLogs = snapshot.docs.map(doc => {
                const data = doc.data();
                const ts = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
                return {
                    id: doc.id,
                    ...data,
                    timestampDate: ts
                };
            });
            applyFilters();
        }, (err) => {
            console.error('Erro ao escutar logs:', err);
        });

        // 2. Busca lista de usuários cadastrados para métricas de adoção e inatividade
        const usersSnap = await getDocs(collection(db, 'users'));
        allUsers = usersSnap.docs.map(doc => {
            const data = doc.data();
            const lastAccess = data.lastAppAccess?.toDate ? data.lastAppAccess.toDate() : null;
            return {
                id: doc.id,
                uid: doc.id,
                ...data,
                lastAppAccessDate: lastAccess
            };
        });

        applyFilters();
    } catch (error) {
        console.error('Erro ao carregar dados do Analytics:', error);
    }
}

/**
 * Aplica os filtros selecionados (Unidade e Período)
 */
function applyFilters() {
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(now.getDate() - selectedPeriod);
    periodStart.setHours(0, 0, 0, 0);

    // Filtra logs
    filteredLogs = allLogs.filter(log => {
        // Filtro de unidade
        if (selectedUnit !== 'all' && log.unitId !== selectedUnit) {
            return false;
        }
        return true;
    });

    updateKPIs();
    renderChart();
    renderActiveTab();
}

/**
 * Atualiza os Cards de KPIs Principais
 */
function updateKPIs() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Logs de hoje
    const todayLogs = filteredLogs.filter(l => l.dateStr === todayStr);
    const yesterdayLogs = filteredLogs.filter(l => l.dateStr === yesterdayStr);

    // Usuários únicos hoje e ontem
    const uniqueToday = new Set(todayLogs.map(l => l.userId)).size;
    const uniqueYesterday = new Set(yesterdayLogs.map(l => l.userId)).size;

    // Total de sessões
    const sessionsToday = todayLogs.length;

    // Sessões no período selecionado
    const periodStart = new Date();
    periodStart.setDate(today.getDate() - selectedPeriod);
    periodStart.setHours(0, 0, 0, 0);
    const periodLogs = filteredLogs.filter(l => l.timestampDate >= periodStart);

    // Contagem de plataformas no período
    let androidCount = 0;
    let iosCount = 0;
    periodLogs.forEach(l => {
        const plat = (l.platform || '').toLowerCase();
        if (plat === 'android') androidCount++;
        else if (plat === 'ios') iosCount++;
    });

    const totalPlat = androidCount + iosCount || 1;
    const androidPct = Math.round((androidCount / totalPlat) * 100);
    const iosPct = 100 - androidPct;

    // Usuários filtrados por unidade
    const usersInUnit = allUsers.filter(u => {
        if (selectedUnit === 'all') return true;
        return u.unitId === selectedUnit || u.unit === selectedUnit;
    });

    const activeAppUsers = usersInUnit.filter(u => u.lastAppAccessDate || u.appAccessCount > 0);
    const totalStudents = usersInUnit.length || 1;
    const adoptionRate = Math.round((activeAppUsers.length / totalStudents) * 100);

    // Atualiza o DOM
    document.getElementById('kpi-unique-today').textContent = uniqueToday;
    document.getElementById('kpi-yesterday-text').textContent = `Ontem: ${uniqueYesterday} alunos`;

    document.getElementById('kpi-sessions-today').textContent = sessionsToday;
    document.getElementById('kpi-period-sessions').textContent = periodLogs.length;

    document.getElementById('kpi-android-count').textContent = `${androidCount} (${androidPct}%)`;
    document.getElementById('kpi-ios-count').textContent = `${iosCount} (${iosPct}%)`;
    document.getElementById('kpi-android-bar').style.width = `${androidPct}%`;
    document.getElementById('kpi-ios-bar').style.width = `${iosPct}%`;

    document.getElementById('kpi-adoption-rate').textContent = `${adoptionRate}%`;
    document.getElementById('kpi-adoption-details').textContent = `${activeAppUsers.length} de ${usersInUnit.length} alunos cadastrados`;

    // Badges de contagem nas abas
    document.getElementById('badge-recent-count').textContent = filteredLogs.length;
    
    // Inativos (> 15 dias ou sem acesso)
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(today.getDate() - 15);
    const inactiveCount = usersInUnit.filter(u => !u.lastAppAccessDate || u.lastAppAccessDate < fifteenDaysAgo).length;
    document.getElementById('badge-inactive-count').textContent = inactiveCount;
}

/**
 * Renderiza o Gráfico Interativo com Chart.js
 */
function renderChart() {
    const ctx = document.getElementById('accessChart')?.getContext('2d');
    if (!ctx) return;

    // Gera lista dos últimos N dias
    const days = [];
    const sessionsData = [];
    const uniqueData = [];

    const isDark = document.documentElement.classList.contains('dark');

    for (let i = selectedPeriod - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        days.push(label);

        const logsOnDay = filteredLogs.filter(l => l.dateStr === dStr);
        sessionsData.push(logsOnDay.length);
        uniqueData.push(new Set(logsOnDay.map(l => l.userId)).size);
    }

    if (accessChartInstance) {
        accessChartInstance.destroy();
    }

    // Gradientes suaves
    const gradAmber = ctx.createLinearGradient(0, 0, 0, 250);
    gradAmber.addColorStop(0, 'rgba(234, 179, 8, 0.35)');
    gradAmber.addColorStop(1, 'rgba(234, 179, 8, 0.0)');

    const gradBlue = ctx.createLinearGradient(0, 0, 0, 250);
    gradBlue.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
    gradBlue.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    accessChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Total Sessões',
                    data: sessionsData,
                    borderColor: '#eab308',
                    backgroundColor: gradAmber,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#eab308',
                    pointRadius: selectedPeriod > 15 ? 2.5 : 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Alunos Únicos',
                    data: uniqueData,
                    borderColor: '#3b82f6',
                    backgroundColor: gradBlue,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: selectedPeriod > 15 ? 2.5 : 4,
                    pointHoverRadius: 6
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
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    titleColor: isDark ? '#fff' : '#111',
                    bodyColor: isDark ? '#ccc' : '#444',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4,
                    usePointStyle: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: isDark ? '#888' : '#666',
                        font: { size: 10, weight: 'bold' }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        precision: 0,
                        color: isDark ? '#888' : '#666',
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

/**
 * Renderiza o conteúdo da aba ativa
 */
function renderActiveTab() {
    if (currentTab === 'recent') {
        renderRecentLogs();
    } else if (currentTab === 'top-users') {
        renderTopUsers();
    } else if (currentTab === 'inactive') {
        renderInactiveUsers();
    }
}

/**
 * Aba 1: Renderiza tabela de acessos recentes em tempo real
 */
function renderRecentLogs() {
    const tbody = document.getElementById('recent-logs-tbody');
    if (!tbody) return;

    let logs = filteredLogs;
    if (searchQuery) {
        logs = logs.filter(l => 
            (l.userName || '').toLowerCase().includes(searchQuery) ||
            (l.userEmail || '').toLowerCase().includes(searchQuery)
        );
    }

    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-12 text-center text-gray-400">
                    <i class="fas fa-inbox text-3xl mb-3 block opacity-40"></i>
                    Nenhum acesso registrado com os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.slice(0, 100).map(log => {
        const isAndroid = (log.platform || '').toLowerCase() === 'android';
        const platformIcon = isAndroid 
            ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><i class="fab fa-android"></i> Android</span>`
            : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-500/10 text-gray-800 dark:text-gray-200 border border-gray-500/20"><i class="fab fa-apple"></i> iOS</span>`;

        const initial = (log.userName || 'A').charAt(0).toUpperCase();

        return `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                            ${initial}
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-gray-900 dark:text-white truncate">${log.userName || 'Aluno Kihap'}</div>
                            <div class="text-[11px] text-gray-400 truncate">${log.userEmail || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    <span class="inline-block px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        ${getUnitName(log.unitId)}
                    </span>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                    ${platformIcon}
                </td>
                <td class="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                    v${log.appVersion || '3.9'}
                </td>
                <td class="py-3 px-4 text-right whitespace-nowrap text-xs text-gray-600 dark:text-gray-300 font-semibold">
                    ${formatRelativeTime(log.timestampDate)}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Aba 2: Renderiza ranking dos alunos que mais usam o app
 */
function renderTopUsers() {
    const tbody = document.getElementById('top-users-tbody');
    if (!tbody) return;

    let users = allUsers.filter(u => {
        if (selectedUnit !== 'all' && (u.unitId !== selectedUnit && u.unit !== selectedUnit)) {
            return false;
        }
        return (u.appAccessCount && u.appAccessCount > 0) || u.lastAppAccessDate;
    });

    if (searchQuery) {
        users = users.filter(u => 
            (u.name || '').toLowerCase().includes(searchQuery) ||
            (u.email || '').toLowerCase().includes(searchQuery)
        );
    }

    users.sort((a, b) => (b.appAccessCount || 0) - (a.appAccessCount || 0));

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-12 text-center text-gray-400">
                    <i class="fas fa-trophy text-3xl mb-3 block opacity-40"></i>
                    Nenhum aluno com acessos registrados nesta unidade ainda.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.slice(0, 50).map((user, idx) => {
        let medal = `#${idx + 1}`;
        if (idx === 0) medal = '🥇 1º';
        else if (idx === 1) medal = '🥈 2º';
        else if (idx === 2) medal = '🥉 3º';

        const isAndroid = (user.lastAppPlatform || '').toLowerCase() === 'android';
        const platformBadge = user.lastAppPlatform ? (
            isAndroid 
                ? `<span class="text-emerald-500 font-bold text-xs"><i class="fab fa-android mr-1"></i>Android</span>`
                : `<span class="text-gray-800 dark:text-gray-200 font-bold text-xs"><i class="fab fa-apple mr-1"></i>iOS</span>`
        ) : `<span class="text-gray-400 text-xs">--</span>`;

        return `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                        <span class="font-black text-xs w-8 text-amber-500">${medal}</span>
                        <div>
                            <div class="font-bold text-gray-900 dark:text-white">${user.name || 'Aluno'}</div>
                            <div class="text-[11px] text-gray-400">${user.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4 text-gray-600 dark:text-gray-400">
                    ${getUnitName(user.unitId || user.unit)}
                </td>
                <td class="py-3 px-4 font-black text-amber-600 dark:text-amber-400">
                    ${user.appAccessCount || 1} acessos
                </td>
                <td class="py-3 px-4">
                    ${platformBadge}
                </td>
                <td class="py-3 px-4 text-right text-xs text-gray-500 dark:text-gray-400 font-semibold">
                    ${formatRelativeTime(user.lastAppAccessDate)}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Aba 3: Renderiza alunos inativos ou que nunca abriram o app
 */
function renderInactiveUsers() {
    const tbody = document.getElementById('inactive-users-tbody');
    if (!tbody) return;

    const now = new Date();
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(now.getDate() - 15);

    let users = allUsers.filter(u => {
        if (selectedUnit !== 'all' && (u.unitId !== selectedUnit && u.unit !== selectedUnit)) {
            return false;
        }
        // Inativo se nunca acessou ou último acesso foi há mais de 15 dias
        return !u.lastAppAccessDate || u.lastAppAccessDate < fifteenDaysAgo;
    });

    if (searchQuery) {
        users = users.filter(u => 
            (u.name || '').toLowerCase().includes(searchQuery) ||
            (u.email || '').toLowerCase().includes(searchQuery)
        );
    }

    // Ordena: nunca acessou primeiro
    users.sort((a, b) => {
        if (!a.lastAppAccessDate && b.lastAppAccessDate) return -1;
        if (a.lastAppAccessDate && !b.lastAppAccessDate) return 1;
        return 0;
    });

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-12 text-center text-emerald-500 font-bold">
                    <i class="fas fa-check-circle text-3xl mb-3 block"></i>
                    Excelente! Todos os alunos desta unidade estão com o app ativo nos últimos 15 dias!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.slice(0, 100).map(user => {
        const neverAccessed = !user.lastAppAccessDate;
        const statusBadge = neverAccessed 
            ? `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">Nunca acessou</span>`
            : `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Inativo há +15 dias</span>`;

        // Telefone para WhatsApp
        const rawPhone = user.phone || user.telefone || user.whatsapp || '';
        const cleanPhone = String(rawPhone).replace(/\D/g, '');
        const studentName = user.name || 'Aluno';
        const msgText = encodeURIComponent(`Olá, ${studentName}! Notamos que você ainda não acessou o novo aplicativo oficial da Kihap. Por lá você pode acompanhar seus exames, eventos e muito mais! Precisa de ajuda para acessar?`);
        const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${msgText}` : null;

        const actionBtn = waLink ? `
            <a href="${waLink}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95">
                <i class="fab fa-whatsapp"></i> Lembrar
            </a>
        ` : `<span class="text-xs text-gray-400">Sem telefone</span>`;

        return `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                <td class="py-3 px-4">
                    <div class="font-bold text-gray-900 dark:text-white">${user.name || 'Aluno'}</div>
                    <div class="text-[11px] text-gray-400">${user.email || ''}</div>
                </td>
                <td class="py-3 px-4 text-gray-600 dark:text-gray-400">
                    ${getUnitName(user.unitId || user.unit)}
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">
                    ${formatRelativeTime(user.lastAppAccessDate)}
                </td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    ${actionBtn}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Exporta os logs filtrados para arquivo CSV
 */
function exportToCSV() {
    if (filteredLogs.length === 0) {
        alert('Não há dados para exportar com os filtros atuais.');
        return;
    }

    const headers = ['Data', 'Horario', 'Aluno', 'Email', 'Unidade', 'Plataforma', 'Versao'];
    const rows = filteredLogs.map(l => {
        const d = l.timestampDate || new Date();
        const dataStr = d.toLocaleDateString('pt-BR');
        const horaStr = d.toLocaleTimeString('pt-BR');
        return [
            `"${dataStr}"`,
            `"${horaStr}"`,
            `"${(l.userName || '').replace(/"/g, '""')}"`,
            `"${(l.userEmail || '').replace(/"/g, '""')}"`,
            `"${getUnitName(l.unitId)}"`,
            `"${l.platform || ''}"`,
            `"${l.appVersion || ''}"`
        ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_app_kihap_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Inicializa a página assim que a autenticação estiver pronta
onAuthReady(async () => {
    await loadComponents();
    await initUnitFilter();
    await loadData();
});
