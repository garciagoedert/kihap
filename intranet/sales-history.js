import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady } from './auth.js';

let allSales = [];
let allProducts = [];
let currentPage = 1;
const rowsPerPage = 15;

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(user => {
        loadComponents(initializeHistory);
    });
});

async function initializeHistory() {
    await fetchProducts();
    await fetchSales();
    populateFilters();
    applyFilters();

    const searchInput = document.getElementById('search-input');
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');
    const dateFilter = document.getElementById('filter-date');
    const syncBtn = document.getElementById('sync-status-btn');

    [searchInput, unitFilter, productFilter, dateFilter].forEach(el => {
        el.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
        if (el.tagName === 'INPUT') {
            el.addEventListener('keyup', () => {
                currentPage = 1;
                applyFilters();
            });
        }
    });

    syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-2"></i>Sincronizando...';
        
        try {
            const functions = getFunctions();
            const fixOldSalesStatus = httpsCallable(functions, 'fixOldSalesStatus');
            const result = await fixOldSalesStatus();
            alert(result.data.message);
            // Recarregar os dados para refletir as atualizações
            await fetchSales();
            applyFilters();
        } catch (error) {
            console.error('Erro ao sincronizar status:', error);
            alert(`Erro: ${error.message}`);
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Sincronizar Status';
        }
    });
}

async function fetchProducts() {
    try {
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

async function fetchSales() {
    try {
        const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'desc'));
        const querySnapshot = await getDocs(q);
        const salesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const salesBySession = salesData.reduce((acc, sale) => {
            const key = sale.checkoutSessionId || sale.id;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(sale);
            return acc;
        }, {});

        allSales = Object.values(salesBySession);
    } catch (error) {
        console.error('Error fetching sales:', error);
    }
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');
    const dateFilter = document.getElementById('filter-date');

    const searchTerm = searchInput.value.toLowerCase();
    const selectedUnit = unitFilter.value;
    const selectedProduct = productFilter.value;
    const selectedDate = dateFilter.value;

    let filteredGroups = allSales.filter(group => {
        return group.some(sale => {
            const nameMatch = !searchTerm || (sale.userName && sale.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm));
            const unitMatch = !selectedUnit || sale.userUnit === selectedUnit;
            const productMatch = !selectedProduct || sale.productId === selectedProduct;

            let dateMatch = true;
            if (selectedDate && sale.created) {
                const saleDate = sale.created.toDate().toISOString().split('T')[0];
                dateMatch = saleDate === selectedDate;
            }

            return (nameMatch || emailMatch) && unitMatch && productMatch && dateMatch;
        });
    });

    renderSalesLog(filteredGroups);
}

function renderSalesLog(groupsToDisplay) {
    const logBody = document.getElementById('sales-table-body');
    if (!logBody) return;

    const paginatedGroups = groupsToDisplay.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    if (paginatedGroups.length === 0) {
        logBody.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-gray-500">Nenhuma venda encontrada.</td></tr>`;
        renderPagination(0);
        return;
    }

    logBody.innerHTML = paginatedGroups.map(group => {
        const mainSale = group[0];
        const totalAmount = group.reduce((sum, sale) => sum + sale.amountTotal, 0);
        const date = mainSale.created ? new Date(mainSale.created.toDate()).toLocaleString('pt-BR') : 'N/A';
        const amount = (totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: mainSale.currency || 'BRL' });
        const status = renderStatusTag(mainSale.paymentStatus);
        const productName = group.length > 1 ? `${mainSale.productName} (x${group.length})` : mainSale.productName;
        
        const namesList = group.map(sale => sale.userName || 'N/A').join('<br>');
        const emailsList = group.map(sale => sale.userEmail || 'N/A').join('<br>');
        const phonesList = group.map(sale => sale.userPhone || 'N/A').join('<br>');

        // Verifica se pelo menos um e-mail no grupo foi enviado
        const emailSentIcon = group.some(sale => sale.emailSent) 
            ? '<i class="fas fa-check-circle text-green-500"></i>' 
            : '<i class="fas fa-times-circle text-red-500"></i>';

        return `
            <tr class="hover:bg-[#2a2a2a]">
                <td class="p-4">${namesList}</td>
                <td class="p-4">${emailsList}</td>
                <td class="p-4">${phonesList}</td>
                <td class="p-4">${productName}</td>
                <td class="p-4">${mainSale.userPrograma || 'N/A'}</td>
                <td class="p-4">${mainSale.userGraduacao || 'N/A'}</td>
                <td class="p-4">${amount}</td>
                <td class="p-4">${status}</td>
                <td class="p-4 text-center">${emailSentIcon}</td>
                <td class="p-4">${date}</td>
            </tr>
        `;
    }).join('');

    renderPagination(groupsToDisplay.length);
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

    paginationHTML += `
        <button id="prev-page-btn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
            Anterior
        </button>
    `;

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
            applyFilters();
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });
}

function populateFilters() {
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');

    const units = [...new Set(allSales.map(sale => sale.userUnit).filter(Boolean))];
    unitFilter.innerHTML = '<option value="">Todas as Unidades</option>';
    units.sort().forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
        unitFilter.appendChild(option);
    });

    productFilter.innerHTML = '<option value="">Todos os Produtos</option>';
    allProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        productFilter.appendChild(option);
    });
}

const renderStatusTag = (status) => {
    if (!status) return 'N/A';
    const statusText = status === 'paid' ? 'Pago' : 'Pendente';
    const colorClasses = status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400';
    return `<span class="px-2 py-1 rounded-full text-xs font-medium ${colorClasses}">${statusText}</span>`;
};
