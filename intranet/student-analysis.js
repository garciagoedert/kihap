import { app, db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady } from './auth.js';

const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
const getActiveContractsCount = httpsCallable(functions, 'getActiveContractsCount');
const getDailyEntries = httpsCallable(functions, 'getDailyEntries');
const triggerSnapshot = httpsCallable(functions, 'triggerSnapshot');

let snapshots = [];

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(user => {
        loadComponents(initializeDashboard);
    });
});

async function initializeDashboard() {
    await populateFilters();
    
    const locationFilter = document.getElementById('location-filter');
    locationFilter.addEventListener('change', () => {
        displayEvoKpi();
        displayDailyEntriesKpi();
    });

    await fetchSnapshots();
    renderSnapshotLog();
    setupModal();
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

function renderSnapshotLog() {
    const logBody = document.getElementById('snapshot-log-body');
    if (!logBody) return;

    if (snapshots.length === 0) {
        logBody.innerHTML = `<div class="text-center p-4 text-gray-500 md:col-span-3">Nenhum snapshot encontrado.</div>`;
        return;
    }

    logBody.innerHTML = snapshots.map(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return `
            <div class="log-item cursor-pointer bg-[#2a2a2a] md:bg-transparent p-4 rounded-lg md:p-0 md:grid md:grid-cols-3 md:gap-4 md:px-6 md:py-4 md:border-b md:border-gray-700 hover:bg-[#3a3a3a]" data-id="${item.id}">
                <div class="hidden md:flex items-center text-sm text-gray-300">${displayDate}</div>
                <div class="hidden md:flex items-center text-sm text-gray-300">${item.totalContracts || 0}</div>
                <div class="hidden md:flex items-center text-sm text-gray-300">${item.totalDailyActives || 0}</div>
                <div class="flex justify-between md:hidden"><span class="font-bold text-gray-400">Data:</span><span class="text-gray-300">${displayDate}</span></div>
                <div class="flex justify-between md:hidden mt-2"><span class="font-bold text-gray-400">Total Contratos:</span><span class="text-gray-300">${item.totalContracts || 0}</span></div>
                <div class="flex justify-between md:hidden mt-2"><span class="font-bold text-gray-400">Total Alunos Ativos:</span><span class="text-gray-300">${item.totalDailyActives || 0}</span></div>
            </div>
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

async function displayDailyEntriesKpi() {
    const kpiContainer = document.getElementById('kpi-container');
    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter.value;

    const oldCard = document.getElementById('daily-entries-kpi-card');
    if (oldCard) oldCard.remove();

    const placeholderHtml = `
        <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center animate-pulse">
            <div class="text-3xl mr-4">🏃</div>
            <div>
                <p class="text-gray-400 text-sm">Alunos Ativos (Hoje)</p>
                <p class="text-2xl font-bold text-white">...</p>
            </div>
        </div>`;
    kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

    try {
        const today = new Date().toISOString().split('T')[0];
        let totalAtivosHoje = 0;
        let label = "Alunos Ativos (Hoje)";

        if (selectedUnit === 'geral') {
            label = "Total Alunos Ativos (Hoje)";
            const result = await getEvoUnits();
            const evoUnits = result.data;
            const promises = evoUnits.map(unitId => getDailyEntries({ unitId: unitId, date: today }));
            const results = await Promise.all(promises);
            results.forEach(result => {
                totalAtivosHoje += result.data.uniqueMembersCount;
            });
        } else {
            const result = await getDailyEntries({ unitId: selectedUnit, date: today });
            totalAtivosHoje = result.data.uniqueMembersCount;
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
        console.error("Erro ao carregar KPI de entradas diárias:", error);
        const errorHtml = `
            <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">⚠️</div>
                <div>
                    <p class="text-gray-400 text-sm">Alunos Ativos (Hoje)</p>
                    <p class="text-xl font-bold text-red-500">Erro</p>
                </div>
            </div>
        `;
        const placeholderCard = document.getElementById('daily-entries-kpi-card');
        if (placeholderCard) placeholderCard.outerHTML = errorHtml;
    }
}
