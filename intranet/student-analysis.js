import { app, db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady, checkAdminStatus } from './auth.js';

const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
const getActiveContractsCount = httpsCallable(functions, 'getActiveContractsCount');
const triggerSnapshot = httpsCallable(functions, 'triggerSnapshot');
const deleteEvoSnapshot = httpsCallable(functions, 'deleteEvoSnapshot');
const getTodaysTotalEntries = httpsCallable(functions, 'getTodaysTotalEntries');

let snapshots = [];
let isAdmin = false;

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
    locationFilter.addEventListener('change', () => {
        displayEvoKpi();
        displayDailyEntriesKpi();
    });

    await fetchSnapshots();
    renderSnapshotLog();
    renderEvolutionCharts();
    setupModal();
    document.getElementById('snapshot-search').addEventListener('input', (e) => {
        renderSnapshotLog(e.target.value);
    });
    displayEvoKpi();
    displayDailyEntriesKpi();

    document.getElementById('manual-snapshot-btn').addEventListener('click', async () => {
        try {
            alert('Gerando snapshot... Isso pode levar um minuto.');
            await triggerSnapshot();
            alert('Snapshot gerado com sucesso! A página será atualizada.');
            await fetchSnapshots();
            renderSnapshotLog();
        } catch (error) {
            console.error("Erro ao gerar snapshot manual:", error);
            alert(`Erro ao gerar snapshot: ${error.message}`);
        }
    });
}

async function populateFilters() {
    const locationFilter = document.getElementById('location-filter');
    
    try {
        const result = await getEvoUnits();
        const evoUnits = result.data.sort();
        
        evoUnits.forEach(unitId => {
            const option = document.createElement('option');
            option.value = unitId;
            const displayName = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            option.textContent = `Unidade ${displayName}`;
            locationFilter.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao buscar unidades do EVO:", error);
    }
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

    const filteredSnapshots = snapshots.filter(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return displayDate.includes(searchTerm);
    });

    if (filteredSnapshots.length === 0) {
        logBody.innerHTML = `<div class="text-center p-4 text-gray-500 md:col-span-3">Nenhum snapshot encontrado para "${searchTerm}".</div>`;
        return;
    }

    logBody.innerHTML = filteredSnapshots.map(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return `
            <tr class="log-item cursor-pointer hover:bg-[#2a2a2a]" data-id="${item.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">${displayDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${item.totalContracts || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${item.totalDailyActives || 0}</td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', handleViewSnapshot);
    });
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
        // Clonar e substituir o botão para remover event listeners antigos
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newDeleteBtn.addEventListener('click', () => handleDeleteSnapshot(docId));
    } else {
        deleteBtn.classList.add('hidden');
    }

    let tableHtml = `
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left text-gray-400">
                <thead class="text-xs text-gray-300 uppercase bg-[#2a2a2a]">
                    <tr>
                        <th scope="col" class="px-6 py-3">Unidade</th>
                        <th scope="col" class="px-6 py-3">Contratos Ativos</th>
                        <th scope="col" class="px-6 py-3">Alunos Ativos (Dia)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const unitId in snapshot.units) {
        const unitData = snapshot.units[unitId];
        const displayName = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        tableHtml += `
            <tr class="border-b border-gray-700">
                <th scope="row" class="px-6 py-4 font-medium text-white whitespace-nowrap">${displayName}</th>
                <td class="px-6 py-4">${unitData.contracts || 0}</td>
                <td class="px-6 py-4">${unitData.dailyActives || 0}</td>
            </tr>
        `;
    }

    tableHtml += `
                </tbody>
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
    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter.value;

    const oldCard = document.getElementById('evo-kpi-card');
    if (oldCard) oldCard.remove();

    const placeholderHtml = `
        <div id="evo-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-400 text-sm">Contratos Ativos (EVO)</p>
                <p class="text-2xl font-bold text-white">...</p>
            </div>
        </div>`;
    kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

    try {
        const result = await getActiveContractsCount({ unitId: selectedUnit });
        const counts = result.data;
        
        let label;
        let value;

        if (selectedUnit && selectedUnit !== 'geral') {
            const displayName = selectedUnit.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            label = `Contratos Ativos (${displayName})`;
            value = counts[selectedUnit] !== undefined ? counts[selectedUnit] : 0;
        } else {
            label = "Total de Contratos Ativos (EVO)";
            value = counts.totalGeral !== undefined ? counts.totalGeral : 0;
        }
        
        const finalHtml = `
            <div id="evo-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">📝</div>
                <div>
                    <p class="text-gray-400 text-sm">${label}</p>
                    <p class="text-2xl font-bold text-white">${value.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;
        
        const placeholderCard = document.getElementById('evo-kpi-card');
        if (placeholderCard) placeholderCard.outerHTML = finalHtml;

    } catch (error) {
        console.error("Erro ao carregar KPIs da EVO:", error);
        const errorHtml = `
            <div id="evo-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">⚠️</div>
                <div>
                    <p class="text-gray-400 text-sm">Contratos Ativos (EVO)</p>
                    <p class="text-xl font-bold text-red-500">Erro</p>
                </div>
            </div>
        `;
        const placeholderCard = document.getElementById('evo-kpi-card');
        if (placeholderCard) placeholderCard.outerHTML = errorHtml;
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
    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter.value;

    const oldCard = document.getElementById('daily-entries-kpi-card');
    if (oldCard) oldCard.remove();

    // Placeholder de carregamento
    const placeholderHtml = `
        <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center animate-pulse">
            <div class="text-3xl mr-4">🏃</div>
            <div>
                <p class="text-gray-400 text-sm">Total Alunos Ativos (Hoje)</p>
                <p class="text-2xl font-bold text-white">...</p>
            </div>
        </div>`;
    kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

    try {
        const result = await getTodaysTotalEntries({ unitId: selectedUnit });
        const totalAtivosHoje = result.data.totalEntries;
        
        let label;
        if (selectedUnit && selectedUnit !== 'geral') {
            const displayName = selectedUnit.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            label = `Alunos Ativos Hoje (${displayName})`;
        } else {
            label = "Total Alunos Ativos (Hoje)";
        }

        const finalHtml = `
            <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">🏃</div>
                <div>
                    <p class="text-gray-400 text-sm">${label}</p>
                    <p class="text-2xl font-bold text-white">${totalAtivosHoje.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;
        
        const placeholderCard = document.getElementById('daily-entries-kpi-card');
        if (placeholderCard) placeholderCard.outerHTML = finalHtml;

    } catch (error) {
        console.error("Erro ao carregar KPI de Alunos Ativos Hoje:", error);
        const errorHtml = `
            <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">⚠️</div>
                <div>
                    <p class="text-gray-400 text-sm">Total Alunos Ativos (Hoje)</p>
                    <p class="text-xl font-bold text-red-500">Erro</p>
                </div>
            </div>
        `;
        const placeholderCard = document.getElementById('daily-entries-kpi-card');
        if (placeholderCard) placeholderCard.outerHTML = errorHtml;
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

    // Configurações globais para os gráficos
    Chart.defaults.color = '#a0aec0'; // Cor do texto (cinza claro)
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)'; // Cor das bordas/grades

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
                        color: '#a0aec0',
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: '#a0aec0',
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
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
