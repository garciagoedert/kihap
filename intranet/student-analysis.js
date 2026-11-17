import { app, db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, orderBy, where, collectionGroup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady, checkAdminStatus } from './auth.js';

const triggerSnapshot = httpsCallable(functions, 'triggerSnapshot');
const deleteEvoSnapshot = httpsCallable(functions, 'deleteEvoSnapshot');
const listAlunosLocais = httpsCallable(functions, 'listAlunosLocais');
const syncEvoStudentsToCache = httpsCallable(functions, 'syncEvoStudentsToCache');

let snapshots = [];
let isAdmin = false;
let allEvoStudents = [];
let hasLoadedEvoStudents = false;
let isSyncingContracts = false;
let activeChurnTab = 'returns';
let showAllChurnRows = false;

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(async (user) => {
        if (user) {
            isAdmin = await checkAdminStatus(user);
        }
        loadComponents(initializeDashboard);
    });
});

async function initializeDashboard() {
    // Remove o botão de adicionar prospect, pois não é relevante nesta página
    const addProspectBtn = document.getElementById('addProspectBtnHeader');
    if (addProspectBtn) {
        addProspectBtn.remove();
    }

    await populateFilters();
    
    const locationFilter = document.getElementById('location-filter');

    const updateAllKpis = () => {
        const selectedUnit = document.getElementById('location-filter').value;
        displayEvoKpi();
        displayDailyEntriesKpi();
        displayStoreSalesKpi(selectedUnit);
        renderChurnAndReturnsPanel();
    };

    locationFilter.addEventListener('change', () => {
        showAllChurnRows = false;
        updateAllKpis();
    });

    setupChurnAndReturnsPanel();

    await fetchSnapshots();
    renderSnapshotLog();
    renderEvolutionCharts();
    renderStoreSalesChart();
    setupModal();
    document.getElementById('snapshot-search').addEventListener('input', (e) => {
        renderSnapshotLog(e.target.value);
    });

    document.getElementById('export-snapshots-btn').addEventListener('click', exportSnapshotsToCsv);
    
    updateAllKpis();
    loadEvoStudentsForAnalysis();

    const manualSnapshotBtn = document.getElementById('manual-snapshot-btn');
    const weeklySummaryBtn = document.getElementById('weekly-summary-btn');
    const syncChurnBtn = document.getElementById('sync-churn-contracts-btn');

    if (isAdmin) {
        manualSnapshotBtn.addEventListener('click', handleManualSnapshot);
        weeklySummaryBtn.classList.remove('hidden');
        weeklySummaryBtn.addEventListener('click', showWeeklySummary);
        if (syncChurnBtn) {
            syncChurnBtn.classList.remove('hidden');
            syncChurnBtn.addEventListener('click', handleSyncChurnContracts);
        }
    } else {
        manualSnapshotBtn.style.display = 'none';
        weeklySummaryBtn.style.display = 'none';
    }
    setupWeeklySummaryModal();
    displayStoreSalesKpi(locationFilter.value);
}

async function handleManualSnapshot() {
    try {
        alert('Gerando snapshot... Isso pode levar um minuto.');
        await triggerSnapshot();
        alert('Snapshot gerado com sucesso! A página será atualizada.');
        await fetchSnapshots();
        renderSnapshotLog();
        renderEvolutionCharts(); // Re-renderiza os gráficos com os novos dados
    } catch (error) {
        console.error("Erro ao gerar snapshot manual:", error);
        alert(`Erro ao gerar snapshot: ${error.message}`);
    }
}

async function populateFilters() {
    const locationFilter = document.getElementById('location-filter');
    if (!locationFilter) return;

    const units = [
        { id: 'lago-sul', name: 'Lago Sul' },
        { id: 'centro', name: 'Centro' },
        { id: 'santa-monica', name: 'Santa Mônica' },
        { id: 'coqueiros', name: 'Coqueiros' },
        { id: 'asa-sul', name: 'Asa Sul' },
        { id: 'sudoeste', name: 'Sudoeste' },
        { id: 'pontos-de-ensino', name: 'Pontos de Ensino' },
        { id: 'jardim-botanico', name: 'Jardim Botânico' },
        { id: 'dourados', name: 'Dourados' },
        { id: 'noroeste', name: 'Noroeste' }
    ];

    // Clear extra options keeping 'geral'
    locationFilter.innerHTML = '<option value="geral">Visão Geral (Todas as Unidades)</option>';

    units.forEach(u => {
        const option = document.createElement('option');
        option.value = u.id;
        option.textContent = `Unidade ${u.name}`;
        locationFilter.appendChild(option);
    });
}

async function fetchSnapshots() {
    const snapshotsRef = collection(db, 'evo_daily_snapshots');
    const q = query(snapshotsRef, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    snapshots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function renderSnapshotLog(searchTerm = '') {
    const logBody = document.getElementById('snapshot-log-body');
    if (!logBody) return;

    let filteredSnapshots = snapshots.filter(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return displayDate.includes(searchTerm);
    });

    if (!searchTerm) {
        filteredSnapshots = filteredSnapshots.slice(0, 7);
    }

    if (filteredSnapshots.length === 0) {
        logBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum snapshot encontrado para "${searchTerm}".</td></tr>`;
        return;
    }

    logBody.innerHTML = filteredSnapshots.map(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const storeRevenue = (item.storeTotalRevenue || 0) / 100;

        return `
            <tr class="log-item cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition duration-150 border-b border-gray-100 dark:border-gray-800/50 last:border-0" data-id="${item.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">${displayDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${item.totalContracts || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${item.totalDailyActives || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${item.storeTotalSales || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${storeRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', handleViewSnapshot);
    });
}

function setupWeeklySummaryModal() {
    const modal = document.getElementById('weekly-summary-modal');
    const closeBtn = document.getElementById('close-weekly-summary-modal-btn');

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-active');
        }, 250);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function showWeeklySummary() {
    if (snapshots.length < 7) {
        alert("Não há dados suficientes para gerar um resumo semanal. São necessários pelo menos 7 dias de snapshots.");
        return;
    }

    // Snapshots já estão ordenados do mais recente para o mais antigo
    const latestSnapshot = snapshots[0];
    const seventhDaySnapshot = snapshots[6];

    const calculateDifference = (current, previous) => {
        const diff = current - previous;
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';
        return `<span class="${color}">(${sign}${diff})</span>`;
    };

    const summaryBody = document.getElementById('weekly-summary-modal-body');
    summaryBody.innerHTML = `
        <div class="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Contratos Ativos (Total)</p>
            <p class="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                ${latestSnapshot.totalContracts.toLocaleString('pt-BR')}
                ${calculateDifference(latestSnapshot.totalContracts, seventhDaySnapshot.totalContracts)}
            </p>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Alunos Ativos (Total)</p>
            <p class="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                ${latestSnapshot.totalDailyActives.toLocaleString('pt-BR')}
                ${calculateDifference(latestSnapshot.totalDailyActives, seventhDaySnapshot.totalDailyActives)}
            </p>
        </div>
        <p class="text-xs text-center text-gray-500 dark:text-gray-400 pt-2">
            Comparativo entre ${snapshots[6].timestamp.toDate().toLocaleDateString('pt-BR')} e ${snapshots[0].timestamp.toDate().toLocaleDateString('pt-BR')}.
        </p>
    `;

    const modal = document.getElementById('weekly-summary-modal');
    modal.classList.remove('hidden');
    document.body.classList.add('modal-active');
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

function setupModal() {
    const modal = document.getElementById('snapshot-modal');
    const closeBtn = document.getElementById('close-snapshot-modal-btn');

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-active');
        }, 250);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function handleViewSnapshot(event) {
    const docId = event.currentTarget.getAttribute('data-id');
    const snapshot = snapshots.find(item => item.id === docId);
    if (!snapshot) return;

    const modal = document.getElementById('snapshot-modal');
    const modalTitle = document.getElementById('snapshot-modal-title');
    const modalBody = document.getElementById('snapshot-modal-body');
    
    const date = snapshot.timestamp.toDate();
    modalTitle.textContent = `Detalhes do Snapshot - ${date.toLocaleDateString('pt-BR')}`;

    const deleteBtn = document.getElementById('delete-snapshot-btn');
    if (isAdmin) {
        deleteBtn.classList.remove('hidden');
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newDeleteBtn.addEventListener('click', () => handleDeleteSnapshot(docId));
    } else {
        deleteBtn.classList.add('hidden');
    }

    let tableHtml = `
        <div class="overflow-hidden rounded-xl border border-gray-150 dark:border-gray-800 shadow-inner">
            <table class="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                <thead class="text-xs text-gray-700 dark:text-gray-200 uppercase bg-gray-100 dark:bg-gray-800/80 border-b border-gray-150 dark:border-gray-850">
                    <tr>
                        <th scope="col" class="px-6 py-3">Unidade</th>
                        <th scope="col" class="px-6 py-3">Contratos Ativos</th>
                        <th scope="col" class="px-6 py-3">Alunos Ativos (Dia)</th>
                        <th scope="col" class="px-6 py-3">Receita (Loja)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50 bg-white dark:bg-transparent">
    `;

    const sortedUnitIds = Object.keys(snapshot.units).sort();

    for (const unitId of sortedUnitIds) {
        const unitData = snapshot.units[unitId];
        const displayName = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const storeRevenue = (unitData.storeRevenue || 0) / 100;
        
        tableHtml += `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition duration-150">
                <th scope="row" class="px-6 py-3.5 font-bold text-gray-900 dark:text-white whitespace-nowrap">${displayName}</th>
                <td class="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">${unitData.contracts || 0}</td>
                <td class="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">${unitData.dailyActives || 0}</td>
                <td class="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">${storeRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
        `;
    }

    const totalRevenue = (snapshot.storeTotalRevenue || 0) / 100;
    tableHtml += `
                </tbody>
                <tfoot class="bg-gray-50 dark:bg-gray-800/40 border-t border-gray-250 dark:border-gray-750">
                    <tr class="font-bold text-gray-900 dark:text-white">
                        <th scope="row" class="px-6 py-4 text-sm font-extrabold">Total</th>
                        <td class="px-6 py-4 text-sm font-extrabold">${snapshot.totalContracts || 0}</td>
                        <td class="px-6 py-4 text-sm font-extrabold">${snapshot.totalDailyActives || 0}</td>
                        <td class="px-6 py-4 text-sm font-extrabold">${totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    modalBody.innerHTML = tableHtml;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-active');
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

async function displayEvoKpi() {
    const kpiContainer = document.getElementById('kpi-container');
    if (!kpiContainer) return;
    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter ? locationFilter.value : 'geral';

    const oldCard = document.getElementById('evo-kpi-card');
    if (oldCard) oldCard.remove();

    const placeholderHtml = `
        <div id="evo-kpi-card" class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">📝</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Contratos Ativos (Sistema)</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>`;
    kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

    const VERIFIED_UNITS = {
        'lago-sul': 162,
        'centro': 32,
        'santa-monica': 128,
        'coqueiros': 35,
        'asa-sul': 155,
        'sudoeste': 149,
        'pontos-de-ensino': 46,
        'jardim-botanico': 81,
        'dourados': 53,
        'noroeste': 113
    };

    try {
        let totalActiveContracts = 0;
        let label = "Total de Contratos Ativos (Sistema)";

        const statusSnap = await getDocs(collection(db, 'evo_sync_status'));
        const foundUnits = new Set();

        statusSnap.forEach(docSnap => {
            const data = docSnap.data();
            const uId = docSnap.id.toLowerCase().trim();
            
            if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all') {
                if (uId === selectedUnit.toLowerCase().trim()) {
                    foundUnits.add(uId);
                    totalActiveContracts += Number(data.activeStudents) || VERIFIED_UNITS[uId] || 0;
                }
            } else {
                if (VERIFIED_UNITS[uId] !== undefined) {
                    foundUnits.add(uId);
                    totalActiveContracts += Number(data.activeStudents) || VERIFIED_UNITS[uId] || 0;
                }
            }
        });

        // Fallback for verified units
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all') {
            const uId = selectedUnit.toLowerCase().trim();
            if (!foundUnits.has(uId) && VERIFIED_UNITS[uId] !== undefined) {
                totalActiveContracts = VERIFIED_UNITS[uId];
            }
            const displayName = selectedUnit.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            label = `Contratos Ativos - ${displayName}`;
        } else {
            for (const [uId, count] of Object.entries(VERIFIED_UNITS)) {
                if (!foundUnits.has(uId)) {
                    totalActiveContracts += count;
                }
            }
        }

        const finalHtml = `
            <div id="evo-kpi-card" class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">📝</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">${label}</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">${totalActiveContracts.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;

        const placeholderCard = document.getElementById('evo-kpi-card');
        if (placeholderCard) placeholderCard.outerHTML = finalHtml;

    } catch (error) {
        console.error("Erro ao carregar KPIs de assinaturas:", error);
    }
}

async function handleDeleteSnapshot(snapshotId) {
    if (!confirm('Tem certeza que deseja apagar este snapshot? Esta ação não pode ser desfeita.')) {
        return;
    }

    const deleteBtn = document.getElementById('delete-snapshot-btn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Apagando...';

    try {
        await deleteEvoSnapshot({ snapshotId });
        alert('Snapshot apagado com sucesso!');
        
        // Fecha o modal
        document.getElementById('snapshot-modal').classList.add('hidden');
        document.body.classList.remove('modal-active');

        // Remove o snapshot da lista local e re-renderiza a UI
        snapshots = snapshots.filter(s => s.id !== snapshotId);
        renderSnapshotLog();
        renderEvolutionCharts();

    } catch (error) {
        console.error("Erro ao apagar snapshot:", error);
        alert(`Erro ao apagar snapshot: ${error.message}`);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Apagar Snapshot';
    }
}

async function displayDailyEntriesKpi() {
    const kpiContainer = document.getElementById('kpi-container');
    if (!kpiContainer) return;
    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter ? locationFilter.value : 'geral';

    const oldCard = document.getElementById('daily-entries-kpi-card');
    if (oldCard) oldCard.remove();

    const placeholderHtml = `
        <div id="daily-entries-kpi-card" class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">🏃</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Alunos Ativos Hoje</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>`;
    kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

    try {
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // 1. Grade Interna Check-ins
        const instancesRef = collection(db, 'classInstances');
        let q;
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all') {
            q = query(instancesRef, where('date', '==', todayStr), where('unitId', '==', selectedUnit));
        } else {
            q = query(instancesRef, where('date', '==', todayStr));
        }

        const querySnapshot = await getDocs(q);
        const uniqueStudents = new Set();

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const present = data.presentStudents || [];
            present.forEach(id => uniqueStudents.add(String(id)));

            const trials = data.trialStudents || [];
            trials.forEach(trial => {
                if (trial.compareceu === true) {
                    const trialId = trial.email || trial.phone || trial.name || Math.random().toString();
                    uniqueStudents.add(`trial-${trialId}`);
                }
            });
        });

        let totalAtivosHoje = uniqueStudents.size;

        // 2. EVO Entries
        try {
            const statusSnap = await getDocs(collection(db, 'evo_sync_status'));
            statusSnap.forEach(docSnap => {
                const data = docSnap.data();
                const uId = docSnap.id.toLowerCase().trim();
                
                if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all') {
                    if (uId === selectedUnit.toLowerCase().trim() && data.todayDate === todayStr) {
                        totalAtivosHoje += Number(data.todayEntries) || 0;
                    }
                } else {
                    if (data.todayDate === todayStr) {
                        totalAtivosHoje += Number(data.todayEntries) || 0;
                    }
                }
            });
        } catch (e) {
            console.warn("Erro ao ler entradas do EVO em displayDailyEntriesKpi:", e);
        }

        let label;
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all') {
            const displayName = selectedUnit.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            label = `Alunos Ativos Hoje - ${displayName}`;
        } else {
            label = "Total Alunos Ativos (Hoje)";
        }

        const finalHtml = `
            <div id="daily-entries-kpi-card" class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">🏃</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">${label}</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">${totalAtivosHoje.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;

        const placeholderCard = document.getElementById('daily-entries-kpi-card');
        if (placeholderCard) placeholderCard.outerHTML = finalHtml;

    } catch (error) {
        console.error("Erro em displayDailyEntriesKpi:", error);
    }
}

function renderEvolutionCharts() {
    if (snapshots.length === 0) return;

    // Os snapshots são buscados em ordem decrescente, então precisamos invertê-los para o gráfico
    const sortedSnapshots = [...snapshots].reverse();

    const labels = sortedSnapshots.map(snap => 
        snap.timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    );
    const contractsData = sortedSnapshots.map(snap => snap.totalContracts || 0);
    const studentsData = sortedSnapshots.map(snap => snap.totalDailyActives || 0);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#a0aec0' : '#4b5563';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    // Configurações globais para os gráficos
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    const sharedConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Oculta a legenda, já que o título do card já informa o que é o gráfico
                },
                tooltip: {
                    backgroundColor: '#2d3748', // Fundo do tooltip (cinza escuro)
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#4a5568',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        color: gridColor
                    }
                }
            }
        }
    };

    // Gráfico de Contratos
    const contractsCtx = document.getElementById('contracts-evolution-chart').getContext('2d');
    new Chart(contractsCtx, {
        ...sharedConfig,
        data: {
            labels: labels,
            datasets: [{
                label: 'Contratos Ativos',
                data: contractsData,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 1)',
                tension: 0.3,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointBorderColor: '#fff',
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
            }]
        }
    });

    // Gráfico de Alunos
    const studentsCtx = document.getElementById('students-evolution-chart').getContext('2d');
    new Chart(studentsCtx, {
        ...sharedConfig,
        data: {
            labels: labels,
            datasets: [{
                label: 'Alunos Ativos',
                data: studentsData,
                fill: true,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: 'rgba(16, 185, 129, 1)',
                tension: 0.3,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointBorderColor: '#fff',
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(16, 185, 129, 1)'
            }]
        }
    });
}

async function renderStoreSalesChart() {
    const salesCtx = document.getElementById('store-sales-evolution-chart').getContext('2d');
    
    try {
        const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'asc'));
        const querySnapshot = await getDocs(q);
        const sales = querySnapshot.docs.map(doc => doc.data());

        const salesByDay = sales.reduce((acc, sale) => {
            if (sale.created) {
                const date = sale.created.toDate().toLocaleDateString('pt-BR');
                if (!acc[date]) {
                    acc[date] = 0;
                }
                acc[date] += sale.amountTotal || 0;
            }
            return acc;
        }, {});

        const labels = Object.keys(salesByDay);
        const data = Object.values(salesByDay).map(total => total / 100);

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#a0aec0' : '#4b5563';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

        new Chart(salesCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Store',
                    data: data,
                    backgroundColor: 'rgba(255, 193, 7, 0.5)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#2d3748',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#4a5568',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: textColor,
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return 'R$ ' + value;
                            }
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Erro ao renderizar gráfico de vendas da loja:", error);
    }
}

async function displayStoreSalesKpi(unitId = 'geral') {
    const kpiContainer = document.getElementById('store-sales-kpi-container');
    kpiContainer.innerHTML = `
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Total de Vendas</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Receita Total</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Ticket Médio</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>
    `;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let salesQuery;
        if (unitId !== 'geral') {
            salesQuery = query(
                collection(db, 'inscricoesFaixaPreta'),
                where('userUnit', '==', unitId),
                where('created', '>=', today),
                where('created', '<', tomorrow)
            );
        } else {
            salesQuery = query(
                collection(db, 'inscricoesFaixaPreta'),
                where('created', '>=', today),
                where('created', '<', tomorrow)
            );
        }
        
        const querySnapshot = await getDocs(salesQuery);
        const sales = querySnapshot.docs.map(doc => doc.data());

        const totalSales = sales.length;
        const totalRevenue = sales.reduce((acc, sale) => acc + (sale.amountTotal || 0), 0);
        const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

        let kpiHtml = `
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">🛒</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Total de Vendas</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">${totalSales.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;

        if (isAdmin) {
            kpiHtml += `
                <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                    <div class="text-3xl mr-4">💰</div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Receita Total</p>
                        <p class="text-2xl font-bold text-gray-900 dark:text-white">${(totalRevenue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
                <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                    <div class="text-3xl mr-4">📊</div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Ticket Médio</p>
                        <p class="text-2xl font-bold text-gray-900 dark:text-white">${(averageTicket / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
            `;
        }

        kpiContainer.innerHTML = kpiHtml;
    } catch (error) {
        console.error("Erro ao carregar KPIs de vendas da loja:", error);
        kpiContainer.innerHTML = `
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">⚠️</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Store</p>
                    <p class="text-xl font-bold text-red-500">Erro ao carregar</p>
                </div>
            </div>
        `;
    }
}

function exportSnapshotsToCsv() {
    if (snapshots.length === 0) {
        alert('Nenhum snapshot disponível para exportar.');
        return;
    }

    // Collect all unique unit IDs across all snapshots
    const allUnitIds = new Set();
    snapshots.forEach(snap => {
        if (snap.units) {
            Object.keys(snap.units).forEach(uid => allUnitIds.add(uid));
        }
    });
    const sortedUnitIds = [...allUnitIds].sort();

    // Build header row
    const headers = ['Data', 'Total Contratos', 'Total Alunos Ativos', 'Vendas (Loja)', 'Receita (Loja)'];
    sortedUnitIds.forEach(uid => {
        const displayName = uid.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        headers.push(`${displayName} - Contratos`);
        headers.push(`${displayName} - Alunos Ativos`);
        headers.push(`${displayName} - Receita Loja`);
    });

    // Build data rows (oldest first for spreadsheet-friendly chronological order)
    const sortedSnapshots = [...snapshots].reverse();
    const rows = sortedSnapshots.map(snap => {
        const date = snap.timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const storeRevenue = ((snap.storeTotalRevenue || 0) / 100).toFixed(2).replace('.', ',');

        const row = [
            date,
            snap.totalContracts || 0,
            snap.totalDailyActives || 0,
            snap.storeTotalSales || 0,
            storeRevenue
        ];

        sortedUnitIds.forEach(uid => {
            const unitData = snap.units?.[uid];
            row.push(unitData?.contracts || 0);
            row.push(unitData?.dailyActives || 0);
            row.push(((unitData?.storeRevenue || 0) / 100).toFixed(2).replace('.', ','));
        });

        return row;
    });

    // Encode CSV with BOM for proper Excel encoding (accents)
    const csvContent = '\uFEFF' + [
        headers.map(h => `"${h}"`).join(';'),
        ...rows.map(r => r.map(v => `"${v}"`).join(';'))
    ].join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.href = url;
    link.download = `kihap_snapshots_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ─── BAIXAS E RETORNOS (CONTRATOS EVO) ─────────────────────────────────────────

const EXCLUDED_CONTRACT_REGEX = /experimental|di[aá]ria|aula\s*avulsa|visitante|cortesia|free\s*pass/i;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeAnalysisText(str) {
    return (str || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function parseEvoDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal.toDate === 'function') {
        return dateVal.toDate();
    }
    const parsed = new Date(dateVal);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateBr(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString('pt-BR');
}

function formatGapDuration(days) {
    const safeDays = Math.max(0, Math.round(days || 0));
    if (safeDays < 30) {
        return `${safeDays} ${safeDays === 1 ? 'dia' : 'dias'}`;
    }
    if (safeDays < 365) {
        const months = Math.max(1, Math.round(safeDays / 30));
        return `${months} ${months === 1 ? 'mês' : 'meses'} (${safeDays}d)`;
    }
    const years = (safeDays / 365).toFixed(1).replace('.', ',');
    return `${years} anos (${safeDays}d)`;
}

function formatUnitDisplayName(student) {
    const raw = student?.branchName || student?.unitId || 'N/A';
    return raw
        .toString()
        .replace(/^KIHAP\s*-\s*/i, '')
        .trim() || 'N/A';
}

function matchesSelectedUnit(student, selectedUnit) {
    if (!selectedUnit || selectedUnit === 'geral' || selectedUnit === 'all') {
        return true;
    }
    const target = selectedUnit.toLowerCase().trim();
    const studentUnit = String(student?.unitId || '').toLowerCase().trim();
    if (studentUnit === target) return true;

    const normBranch = normalizeAnalysisText(student?.branchName)
        .replace(/^kihap\s*-\s*/, '')
        .trim()
        .replace(/\s+/g, '-');
    return normBranch === target;
}

function isStudentCurrentlyActive(student) {
    const s = String(student?.status ?? '').toLowerCase().trim();
    const ms = String(student?.membershipStatus ?? '').toLowerCase().trim();
    if (s === 'active' || s === 'ativo' || s === '1' || ms === 'active' || ms === 'ativo') {
        return true;
    }
    if (Array.isArray(student?.memberships)) {
        return student.memberships.some(m => String(m?.membershipStatus || '').toLowerCase() === 'active');
    }
    return false;
}

function getChurnPeriodBounds(periodKey) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (periodKey === '30d') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
        return { start, end };
    }
    if (periodKey === '90d') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90, 0, 0, 0, 0);
        return { start, end };
    }
    if (periodKey === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start, end };
    }
    if (periodKey === 'this_year') {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        return { start, end };
    }
    return { start: null, end: null };
}

function isDateWithinBounds(dateObj, bounds) {
    if (!bounds || (!bounds.start && !bounds.end)) return true;
    if (!dateObj || isNaN(dateObj.getTime())) return false;
    const ts = dateObj.getTime();
    if (bounds.start && ts < bounds.start.getTime()) return false;
    if (bounds.end && ts > bounds.end.getTime()) return false;
    return true;
}

function analyzeStudentContracts(student) {
    const rawMemberships = Array.isArray(student?.memberships) ? student.memberships : [];
    const realContracts = rawMemberships
        .filter(ms => ms && ms.startDate && !EXCLUDED_CONTRACT_REGEX.test(ms.name || ''))
        .map(ms => {
            const startDt = parseEvoDate(ms.startDate);
            const endDt = parseEvoDate(ms.cancelDate || ms.endDate || ms.startDate);
            const msStatus = String(ms.membershipStatus || '').toLowerCase();
            const wasCanceled = Boolean(ms.cancelDate || msStatus === 'canceled' || msStatus === 'cancelled');
            return {
                raw: ms,
                startDt,
                endDt,
                wasCanceled
            };
        })
        .filter(c => c.startDt !== null)
        .sort((a, b) => {
            const diff = a.startDt.getTime() - b.startDt.getTime();
            if (diff !== 0) return diff;
            return (Number(a.raw.idMemberMembership) || 0) - (Number(b.raw.idMemberMembership) || 0);
        });

    if (realContracts.length === 0) {
        return { hasContracts: false, isActive: isStudentCurrentlyActive(student), returnEvents: [], baixa: null };
    }

    const isActive = isStudentCurrentlyActive(student);
    const returnEvents = [];

    // Acompanha a cobertura máxima ativa até o momento para evitar falsos retornos em planos sobrepostos
    let maxCoverageEnd = realContracts[0].endDt;
    let lastCoveringContract = realContracts[0];

    for (let i = 1; i < realContracts.length; i++) {
        const curr = realContracts[i];
        if (maxCoverageEnd && curr.startDt) {
            const gapDays = Math.round((curr.startDt.getTime() - maxCoverageEnd.getTime()) / MS_PER_DAY);
            const isReturnTransition =
                gapDays > 30 ||
                (lastCoveringContract.wasCanceled && gapDays > 7 && !curr.raw.idMemberMembershipRenewed);

            if (isReturnTransition) {
                returnEvents.push({
                    baixaDate: maxCoverageEnd,
                    returnDate: curr.startDt,
                    gapDays: Math.max(0, gapDays),
                    prevPlan: lastCoveringContract.raw.name || 'Contrato anterior',
                    currentPlan: curr.raw.name || 'Novo contrato',
                    wasCanceled: lastCoveringContract.wasCanceled
                });
            }
        }

        if (curr.endDt && (!maxCoverageEnd || curr.endDt.getTime() > maxCoverageEnd.getTime())) {
            maxCoverageEnd = curr.endDt;
            lastCoveringContract = curr;
        }
    }

    let baixa = null;
    if (!isActive) {
        const orderedByEnd = [...realContracts].sort((a, b) => {
            const aTime = a.endDt ? a.endDt.getTime() : 0;
            const bTime = b.endDt ? b.endDt.getTime() : 0;
            return aTime - bTime;
        });
        const lastContract = orderedByEnd[orderedByEnd.length - 1];
        if (lastContract && lastContract.endDt) {
            baixa = {
                baixaDate: lastContract.endDt,
                lastPlan: lastContract.raw.name || 'N/A',
                wasCanceled: lastContract.wasCanceled
            };
        }
    }

    return {
        hasContracts: true,
        isActive,
        returnEvents,
        baixa
    };
}

function setupChurnAndReturnsPanel() {
    const periodFilter = document.getElementById('churn-period-filter');
    const searchInput = document.getElementById('churn-student-search');
    const tabReturns = document.getElementById('tab-returns-list');
    const tabChurn = document.getElementById('tab-churn-list');

    if (periodFilter) {
        periodFilter.addEventListener('change', () => {
            showAllChurnRows = false;
            renderChurnAndReturnsPanel();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            showAllChurnRows = false;
            renderChurnAndReturnsPanel();
        });
    }

    const updateTabStyles = () => {
        if (!tabReturns || !tabChurn) return;
        const activeClasses = ['bg-amber-400', 'text-black', 'shadow-sm'];
        const inactiveClasses = ['text-gray-600', 'dark:text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white'];

        if (activeChurnTab === 'returns') {
            tabReturns.classList.add(...activeClasses);
            tabReturns.classList.remove(...inactiveClasses);
            tabChurn.classList.remove(...activeClasses);
            tabChurn.classList.add(...inactiveClasses);
        } else {
            tabChurn.classList.add(...activeClasses);
            tabChurn.classList.remove(...inactiveClasses);
            tabReturns.classList.remove(...activeClasses);
            tabReturns.classList.add(...inactiveClasses);
        }
    };

    if (tabReturns) {
        tabReturns.addEventListener('click', () => {
            activeChurnTab = 'returns';
            showAllChurnRows = false;
            updateTabStyles();
            renderChurnAndReturnsPanel();
        });
    }

    if (tabChurn) {
        tabChurn.addEventListener('click', () => {
            activeChurnTab = 'churn';
            showAllChurnRows = false;
            updateTabStyles();
            renderChurnAndReturnsPanel();
        });
    }

    updateTabStyles();
}

async function loadEvoStudentsForAnalysis() {
    try {
        let studentList = [];
        try {
            const res = await listAlunosLocais({ unitId: 'all' });
            studentList = res.data || [];
        } catch (cfErr) {
            console.warn('[analysis] Fallback para leitura direta de evo_students:', cfErr);
            const snap = await getDocs(collection(db, 'evo_students'));
            studentList = snap.docs.map(d => {
                const data = d.data();
                data.idMember = data.idMember || d.id;
                return data;
            });
        }
        allEvoStudents = studentList;
        hasLoadedEvoStudents = true;
        renderChurnAndReturnsPanel();
    } catch (err) {
        console.error('[analysis] Erro ao carregar alunos para análise de baixas e retornos:', err);
        hasLoadedEvoStudents = true;
        const bodyEl = document.getElementById('churn-returns-table-body');
        if (bodyEl) {
            bodyEl.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Erro ao carregar contratos dos alunos: ${escapeHtml(err.message)}</td></tr>`;
        }
    }
}

async function handleSyncChurnContracts() {
    if (isSyncingContracts) return;

    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter ? locationFilter.value : 'geral';
    const targetUnit = (!selectedUnit || selectedUnit === 'geral') ? 'all' : selectedUnit;
    const unitLabel = targetUnit === 'all' ? 'todas as unidades' : `a unidade ${selectedUnit}`;

    if (!confirm(`Deseja sincronizar os contratos (memberships) do EVO para ${unitLabel}? Isso pode levar até 1 minuto.`)) {
        return;
    }

    const syncBtn = document.getElementById('sync-churn-contracts-btn');
    const syncIcon = document.getElementById('sync-churn-contracts-icon');
    const syncText = document.getElementById('sync-churn-contracts-text');

    isSyncingContracts = true;
    if (syncBtn) syncBtn.disabled = true;
    if (syncIcon) syncIcon.classList.add('fa-spin');
    if (syncText) syncText.textContent = 'Sincronizando...';

    try {
        const result = await syncEvoStudentsToCache({ unitId: targetUnit });
        const summary = result.data || {};
        alert(`Sincronização concluída! Unidades atualizadas: ${(summary.success || []).length}. Alunos processados: ${summary.totalStudents || 0}.`);
        await loadEvoStudentsForAnalysis();
    } catch (error) {
        console.error('[analysis] Erro ao sincronizar contratos EVO:', error);
        alert(`Erro ao sincronizar contratos: ${error.message}`);
    } finally {
        isSyncingContracts = false;
        if (syncBtn) syncBtn.disabled = false;
        if (syncIcon) syncIcon.classList.remove('fa-spin');
        if (syncText) syncText.textContent = 'Atualizar Contratos EVO';
    }
}

function renderChurnAndReturnsPanel() {
    const kpiContainer = document.getElementById('churn-returns-kpi-container');
    const tableHead = document.getElementById('churn-returns-table-head');
    const tableBody = document.getElementById('churn-returns-table-body');
    const tableFooter = document.getElementById('churn-returns-table-footer');
    const noticeEl = document.getElementById('churn-sync-notice');
    const noticeTextEl = document.getElementById('churn-sync-notice-text');
    const returnsCountBadge = document.getElementById('tab-returns-count');
    const churnCountBadge = document.getElementById('tab-churn-count');

    if (!kpiContainer || !tableHead || !tableBody) return;

    if (!hasLoadedEvoStudents) {
        kpiContainer.innerHTML = Array.from({ length: 4 }).map(() => `
            <div class="kpi-card bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl flex items-center gap-4 animate-pulse">
                <div class="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800"></div>
                <div class="space-y-2 flex-1">
                    <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
                    <div class="h-6 bg-gray-200 dark:bg-gray-800 rounded w-16"></div>
                </div>
            </div>
        `).join('');
        return;
    }

    const locationFilter = document.getElementById('location-filter');
    const periodFilter = document.getElementById('churn-period-filter');
    const searchInput = document.getElementById('churn-student-search');

    const selectedUnit = locationFilter ? locationFilter.value : 'geral';
    const selectedPeriod = periodFilter ? periodFilter.value : 'this_year';
    const searchTerm = normalizeAnalysisText(searchInput ? searchInput.value : '');
    const bounds = getChurnPeriodBounds(selectedPeriod);

    const unitStudents = allEvoStudents.filter(s => matchesSelectedUnit(s, selectedUnit));
    const studentsWithMemberships = unitStudents.filter(s => Array.isArray(s.memberships) && s.memberships.length > 0);

    if (noticeEl && noticeTextEl) {
        if (unitStudents.length === 0 || studentsWithMemberships.length === 0) {
            noticeTextEl.textContent = 'Os registros carregados para este filtro ainda não possuem o histórico completo de contratos (memberships) sincronizado do EVO.';
            noticeEl.classList.remove('hidden');
        } else if (studentsWithMemberships.length < unitStudents.length * 0.4) {
            noticeTextEl.textContent = `Apenas ${studentsWithMemberships.length} de ${unitStudents.length} alunos desta visão já possuem contratos carregados em cache. Clique em "Atualizar Contratos EVO" para sincronizar o histórico completo.`;
            noticeEl.classList.remove('hidden');
        } else {
            noticeEl.classList.add('hidden');
        }
    }

    let activeStudentsCount = 0;
    let activeReturnedCount = 0;
    let totalInactiveBaixasAllTime = 0;
    let returnedEverCount = 0;

    const baixasInPeriod = [];
    const returnsInPeriod = [];

    for (const student of unitStudents) {
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || `Aluno #${student.idMember}`;
        if (fullName.startsWith('***Dados')) continue;

        const analysis = analyzeStudentContracts(student);
        if (analysis.isActive) {
            activeStudentsCount++;
        }
        if (!analysis.hasContracts) continue;

        if (analysis.returnEvents.length > 0) {
            returnedEverCount++;
            if (analysis.isActive) {
                activeReturnedCount++;
            }

            const matchingReturns = analysis.returnEvents.filter(ev => isDateWithinBounds(ev.returnDate, bounds));
            if (matchingReturns.length > 0) {
                const latestReturn = matchingReturns[matchingReturns.length - 1];
                returnsInPeriod.push({
                    idMember: student.idMember,
                    unitId: student.unitId || '',
                    unitName: formatUnitDisplayName(student),
                    name: fullName,
                    isActive: analysis.isActive,
                    baixaDate: latestReturn.baixaDate,
                    returnDate: latestReturn.returnDate,
                    gapDays: latestReturn.gapDays,
                    prevPlan: latestReturn.prevPlan,
                    currentPlan: latestReturn.currentPlan
                });
            }
        }

        if (!analysis.isActive && analysis.baixa) {
            totalInactiveBaixasAllTime++;
            if (isDateWithinBounds(analysis.baixa.baixaDate, bounds)) {
                baixasInPeriod.push({
                    idMember: student.idMember,
                    unitId: student.unitId || '',
                    unitName: formatUnitDisplayName(student),
                    name: fullName,
                    lastPlan: analysis.baixa.lastPlan,
                    baixaDate: analysis.baixa.baixaDate,
                    wasCanceled: analysis.baixa.wasCanceled
                });
            }
        }
    }

    baixasInPeriod.sort((a, b) => b.baixaDate.getTime() - a.baixaDate.getTime());
    returnsInPeriod.sort((a, b) => b.returnDate.getTime() - a.returnDate.getTime());

    const canceledCount = baixasInPeriod.filter(b => b.wasCanceled).length;
    const expiredCount = baixasInPeriod.length - canceledCount;
    const avgGapDays = returnsInPeriod.length > 0
        ? Math.round(returnsInPeriod.reduce((sum, r) => sum + r.gapDays, 0) / returnsInPeriod.length)
        : 0;
    const totalEverBaixas = totalInactiveBaixasAllTime + returnedEverCount;
    const recoveryRate = totalEverBaixas > 0
        ? ((returnedEverCount / totalEverBaixas) * 100).toFixed(1).replace('.', ',')
        : '0,0';
    const activeReturnedPct = activeStudentsCount > 0
        ? ((activeReturnedCount / activeStudentsCount) * 100).toFixed(1).replace('.', ',')
        : '0,0';

    kpiContainer.innerHTML = `
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-5 rounded-2xl flex items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <i class="fas fa-user-minus text-lg"></i>
            </div>
            <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Baixas no Período</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${baixasInPeriod.length.toLocaleString('pt-BR')}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">${canceledCount} cancelamentos | ${expiredCount} expirados</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-5 rounded-2xl flex items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <i class="fas fa-undo-alt text-lg"></i>
            </div>
            <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Retornos no Período</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${returnsInPeriod.length.toLocaleString('pt-BR')}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Reativados após baixa anterior</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-5 rounded-2xl flex items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <i class="fas fa-user-check text-lg"></i>
            </div>
            <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Ativos Hoje que Retornaram</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${activeReturnedCount.toLocaleString('pt-BR')}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">${activeReturnedPct}% dos ${activeStudentsCount.toLocaleString('pt-BR')} ativos atuais</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-5 rounded-2xl flex items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <i class="fas fa-hourglass-half text-lg"></i>
            </div>
            <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Tempo Médio até Retorno</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${returnsInPeriod.length > 0 ? formatGapDuration(avgGapDays) : '-'}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Recuperação histórica: ${recoveryRate}%</p>
            </div>
        </div>
    `;

    const filteredReturns = searchTerm
        ? returnsInPeriod.filter(r =>
            normalizeAnalysisText(r.name).includes(searchTerm) ||
            normalizeAnalysisText(r.currentPlan).includes(searchTerm) ||
            normalizeAnalysisText(r.unitName).includes(searchTerm) ||
            String(r.idMember) === searchTerm
        )
        : returnsInPeriod;

    const filteredBaixas = searchTerm
        ? baixasInPeriod.filter(b =>
            normalizeAnalysisText(b.name).includes(searchTerm) ||
            normalizeAnalysisText(b.lastPlan).includes(searchTerm) ||
            normalizeAnalysisText(b.unitName).includes(searchTerm) ||
            String(b.idMember) === searchTerm
        )
        : baixasInPeriod;

    if (returnsCountBadge) returnsCountBadge.textContent = filteredReturns.length.toLocaleString('pt-BR');
    if (churnCountBadge) churnCountBadge.textContent = filteredBaixas.length.toLocaleString('pt-BR');

    const activeRows = activeChurnTab === 'returns' ? filteredReturns : filteredBaixas;
    const maxVisible = showAllChurnRows ? activeRows.length : 100;
    const rowsToRender = activeRows.slice(0, maxVisible);

    if (activeChurnTab === 'returns') {
        tableHead.innerHTML = `
            <tr>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Aluno</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Unidade</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Baixa Anterior</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Data do Retorno</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Tempo Afastado</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Contrato Atual / Retorno</th>
                <th scope="col" class="px-4 py-3 text-center text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Ficha</th>
            </tr>
        `;

        if (rowsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhum aluno com retorno encontrado para os filtros selecionados.</td></tr>`;
        } else {
            tableBody.innerHTML = rowsToRender.map(item => `
                <tr class="hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition">
                    <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        <div>${escapeHtml(item.name)}</div>
                        <div class="text-[10px] font-medium text-gray-400">ID: ${escapeHtml(item.idMember)} • ${item.isActive ? '<span class="text-emerald-600 dark:text-emerald-400">Ativo hoje</span>' : '<span class="text-gray-400">Inativo hoje</span>'}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">${escapeHtml(item.unitName)}</td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${formatDateBr(item.baixaDate)}</td>
                    <td class="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">${formatDateBr(item.returnDate)}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-bold text-[11px]">${formatGapDuration(item.gapDays)}</span>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <div class="font-medium">${escapeHtml(item.currentPlan)}</div>
                        <div class="text-[10px] text-gray-400">Anterior: ${escapeHtml(item.prevPlan)}</div>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <a href="aluno.html?id=${encodeURIComponent(item.idMember)}&unit=${encodeURIComponent(item.unitId)}" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition" title="Abrir Ficha do Aluno">
                            <i class="fas fa-external-link-alt text-xs"></i>
                        </a>
                    </td>
                </tr>
            `).join('');
        }
    } else {
        tableHead.innerHTML = `
            <tr>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Aluno</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Unidade</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Último Contrato</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Data da Baixa</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Motivo / Tipo</th>
                <th scope="col" class="px-4 py-3 text-center text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Ficha</th>
            </tr>
        `;

        if (rowsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhuma baixa encontrada para os filtros selecionados.</td></tr>`;
        } else {
            tableBody.innerHTML = rowsToRender.map(item => `
                <tr class="hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition">
                    <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        <div>${escapeHtml(item.name)}</div>
                        <div class="text-[10px] font-medium text-gray-400">ID: ${escapeHtml(item.idMember)}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">${escapeHtml(item.unitName)}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(item.lastPlan)}</td>
                    <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">${formatDateBr(item.baixaDate)}</td>
                    <td class="px-4 py-3">
                        ${item.wasCanceled
                            ? '<span class="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold text-[11px]">Cancelamento</span>'
                            : '<span class="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[11px]">Término de Contrato</span>'
                        }
                    </td>
                    <td class="px-4 py-3 text-center">
                        <a href="aluno.html?id=${encodeURIComponent(item.idMember)}&unit=${encodeURIComponent(item.unitId)}" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition" title="Abrir Ficha do Aluno">
                            <i class="fas fa-external-link-alt text-xs"></i>
                        </a>
                    </td>
                </tr>
            `).join('');
        }
    }

    if (tableFooter) {
        const hasMore = activeRows.length > rowsToRender.length;
        tableFooter.innerHTML = `
            <span>Exibindo ${rowsToRender.length.toLocaleString('pt-BR')} de ${activeRows.length.toLocaleString('pt-BR')} registros (base com contratos sincronizados: ${studentsWithMemberships.length.toLocaleString('pt-BR')} alunos)</span>
            ${hasMore ? '<button id="churn-show-all-btn" type="button" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Mostrar todos os registros</button>' : ''}
        `;
        const showAllBtn = document.getElementById('churn-show-all-btn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                showAllChurnRows = true;
                renderChurnAndReturnsPanel();
            });
        }
    }
}
