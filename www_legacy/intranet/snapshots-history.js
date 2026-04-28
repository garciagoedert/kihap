import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady } from './auth.js';

let snapshots = [];
let currentPage = 1;
const rowsPerPage = 15;

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(user => {
        loadComponents(initializeHistory);
    });
});

async function initializeHistory() {
    await fetchSnapshots();
    renderSnapshotLog();
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
        logBody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-gray-500">Nenhum snapshot encontrado.</td></tr>`;
        renderPagination(0);
        return;
    }

    logBody.innerHTML = paginatedSnapshots.map(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return `
            <tr class="hover:bg-[#2a2a2a]">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">${displayDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${item.totalContracts || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${item.totalDailyActives || 0}</td>
            </tr>
        `;
    }).join('');

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
        <span class="text-sm text-gray-400">
            Página ${currentPage} de ${totalPages}
        </span>
        <div class="flex items-center gap-2">
    `;

    // Previous Button
    paginationHTML += `
        <button id="prev-page-btn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
            Anterior
        </button>
    `;

    // Next Button
    paginationHTML += `
        <button id="next-page-btn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
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
