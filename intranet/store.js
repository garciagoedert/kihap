import { db } from './firebase-config.js';
import {
    collection, getDocs, query, orderBy, where,
    addDoc, doc, updateDoc, deleteDoc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getCurrentUser, checkAdminStatus } from './auth.js';

export async function setupStorePage() {
    const currentUser = await getCurrentUser();
    const isAdmin = await checkAdminStatus(currentUser);

    // Tab elements
    const tabSalesLog = document.getElementById('tab-sales-log');
    const tabManageProducts = document.getElementById('tab-manage-products');
    const tabMarketing = document.getElementById('tab-marketing');
    const tabEvents = document.getElementById('tab-events');
    const contentSalesLog = document.getElementById('content-sales-log');
    const contentManageProducts = document.getElementById('content-manage-products');
    const contentMarketing = document.getElementById('content-marketing');
    const contentManageBanners = document.getElementById('content-manage-banners');
    const contentManageCoupons = document.getElementById('content-manage-coupons');
    const contentEvents = document.getElementById('content-events');

    // Marketing sub-tab elements
    const subtabBanners = document.getElementById('subtab-banners');
    const subtabCoupons = document.getElementById('subtab-coupons');

    if (!isAdmin) {
        tabManageProducts.style.display = 'none';
        tabMarketing.style.display = 'none';
        tabEvents.style.display = 'none';
    }

    // Events Tab elements
    const eventProductFilter = document.getElementById('event-product-filter');
    const eventSearchInput = document.getElementById('event-search-input');
    const eventsTableBody = document.getElementById('events-table-body');
    let allCheckins = [];

    // Sales Log elements
    const salesTableBody = document.getElementById('sales-table-body');
    const searchInput = document.getElementById('search-input');
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');
    const dateFilter = document.getElementById('filter-date');
    const statusFilter = document.getElementById('filter-status');
    const exportBtn = document.getElementById('export-btn');
    const modal = document.getElementById('sale-details-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalContent = document.getElementById('modal-content');
    const deleteSaleBtnModal = document.getElementById('delete-sale-btn-modal');
    const resendEmailBtnModal = document.getElementById('resend-email-btn-modal');

    // Product Management elements
    const productForm = document.getElementById('product-form');
    const productFormTitle = document.getElementById('product-form-title');
    const productIdInput = document.getElementById('product-id');
    const productNameInput = document.getElementById('product-name');
    const productPriceInput = document.getElementById('product-price');
    const productDescriptionInput = document.getElementById('product-description');
    const productImageInput = document.getElementById('product-image');
    const priceTypeRadios = document.querySelectorAll('input[name="price-type"]');
    const fixedPriceContainer = document.getElementById('fixed-price-container');
    const variablePricesContainer = document.getElementById('variable-prices-container');
    const addPriceVariantBtn = document.getElementById('add-price-variant-btn');
    const priceVariantsList = document.getElementById('price-variants-list');
    const lotesContainer = document.getElementById('lotes-container');
    const addLoteBtn = document.getElementById('add-lote-btn');
    const lotesList = document.getElementById('lotes-list');
    const productVisibleInput = document.getElementById('product-visible');
    const productAvailableInput = document.getElementById('product-available');
    const productPublicInput = document.getElementById('product-public');
    const productIsTicketInput = document.getElementById('product-is-ticket');
    const productAvailabilityDateInput = document.getElementById('product-availability-date');
    const productAskProfessorInput = document.getElementById('product-ask-professor');
    const productCustomUnitsInput = document.getElementById('product-custom-units');
    const recommendedProductsSelect = document.getElementById('recommended-products');
    const saveProductBtn = document.getElementById('save-product-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const productsTableBody = document.getElementById('products-table-body');
    const sendBulkEmailsBtn = document.getElementById('send-bulk-emails-btn');

    // Banner Management elements
    const bannerForm = document.getElementById('banner-form');
    const bannerFormTitle = document.getElementById('banner-form-title');
    const bannerIdInput = document.getElementById('banner-id');
    const bannerImageInput = document.getElementById('banner-image');
    const bannerLinkInput = document.getElementById('banner-link');
    const bannerActiveInput = document.getElementById('banner-active');
    const saveBannerBtn = document.getElementById('save-banner-btn');
    const cancelBannerEditBtn = document.getElementById('cancel-banner-edit-btn');
    const bannersList = document.getElementById('banners-list');

    // Coupon Management elements
    const couponForm = document.getElementById('coupon-form');
    const couponFormTitle = document.getElementById('coupon-form-title');
    const couponIdInput = document.getElementById('coupon-id');
    const couponCodeInput = document.getElementById('coupon-code');
    const couponTypeInput = document.getElementById('coupon-type');
    const couponValueInput = document.getElementById('coupon-value');
    const couponExpiryInput = document.getElementById('coupon-expiry');
    const saveCouponBtn = document.getElementById('save-coupon-btn');
    const cancelCouponEditBtn = document.getElementById('cancel-coupon-edit-btn');
    const couponsTableBody = document.getElementById('coupons-table-body');

    // Manual Sale elements
    const addManualSaleBtn = document.getElementById('add-manual-sale-btn');
    const manualSaleModal = document.getElementById('manual-sale-modal');
    const manualSaleForm = document.getElementById('manual-sale-form');
    const closeManualSaleModalBtn = document.getElementById('close-manual-sale-modal-btn');
    const cancelManualSaleBtn = document.getElementById('cancel-manual-sale-btn');
    const manualSalePaymentMethod = document.getElementById('manual-sale-payment-method');
    const manualSaleCardDetails = document.getElementById('manual-sale-card-details');
    const manualSalePixDetails = document.getElementById('manual-sale-pix-details');
    const manualSaleCashDetails = document.getElementById('manual-sale-cash-details');
    const manualSaleProductsContainer = document.getElementById('manual-sale-products-container');
    const addManualSaleProductBtn = document.getElementById('add-manual-sale-product-btn');
    const manualSaleAmountInput = document.getElementById('manual-sale-amount');
    const manualSaleUnitSelect = document.getElementById('manual-sale-user-unit');


    let allSales = [];
    let allProducts = [];
    let allBanners = [];
    let allCoupons = [];
    let currentOpenSaleId = null;

    // --- Tab Switching Logic ---
    function switchTab(activeTab) {
        // Remove active from all main tabs
        [tabSalesLog, tabManageProducts, tabMarketing, tabEvents].forEach(tab => {
            tab.classList.remove('text-white', 'border-blue-500');
            tab.classList.add('text-gray-400', 'hover:border-gray-500');
        });

        // Hide all main content
        [contentSalesLog, contentManageProducts, contentMarketing, contentEvents].forEach(content => {
            content.classList.add('hidden');
        });

        if (activeTab === 'sales') {
            tabSalesLog.classList.add('text-white', 'border-blue-500');
            tabSalesLog.classList.remove('text-gray-400', 'hover:border-gray-500');
            contentSalesLog.classList.remove('hidden');
        } else if (activeTab === 'products') {
            tabManageProducts.classList.add('text-white', 'border-blue-500');
            tabManageProducts.classList.remove('text-gray-400', 'hover:border-gray-500');
            contentManageProducts.classList.remove('hidden');
        } else if (activeTab === 'marketing') {
            tabMarketing.classList.add('text-white', 'border-blue-500');
            tabMarketing.classList.remove('text-gray-400', 'hover:border-gray-500');
            contentMarketing.classList.remove('hidden');
        } else if (activeTab === 'events') {
            fetchCheckins();
            tabEvents.classList.add('text-white', 'border-blue-500');
            tabEvents.classList.remove('text-gray-400', 'hover:border-gray-500');
            contentEvents.classList.remove('hidden');
        }
    }

    // --- Marketing Sub-tab Switching Logic ---
    function switchMarketingSubTab(activeSubTab) {
        if (activeSubTab === 'banners') {
            subtabBanners.classList.add('text-white', 'border-blue-500');
            subtabBanners.classList.remove('text-gray-400', 'hover:border-gray-500');
            subtabCoupons.classList.remove('text-white', 'border-blue-500');
            subtabCoupons.classList.add('text-gray-400', 'hover:border-gray-500');
            contentManageBanners.classList.remove('hidden');
            contentManageCoupons.classList.add('hidden');
        } else if (activeSubTab === 'coupons') {
            subtabCoupons.classList.add('text-white', 'border-blue-500');
            subtabCoupons.classList.remove('text-gray-400', 'hover:border-gray-500');
            subtabBanners.classList.remove('text-white', 'border-blue-500');
            subtabBanners.classList.add('text-gray-400', 'hover:border-gray-500');
            contentManageCoupons.classList.remove('hidden');
            contentManageBanners.classList.add('hidden');
        }
    }

    if (tabSalesLog) tabSalesLog.addEventListener('click', () => switchTab('sales'));
    if (tabManageProducts) tabManageProducts.addEventListener('click', () => switchTab('products'));
    if (tabMarketing) tabMarketing.addEventListener('click', () => switchTab('marketing'));
    if (tabEvents) tabEvents.addEventListener('click', () => switchTab('events'));

    if (subtabBanners) subtabBanners.addEventListener('click', () => switchMarketingSubTab('banners'));
    if (subtabCoupons) subtabCoupons.addEventListener('click', () => switchMarketingSubTab('coupons'));

    // --- Manual Sale Modal Logic ---
    const updateManualSaleTotal = () => {
        let total = 0;
        const productRows = manualSaleProductsContainer.querySelectorAll('.manual-sale-product-row');
        productRows.forEach(row => {
            const priceInput = row.querySelector('.manual-sale-product-price');
            const price = parseInt(priceInput.value, 10) || 0;
            total += price;
        });
        manualSaleAmountInput.value = total;
    };

    const addManualSaleProductRow = () => {
        const row = document.createElement('div');
        row.className = 'manual-sale-product-row grid grid-cols-3 gap-2 items-center';

        const productSelect = document.createElement('select');
        productSelect.className = 'manual-sale-product-select col-span-2 w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md';
        productSelect.innerHTML = '<option value="">Selecione um produto</option>';
        allProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            option.dataset.price = product.price;
            productSelect.appendChild(option);
        });

        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.className = 'manual-sale-product-price w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md';
        priceInput.placeholder = 'Preço';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-manual-sale-product-btn text-red-500 hover:text-red-400';
        removeBtn.innerHTML = '&times;';

        row.appendChild(productSelect);
        row.appendChild(priceInput);
        row.appendChild(removeBtn);
        manualSaleProductsContainer.appendChild(row);

        productSelect.addEventListener('change', () => {
            const selectedOption = productSelect.options[productSelect.selectedIndex];
            if (selectedOption.dataset.price) {
                priceInput.value = selectedOption.dataset.price;
            }
            updateManualSaleTotal();
        });

        priceInput.addEventListener('input', updateManualSaleTotal);

        removeBtn.addEventListener('click', () => {
            row.remove();
            updateManualSaleTotal();
        });
    };

    const openManualSaleModal = () => {
        manualSaleForm.reset();
        manualSaleProductsContainer.innerHTML = '';
        addManualSaleProductRow();
        updateManualSaleTotal();

        // Populate units
        const units = [...new Set(allSales.map(sale => sale.userUnit).filter(Boolean))];
        manualSaleUnitSelect.innerHTML = '<option value="">Selecione uma unidade</option>';
        units.sort().forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
            manualSaleUnitSelect.appendChild(option);
        });

        manualSaleModal.classList.remove('hidden');
    };

    if (addManualSaleProductBtn) addManualSaleProductBtn.addEventListener('click', addManualSaleProductRow);

    const closeManualSaleModal = () => {
        manualSaleModal.classList.add('hidden');
    };

    if (addManualSaleBtn) addManualSaleBtn.addEventListener('click', openManualSaleModal);
    if (closeManualSaleModalBtn) closeManualSaleModalBtn.addEventListener('click', closeManualSaleModal);
    if (cancelManualSaleBtn) cancelManualSaleBtn.addEventListener('click', closeManualSaleModal);

    if (manualSalePaymentMethod) manualSalePaymentMethod.addEventListener('change', (e) => {
        manualSaleCardDetails.classList.add('hidden');
        manualSalePixDetails.classList.add('hidden');
        manualSaleCashDetails.classList.add('hidden');
        if (e.target.value === 'card') {
            manualSaleCardDetails.classList.remove('hidden');
        } else if (e.target.value === 'pix') {
            manualSalePixDetails.classList.remove('hidden');
        } else if (e.target.value === 'cash') {
            manualSaleCashDetails.classList.remove('hidden');
        }
    });

    if (manualSaleForm) manualSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-manual-sale-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            const productRows = manualSaleProductsContainer.querySelectorAll('.manual-sale-product-row');
            const items = [];
            productRows.forEach(row => {
                const productSelect = row.querySelector('.manual-sale-product-select');
                const priceInput = row.querySelector('.manual-sale-product-price');
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                if (selectedOption.value) {
                    items.push({
                        productId: selectedOption.value,
                        productName: selectedOption.textContent,
                        amount: parseInt(priceInput.value, 10) || 0
                    });
                }
            });

            if (items.length === 0) {
                alert('Adicione pelo menos um produto.');
                return;
            }

            const saleData = {
                saleType: 'manual',
                userName: document.getElementById('manual-sale-user-name').value,
                userEmail: document.getElementById('manual-sale-user-email').value,
                userPhone: document.getElementById('manual-sale-user-phone').value,
                userCpf: document.getElementById('manual-sale-user-cpf').value,
                userGraduacao: document.getElementById('manual-sale-user-graduacao').value,
                userUnit: document.getElementById('manual-sale-user-unit').value,
                items: items,
                productName: items.map(i => i.productName).join(', '), // For compatibility with table display
                productId: items[0].productId, // For compatibility with filters
                amountTotal: parseInt(manualSaleAmountInput.value, 10),
                paymentStatus: 'paid',
                created: serverTimestamp(),
                details: document.getElementById('manual-sale-details').value,
                paymentDetails: {
                    method: manualSalePaymentMethod.value,
                }
            };

            if (saleData.paymentDetails.method === 'credit') {
                saleData.amountTotal = 0;
            }

            if (saleData.paymentDetails.method === 'card') {
                saleData.paymentDetails.cardLast4 = document.getElementById('manual-sale-card-last4').value;
                saleData.paymentDetails.cardBrand = document.getElementById('manual-sale-card-brand').value;
                saleData.paymentDetails.authCode = document.getElementById('manual-sale-card-auth').value;
            }

            await addDoc(collection(db, 'inscricoesFaixaPreta'), saleData);

            alert('Venda manual adicionada com sucesso!');
            closeManualSaleModal();
            await fetchSales();
            applyFilters();

        } catch (error) {
            console.error('Error adding manual sale:', error);
            alert('Erro ao adicionar venda manual.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar Venda';
        }
    });


    // --- Helper Functions ---
    const renderStatusTag = (status) => {
        if (!status) return 'N/A';

        const statusText = status === 'paid' ? 'Pago' : 'Pendente';
        const colorClasses = status === 'paid'
            ? 'bg-green-500/20 text-green-400'
            : 'bg-yellow-500/20 text-yellow-400';

        return `<span class="px-2 py-1 rounded-full text-xs font-medium ${colorClasses}">${statusText}</span>`;
    };

    // --- Sales Log Logic ---
    const fetchSales = async () => {
        salesTableBody.innerHTML = '<tr><td colspan="10" class="text-center p-8">Carregando vendas...</td></tr>';
        try {
            const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'desc'));
            const querySnapshot = await getDocs(q);
            allSales = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching sales:', error);
            salesTableBody.innerHTML = '<tr><td colspan="9" class="text-center p-8 text-red-500">Erro ao carregar vendas.</td></tr>';
        }
    };

    const displaySales = (salesToDisplay) => {
        salesTableBody.innerHTML = '';
        if (salesToDisplay.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="10" class="text-center p-8">Nenhuma venda encontrada.</td></tr>';
            return;
        }

        salesToDisplay.forEach(sale => {
            const row = salesTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700', 'hover:bg-gray-800', 'cursor-pointer');
            row.dataset.saleId = sale.id; // Add sale id to row for modal click

            const date = sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A';
            const amount = (sale.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: sale.currency || 'BRL' });

            let nameDisplay = sale.userName || 'N/A';
            if (sale.saleType === 'manual') {
                nameDisplay += ` <span class="ml-2 px-2 py-1 text-xs font-semibold text-blue-300 bg-blue-800/50 rounded-full">Manual</span>`;
            }

            let productDisplay = sale.productName || 'N/A';
            if (sale.recommendedItems && sale.recommendedItems.length > 0) {
                const recommendedNames = sale.recommendedItems.map(item => `${item.productName} (x${item.quantity})`).join(', ');
                productDisplay += `<br><span class="text-xs text-gray-400">+ ${recommendedNames}</span>`;
            }

            row.innerHTML = `
                <td class="p-4" data-label="Nome do Cliente">${nameDisplay}</td>
                <td class="p-4" data-label="Email">${sale.userEmail || 'N/A'}</td>
                <td class="p-4" data-label="Telefone">${sale.userPhone || 'N/A'}</td>
                <td class="p-4" data-label="Produto">${productDisplay}</td>
                <td class="p-4" data-label="Programa">${sale.userPrograma || 'N/A'}</td>
                <td class="p-4" data-label="Graduação">${sale.userGraduacao || 'N/A'}</td>
                <td class="p-4" data-label="Valor">${amount}</td>
                <td class="p-4" data-label="Status do Pagamento">${renderStatusTag(sale.paymentStatus)}</td>
                <td class="p-4" data-label="Data da Compra">${date}</td>
            `;
        });
    };

    const applyFilters = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedUnit = unitFilter.value;
        const selectedProduct = productFilter.value;
        const selectedDate = dateFilter.value;
        const selectedStatus = statusFilter.value;

        let filteredSales = allSales.filter(sale => {
            const nameMatch = !searchTerm || (sale.userName && sale.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm));
            const unitMatch = !selectedUnit || sale.userUnit === selectedUnit;
            const mainProductMatch = sale.productId === selectedProduct;
            const recommendedProductMatch = sale.recommendedItems && sale.recommendedItems.some(item => item.productId === selectedProduct);
            const productMatch = !selectedProduct || mainProductMatch || recommendedProductMatch;
            const statusMatch = !selectedStatus || sale.paymentStatus === selectedStatus;

            let dateMatch = true;
            if (selectedDate && sale.created) {
                const saleDate = sale.created.toDate().toISOString().split('T')[0];
                dateMatch = saleDate === selectedDate;
            }

            return (nameMatch || emailMatch) && unitMatch && productMatch && dateMatch && statusMatch;
        });

        const noFiltersApplied = !searchTerm && !selectedUnit && !selectedProduct && !selectedDate && !selectedStatus;
        if (noFiltersApplied) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            filteredSales = filteredSales.filter(sale => {
                if (!sale.created) return false;
                return sale.created.toDate() >= sevenDaysAgo;
            });
        }

        displaySales(filteredSales);
        displayStoreKpis(filteredSales);
    };

    [searchInput, unitFilter, productFilter, dateFilter, statusFilter].forEach(el => {
        if (el) {
            el.addEventListener('change', applyFilters);
            el.addEventListener('keyup', applyFilters);
        }
    });

    const resendMissingTicketsBtn = document.getElementById('resend-missing-tickets-btn');
    if (resendMissingTicketsBtn) resendMissingTicketsBtn.addEventListener('click', async () => {
        if (!confirm('Tem certeza que deseja verificar e reenviar TODOS os ingressos pendentes? Isso pode levar alguns instantes.')) {
            return;
        }

        resendMissingTicketsBtn.disabled = true;
        const originalContent = resendMissingTicketsBtn.innerHTML;
        resendMissingTicketsBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-2"></i>Processando...';

        try {
            const functions = getFunctions();
            const resendAllMissingTickets = httpsCallable(functions, 'resendAllMissingTickets');
            const result = await resendAllMissingTickets();
            const { message, sentCount, errorCount } = result.data;
            alert(`${message}\n\nEnviados: ${sentCount}\nErros: ${errorCount}`);
        } catch (error) {
            console.error('Erro ao processar reenvio em massa:', error);
            alert(`Erro: ${error.message}`);
        } finally {
            resendMissingTicketsBtn.disabled = false;
            resendMissingTicketsBtn.innerHTML = originalContent;
        }
    });

    if (exportBtn) exportBtn.addEventListener('click', () => {
        const filteredSales = getFilteredSales();
        exportToExcel(filteredSales);
    });

    const getFilteredSales = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedUnit = unitFilter.value;
        const selectedProduct = productFilter.value;
        const selectedDate = dateFilter.value;

        return allSales.filter(sale => {
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
    };

    const exportToExcel = (sales) => {
        const worksheetData = sales.map(sale => ({
            'Nome do Cliente': sale.userName || 'N/A',
            'Email': sale.userEmail || 'N/A',
            'Telefone': sale.userPhone || 'N/A',
            'Produto': sale.productName || 'N/A',
            'Programa': sale.userPrograma || 'N/A',
            'Graduação': sale.userGraduacao || 'N/A',
            'Valor': (sale.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            'Status do Pagamento': sale.paymentStatus === 'paid' ? 'Pago' : 'Pendente',
            'Data da Compra': sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A'
        }));

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas');
        XLSX.writeFile(workbook, 'RelatorioDeVendas.xlsx');
    };

    // --- Product Management Logic ---
    const fetchProducts = async () => {
        productsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8">Carregando produtos...</td></tr>';
        try {
            const q = query(collection(db, 'products'), orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayProducts(allProducts);
        } catch (error) {
            console.error('Error fetching products:', error);
            productsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-red-500">Erro ao carregar produtos.</td></tr>';
        }
    };

    const displayProducts = (productsToDisplay) => {
        populateRecommendedProductsSelect();
        productsTableBody.innerHTML = '';
        if (productsToDisplay.length === 0) {
            productsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8">Nenhum produto cadastrado.</td></tr>';
            return;
        }

        productsToDisplay.forEach(product => {
            const row = productsTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700');

            let price;
            if (product.priceType === 'variable' && product.priceVariants) {
                const prices = product.priceVariants.map(v => v.price / 100);
                const minPrice = Math.min(...prices).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const maxPrice = Math.max(...prices).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                price = `${minPrice} - ${maxPrice}`;
            } else {
                price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }

            const productUrl = `${window.location.origin.replace('/intranet', '')}/produto.html?id=${product.id}`;
            const visibilityStatus = product.visible ? '<span class="text-green-400">Visível</span>' : '<span class="text-gray-400">Invisível</span>';
            const availabilityStatus = product.available ? '<span class="text-blue-400">Disponível</span>' : '<span class="text-red-400">Indisponível</span>';
            const publicStatus = product.acessoPublico ? '<span class="text-indigo-400">Público</span>' : '<span class="text-gray-500">Privado</span>';

            row.innerHTML = `
                <td class="p-4" data-label="Nome">${product.name}</td>
                <td class="p-4" data-label="Preço">${price}</td>
                <td class="p-4" data-label="Status">${visibilityStatus} / ${availabilityStatus} / ${publicStatus}</td>
                <td class="p-4" data-label="Link">
                    <button class="copy-link-btn text-green-400 hover:text-green-300" data-link="${productUrl}">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </td>
                <td class="p-4" data-label="Ações">
                    <button class="edit-btn text-blue-400 hover:text-blue-300 mr-2" data-id="${product.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-btn text-red-500 hover:text-red-400" data-id="${product.id}"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
    };

    const populateRecommendedProductsSelect = () => {
        const currentProductId = productIdInput.value;
        recommendedProductsSelect.innerHTML = '';
        allProducts.forEach(product => {
            if (product.id !== currentProductId) {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = product.name;
                recommendedProductsSelect.appendChild(option);
            }
        });
    };

    const resetProductForm = () => {
        productForm.reset();
        productIdInput.value = '';
        productImageInput.dataset.existingImageUrl = '';
        productVisibleInput.checked = false;
        productAvailableInput.checked = true; // Default to available
        productPublicInput.checked = false;
        productIsTicketInput.checked = false;
        productAvailabilityDateInput.value = '';
        productAskProfessorInput.checked = false;
        productCustomUnitsInput.value = '';
        priceVariantsList.innerHTML = '';
        recommendedProductsSelect.value = '';
        Array.from(recommendedProductsSelect.options).forEach(option => option.selected = false);
        document.querySelector('input[name="price-type"][value="fixed"]').checked = true;
        fixedPriceContainer.classList.remove('hidden');
        variablePricesContainer.classList.add('hidden');
        productFormTitle.textContent = 'Adicionar Novo Produto';
        saveProductBtn.textContent = 'Salvar Produto';
        cancelEditBtn.classList.add('hidden');
        sendBulkEmailsBtn.classList.add('hidden');
    };

    if (productForm) productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveProductBtn.disabled = true;
        saveProductBtn.textContent = 'Salvando...';

        const id = productIdInput.value;
        const imageFile = productImageInput.files[0];
        let imageUrl = productImageInput.dataset.existingImageUrl || null;

        try {
            if (imageFile) {
                const storage = getStorage();
                const storageRef = ref(storage, `product_images/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const priceType = document.querySelector('input[name="price-type"]:checked').value;
            const productData = {
                name: productNameInput.value,
                description: productDescriptionInput.value,
                imageUrl: imageUrl,
                priceType: priceType,
                visible: productVisibleInput.checked,
                available: productAvailableInput.checked,
                acessoPublico: productPublicInput.checked,
                isTicket: productIsTicketInput.checked,
                availabilityDate: productAvailabilityDateInput.value || null,
                askProfessor: productAskProfessorInput.checked,
                customUnits: productCustomUnitsInput.value ? productCustomUnitsInput.value.split(',').map(u => u.trim()).filter(u => u) : [],
                recommendedProducts: Array.from(recommendedProductsSelect.selectedOptions).map(option => option.value)
            };

            if (priceType === 'fixed') {
                productData.price = parseInt(productPriceInput.value, 10);
            } else if (priceType === 'variable') {
                const variants = [];
                const variantElements = priceVariantsList.querySelectorAll('.price-variant-item');
                variantElements.forEach(item => {
                    const name = item.querySelector('input[name="variant-name"]').value;
                    const price = parseInt(item.querySelector('input[name="variant-price"]').value, 10);
                    if (name && !isNaN(price)) {
                        variants.push({ name, price });
                    }
                });
                productData.priceVariants = variants;
                productData.price = variants.length > 0 ? Math.min(...variants.map(v => v.price)) : 0;
            } else if (priceType === 'lotes') {
                const lotes = [];
                const loteElements = lotesList.querySelectorAll('.lote-item');
                loteElements.forEach(item => {
                    const name = item.querySelector('input[name="lote-name"]').value;
                    const price = parseInt(item.querySelector('input[name="lote-price"]').value, 10);
                    const startDate = item.querySelector('input[name="lote-start-date"]').value;
                    if (name && !isNaN(price)) {
                        lotes.push({ name, price, startDate: startDate || null });
                    }
                });
                productData.lotes = lotes;
                productData.price = lotes.length > 0 ? lotes[0].price : 0;
            }

            if (id) {
                const productRef = doc(db, 'products', id);
                await updateDoc(productRef, productData);
                alert('Produto atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'products'), productData);
                alert('Produto adicionado com sucesso!');
            }

            resetProductForm();
            fetchProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Erro ao salvar produto.');
        } finally {
            saveProductBtn.disabled = false;
            saveProductBtn.textContent = 'Salvar Produto';
        }
    });

    if (productsTableBody) productsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const copyLinkBtn = e.target.closest('.copy-link-btn');

        if (copyLinkBtn) {
            const link = copyLinkBtn.dataset.link;
            navigator.clipboard.writeText(link).then(() => {
                alert('Link copiado para a área de transferência!');
            }, (err) => {
                console.error('Could not copy text: ', err);
                alert('Não foi possível copiar o link.');
            });
        }

        if (editBtn) {
            const id = editBtn.dataset.id;
            const product = allProducts.find(p => p.id === id);
            if (product) {
                productFormTitle.textContent = 'Editar Produto';
                productIdInput.value = product.id;
                populateRecommendedProductsSelect(); // Repopulate to exclude current product
                productNameInput.value = product.name;
                productDescriptionInput.value = product.description;
                productImageInput.dataset.existingImageUrl = product.imageUrl || '';

                if (product.priceType === 'variable' && product.priceVariants) {
                    document.querySelector('input[name="price-type"][value="variable"]').checked = true;
                    fixedPriceContainer.classList.add('hidden');
                    variablePricesContainer.classList.remove('hidden');
                    lotesContainer.classList.add('hidden');
                    priceVariantsList.innerHTML = '';
                    product.priceVariants.forEach(variant => addPriceVariant(variant.name, variant.price));
                } else if (product.priceType === 'lotes' && product.lotes) {
                    document.querySelector('input[name="price-type"][value="lotes"]').checked = true;
                    fixedPriceContainer.classList.add('hidden');
                    variablePricesContainer.classList.add('hidden');
                    lotesContainer.classList.remove('hidden');
                    lotesList.innerHTML = '';
                    product.lotes.forEach(lote => addLote(lote.name, lote.price, lote.startDate));
                } else {
                    document.querySelector('input[name="price-type"][value="fixed"]').checked = true;
                    fixedPriceContainer.classList.remove('hidden');
                    variablePricesContainer.classList.add('hidden');
                    lotesContainer.classList.add('hidden');
                    productPriceInput.value = product.price;
                }

                productVisibleInput.checked = product.visible || false;
                productAvailableInput.checked = product.available !== false; // Default to true if undefined
                productPublicInput.checked = product.acessoPublico || false;
                productIsTicketInput.checked = product.isTicket || false;
                productAvailabilityDateInput.value = product.availabilityDate || '';
                productAskProfessorInput.checked = product.askProfessor || false;
                productCustomUnitsInput.value = product.customUnits ? product.customUnits.join(', ') : '';

                if (product.isTicket) {
                    sendBulkEmailsBtn.classList.remove('hidden');
                } else {
                    sendBulkEmailsBtn.classList.add('hidden');
                }

                if (product.recommendedProducts) {
                    Array.from(recommendedProductsSelect.options).forEach(option => {
                        if (product.recommendedProducts.includes(option.value)) {
                            option.selected = true;
                        }
                    });
                }

                saveProductBtn.textContent = 'Atualizar Produto';
                cancelEditBtn.classList.remove('hidden');
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('Tem certeza que deseja excluir este produto?')) {
                deleteProduct(id);
            }
        }
    });

    if (sendBulkEmailsBtn) sendBulkEmailsBtn.addEventListener('click', async () => {
        const productId = productIdInput.value;
        if (!productId) {
            alert('Nenhum produto selecionado.');
            return;
        }

        if (!confirm('Tem certeza que deseja enviar os ingressos para todos os compradores deste produto que ainda não receberam o e-mail?')) {
            return;
        }

        sendBulkEmailsBtn.disabled = true;
        sendBulkEmailsBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-2"></i>Enviando...';

        try {
            const functions = getFunctions();
            const sendBulkTicketEmails = httpsCallable(functions, 'sendBulkTicketEmails');
            const result = await sendBulkTicketEmails({ productId: productId });
            alert(result.data.message);
        } catch (error) {
            console.error('Erro ao enviar e-mails em massa:', error);
            alert(`Erro: ${error.message}`);
        } finally {
            sendBulkEmailsBtn.disabled = false;
            sendBulkEmailsBtn.innerHTML = '<i class="fas fa-envelope mr-2"></i>Enviar Ingressos em Massa';
        }
    });

    const deleteProduct = async (id) => {
        try {
            await deleteDoc(doc(db, 'products', id));
            alert('Produto excluído com sucesso!');
            fetchProducts(); // Refresh the list
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Erro ao excluir produto.');
        }
    };

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetProductForm);

    // --- Price Type Switching Logic ---
    priceTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            fixedPriceContainer.classList.add('hidden');
            variablePricesContainer.classList.add('hidden');
            lotesContainer.classList.add('hidden');

            if (radio.value === 'fixed') {
                fixedPriceContainer.classList.remove('hidden');
            } else if (radio.value === 'variable') {
                variablePricesContainer.classList.remove('hidden');
                if (priceVariantsList.children.length === 0) {
                    addPriceVariant(); // Add one by default
                }
            } else if (radio.value === 'lotes') {
                lotesContainer.classList.remove('hidden');
                if (lotesList.children.length === 0) {
                    addLote(); // Add one by default
                }
            }
        });
    });

    const addPriceVariant = (name = '', price = '') => {
        const variantId = Date.now();
        const variantItem = document.createElement('div');
        variantItem.className = 'price-variant-item flex items-center space-x-2';
        const isVariablePrice = document.querySelector('input[name="price-type"]:checked').value === 'variable';

        variantItem.innerHTML = `
            <input type="text" name="variant-name" placeholder="Nome da Variação (ex: 1BD)" value="${name}" class="w-1/2 px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${isVariablePrice ? 'required' : ''}>
            <input type="number" name="variant-price" placeholder="Preço (centavos)" value="${price}" class="w-1/2 px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${isVariablePrice ? 'required' : ''}>
            <button type="button" class="remove-price-variant-btn text-red-500 hover:text-red-400">&times;</button>
        `;
        priceVariantsList.appendChild(variantItem);
    };

    if (addPriceVariantBtn) addPriceVariantBtn.addEventListener('click', () => addPriceVariant());

    if (priceVariantsList) priceVariantsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-price-variant-btn')) {
            e.target.closest('.price-variant-item').remove();
        }
    });

    const addLote = (name = '', price = '', startDate = '') => {
        const loteId = Date.now();
        const loteItem = document.createElement('div');
        loteItem.className = 'lote-item grid grid-cols-3 gap-2 items-center';
        const isLotePrice = document.querySelector('input[name="price-type"]:checked').value === 'lotes';

        loteItem.innerHTML = `
            <input type="text" name="lote-name" placeholder="Nome do Lote" value="${name}" class="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${isLotePrice ? 'required' : ''}>
            <input type="number" name="lote-price" placeholder="Preço (centavos)" value="${price}" class="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${isLotePrice ? 'required' : ''}>
            <input type="date" name="lote-start-date" value="${startDate}" class="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button type="button" class="remove-lote-btn text-red-500 hover:text-red-400 col-span-3">&times; Remover</button>
        `;
        lotesList.appendChild(loteItem);
    };

    if (addLoteBtn) addLoteBtn.addEventListener('click', () => addLote());

    if (lotesList) lotesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-lote-btn')) {
            e.target.closest('.lote-item').remove();
        }
    });

    // --- Modal Logic ---
    const openModalWithSaleDetails = async (saleId) => {
        const sale = allSales.find(s => s.id === saleId);
        if (!sale) return;

        currentOpenSaleId = saleId;

        // Get product to determine if it's a ticket
        let isTicket = false;
        try {
            const productRef = doc(db, 'products', sale.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                isTicket = productSnap.data().isTicket || false;
            }
        } catch (error) {
            console.error('Error fetching product:', error);
        }

        // Update resend button text based on product type
        const resendEmailText = document.getElementById('resend-email-text');
        if (isTicket) {
            resendEmailText.innerHTML = '🎫 Reenviar Ingresso';
        } else {
            resendEmailText.innerHTML = '📧 Reenviar Recibo';
        }

        let studentInfoHtml = '';
        if (sale.userId) {
            try {
                const userRef = doc(db, 'users', sale.userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const studentData = userSnap.data();
                    const studentName = studentData.name || 'Nome não encontrado';
                    const searchUrl = `alunos.html?search=${encodeURIComponent(studentName)}`;
                    studentInfoHtml = `<p><strong>Aluno Vinculado:</strong> <a href="${searchUrl}" target="_blank" class="text-blue-400 hover:underline">${studentName}</a></p>`;
                } else {
                    studentInfoHtml = `<p><strong>Aluno Vinculado:</strong> ID ${sale.userId} (não encontrado no banco de dados)</p>`;
                }
            } catch (error) {
                console.error("Erro ao buscar dados do aluno:", error);
                studentInfoHtml = `<p><strong>Aluno Vinculado:</strong> Erro ao buscar dados</p>`;
            }
        }

        let productDetailsHtml = `<p><strong>Produto:</strong> ${sale.productName || 'N/A'}</p>`;
        if (sale.recommendedItems && sale.recommendedItems.length > 0) {
            const recommendedItemsHtml = sale.recommendedItems.map(item =>
                `<li>${item.productName} (x${item.quantity}) - ${(item.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</li>`
            ).join('');
            productDetailsHtml += `
                <div class="mt-2">
                    <strong class="text-sm text-gray-400">Comprado Junto:</strong>
                    <ul class="list-disc list-inside text-sm text-gray-300">
                        ${recommendedItemsHtml}
                    </ul>
                </div>
            `;
        }

        let paymentDetailsHtml = '';
        if (sale.saleType === 'manual' && sale.paymentDetails) {
            const details = sale.paymentDetails;
            let method = 'N/A';
            if (details.method === 'card') method = 'Cartão';
            if (details.method === 'pix') method = 'PIX';
            if (details.method === 'cash') method = 'Dinheiro';

            paymentDetailsHtml = `<div class="mt-4 pt-4 border-t border-gray-700">
                <h3 class="text-lg font-bold mb-2">Detalhes do Pagamento Manual</h3>
                <p><strong>Método:</strong> ${method}</p>`;

            if (details.method === 'card') {
                paymentDetailsHtml += `
                    <p><strong>Final do Cartão:</strong> ${details.cardLast4 || 'N/A'}</p>
                    <p><strong>Bandeira:</strong> ${details.cardBrand || 'N/A'}</p>
                    <p><strong>Autorização:</strong> ${details.authCode || 'N/A'}</p>
                `;
            }
            paymentDetailsHtml += `</div>`;
        }

        modalContent.innerHTML = `
            <p><strong>ID da Venda:</strong> ${sale.id}</p>
            ${studentInfoHtml}
            <p><strong>Nome do Cliente:</strong> ${sale.userName || 'N/A'}</p>
            <p><strong>Email:</strong> ${sale.userEmail || 'N/A'}</p>
            <p><strong>Telefone:</strong> ${sale.userPhone || 'N/A'}</p>
            <p><strong>CPF:</strong> ${sale.userCpf || 'N/A'}</p>
            <p><strong>Unidade:</strong> ${sale.userUnit || 'N/A'}</p>
            <p><strong>Programa:</strong> ${sale.userPrograma || 'N/A'}</p>
            <p><strong>Graduação:</strong> ${sale.userGraduacao || 'N/A'}</p>
            ${productDetailsHtml}
            <p><strong>Valor Total:</strong> ${(sale.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <p><strong>Status do Pagamento:</strong> ${renderStatusTag(sale.paymentStatus)}</p>
            <p><strong>Data da Compra:</strong> ${sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A'}</p>
            ${paymentDetailsHtml}
        `;

        // Load email logs
        await loadEmailLogs(saleId);

        modal.classList.remove('hidden');

        const currentUser = await getCurrentUser();
        if (currentUser && currentUser.isAdmin) {
            deleteSaleBtnModal.style.display = 'inline-block';
        } else {
            deleteSaleBtnModal.style.display = 'none';
        }
    };

    // --- Email Logs Logic ---
    const loadEmailLogs = async (saleId) => {
        try {
            const emailLogsRef = collection(db, 'inscricoesFaixaPreta', saleId, 'emailLogs');
            const q = query(emailLogsRef, orderBy('sentAt', 'desc'));
            const querySnapshot = await getDocs(q);

            const emailLogsSection = document.getElementById('email-logs-section');
            const emailLogsList = document.getElementById('email-logs-list');

            if (querySnapshot.empty) {
                emailLogsSection.classList.add('hidden');
                return;
            }

            emailLogsSection.classList.remove('hidden');
            emailLogsList.innerHTML = '';

            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const typeIcon = log.type === 'ticket' ? '🎫' : '📧';
                const statusIcon = log.success ? '✅' : '❌';
                const dateStr = log.sentAt ? new Date(log.sentAt.toDate()).toLocaleString('pt-BR') : 'N/A';

                const logItem = document.createElement('div');
                logItem.className = 'bg-[#2a2a2a] p-3 rounded-lg text-sm';
                logItem.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span>${typeIcon} ${log.type === 'ticket' ? 'Ingresso' : 'Recibo'} ${statusIcon}</span>
                        <span class="text-gray-400">${dateStr}</span>
                    </div>
                    ${log.error ? `<p class="text-red-400 text-xs mt-1">Erro: ${log.error}</p>` : ''}
                `;
                emailLogsList.appendChild(logItem);
            });
        } catch (error) {
            console.error('Error loading email logs:', error);
        }
    };

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    if (salesTableBody) salesTableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.saleId) {
            openModalWithSaleDetails(row.dataset.saleId);
        }
    });

    if (deleteSaleBtnModal) deleteSaleBtnModal.addEventListener('click', () => {
        if (currentOpenSaleId && confirm('Tem certeza que deseja excluir este log de venda?')) {
            deleteSaleLog(currentOpenSaleId);
        }
    });

    if (resendEmailBtnModal) resendEmailBtnModal.addEventListener('click', async () => {
        if (currentOpenSaleId) {
            resendEmailBtnModal.disabled = true;
            const originalContent = resendEmailBtnModal.innerHTML;
            resendEmailBtnModal.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-2"></i>Reenviando...';
            try {
                const functions = getFunctions();
                const resendEmail = httpsCallable(functions, 'resendEmail');
                const result = await resendEmail({ saleId: currentOpenSaleId });
                alert(result.data.message);
                // Reload email logs after sending
                await loadEmailLogs(currentOpenSaleId);
            } catch (error) {
                console.error('Erro ao reenviar email:', error);
                alert(`Erro: ${error.message}`);
            } finally {
                resendEmailBtnModal.disabled = false;
                resendEmailBtnModal.innerHTML = originalContent;
            }
        }
    });

    const deleteSaleLog = async (saleId) => {
        const currentUser = await getCurrentUser();
        if (!currentUser || !currentUser.isAdmin) {
            alert('Você não tem permissão para executar esta ação.');
            return;
        }

        try {
            await deleteDoc(doc(db, 'inscricoesFaixaPreta', saleId));
            alert('Log de venda excluído com sucesso!');
            closeModal();
            fetchSales(); // Refresh the list
        } catch (error) {
            console.error('Error deleting sale log:', error);
            alert('Erro ao excluir o log de venda.');
        }
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    const populateFilters = () => {
        // Populate units
        const units = [...new Set(allSales.map(sale => sale.userUnit).filter(Boolean))];
        unitFilter.innerHTML = '<option value="">Todas as Unidades</option>';
        units.sort().forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
            unitFilter.appendChild(option);
        });

        // Populate products
        productFilter.innerHTML = '<option value="">Todos os Produtos</option>';
        allProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            productFilter.appendChild(option);
        });
    };

    // --- Initial Load ---
    const initialLoad = async () => {
        await fetchProducts(); // Fetch products first to populate filter
        await fetchSales();   // Fetch sales
        populateFilters();    // Then populate filters with data from both
        await fetchBanners();
        await fetchCoupons();
        // fetchCheckins() is now called when switching to the tab
        applyFilters();
    };

    // --- Events Tab Logic ---
    const fetchCheckins = async () => {
        eventsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Carregando check-ins...</td></tr>';
        try {
            const q = query(collection(db, 'inscricoesFaixaPreta'), where('checkinStatus', '==', 'realizado'), orderBy('checkinTimestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            allCheckins = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateEventFilter();
        } catch (error) {
            console.error('Error fetching check-ins:', error);
            eventsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao carregar check-ins.</td></tr>';
        }
    };

    const populateEventFilter = () => {
        const eventProducts = allProducts.filter(p => p.isTicket);
        eventProductFilter.innerHTML = '<option value="">Todos os Eventos</option>';
        eventProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            eventProductFilter.appendChild(option);
        });
    };

    const displayCheckins = (checkinsToDisplay) => {
        eventsTableBody.innerHTML = '';
        if (checkinsToDisplay.length === 0) {
            eventsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Nenhum check-in encontrado.</td></tr>';
            return;
        }

        checkinsToDisplay.forEach(checkin => {
            const row = eventsTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700', 'hover:bg-gray-800', 'cursor-pointer');
            row.dataset.saleId = checkin.id; // Reutiliza o modal de detalhes da venda
            const checkinDate = checkin.checkinTimestamp ? new Date(checkin.checkinTimestamp.toDate()).toLocaleString('pt-BR') : 'N/A';

            row.innerHTML = `
                <td class="p-4" data-label="Nome do Cliente">${checkin.userName || 'N/A'}</td>
                <td class="p-4" data-label="Email">${checkin.userEmail || 'N/A'}</td>
                <td class="p-4" data-label="Produto (Evento)">${checkin.productName || 'N/A'}</td>
                <td class="p-4" data-label="Data do Check-in">${checkinDate}</td>
            `;
        });
    };

    const applyEventFilters = () => {
        const selectedProductId = eventProductFilter.value;
        const searchTerm = eventSearchInput.value.toLowerCase();

        let filteredCheckins = allCheckins.filter(checkin => {
            const productMatch = !selectedProductId || checkin.productId === selectedProductId;
            const nameMatch = !searchTerm || (checkin.userName && checkin.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (checkin.userEmail && checkin.userEmail.toLowerCase().includes(searchTerm));

            return productMatch && (nameMatch || emailMatch);
        });

        displayCheckins(filteredCheckins);
    };

    if (eventProductFilter) eventProductFilter.addEventListener('change', applyEventFilters);
    if (eventSearchInput) eventSearchInput.addEventListener('keyup', applyEventFilters);

    if (eventsTableBody) eventsTableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.saleId) {
            openModalWithSaleDetails(row.dataset.saleId);
        }
    });


    // --- Banner Management Logic ---
    const fetchBanners = async () => {
        bannersList.innerHTML = '<p class="text-center">Carregando banners...</p>';
        try {
            const q = query(collection(db, 'banners'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            allBanners = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayBanners(allBanners);
        } catch (error) {
            console.error('Error fetching banners:', error);
            bannersList.innerHTML = '<p class="text-center text-red-500">Erro ao carregar banners.</p>';
        }
    };

    const displayBanners = (banners) => {
        bannersList.innerHTML = '';
        if (banners.length === 0) {
            bannersList.innerHTML = '<p class="text-center">Nenhum banner cadastrado.</p>';
            return;
        }

        banners.forEach(banner => {
            const bannerEl = document.createElement('div');
            bannerEl.className = 'bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4';
            bannerEl.innerHTML = `
                <div class="flex items-center">
                    <img src="${banner.imageUrl}" class="w-24 h-12 object-cover rounded-md mr-4">
                    <div>
                        <a href="${banner.link}" target="_blank" class="hover:underline">${banner.link || 'Sem link'}</a>
                        <p class="text-sm text-gray-400">${banner.active ? 'Ativo' : 'Inativo'}</p>
                    </div>
                </div>
                <div>
                    <button class="edit-banner-btn text-blue-400 hover:text-blue-300 mr-2" data-id="${banner.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-banner-btn text-red-500 hover:text-red-400" data-id="${banner.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            bannersList.appendChild(bannerEl);
        });
    };

    const resetBannerForm = () => {
        bannerForm.reset();
        bannerIdInput.value = '';
        bannerImageInput.dataset.existingImageUrl = '';
        bannerActiveInput.checked = false;
        bannerFormTitle.textContent = 'Adicionar Novo Banner';
        saveBannerBtn.textContent = 'Salvar Banner';
        cancelBannerEditBtn.classList.add('hidden');
    };

    if (bannerForm) bannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBannerBtn.disabled = true;
        saveBannerBtn.textContent = 'Salvando...';

        const id = bannerIdInput.value;
        const imageFile = bannerImageInput.files[0];
        let imageUrl = bannerImageInput.dataset.existingImageUrl || null;

        try {
            if (imageFile) {
                const storage = getStorage();
                const storageRef = ref(storage, `banners/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const bannerData = {
                imageUrl: imageUrl,
                link: bannerLinkInput.value,
                active: bannerActiveInput.checked,
                createdAt: serverTimestamp(),
            };

            if (id) {
                const bannerRef = doc(db, 'banners', id);
                await updateDoc(bannerRef, bannerData);
                alert('Banner atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'banners'), bannerData);
                alert('Banner adicionado com sucesso!');
            }

            resetBannerForm();
            fetchBanners();
        } catch (error) {
            console.error('Error saving banner:', error);
            alert('Erro ao salvar banner.');
        } finally {
            saveBannerBtn.disabled = false;
            saveBannerBtn.textContent = 'Salvar Banner';
        }
    });

    if (bannersList) bannersList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-banner-btn');
        const deleteBtn = e.target.closest('.delete-banner-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            const banner = allBanners.find(b => b.id === id);
            if (banner) {
                bannerFormTitle.textContent = 'Editar Banner';
                bannerIdInput.value = banner.id;
                bannerLinkInput.value = banner.link || '';
                bannerImageInput.dataset.existingImageUrl = banner.imageUrl || '';
                bannerActiveInput.checked = banner.active || false;
                saveBannerBtn.textContent = 'Atualizar Banner';
                cancelBannerEditBtn.classList.remove('hidden');
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('Tem certeza que deseja excluir este banner?')) {
                deleteBanner(id);
            }
        }
    });

    const deleteBanner = async (id) => {
        try {
            await deleteDoc(doc(db, 'banners', id));
            alert('Banner excluído com sucesso!');
            fetchBanners();
        } catch (error) {
            console.error('Error deleting banner:', error);
            alert('Erro ao excluir banner.');
        }
    };

    if (cancelBannerEditBtn) cancelBannerEditBtn.addEventListener('click', resetBannerForm);

    // --- Coupon Management Logic ---
    const fetchCoupons = async () => {
        couponsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8">Carregando cupons...</td></tr>';
        try {
            const q = query(collection(db, 'coupons'), orderBy('code', 'asc'));
            const querySnapshot = await getDocs(q);
            allCoupons = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayCoupons(allCoupons);
        } catch (error) {
            console.error('Error fetching coupons:', error);
            couponsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-red-500">Erro ao carregar cupons.</td></tr>';
        }
    };

    const displayCoupons = (couponsToDisplay) => {
        couponsTableBody.innerHTML = '';
        if (couponsToDisplay.length === 0) {
            couponsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8">Nenhum cupom cadastrado.</td></tr>';
            return;
        }

        couponsToDisplay.forEach(coupon => {
            const row = couponsTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700');

            const value = coupon.type === 'percentage' ? `${coupon.value}%` : (coupon.value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const expiry = coupon.expiry ? new Date(coupon.expiry).toLocaleDateString('pt-BR') : 'Sem validade';

            row.innerHTML = `
                <td class="p-4" data-label="Código">${coupon.code}</td>
                <td class="p-4" data-label="Tipo">${coupon.type === 'percentage' ? 'Porcentagem' : 'Valor Fixo'}</td>
                <td class="p-4" data-label="Valor">${value}</td>
                <td class="p-4" data-label="Validade">${expiry}</td>
                <td class="p-4" data-label="Ações">
                    <button class="edit-coupon-btn text-blue-400 hover:text-blue-300 mr-2" data-id="${coupon.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-coupon-btn text-red-500 hover:text-red-400" data-id="${coupon.id}"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
    };

    const resetCouponForm = () => {
        couponForm.reset();
        couponIdInput.value = '';
        couponFormTitle.textContent = 'Adicionar Novo Cupom';
        saveCouponBtn.textContent = 'Salvar Cupom';
        cancelCouponEditBtn.classList.add('hidden');
    };

    if (couponForm) couponForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveCouponBtn.disabled = true;
        saveCouponBtn.textContent = 'Salvando...';

        const id = couponIdInput.value;
        const couponData = {
            code: couponCodeInput.value,
            type: couponTypeInput.value,
            value: parseInt(couponValueInput.value, 10),
            expiry: couponExpiryInput.value || null,
        };

        try {
            if (id) {
                const couponRef = doc(db, 'coupons', id);
                await updateDoc(couponRef, couponData);
                alert('Cupom atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'coupons'), couponData);
                alert('Cupom adicionado com sucesso!');
            }

            resetCouponForm();
            fetchCoupons();
        } catch (error) {
            console.error('Error saving coupon:', error);
            alert('Erro ao salvar cupom.');
        } finally {
            saveCouponBtn.disabled = false;
            saveCouponBtn.textContent = 'Salvar Cupom';
        }
    });

    if (couponsTableBody) couponsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-coupon-btn');
        const deleteBtn = e.target.closest('.delete-coupon-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            const coupon = allCoupons.find(c => c.id === id);
            if (coupon) {
                couponFormTitle.textContent = 'Editar Cupom';
                couponIdInput.value = coupon.id;
                couponCodeInput.value = coupon.code;
                couponTypeInput.value = coupon.type;
                couponValueInput.value = coupon.value;
                couponExpiryInput.value = coupon.expiry || '';
                saveCouponBtn.textContent = 'Atualizar Cupom';
                cancelCouponEditBtn.classList.remove('hidden');
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('Tem certeza que deseja excluir este cupom?')) {
                deleteCoupon(id);
            }
        }
    });

    const deleteCoupon = async (id) => {
        try {
            await deleteDoc(doc(db, 'coupons', id));
            alert('Cupom excluído com sucesso!');
            fetchCoupons();
        } catch (error) {
            console.error('Error deleting coupon:', error);
            alert('Erro ao excluir cupom.');
        }
    };

    if (cancelCouponEditBtn) cancelCouponEditBtn.addEventListener('click', resetCouponForm);

    async function displayStoreKpis(sales = allSales) {
        const kpiContainer = document.getElementById('store-kpi-container');
        kpiContainer.innerHTML = `
            <div class="kpi-card p-6 rounded-xl flex items-center justify-between animate-pulse">
                <div>
                    <p class="text-gray-400 text-sm font-medium uppercase tracking-wider">Total de Vendas</p>
                    <p class="text-3xl font-bold text-white mt-1">...</p>
                </div>
                <div class="text-4xl text-blue-500 opacity-80"><i class="fas fa-shopping-cart"></i></div>
            </div>
            <div class="kpi-card p-6 rounded-xl flex items-center justify-between animate-pulse">
                <div>
                    <p class="text-gray-400 text-sm font-medium uppercase tracking-wider">Receita Total</p>
                    <p class="text-3xl font-bold text-white mt-1">...</p>
                </div>
                <div class="text-4xl text-green-500 opacity-80"><i class="fas fa-dollar-sign"></i></div>
            </div>
            <div class="kpi-card p-6 rounded-xl flex items-center justify-between animate-pulse">
                <div>
                    <p class="text-gray-400 text-sm font-medium uppercase tracking-wider">Ticket Médio</p>
                    <p class="text-3xl font-bold text-white mt-1">...</p>
                </div>
                <div class="text-4xl text-purple-500 opacity-80"><i class="fas fa-chart-line"></i></div>
            </div>
        `;

        try {
            const totalSales = sales.length;
            const totalRevenue = sales.reduce((acc, sale) => acc + (sale.amountTotal || 0), 0);
            const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

            let kpiHtml = `
                <div class="kpi-card p-6 rounded-xl flex items-center justify-between">
                    <div>
                        <p class="text-gray-400 text-sm font-medium uppercase tracking-wider">Total de Vendas</p>
                        <p class="text-3xl font-bold text-white mt-1">${totalSales.toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="text-4xl text-blue-500 opacity-80"><i class="fas fa-shopping-cart"></i></div>
                </div>
            `;

            if (isAdmin) {
                kpiHtml += `
                    <div class="kpi-card p-6 rounded-xl flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm font-medium uppercase tracking-wider">Receita Total</p>
                            <p class="text-3xl font-bold text-white mt-1">${(totalRevenue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div class="text-4xl text-green-500 opacity-80"><i class="fas fa-dollar-sign"></i></div>
                    </div>
                `;
                kpiHtml += `
                    <div class="kpi-card p-6 rounded-xl flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm font-medium uppercase tracking-wider">Ticket Médio</p>
                            <p class="text-3xl font-bold text-white mt-1">${(averageTicket / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div class="text-4xl text-purple-500 opacity-80"><i class="fas fa-chart-line"></i></div>
                    </div>
                `;
            }

            kpiContainer.innerHTML = kpiHtml;
        } catch (error) {
            console.error("Erro ao carregar KPIs da loja:", error);
            kpiContainer.innerHTML = `
                <div class="kpi-card p-6 rounded-xl flex items-center justify-between border-red-500/50">
                    <div>
                        <p class="text-gray-400 text-sm font-medium uppercase tracking-wider">Erro</p>
                        <p class="text-xl font-bold text-red-500 mt-1">Falha ao carregar</p>
                    </div>
                    <div class="text-4xl text-red-500 opacity-80"><i class="fas fa-exclamation-triangle"></i></div>
                </div>
            `;
        }
    }

    initialLoad();
}
