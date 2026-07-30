import { auth, db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    setDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc,
    query,
    orderBy,
    limit,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global state
let allProducts = [];
let allCDs = [];
let allCategories = new Set();

export async function setupEstoquePage() {
    if (!auth.currentUser) {
        return;
    }

    // DOM Elements - Main Page
    const searchInput = document.getElementById('search-input');
    const cdFilter = document.getElementById('cd-filter');
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    const stockTableBody = document.getElementById('stock-table-body');

    // KPI Elements
    const kpiTotalItems = document.getElementById('kpi-total-items');
    const kpiTotalValue = document.getElementById('kpi-total-value');
    const kpiLowStock = document.getElementById('kpi-low-stock');
    const kpiActiveCDs = document.getElementById('kpi-active-cds');

    // Modal Triggers
    const manageCdsBtn = document.getElementById('manage-cds-btn');
    const transferStockBtn = document.getElementById('transfer-stock-btn');
    const historyStockBtn = document.getElementById('history-stock-btn');
    const adjustStockBtn = document.getElementById('adjust-stock-btn');

    // Modals
    const modalManageCds = document.getElementById('modal-manage-cds');
    const closeModalCds = document.getElementById('close-modal-cds');
    const formAddCd = document.getElementById('form-add-cd');
    const cdNameInput = document.getElementById('cd-name-input');
    const cdCodeInput = document.getElementById('cd-code-input');
    const cdsListContainer = document.getElementById('cds-list-container');

    const modalAdjustStock = document.getElementById('modal-adjust-stock');
    const closeModalAdjust = document.getElementById('close-modal-adjust');
    const formAdjustStock = document.getElementById('form-adjust-stock');
    const adjustProductSelect = document.getElementById('adjust-product-select');
    const adjustCdSelect = document.getElementById('adjust-cd-select');
    const adjustTypeSelect = document.getElementById('adjust-type-select');
    const adjustSizeInput = document.getElementById('adjust-size-input');
    const adjustQuantityInput = document.getElementById('adjust-quantity-input');
    const adjustReasonInput = document.getElementById('adjust-reason-input');

    const modalTransferStock = document.getElementById('modal-transfer-stock');
    const closeModalTransfer = document.getElementById('close-modal-transfer');
    const formTransferStock = document.getElementById('form-transfer-stock');
    const transferProductSelect = document.getElementById('transfer-product-select');
    const transferFromCdSelect = document.getElementById('transfer-from-cd-select');
    const transferToCdSelect = document.getElementById('transfer-to-cd-select');
    const transferSizeInput = document.getElementById('transfer-size-input');
    const transferQuantityInput = document.getElementById('transfer-quantity-input');
    const transferReasonInput = document.getElementById('transfer-reason-input');

    const modalHistoryStock = document.getElementById('modal-history-stock');
    const closeModalHistory = document.getElementById('close-modal-history');
    const historyTableBody = document.getElementById('history-table-body');

    // Helper: Normalize Price
    function parsePrice(price) {
        if (!price && price !== 0) return 0;
        let num = typeof price === 'number' ? price : parseFloat(price);
        if (isNaN(num)) return 0;
        // Handle centavos format if legacy stored as 15000 for 150.00
        if (num >= 1000 && Number.isInteger(num)) {
            // Check if it's likely centavos
            num = num / 100;
        }
        return num;
    }

    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // 1. Fetch CDs
    async function fetchCDs() {
        try {
            const cdCol = collection(db, 'distribution_centers');
            const cdSnap = await getDocs(cdCol);

            if (cdSnap.empty) {
                // Initialize Default CDs
                const defaultCDs = [
                    { name: 'CD Principal - Florianópolis', code: 'CD-FLN', active: true, createdAt: new Date().toISOString() },
                    { name: 'CD Brasília', code: 'CD-BSB', active: true, createdAt: new Date().toISOString() },
                    { name: 'CD Dourados', code: 'CD-DOU', active: true, createdAt: new Date().toISOString() }
                ];

                for (const cdData of defaultCDs) {
                    await addDoc(cdCol, cdData);
                }
                const newSnap = await getDocs(cdCol);
                allCDs = newSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } else {
                allCDs = cdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            renderCDSelects();
            renderCDsList();
            kpiActiveCDs.textContent = allCDs.filter(c => c.active !== false).length;
        } catch (error) {
            console.error("Erro ao buscar CDs:", error);
        }
    }

    function renderCDSelects() {
        const activeCDs = allCDs.filter(c => c.active !== false);

        // CD Filter Select
        cdFilter.innerHTML = '<option value="">Todos os CDs</option>';
        activeCDs.forEach(cd => {
            cdFilter.innerHTML += `<option value="${cd.id}">${cd.name} (${cd.code})</option>`;
        });

        // Adjust CD Select
        adjustCdSelect.innerHTML = '';
        activeCDs.forEach(cd => {
            adjustCdSelect.innerHTML += `<option value="${cd.id}">${cd.name} (${cd.code})</option>`;
        });

        // Transfer CD Selects
        transferFromCdSelect.innerHTML = '';
        transferToCdSelect.innerHTML = '';
        activeCDs.forEach(cd => {
            transferFromCdSelect.innerHTML += `<option value="${cd.id}">${cd.name} (${cd.code})</option>`;
            transferToCdSelect.innerHTML += `<option value="${cd.id}">${cd.name} (${cd.code})</option>`;
        });
    }

    function renderCDsList() {
        if (!cdsListContainer) return;
        cdsListContainer.innerHTML = '';

        if (allCDs.length === 0) {
            cdsListContainer.innerHTML = '<div class="text-xs text-gray-400">Nenhum CD cadastrado.</div>';
            return;
        }

        allCDs.forEach(cd => {
            const isActive = cd.active !== false;
            const card = document.createElement('div');
            card.className = 'flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 text-xs';
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'} flex items-center justify-center font-bold text-xs">
                        <i class="fas fa-warehouse"></i>
                    </div>
                    <div>
                        <div class="font-bold text-gray-900 dark:text-white">${cd.name}</div>
                        <div class="text-[10px] text-gray-400 font-mono">Código: ${cd.code}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${isActive ? 'bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}">
                        ${isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <button data-cd-id="${cd.id}" data-active="${isActive}" class="toggle-cd-btn p-1.5 text-gray-400 hover:text-purple-600 transition-colors">
                        <i class="fas ${isActive ? 'fa-toggle-on text-purple-600 text-lg' : 'fa-toggle-off text-gray-400 text-lg'}"></i>
                    </button>
                </div>
            `;

            card.querySelector('.toggle-cd-btn').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const cdId = btn.dataset.cdId;
                const currentActive = btn.dataset.active === 'true';
                try {
                    await updateDoc(doc(db, 'distribution_centers', cdId), { active: !currentActive });
                    await fetchCDs();
                } catch (err) {
                    console.error("Erro ao alterar status do CD:", err);
                }
            });

            cdsListContainer.appendChild(card);
        });
    }

    // 2. Fetch Products
    async function fetchProductsStock() {
        try {
            const productsCol = collection(db, 'products');
            const productsSnap = await getDocs(productsCol);
            allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Populate categories
            allCategories.clear();
            categoryFilter.innerHTML = '<option value="">Todas as Categorias</option>';
            allProducts.forEach(p => {
                if (p.category) allCategories.add(p.category);
            });
            allCategories.forEach(cat => {
                categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
            });

            // Populate modal product selects
            adjustProductSelect.innerHTML = '';
            transferProductSelect.innerHTML = '';
            allProducts.forEach(p => {
                const opt = `<option value="${p.id}">${p.name || 'Produto sem nome'} (R$ ${parsePrice(p.price).toFixed(2)})</option>`;
                adjustProductSelect.innerHTML += opt;
                transferProductSelect.innerHTML += opt;
            });

            renderKPIs();
            renderStockTable();
        } catch (error) {
            console.error("Erro ao buscar produtos da Store:", error);
            stockTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Erro ao carregar produtos do estoque.</td></tr>`;
        }
    }

    // Calculate & Render KPIs
    function renderKPIs() {
        let totalItems = 0;
        let totalValue = 0;
        let lowStockCount = 0;

        allProducts.forEach(p => {
            const cdStock = p.cdStock || {};
            let productTotalQty = 0;

            if (Object.keys(cdStock).length > 0) {
                Object.values(cdStock).forEach(cdData => {
                    productTotalQty += (cdData.total || 0);
                });
            } else {
                productTotalQty = parseInt(p.stockQuantity || p.quantity || 0, 10);
            }

            totalItems += productTotalQty;
            totalValue += (productTotalQty * parsePrice(p.price));

            if (productTotalQty <= 5) {
                lowStockCount++;
            }
        });

        kpiTotalItems.textContent = totalItems.toLocaleString('pt-BR');
        kpiTotalValue.textContent = formatCurrency(totalValue);
        kpiLowStock.textContent = lowStockCount;
    }

    // Render Table Data
    function renderStockTable() {
        const searchTerm = (searchInput.value || '').toLowerCase();
        const selectedCd = cdFilter.value;
        const selectedCategory = categoryFilter.value;
        const selectedStatus = statusFilter.value;

        stockTableBody.innerHTML = '';

        let filteredProducts = allProducts.filter(p => {
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const matchesSearch = !searchTerm || name.includes(searchTerm) || category.includes(searchTerm);
            const matchesCategory = !selectedCategory || p.category === selectedCategory;

            // Calculate product stock quantity for selected CD or total
            const cdStock = p.cdStock || {};
            let qty = 0;
            if (selectedCd) {
                qty = cdStock[selectedCd]?.total || 0;
            } else {
                if (Object.keys(cdStock).length > 0) {
                    Object.values(cdStock).forEach(cd => qty += (cd.total || 0));
                } else {
                    qty = parseInt(p.stockQuantity || p.quantity || 0, 10);
                }
            }

            const matchesCd = !selectedCd || (cdStock[selectedCd] && cdStock[selectedCd].total > 0);

            let statusKey = 'instock';
            if (qty === 0) statusKey = 'outofstock';
            else if (qty <= 5) statusKey = 'lowstock';

            const matchesStatus = !selectedStatus || statusKey === selectedStatus;

            return matchesSearch && matchesCategory && matchesCd && matchesStatus;
        });

        if (filteredProducts.length === 0) {
            stockTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-12 text-gray-400">
                        <i class="fas fa-box-open text-3xl mb-2 block text-gray-300 dark:text-gray-700"></i>
                        Nenhum produto encontrado com os filtros aplicados.
                    </td>
                </tr>
            `;
            return;
        }

        filteredProducts.forEach(p => {
            const cdStock = p.cdStock || {};
            const activeCDs = allCDs.filter(c => c.active !== false);

            let totalQty = 0;
            let cdBadgesHtml = '';

            if (Object.keys(cdStock).length > 0) {
                activeCDs.forEach(cd => {
                    const cdData = cdStock[cd.id];
                    const cdQty = cdData?.total || 0;
                    totalQty += cdQty;

                    if (cdQty > 0 || selectedCd === cd.id) {
                        const isHighlight = selectedCd === cd.id;
                        cdBadgesHtml += `
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${isHighlight ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}">
                                <i class="fas fa-warehouse text-[9px] text-gray-400"></i> ${cd.code || cd.name}: <strong class="text-gray-900 dark:text-white">${cdQty}</strong>
                            </span>
                        `;
                    }
                });
            } else {
                totalQty = parseInt(p.stockQuantity || p.quantity || 0, 10);
                const firstCd = activeCDs[0];
                if (firstCd && totalQty > 0) {
                    cdBadgesHtml = `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                            <i class="fas fa-warehouse text-[9px] text-gray-400"></i> ${firstCd.code || firstCd.name}: <strong class="text-gray-900 dark:text-white">${totalQty}</strong>
                        </span>
                    `;
                }
            }

            if (!cdBadgesHtml) {
                cdBadgesHtml = `<span class="text-[10px] text-gray-400 italic">Sem estoque alocado</span>`;
            }

            // Status Badge
            let statusBadge = '';
            if (totalQty === 0) {
                statusBadge = `<span class="inline-block whitespace-nowrap px-3 py-1 bg-red-100/50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full text-[10px] font-bold uppercase border border-red-200/50">Fora de Estoque</span>`;
            } else if (totalQty <= 5) {
                statusBadge = `<span class="inline-block whitespace-nowrap px-3 py-1 bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold uppercase border border-amber-200/50">Estoque Baixo</span>`;
            } else {
                statusBadge = `<span class="inline-block whitespace-nowrap px-3 py-1 bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase border border-emerald-200/50">Em Estoque</span>`;
            }

            const rawImageUrl = (p.imageUrl || p.image || '').trim();
            let imgHtml = '';
            if (rawImageUrl) {
                imgHtml = `
                    <div class="relative w-10 h-10 shrink-0">
                        <img src="${rawImageUrl}" alt="${p.name}" class="w-10 h-10 rounded-xl object-cover bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex');">
                        <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 shrink-0 hidden items-center justify-center font-bold text-sm">
                            <i class="fas fa-box text-xs"></i>
                        </div>
                    </div>
                `;
            } else {
                imgHtml = `
                    <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 shrink-0 flex items-center justify-center font-bold text-sm">
                        <i class="fas fa-box text-xs"></i>
                    </div>
                `;
            }

            const priceFormatted = formatCurrency(parsePrice(p.price));

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors text-xs';
            tr.innerHTML = `
                <td class="p-4">
                    <div class="flex items-center gap-3 min-w-[180px]">
                        ${imgHtml}
                        <div>
                            <div class="font-bold text-gray-900 dark:text-white text-sm line-clamp-2">${p.name || 'Sem nome'}</div>
                            <div class="text-[10px] text-gray-400 font-mono">ID: #${p.id.slice(-6)}</div>
                        </div>
                    </div>
                </td>
                <td class="p-4 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    <span class="inline-block whitespace-nowrap px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] font-bold uppercase">
                        ${p.category || 'Geral'}
                    </span>
                </td>
                <td class="p-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">${priceFormatted}</td>
                <td class="p-4">
                    <div class="flex flex-wrap gap-1.5 max-w-xs">
                        ${cdBadgesHtml}
                    </div>
                </td>
                <td class="p-4 text-center font-black text-sm text-gray-900 dark:text-white whitespace-nowrap">
                    <span class="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        ${totalQty}
                    </span>
                </td>
                <td class="p-4 text-center whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5">
                        <button data-product-id="${p.id}" class="action-adjust-btn h-8 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap">
                            <i class="fas fa-plus-minus"></i>
                            <span>Entrada / Saída</span>
                        </button>
                        <button data-product-id="${p.id}" class="action-transfer-btn h-8 px-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-purple-200 dark:border-purple-800 inline-flex items-center gap-1.5 whitespace-nowrap">
                            <i class="fas fa-exchange-alt"></i>
                            <span>Transferir</span>
                        </button>
                    </div>
                </td>
            `;

            tr.querySelector('.action-adjust-btn').addEventListener('click', () => {
                adjustProductSelect.value = p.id;
                modalAdjustStock.classList.remove('hidden');
                modalAdjustStock.classList.add('flex');
            });

            tr.querySelector('.action-transfer-btn').addEventListener('click', () => {
                transferProductSelect.value = p.id;
                modalTransferStock.classList.remove('hidden');
                modalTransferStock.classList.add('flex');
            });

            stockTableBody.appendChild(tr);
        });
    }

    // 3. Handle Add CD
    formAddCd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = cdNameInput.value.trim();
        const code = cdCodeInput.value.trim().toUpperCase();

        if (!name || !code) return;

        try {
            await addDoc(collection(db, 'distribution_centers'), {
                name,
                code,
                active: true,
                createdAt: new Date().toISOString()
            });

            cdNameInput.value = '';
            cdCodeInput.value = '';
            await fetchCDs();
        } catch (error) {
            console.error("Erro ao cadastrar CD:", error);
            alert("Erro ao cadastrar CD.");
        }
    });

    // 4. Handle Stock Adjustment (Entry / Exit)
    formAdjustStock.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = adjustProductSelect.value;
        const cdId = adjustCdSelect.value;
        const type = adjustTypeSelect.value; // 'entry' or 'exit'
        const size = (adjustSizeInput.value || '').trim().toUpperCase();
        const qty = parseInt(adjustQuantityInput.value, 10);
        const reason = adjustReasonInput.value.trim();

        if (!productId || !cdId || !qty || qty <= 0) {
            alert("Preencha todos os campos corretamente.");
            return;
        }

        try {
            const productRef = doc(db, 'products', productId);
            const productSnap = await getDoc(productRef);

            if (!productSnap.exists()) {
                alert("Produto não encontrado.");
                return;
            }

            const pData = productSnap.data();
            const cdStock = pData.cdStock || {};
            const cdData = cdStock[cdId] || { total: 0, sizes: {} };

            let currentCdTotal = cdData.total || 0;
            let currentSizeQty = (cdData.sizes && cdData.sizes[size]) || 0;

            if (type === 'entry') {
                currentCdTotal += qty;
                if (size) {
                    if (!cdData.sizes) cdData.sizes = {};
                    cdData.sizes[size] = currentSizeQty + qty;
                }
            } else {
                if (currentCdTotal < qty) {
                    alert(`Saldo insuficiente neste CD. Saldo atual: ${currentCdTotal}`);
                    return;
                }
                currentCdTotal -= qty;
                if (size && cdData.sizes && cdData.sizes[size]) {
                    cdData.sizes[size] = Math.max(0, cdData.sizes[size] - qty);
                }
            }

            cdStock[cdId] = {
                total: currentCdTotal,
                sizes: cdData.sizes || {}
            };

            // Recalculate total product stock
            let newTotalStock = 0;
            Object.values(cdStock).forEach(cd => {
                newTotalStock += (cd.total || 0);
            });

            await updateDoc(productRef, {
                cdStock: cdStock,
                stockQuantity: newTotalStock,
                controlStock: true
            });

            // Log movement
            await addDoc(collection(db, 'stock_movements'), {
                productId,
                productName: pData.name || 'Produto',
                type,
                toCdId: type === 'entry' ? cdId : null,
                fromCdId: type === 'exit' ? cdId : null,
                size: size || null,
                quantity: qty,
                reason,
                createdByName: auth.currentUser.displayName || auth.currentUser.email || 'Usuário',
                createdByUid: auth.currentUser.uid,
                createdAt: new Date().toISOString()
            });

            modalAdjustStock.classList.add('hidden');
            modalAdjustStock.classList.remove('flex');
            formAdjustStock.reset();

            await fetchProductsStock();
        } catch (error) {
            console.error("Erro ao movimentar estoque:", error);
            alert("Erro ao movimentar estoque.");
        }
    });

    // 5. Handle Stock Transfer between CDs
    formTransferStock.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = transferProductSelect.value;
        const fromCdId = transferFromCdSelect.value;
        const toCdId = transferToCdSelect.value;
        const size = (transferSizeInput.value || '').trim().toUpperCase();
        const qty = parseInt(transferQuantityInput.value, 10);
        const reason = transferReasonInput.value.trim();

        if (fromCdId === toCdId) {
            alert("O CD de origem e de destino não podem ser iguais.");
            return;
        }

        try {
            const productRef = doc(db, 'products', productId);
            const productSnap = await getDoc(productRef);

            if (!productSnap.exists()) {
                alert("Produto não encontrado.");
                return;
            }

            const pData = productSnap.data();
            const cdStock = pData.cdStock || {};
            const fromData = cdStock[fromCdId] || { total: 0, sizes: {} };
            const toData = cdStock[toCdId] || { total: 0, sizes: {} };

            if ((fromData.total || 0) < qty) {
                alert(`Saldo insuficiente no CD de Origem. Saldo atual: ${fromData.total || 0}`);
                return;
            }

            // Decrement From CD
            fromData.total -= qty;
            if (size && fromData.sizes && fromData.sizes[size]) {
                fromData.sizes[size] = Math.max(0, fromData.sizes[size] - qty);
            }

            // Increment To CD
            toData.total = (toData.total || 0) + qty;
            if (size) {
                if (!toData.sizes) toData.sizes = {};
                toData.sizes[size] = (toData.sizes[size] || 0) + qty;
            }

            cdStock[fromCdId] = fromData;
            cdStock[toCdId] = toData;

            await updateDoc(productRef, { cdStock });

            // Log movement
            await addDoc(collection(db, 'stock_movements'), {
                productId,
                productName: pData.name || 'Produto',
                type: 'transfer',
                fromCdId,
                toCdId,
                size: size || null,
                quantity: qty,
                reason,
                createdByName: auth.currentUser.displayName || auth.currentUser.email || 'Usuário',
                createdByUid: auth.currentUser.uid,
                createdAt: new Date().toISOString()
            });

            modalTransferStock.classList.add('hidden');
            modalTransferStock.classList.remove('flex');
            formTransferStock.reset();

            await fetchProductsStock();
        } catch (error) {
            console.error("Erro ao transferir estoque:", error);
            alert("Erro ao realizar transferência.");
        }
    });

    // 6. Fetch Movement History
    async function fetchHistory() {
        historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando histórico...</td></tr>`;

        try {
            const movementsCol = collection(db, 'stock_movements');
            const q = query(movementsCol, orderBy('createdAt', 'desc'), limit(50));
            const snap = await getDocs(q);

            if (snap.empty) {
                historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400">Nenhuma movimentação registrada até o momento.</td></tr>`;
                return;
            }

            historyTableBody.innerHTML = '';
            snap.docs.forEach(docSnap => {
                const m = docSnap.data();
                const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleString('pt-BR') : '--';
                
                let typeBadge = '';
                if (m.type === 'entry') {
                    typeBadge = `<span class="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-md uppercase text-[10px]">➕ Entrada</span>`;
                } else if (m.type === 'exit') {
                    typeBadge = `<span class="px-2.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold rounded-md uppercase text-[10px]">➖ Saída</span>`;
                } else {
                    typeBadge = `<span class="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold rounded-md uppercase text-[10px]">⇄ Transferência</span>`;
                }

                const fromCdObj = allCDs.find(c => c.id === m.fromCdId);
                const toCdObj = allCDs.find(c => c.id === m.toCdId);

                let cdFlowStr = '--';
                if (m.type === 'entry') {
                    cdFlowStr = `➔ ${toCdObj ? toCdObj.name : 'CD'}`;
                } else if (m.type === 'exit') {
                    cdFlowStr = `${fromCdObj ? fromCdObj.name : 'CD'} ➔ (Saída)`;
                } else {
                    cdFlowStr = `${fromCdObj ? fromCdObj.code : 'CD'} ➔ ${toCdObj ? toCdObj.code : 'CD'}`;
                }

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors';
                tr.innerHTML = `
                    <td class="p-3.5 text-gray-500 dark:text-gray-400 font-mono text-[11px]">${dateStr}</td>
                    <td class="p-3.5 font-bold text-gray-900 dark:text-white">${m.productName || 'Produto'} ${m.size ? `(${m.size})` : ''}</td>
                    <td class="p-3.5">${typeBadge}</td>
                    <td class="p-3.5 font-medium text-gray-700 dark:text-gray-300">${cdFlowStr}</td>
                    <td class="p-3.5 text-center font-black text-gray-900 dark:text-white">${m.quantity}</td>
                    <td class="p-3.5 text-gray-600 dark:text-gray-400 text-[11px]">${m.reason || '--'}</td>
                    <td class="p-3.5 text-gray-500 dark:text-gray-400 text-[11px]">${m.createdByName || 'Usuário'}</td>
                `;
                historyTableBody.appendChild(tr);
            });

        } catch (error) {
            console.error("Erro ao buscar histórico de estoque:", error);
            historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Erro ao carregar histórico.</td></tr>`;
        }
    }

    // Modal Event Listeners
    manageCdsBtn.addEventListener('click', () => {
        renderCDsList();
        modalManageCds.classList.remove('hidden');
        modalManageCds.classList.add('flex');
    });
    closeModalCds.addEventListener('click', () => {
        modalManageCds.classList.add('hidden');
        modalManageCds.classList.remove('flex');
    });

    adjustStockBtn.addEventListener('click', () => {
        modalAdjustStock.classList.remove('hidden');
        modalAdjustStock.classList.add('flex');
    });
    closeModalAdjust.addEventListener('click', () => {
        modalAdjustStock.classList.add('hidden');
        modalAdjustStock.classList.remove('flex');
    });

    transferStockBtn.addEventListener('click', () => {
        modalTransferStock.classList.remove('hidden');
        modalTransferStock.classList.add('flex');
    });
    closeModalTransfer.addEventListener('click', () => {
        modalTransferStock.classList.add('hidden');
        modalTransferStock.classList.remove('flex');
    });

    historyStockBtn.addEventListener('click', () => {
        fetchHistory();
        modalHistoryStock.classList.remove('hidden');
        modalHistoryStock.classList.add('flex');
    });
    closeModalHistory.addEventListener('click', () => {
        modalHistoryStock.classList.add('hidden');
        modalHistoryStock.classList.remove('flex');
    });

    // Filter Change Listeners
    searchInput.addEventListener('input', renderStockTable);
    cdFilter.addEventListener('change', renderStockTable);
    categoryFilter.addEventListener('change', renderStockTable);
    statusFilter.addEventListener('change', renderStockTable);

    // Initial Load
    await fetchCDs();
    await fetchProductsStock();
}
