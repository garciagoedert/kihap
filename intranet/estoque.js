import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { auth, db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Lógica específica da página de estoque
export async function setupEstoquePage() {
    if (!auth.currentUser) {
        return;
    }

    const unitFilter = document.getElementById('unit-filter');
    const searchInput = document.getElementById('search-input');
    const stockTableBody = document.getElementById('stock-table-body');
    const refreshButton = document.getElementById('refresh-stock');
    const addProductButton = document.getElementById('add-product');
    const modal = document.getElementById('stock-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const stockForm = document.getElementById('stock-form');
    const modalTitle = document.getElementById('modal-title');
    const stockIdField = document.getElementById('stock-id');
    const productNameField = document.getElementById('product-name');
    const productUnitField = document.getElementById('product-unit');
    const productQuantityField = document.getElementById('product-quantity');
    const productPriceField = document.getElementById('product-price');
    const productStatusField = document.getElementById('product-status');
    const deleteButton = document.getElementById('delete-stock-btn');

    let units = [];
    let allStockData = [];

    async function fetchEvoUnits() {
        try {
            const functions = getFunctions();
            const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
            const result = await getEvoUnits();
            return result.data;
        } catch (error) {
            console.error("Erro ao buscar unidades do EVO:", error);
            alert("Não foi possível carregar as unidades. Usando lista de fallback.");
            return ['centro', 'coqueiros', 'asa-sul', 'sudoeste', 'lago-sul'];
        }
    }

    async function fetchStockData() {
        const stockCol = collection(db, 'stock');
        const stockSnapshot = await getDocs(stockCol);
        allStockData = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStockData();
    }

    async function initializePage() {
        units = await fetchEvoUnits();
        populateUnitFilter(units);
        populateUnitFilter(units, productUnitField);
        await fetchStockData();
    }

    function populateUnitFilter(units = [], filterElement = unitFilter) {
        const currentValue = filterElement.value;
        filterElement.innerHTML = filterElement === unitFilter ? '<option value="geral">Visão Geral</option>' : '';
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace(/-/g, ' ');
            filterElement.appendChild(option);
        });
        filterElement.value = currentValue;
    }

    function renderStockData() {
        const unitFilterValue = unitFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        
        stockTableBody.innerHTML = '';

        let filteredData = allStockData;

        if (unitFilterValue !== 'geral') {
            filteredData = filteredData.filter(item => item.unit === unitFilterValue);
        }

        if (searchTerm) {
            filteredData = filteredData.filter(item => item.product.toLowerCase().includes(searchTerm));
        }

        if (filteredData.length === 0) {
            stockTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum item encontrado.</td></tr>';
            return;
        }

        filteredData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group';
            row.dataset.id = item.id;
            const getStatusClasses = (status) => {
                switch (status) {
                    case 'Em estoque':
                        return 'bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20';
                    case 'Estoque baixo':
                        return 'bg-yellow-100/50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-500/20';
                    case 'Fora de estoque':
                        return 'bg-red-100/50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-500/20';
                    default:
                        return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
                }
            };

            const price = (item.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            row.innerHTML = `
                <td class="p-6">
                    <div class="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${item.product}</div>
                    <div class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">ID: #${item.id.slice(-6)}</div>
                </td>
                <td class="p-6">
                    <span class="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-[10px] font-bold uppercase border border-gray-200 dark:border-gray-700">
                        ${item.unit}
                    </span>
                </td>
                <td class="p-6 font-bold text-gray-900 dark:text-white">${price}</td>
                <td class="p-6 text-center">
                    <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        ${item.quantity}
                    </span>
                </td>
                <td class="p-6 text-center">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusClasses(item.status)}">
                        ${item.status}
                    </span>
                </td>
            `;
            row.addEventListener('click', () => openModal(item));
            stockTableBody.appendChild(row);
        });
    }

    function openModal(stockItem = null) {
        stockForm.reset();
        if (stockItem) {
            modalTitle.textContent = 'Editar Produto';
            stockIdField.value = stockItem.id;
            productNameField.value = stockItem.product;
            productUnitField.value = stockItem.unit;
            productQuantityField.value = stockItem.quantity;
            productPriceField.value = stockItem.price;
            productStatusField.value = stockItem.status;
            deleteButton.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Adicionar Produto';
            stockIdField.value = '';
            deleteButton.classList.add('hidden');
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const stockId = stockIdField.value;
        const stockData = {
            product: productNameField.value,
            unit: productUnitField.value,
            quantity: parseInt(productQuantityField.value, 10),
            price: parseFloat(productPriceField.value),
            status: productStatusField.value,
        };

        try {
            if (stockId) {
                const stockRef = doc(db, 'stock', stockId);
                await setDoc(stockRef, stockData, { merge: true });
            } else {
                await addDoc(collection(db, 'stock'), stockData);
            }
            closeModal();
            fetchStockData();
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            alert("Não foi possível salvar o produto.");
        }
    }

    async function handleDelete() {
        const stockId = stockIdField.value;
        if (!stockId) return;

        if (confirm("Tem certeza que deseja excluir este produto?")) {
            try {
                await deleteDoc(doc(db, "stock", stockId));
                closeModal();
                fetchStockData();
            } catch (error) {
                console.error("Erro ao excluir produto:", error);
                alert("Não foi possível excluir o produto.");
            }
        }
    }

    // Event Listeners
    unitFilter.addEventListener('change', renderStockData);
    searchInput.addEventListener('input', renderStockData);
    refreshButton.addEventListener('click', fetchStockData);
    addProductButton.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    stockForm.addEventListener('submit', handleFormSubmit);
    deleteButton.addEventListener('click', handleDelete);

    initializePage();
}
