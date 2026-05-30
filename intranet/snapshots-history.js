import { app, db, functions } from './firebase-config.js';
import { collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady, checkAdminStatus } from './auth.js';

const deleteEvoSnapshot = httpsCallable(functions, 'deleteEvoSnapshot');

let snapshots = [];
let currentPage = 1;
const rowsPerPage = 15;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(async (user) => {
        if (user) {
            isAdmin = await checkAdminStatus(user);
        }
        loadComponents(initializeHistory);
    });
});

async function initializeHistory() {
    await fetchSnapshots();
    renderSnapshotLog();
    setupModal();
    document.getElementById('snapshot-search').addEventListener('input', (e) => {
        currentPage = 1;
        renderSnapshotLog(e.target.value);
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

    const filteredSnapshots = snapshots.filter(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return displayDate.includes(searchTerm);
    });

    const paginatedSnapshots = filteredSnapshots.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    if (paginatedSnapshots.length === 0) {
        logBody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum snapshot encontrado.</td></tr>`;
        renderPagination(0);
        return;
    }

    logBody.innerHTML = paginatedSnapshots.map(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return `
            <tr class="log-item cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition duration-150 border-b border-gray-100 dark:border-gray-800/50 last:border-0" data-id="${item.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">${displayDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${item.totalContracts || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${item.totalDailyActives || 0}</td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', handleViewSnapshot);
    });

    renderPagination(filteredSnapshots.length);
}

function renderPagination(totalItems) {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Página ${currentPage} de ${totalPages}
        </span>
        <div class="flex items-center gap-2">
    `;

    // Previous Button
    paginationHTML += `
        <button id="prev-page-btn" class="px-4 py-2 bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-xl transition duration-200 active:scale-95 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
            Anterior
        </button>
    `;

    // Next Button
    paginationHTML += `
        <button id="next-page-btn" class="px-4 py-2 bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-xl transition duration-200 active:scale-95 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
            Próxima
        </button>
    `;

    paginationHTML += `</div>`;
    paginationContainer.innerHTML = paginationHTML;

    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderSnapshotLog(document.getElementById('snapshot-search').value);
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderSnapshotLog(document.getElementById('snapshot-search').value);
        }
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
        
        // Close modal
        document.getElementById('snapshot-modal').classList.add('hidden');
        document.body.classList.remove('modal-active');

        // Remove local and re-render
        snapshots = snapshots.filter(s => s.id !== snapshotId);
        renderSnapshotLog(document.getElementById('snapshot-search').value);

    } catch (error) {
        console.error("Erro ao apagar snapshot:", error);
        alert(`Erro ao apagar snapshot: ${error.message}`);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Apagar Snapshot';
    }
}
