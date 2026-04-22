import { db } from './firebase-config.js';
import {
    collection, getDocs, query, orderBy, where,
    addDoc, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getCurrentUser, checkAdminStatus } from './auth.js';

export async function setupStorePage() {
    const currentUser = await getCurrentUser();
    const isAdmin = await checkAdminStatus(currentUser);
    const isStore = currentUser && currentUser.isStore === true;

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

    if (!isAdmin && !isStore) {
        tabManageProducts.style.display = 'none';
        tabMarketing.style.display = 'none';
        tabEvents.style.display = 'none';
    }

    // Events Tab elements
    const eventProductFilter = document.getElementById('event-product-filter');
    const eventRingFilter = document.getElementById('event-ring-filter');
    const eventUnitFilter = document.getElementById('event-unit-filter');
    const eventSearchInput = document.getElementById('event-search-input');
    const eventsTableBody = document.getElementById('events-table-body');
    const totalEventSubscribersElem = document.getElementById('total-event-subscribers');
    const totalEventCheckinsElem = document.getElementById('total-event-checkins');
    const ringStatsList = document.getElementById('ring-stats-list');
    const exportEventCsvBtn = document.getElementById('export-event-csv-btn');
    let allCheckins = [];

    // Sales Log elements
    const salesTableBody = document.getElementById('sales-table-body');
    const searchInput = document.getElementById('search-input');
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');
    const periodFilter = document.getElementById('filter-period');
    const customDateContainer = document.getElementById('filter-custom-date');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const statusFilter = document.getElementById('filter-status');
    const fulfillmentFilter = document.getElementById('filter-fulfillment');
    const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    const filterGridContainer = document.getElementById('filter-grid-container');
    const exportBtn = document.getElementById('export-btn');
    const modal = document.getElementById('sale-details-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalContent = document.getElementById('modal-content');
    const deleteSaleBtnModal = document.getElementById('delete-sale-btn-modal');
    const resendEmailBtnModal = document.getElementById('resend-email-btn-modal');
    const recoverCartBtnModal = document.getElementById('recover-cart-btn-modal');
    const fulfillmentStatusSelect = document.getElementById('sale-fulfillment-status');

    const exportModal = document.getElementById('export-modal'); // Still needed if we want to avoid breaking script, but let's see if we can just remove all of them.

    // Product Management elements
    const productModal = document.getElementById('product-modal');
    const addProductBtn = document.getElementById('add-product-btn');
    const closeProductModalBtn = document.getElementById('close-product-modal-btn');
    const cancelProductModalBtn = document.getElementById('cancel-product-modal-btn');
    const deleteProductBtn = document.getElementById('delete-product-btn');
    const deleteConfirmationModal = document.getElementById('delete-confirmation-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteConfirmationMessage = document.getElementById('delete-confirmation-message');
    const productSearchInput = document.getElementById('product-search-input');

    const productForm = document.getElementById('product-form');
    const productFormTitle = document.getElementById('product-form-title');
    const productIdInput = document.getElementById('product-id');
    const productNameInput = document.getElementById('product-name');
    const productPriceInput = document.getElementById('product-price');
    const productCategoryInput = document.getElementById('product-category');
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
    const kitContainer = document.getElementById('kit-container');
    const kitBasePriceInput = document.getElementById('kit-base-price');
    const addKitItemBtn = document.getElementById('add-kit-item-btn');
    const kitItemsList = document.getElementById('kit-items-list');

    const addonsContainer = document.getElementById('addons-container');
    const addAddonBtn = document.getElementById('add-addon-btn');
    const addonsList = document.getElementById('addons-list');

    const productVisibleInput = document.getElementById('product-visible');
    const productAvailableInput = document.getElementById('product-available');
    const productPublicInput = document.getElementById('product-public');
    const productIsTicketInput = document.getElementById('product-is-ticket');
    const productIsSubscriptionInput = document.getElementById('product-is-subscription');
    const productAvailabilityDateInput = document.getElementById('product-availability-date');
    const productAskProfessorInput = document.getElementById('product-ask-professor');
    const productAskAgeInput = document.getElementById('product-ask-age');
    const productControlStockInput = document.getElementById('product-control-stock');
    const stockContainer = document.getElementById('stock-container');
    const productStockQuantityInput = document.getElementById('product-stock-quantity');
    const productHasSizesInput = document.getElementById('product-has-sizes');
    const productSizesContainer = document.getElementById('product-sizes-container');
    const productSizesInput = document.getElementById('product-sizes');
    const productCustomUnitsInput = document.getElementById('product-custom-units');
    const productSizesLabelInput = document.getElementById('product-sizes-label');
    const productVariantsLabelInput = document.getElementById('product-variants-label');
    const recommendedProductsSelect = document.getElementById('recommended-products');
    const productMpAccountSelect = document.getElementById('product-mp-account');
    const productMpSplitInput = document.getElementById('product-mp-split');
    const subscriptionFrequencyContainer = document.getElementById('subscription-frequency-container');
    const subscriptionFrequencyInput = document.getElementById('subscription-frequency');
    const saveProductBtn = document.getElementById('save-product-btn');
    const productsTableBody = document.getElementById('products-table-body');
    const sendBulkEmailsBtn = document.getElementById('send-bulk-emails-btn');
    const productIsEventInput = document.getElementById('product-is-event');
    const productEventAddressInput = document.getElementById('product-event-address');
    const eventConfigContainer = document.getElementById('event-config-container');
    const eventSlotsList = document.getElementById('event-slots-list');
    const addEventSlotBtn = document.getElementById('add-event-slot-btn');

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
        [tabSalesLog, tabManageProducts, tabMarketing, tabEvents].forEach(tab => {
            tab.classList.remove('text-white', 'border-blue-500');
            tab.classList.add('text-gray-400', 'hover:border-gray-500');
        });

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
            populateEventFilter();
            fetchEventSubscribers();
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
    




    // --- Filter Toggle Logic ---
    if (toggleFiltersBtn && filterGridContainer) {
        toggleFiltersBtn.addEventListener('click', () => {
            filterGridContainer.classList.toggle('hidden');
            toggleFiltersBtn.classList.toggle('bg-blue-600');
            toggleFiltersBtn.classList.toggle('text-white');
        });
    }

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
                userAge: document.getElementById('manual-sale-user-age').value || null,
                chosenVariant: document.getElementById('manual-sale-user-variant').value || null,
                items: items,
                productName: items.map(i => i.productName).join(', '),
                productId: items[0].productId,
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
    const getFulfillmentStatusLabel = (status) => {
        switch (status) {
            case 'processing': return 'Em Preparação';
            case 'shipped': return 'Enviado';
            case 'delivered': return 'Entregue';
            case 'returned': return 'Devolvido';
            case 'canceled': return 'Cancelado';
            default: return 'Pendente';
        }
    };

    const renderFulfillmentStatusTag = (status) => {
        let colorClass = 'bg-gray-800 text-gray-400';
        let text = 'Pendente';

        switch (status) {
            case 'processing':
                colorClass = 'bg-blue-900/50 text-blue-300';
                text = 'Em Preparação';
                break;
            case 'shipped':
                colorClass = 'bg-indigo-900/50 text-indigo-300';
                text = 'Enviado';
                break;
            case 'delivered':
                colorClass = 'bg-green-900/50 text-green-300';
                text = 'Entregue';
                break;
            case 'returned':
                colorClass = 'bg-yellow-900/50 text-yellow-300';
                text = 'Devolvido';
                break;
            case 'canceled':
                colorClass = 'bg-red-900/50 text-red-300';
                text = 'Cancelado';
                break;
            default:
                break;
        }

        return `<span class="px-3 py-1 text-xs font-bold rounded-full ${colorClass}">${text}</span>`;
    };

    const renderStatusTag = (status) => {
        if (!status) return 'N/A';

        const statusText = status === 'paid' ? 'Pago' : (status === 'canceled' ? 'Cancelado' : 'Pendente');
        const colorClasses = status === 'paid'
            ? 'bg-green-500/20 text-green-400'
            : (status === 'canceled' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400');

        return `<span class="px-2 py-1 rounded-full text-xs font-medium ${colorClasses}">${statusText}</span>`;
    };

    // --- Sales Log Logic ---
    const fetchSales = async () => {
        salesTableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8">Carregando vendas...</td></tr>';
        try {
            const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'desc'));
            const querySnapshot = await getDocs(q);
            allSales = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching sales:', error);
            salesTableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-red-500">Erro ao carregar vendas.</td></tr>';
        }
    };

    const displaySales = (salesToDisplay) => {
        salesTableBody.innerHTML = '';
        if (salesToDisplay.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8">Nenhuma venda encontrada.</td></tr>';
            return;
        }

        salesToDisplay.forEach(sale => {
            const row = salesTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700', 'hover:bg-gray-800', 'cursor-pointer');
            row.dataset.saleId = sale.id;

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
                <td class="p-4" data-label="Produto">${productDisplay}</td>
                <td class="p-4" data-label="Valor">${amount}</td>
                <td class="p-4" data-label="Status do Pagamento">${renderStatusTag(sale.paymentStatus)}</td>
                <td class="p-4" data-label="Entrega">${renderFulfillmentStatusTag(sale.fulfillmentStatus)}</td>
                <td class="p-4" data-label="Data da Compra">${date}</td>
                <td class="p-4" data-label="Ações">
                    <button class="update-status-btn bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1 rounded text-xs transition-colors" 
                        data-sale-id="${sale.id}">
                        <i class="fas fa-edit mr-1"></i>Atualizar
                    </button>
                </td>
            `;
        });
    };

    const applyFilters = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedUnit = unitFilter.value;
        const selectedProduct = productFilter.value;
        const selectedPeriod = periodFilter ? periodFilter.value : 'all';
        const customStart = filterStartDate ? filterStartDate.value : '';
        const customEnd = filterEndDate ? filterEndDate.value : '';
        const selectedStatus = statusFilter.value;
        const selectedFulfillment = fulfillmentFilter ? fulfillmentFilter.value : '';

        let filteredSales = allSales.filter(sale => {
            const nameMatch = !searchTerm || (sale.userName && sale.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm));
            const unitMatch = !selectedUnit || sale.userUnit === selectedUnit;
            const mainProductMatch = sale.productId === selectedProduct;
            const recommendedProductMatch = sale.recommendedItems && sale.recommendedItems.some(item => item.productId === selectedProduct);
            const productMatch = !selectedProduct || mainProductMatch || recommendedProductMatch;
            const statusMatch = !selectedStatus || sale.paymentStatus === selectedStatus;
            const fulfillmentMatch = !selectedFulfillment || sale.fulfillmentStatus === selectedFulfillment || (selectedFulfillment === 'pending' && !sale.fulfillmentStatus);

            let dateMatch = true;
            if (sale.created && selectedPeriod) {
                const saleDateObj = sale.created.toDate();
                const saleTime = saleDateObj.getTime();
                
                if (selectedPeriod === 'all') {
                    dateMatch = true;
                } else if (selectedPeriod === 'custom') {
                    if (customStart) {
                        const startStr = customStart.split('-');
                        const startObj = new Date(startStr[0], startStr[1]-1, startStr[2]);
                        startObj.setHours(0,0,0,0);
                        if (saleTime < startObj.getTime()) dateMatch = false;
                    }
                    if (customEnd) {
                        const endStr = customEnd.split('-');
                        const endObj = new Date(endStr[0], endStr[1]-1, endStr[2]);
                        endObj.setHours(23,59,59,999);
                        if (saleTime > endObj.getTime()) dateMatch = false;
                    }
                } else {
                    const now = new Date();
                    now.setHours(23, 59, 59, 999);
                    let startObj = new Date();
                    startObj.setHours(0, 0, 0, 0);
                    
                    if (selectedPeriod === '7') {
                        startObj.setDate(startObj.getDate() - 7);
                    } else if (selectedPeriod === '15') {
                        startObj.setDate(startObj.getDate() - 15);
                    } else if (selectedPeriod === '30') {
                        startObj.setDate(startObj.getDate() - 30);
                    } else if (selectedPeriod === 'month') {
                        startObj.setDate(1);
                    }

                    if (saleTime < startObj.getTime() || saleTime > now.getTime()) {
                        dateMatch = false;
                    }
                }
            } else if (!sale.created && selectedPeriod !== 'all') {
                dateMatch = false;
            }

            return (nameMatch || emailMatch) && unitMatch && productMatch && dateMatch && statusMatch && fulfillmentMatch;
        });

        const noFiltersApplied = !searchTerm && !selectedUnit && !selectedProduct && selectedPeriod === 'all' && !selectedStatus;
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
    };

    if (periodFilter) {
        periodFilter.addEventListener('change', () => {
            if (periodFilter.value === 'custom') {
                customDateContainer.classList.remove('hidden');
            } else {
                customDateContainer.classList.add('hidden');
            }
            applyFilters();
        });
    }

    [searchInput, unitFilter, productFilter, filterStartDate, filterEndDate, statusFilter, fulfillmentFilter].forEach(el => {
        if (el) {
            el.addEventListener('change', applyFilters);
            el.addEventListener('keyup', applyFilters);
        }
    });


    const fetchMpAccounts = async () => {
        if (!productMpAccountSelect) return;
        try {
            const q = query(collection(db, 'mercadopagoAccounts'));
            const querySnapshot = await getDocs(q);
            
            // Keep the default option
            productMpAccountSelect.innerHTML = '<option value="default">Vidual / Principal (Default)</option>';
            
            querySnapshot.forEach((doc) => {
                const account = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = account.name || doc.id;
                productMpAccountSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching MP Accounts:', error);
        }
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
        productsTableBody.innerHTML = '';
        if (productsToDisplay.length === 0) {
            productsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8">Nenhum produto cadastrado.</td></tr>';
            return;
        }

        productsToDisplay.forEach(product => {
            const row = productsTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-800', 'hover:bg-gray-800/30', 'transition-colors');

            let price;
            if (product.priceType === 'variable' && product.priceVariants) {
                const prices = product.priceVariants.map(v => v.price / 100);
                const minPrice = Math.min(...prices).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const maxPrice = Math.max(...prices).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                price = `${minPrice} - ${maxPrice}`;
            } else {
                price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }

            row.innerHTML = `
                <td class="p-4">
                    <div class="font-bold text-white">${product.name}</div>
                    <div class="text-[10px] text-gray-400 uppercase tracking-widest mt-1">${product.category || 'Geral'}</div>
                </td>
                <td class="p-4 font-mono text-sm text-gray-300 font-bold">${price}</td>
                <td class="p-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${product.visible ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}">
                        ${product.visible ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="p-4">
                    <button title="Copiar Link de Compra" class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all copy-link-btn" 
                        data-link="https://www.kihap.com.br/checkout?product=${product.id}">
                        <i class="fas fa-link text-xs"></i>
                    </button>
                </td>
                <td class="p-4 text-right">
                    <button class="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-all edit-btn" data-id="${product.id}">
                        <i class="fas fa-pencil-alt text-[10px]"></i>
                        <span class="text-[10px] font-bold uppercase tracking-widest">Editar</span>
                    </button>
                </td>
            `;
        });
    };

    const populateRecommendedProductsSelect = () => {
        if (!recommendedProductsSelect) return;
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

    const openProductModal = () => {
        productModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    const closeProductModal = () => {
        productModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        productForm.reset();
        eventConfigContainer.classList.add('hidden');
        eventSlotsList.innerHTML = '';
        if (deleteProductBtn) deleteProductBtn.classList.add('hidden');
    };

    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            productFormTitle.textContent = 'Adicionar Produto';
            productIdInput.value = '';
            if (deleteProductBtn) deleteProductBtn.classList.add('hidden');
            populateRecommendedProductsSelect();
            openProductModal();
        });
    }
    if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
    if (cancelProductModalBtn) cancelProductModalBtn.addEventListener('click', closeProductModal);

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

            const eventConfigData = getEventConfigFromUI();
            const priceType = document.querySelector('input[name="price-type"]:checked').value;

            const productData = {
                name: productNameInput.value,
                category: productCategoryInput.value || '',
                description: productDescriptionInput.value,
                imageUrl: imageUrl,
                priceType: priceType,
                visible: productVisibleInput.checked,
                available: productAvailableInput.checked,
                acessoPublico: productPublicInput.checked,
                isTicket: productIsTicketInput.checked,
                availabilityDate: productAvailabilityDateInput.value || null,
                hasSizes: productHasSizesInput.checked,
                sizes: productHasSizesInput.checked ? productSizesInput.value.split(',').map(s => s.trim()).filter(s => s) : [],
                askProfessor: productAskProfessorInput.checked,
                askAge: productAskAgeInput.checked,
                controlStock: productControlStockInput.checked,
                customUnits: productCustomUnitsInput.value ? productCustomUnitsInput.value.split(',').map(u => u.trim()).filter(u => u) : [],
                recommendedProducts: Array.from(recommendedProductsSelect.selectedOptions).map(option => option.value),
                mpAccountId: productMpAccountSelect ? productMpAccountSelect.value : 'default',
                mpSplitPercentage: productMpSplitInput ? (parseFloat(productMpSplitInput.value) || 0) : 0,
                sizesLabel: productSizesLabelInput ? productSizesLabelInput.value : '',
                variantsLabel: productVariantsLabelInput ? productVariantsLabelInput.value : '',
                isEvent: eventConfigData.isEvent,
                eventAddress: eventConfigData.eventAddress,
                eventConfig: eventConfigData.eventConfig
            };

            // Handle stock fields
            if (productControlStockInput.checked) {
                const hasSizes = productHasSizesInput.checked;
                if (hasSizes && stockPerSizeInputs) {
                    const sizeInputEls = stockPerSizeInputs.querySelectorAll('[data-stock-size-input]');
                    const sizeStock = {};
                    let allZero = true;
                    sizeInputEls.forEach(el => {
                        const qty = parseInt(el.value) || 0;
                        sizeStock[el.dataset.size] = qty;
                        if (qty > 0) allZero = false;
                    });
                    productData.sizeStock = sizeStock;
                    productData.stockQuantity = Object.values(sizeStock).reduce((a, b) => a + b, 0);
                    if (allZero && sizeInputEls.length > 0) {
                        productData.available = false;
                    }
                } else {
                    productData.stockQuantity = parseInt(productStockQuantityInput.value) || 0;
                    if (productData.stockQuantity <= 0) {
                        productData.available = false;
                    }
                }
            } else {
                productData.stockQuantity = 0;
                productData.sizeStock = {};
            }

            // Handle Subscription toggle regardless of priceType
            if (productIsSubscriptionInput && productIsSubscriptionInput.checked) {
                productData.isSubscription = true;
                const parts = subscriptionFrequencyInput.value.split('_');
                productData.subscriptionFrequency = parseInt(parts[0], 10);
                productData.subscriptionPeriod = parts[1]; // months, years
                productData.subscriptionFrequencyInput = subscriptionFrequencyInput.value;
            } else {
                productData.isSubscription = false;
            }

            if (priceType === 'fixed') {
                productData.price = parseInt(productPriceInput.value, 10) || 0;
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
            } else if (priceType === 'kit') {
                productData.kitBasePrice = parseInt(kitBasePriceInput.value, 10) || 0;
                productData.price = productData.kitBasePrice;
                const kitItems = [];
                const itemElements = kitItemsList.querySelectorAll('.kit-item-row');
                itemElements.forEach(item => {
                    const name = item.querySelector('input[name="kit-item-name"]').value;
                    const optionsStr = item.querySelector('input[name="kit-item-options"]').value;
                    if (name) {
                        const options = optionsStr.split(',').map(o => o.trim()).filter(o => o);
                        kitItems.push({ name, options });
                    }
                });
                productData.kitItems = kitItems;
            }

            // Handle Addons
            const addons = [];
            if (addonsList) {
                const addonElements = addonsList.querySelectorAll('.addon-item');
                addonElements.forEach(item => {
                    const name = item.querySelector('input[name="addon-name"]').value;
                    const price = parseInt(item.querySelector('input[name="addon-price"]').value, 10);
                    if (name && !isNaN(price)) {
                        addons.push({ name, price });
                    }
                });
            }
            productData.addons = addons;

            if (id) {
                const productRef = doc(db, 'products', id);
                await updateDoc(productRef, productData);
                alert('Produto atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'products'), productData);
                alert('Produto adicionado com sucesso!');
            }

            closeProductModal();
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
                if (productCategoryInput) productCategoryInput.value = product.category || '';
                productDescriptionInput.value = product.description;
                if (productImageInput) productImageInput.dataset.existingImageUrl = product.imageUrl || '';
                if (deleteProductBtn) deleteProductBtn.classList.remove('hidden');
                openProductModal();

                if (product.priceType === 'variable' && product.priceVariants) {
                    document.querySelector('input[name="price-type"][value="variable"]').checked = true;
                    fixedPriceContainer.classList.add('hidden');
                    variablePricesContainer.classList.remove('hidden');
                    lotesContainer.classList.add('hidden');
                    kitContainer.classList.add('hidden');
                    priceVariantsList.innerHTML = '';
                    if (productVariantsLabelInput) productVariantsLabelInput.value = product.variantsLabel || '';
                    product.priceVariants.forEach(variant => addPriceVariant(variant.name, variant.price));
                } else if (product.priceType === 'lotes' && product.lotes) {
                    document.querySelector('input[name="price-type"][value="lotes"]').checked = true;
                    fixedPriceContainer.classList.add('hidden');
                    variablePricesContainer.classList.add('hidden');
                    lotesContainer.classList.remove('hidden');
                    kitContainer.classList.add('hidden');
                    lotesList.innerHTML = '';
                    product.lotes.forEach(lote => addLote(lote.name, lote.price, lote.startDate));
                } else if (product.priceType === 'kit' && product.kitItems) {
                    document.querySelector('input[name="price-type"][value="kit"]').checked = true;
                    fixedPriceContainer.classList.add('hidden');
                    variablePricesContainer.classList.add('hidden');
                    lotesContainer.classList.add('hidden');
                    kitContainer.classList.remove('hidden');
                    kitBasePriceInput.value = product.kitBasePrice || product.price;
                    kitItemsList.innerHTML = '';
                    product.kitItems.forEach(item => addKitItemRow(item.name, item.options ? item.options.join(', ') : ''));
                } else {
                    // Legacy subscription may have had 'subscription' priceType
                    // Fallback to 'fixed' if so.
                    document.querySelector('input[name="price-type"][value="fixed"]').checked = true;
                    fixedPriceContainer.classList.remove('hidden');
                    variablePricesContainer.classList.add('hidden');
                    lotesContainer.classList.add('hidden');
                    kitContainer.classList.add('hidden');
                    productPriceInput.value = product.price;
                }

                // Handle Addons load
                if (addonsList) {
                    addonsList.innerHTML = '';
                    if (product.addons && product.addons.length > 0) {
                        product.addons.forEach(addon => addAddon(addon.name, addon.price));
                    }
                }

                // Handle Subscription toggle
                if (product.isSubscription || product.priceType === 'subscription') {
                    if (productIsSubscriptionInput) productIsSubscriptionInput.checked = true;
                    if (subscriptionFrequencyContainer) subscriptionFrequencyContainer.classList.remove('hidden');
                    if (product.subscriptionFrequencyInput && subscriptionFrequencyInput) {
                        subscriptionFrequencyInput.value = product.subscriptionFrequencyInput;
                    }
                } else {
                    if (productIsSubscriptionInput) productIsSubscriptionInput.checked = false;
                    if (subscriptionFrequencyContainer) subscriptionFrequencyContainer.classList.add('hidden');
                    if (subscriptionFrequencyInput) subscriptionFrequencyInput.value = '1_months';
                }

                productVisibleInput.checked = product.visible || false;
                productAvailableInput.checked = product.available !== false; // Default to true if undefined
                productPublicInput.checked = product.acessoPublico || false;
                productIsTicketInput.checked = product.isTicket || false;
                productAvailabilityDateInput.value = product.availabilityDate || '';
                productHasSizesInput.checked = product.hasSizes || false;
                if (product.hasSizes) {
                    productSizesContainer.classList.remove('hidden');
                    productSizesInput.value = product.sizes ? product.sizes.join(', ') : '';
                    if (productSizesLabelInput) productSizesLabelInput.value = product.sizesLabel || '';
                } else {
                    productSizesContainer.classList.add('hidden');
                    productSizesInput.value = '';
                }
                productAskProfessorInput.checked = product.askProfessor || false;
                productAskAgeInput.checked = product.askAge || false;
                productControlStockInput.checked = product.controlStock || false;
                if (product.controlStock) {
                    stockContainer.classList.remove('hidden');
                    if (product.hasSizes && product.sizeStock) {
                        // Use the existing sizeStock map
                        renderSizeStockInputs(product.sizeStock || {});
                    } else {
                        // Simple qty
                        renderSizeStockInputs({});
                        productStockQuantityInput.value = product.stockQuantity || 0;
                    }
                } else {
                    stockContainer.classList.add('hidden');
                    productStockQuantityInput.value = '';
                }
                productCustomUnitsInput.value = product.customUnits ? product.customUnits.join(', ') : '';
                
                if (productMpAccountSelect) productMpAccountSelect.value = product.mpAccountId || 'default';
                if (productMpSplitInput) productMpSplitInput.value = product.mpSplitPercentage || '';

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

                // Handle Event Config load
                if (productIsEventInput) {
                    productIsEventInput.checked = product.isEvent || false;
                    eventConfigContainer.classList.toggle('hidden', !productIsEventInput.checked);
                    
                    if (productEventAddressInput) {
                        productEventAddressInput.value = product.eventAddress || '';
                    }

                    if (eventSlotsList) {
                        eventSlotsList.innerHTML = '';
                        if (product.eventConfig && product.eventConfig.scheduleSlots) {
                            product.eventConfig.scheduleSlots.forEach(slot => {
                                // variationNames is the new array field, variationName is the fallback
                                const belts = slot.variationNames || (slot.variationName ? [slot.variationName] : []);
                                addEventSlotRow(belts, slot.day, slot.time, slot.ring, slot.minAge, slot.maxAge, slot.programId || 'tradicional');
                            });
                        }
                    }
                }

                saveProductBtn.textContent = 'Atualizar Produto';
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
            closeProductModal();
            fetchProducts(); // Refresh the list
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Erro ao excluir produto.');
        }
    };

    if (deleteProductBtn) deleteProductBtn.addEventListener('click', () => {
        const id = productIdInput.value;
        const name = productNameInput.value;
        if (id) {
            if (deleteConfirmationMessage) {
                deleteConfirmationMessage.textContent = `Tem certeza que deseja excluir o produto "${name}"? Esta ação não pode ser desfeita.`;
            }
            if (deleteConfirmationModal) {
                deleteConfirmationModal.classList.remove('hidden');
            }
        }
    });

    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => {
        if (deleteConfirmationModal) {
            deleteConfirmationModal.classList.add('hidden');
        }
    });

    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => {
        const id = productIdInput.value;
        if (id) {
            deleteProduct(id);
            if (deleteConfirmationModal) {
                deleteConfirmationModal.classList.add('hidden');
            }
        }
    });



    // --- Price Type Switching Logic ---
    priceTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            fixedPriceContainer.classList.add('hidden');
            variablePricesContainer.classList.add('hidden');
            lotesContainer.classList.add('hidden');
            kitContainer.classList.add('hidden');

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
            } else if (radio.value === 'kit') {
                kitContainer.classList.remove('hidden');
                if (kitItemsList.children.length === 0) {
                    addKitItemRow();
                }
            }
            // Addons estão sempre visíveis para Assinatura e Fixo pois são úteis
            if (addonsContainer) addonsContainer.classList.remove('hidden');
        });
    });

    if (productIsSubscriptionInput) {
        productIsSubscriptionInput.addEventListener('change', () => {
            if (productIsSubscriptionInput.checked) {
                if (subscriptionFrequencyContainer) subscriptionFrequencyContainer.classList.remove('hidden');
            } else {
                if (subscriptionFrequencyContainer) subscriptionFrequencyContainer.classList.add('hidden');
            }
        });
    }

    // --- Stock per-size helper ---
    const stockSimpleDiv = document.getElementById('stock-simple');
    const stockPerSizeDiv = document.getElementById('stock-per-size');
    const stockPerSizeInputs = document.getElementById('stock-per-size-inputs');

    const renderSizeStockInputs = (existingSizeStock = {}) => {
        if (!stockPerSizeInputs) return;
        const hasSizes = productHasSizesInput && productHasSizesInput.checked;
        const controlStock = productControlStockInput && productControlStockInput.checked;

        if (controlStock && hasSizes) {
            // Show per-size inputs, hide simple input
            if (stockSimpleDiv) stockSimpleDiv.classList.add('hidden');
            if (stockPerSizeDiv) stockPerSizeDiv.classList.remove('hidden');

            const sizes = productSizesInput.value.split(',').map(s => s.trim()).filter(s => s);
            stockPerSizeInputs.innerHTML = '';
            sizes.forEach(size => {
                const qty = existingSizeStock[size] !== undefined ? existingSizeStock[size] : '';
                const row = document.createElement('div');
                row.className = 'flex items-center gap-3';
                row.innerHTML = `
                    <span class="text-sm font-medium text-gray-200 w-16 flex-shrink-0">${size}</span>
                    <input type="number" data-size="${size}" data-stock-size-input 
                        class="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Qtd" min="0" value="${qty}" />
                `;
                stockPerSizeInputs.appendChild(row);
            });
        } else if (controlStock && !hasSizes) {
            // Show simple input, hide per-size
            if (stockSimpleDiv) stockSimpleDiv.classList.remove('hidden');
            if (stockPerSizeDiv) stockPerSizeDiv.classList.add('hidden');
        }
    };

    if (productHasSizesInput) productHasSizesInput.addEventListener('change', () => {
        productSizesContainer.classList.toggle('hidden', !productHasSizesInput.checked);
        renderSizeStockInputs();
    });

    // Re-render size stock inputs when sizes text changes
    if (productSizesInput) productSizesInput.addEventListener('input', () => {
        if (productControlStockInput && productControlStockInput.checked && productHasSizesInput && productHasSizesInput.checked) {
            renderSizeStockInputs();
        }
    });

    if (productControlStockInput) productControlStockInput.addEventListener('change', () => {
        stockContainer.classList.toggle('hidden', !productControlStockInput.checked);
        renderSizeStockInputs();
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

    const addKitItemRow = (name = '', options = '') => {
        const itemRow = document.createElement('div');
        itemRow.className = 'kit-item-row grid grid-cols-[1fr,2fr,auto] gap-2 items-center';
        const isKitPrice = document.querySelector('input[name="price-type"]:checked').value === 'kit';

        itemRow.innerHTML = `
            <input type="text" name="kit-item-name" placeholder="Item (ex: Bota)" value="${name}" class="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${isKitPrice ? 'required' : ''}>
            <input type="text" name="kit-item-options" placeholder="Opções (ex: P, M, G)" value="${options}" class="w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${isKitPrice ? 'required' : ''}>
            <button type="button" class="remove-kit-item-btn text-red-500 hover:text-red-400">&times;</button>
        `;
        kitItemsList.appendChild(itemRow);
    };

    if (addKitItemBtn) addKitItemBtn.addEventListener('click', () => addKitItemRow());

    if (kitItemsList) kitItemsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-kit-item-btn')) {
            e.target.closest('.kit-item-row').remove();
        }
    });

    const addAddon = (name = '', price = '') => {
        if (!addonsList) return;
        const addonItem = document.createElement('div');
        addonItem.className = 'addon-item flex items-center space-x-2 mb-2';
        addonItem.innerHTML = `
            <input type="text" name="addon-name" placeholder="Nome do Addon (ex: Camiseta Extra)" value="${name}" class="w-1/2 px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <input type="number" name="addon-price" placeholder="Preço (centavos)" value="${price}" class="w-1/2 px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button type="button" class="remove-addon-btn text-red-500 hover:text-red-400">&times;</button>
        `;
        addonsList.appendChild(addonItem);
    };

    if (addAddonBtn) addAddonBtn.addEventListener('click', () => addAddon());

    if (addonsList) addonsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-addon-btn')) {
            e.target.closest('.addon-item').remove();
        }
    });

    // --- EVENT CONFIGURATION LOGIC ---
    const refreshAllEventSlotDropdowns = () => {
        if (!eventSlotsList) return;
        const variants = getCurrentProductVariants();
        const slots = eventSlotsList.querySelectorAll('.event-slot-row');
        slots.forEach(slot => {
            const select = slot.querySelector('[name="event-slot-category"]');
            if (select) {
                const currentValue = select.value;
                let optionsHtml = variants.map(v => `<option value="${v}" ${v === currentValue ? 'selected' : ''}>${v}</option>`).join('');
                if (currentValue && !variants.includes(currentValue)) {
                    optionsHtml = `<option value="${currentValue}" selected>${currentValue} (Variação Antiga / Não Definida)</option>` + optionsHtml;
                }
                select.innerHTML = optionsHtml;
            }
        });
    };

    // Listeners for real-time sync with price variations
    if (priceVariantsList) {
        priceVariantsList.addEventListener('input', (e) => {
            if (e.target.name === 'variant-name') refreshAllEventSlotDropdowns();
        });
        priceVariantsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-price-variant-btn')) {
                setTimeout(refreshAllEventSlotDropdowns, 50);
            }
        });
    }
    if (lotesList) {
        lotesList.addEventListener('input', (e) => {
            if (e.target.name === 'lote-name') refreshAllEventSlotDropdowns();
        });
        lotesList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-lote-btn')) {
                setTimeout(refreshAllEventSlotDropdowns, 50);
            }
        });
    }
    if (addPriceVariantBtn) addPriceVariantBtn.addEventListener('click', () => setTimeout(refreshAllEventSlotDropdowns, 50));
    if (addLoteBtn) addLoteBtn.addEventListener('click', () => setTimeout(refreshAllEventSlotDropdowns, 50));

    if (productNameInput) {
        productNameInput.addEventListener('input', () => refreshAllEventSlotDropdowns());
    }

    document.querySelectorAll('input[name="price-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            setTimeout(refreshAllEventSlotDropdowns, 50);
        });
    });

    if (productIsEventInput) {
        productIsEventInput.addEventListener('change', () => {
            const isEvent = productIsEventInput.checked;
            eventConfigContainer.classList.toggle('hidden', !isEvent);
            if (isEvent) {
                refreshAllEventSlotDropdowns();
                // Força o campo de idade se for evento, para garantir a precisão dos ringues
                if (productAskAgeInput) productAskAgeInput.checked = true;
            }
        });
    }

    const kiHapPrograms = {
        tradicional: {
            label: 'Tradicional',
            belts: ['Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida', 'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida', 'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida', 'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida', 'Vermelha e preta', 'Preta', '1º Dan Preta', '2º Dan Preta', '3º Dan Preta', '4º Dan Preta', '5º Dan Preta', '6º Dan Preta', '7º Dan Preta', '8º Dan Preta', '9º Dan Preta']
        },
        littles: {
            label: 'Littles',
            belts: ['Littles Branca', 'Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta', 'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix']
        },
        baby_littles: {
            label: 'Baby Littles',
            belts: ['Baby Littles Branco', 'Baby Littles Amarelo', 'Baby Littles Laranja', 'Baby Littles Verde']
        }
    };

    const addEventSlotRow = (variationName = '', day = '', time = '', ring = '', minAge = '', maxAge = '', programId = 'tradicional') => {
        const slotRow = document.createElement('div');
        slotRow.className = 'event-slot-row bg-purple-900/10 p-5 rounded-2xl border border-purple-600/20 mb-4 transition-all hover:bg-purple-900/20 shadow-lg';
        
        // Handle variations (can be string or array)
        let selectedBelts = [];
        if (Array.isArray(variationName)) {
            selectedBelts = variationName;
        } else if (variationName) {
            selectedBelts = [variationName];
        }

        // Handle legacy data where variationName might be the belt
        // If variationName exists but programId is default, try to detect program
        if (selectedBelts.length > 0 && programId === 'tradicional') {
            for (const [id, data] of Object.entries(kiHapPrograms)) {
                if (data.belts.includes(selectedBelts[0])) {
                    programId = id;
                    break;
                }
            }
        }

        const programOptions = Object.entries(kiHapPrograms).map(([id, data]) => 
            `<option value="${id}" ${id === programId ? 'selected' : ''}>${data.label}</option>`
        ).join('');

        const updateBeltsForSlot = (dropdownEl, textEl, selectedProgram, currentBelts) => {
            const belts = kiHapPrograms[selectedProgram]?.belts || [];
            dropdownEl.innerHTML = belts.map(b => `
                <label class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                    <input type="checkbox" name="event-slot-belt" value="${b}" ${currentBelts.includes(b) ? 'checked' : ''} 
                        class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500">
                    <span class="text-sm text-gray-200">${b}</span>
                </label>
            `).join('');
            
            const updateText = () => {
                const checked = Array.from(dropdownEl.querySelectorAll('input:checked')).map(i => i.value);
                if (checked.length === 0) {
                    textEl.textContent = 'Selecionar Faixas...';
                    textEl.classList.add('text-gray-500');
                } else if (checked.length === 1) {
                    textEl.textContent = checked[0];
                    textEl.classList.remove('text-gray-500');
                } else {
                    textEl.textContent = `${checked.length} Faixas selecionadas`;
                    textEl.classList.remove('text-gray-500');
                }
            };

            dropdownEl.querySelectorAll('input').forEach(i => i.addEventListener('change', updateText));
            updateText();
        };

        slotRow.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-[10px] text-purple-400 font-bold uppercase mb-1.5 block tracking-wider">Programa</label>
                        <select name="event-slot-program" 
                            class="w-full px-4 py-2.5 text-sm text-white bg-gray-900/80 border border-gray-700/50 rounded-xl focus:outline-none focus:border-purple-500 shadow-inner">
                            ${programOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] text-purple-400 font-bold uppercase mb-1.5 block tracking-wider">Graduações (Multi-seleção)</label>
                        <div class="relative event-belts-container">
                            <button type="button" class="select-belts-btn w-full px-4 py-2.5 text-sm text-left text-white bg-gray-900/80 border border-gray-700/50 rounded-xl focus:outline-none focus:border-purple-500 shadow-inner flex justify-between items-center transition-all">
                                <span class="selected-belts-text truncate">Selecionar Faixas...</span>
                                <i class="fas fa-chevron-down text-[10px] text-gray-500 transition-transform"></i>
                            </button>
                            <div class="belts-dropdown hidden absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl p-2 space-y-1 backdrop-blur-md">
                                <!-- Populated by JS -->
                            </div>
                        </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-[10px] text-purple-400 font-bold uppercase mb-1.5 block tracking-wider">Dia do Evento</label>
                        <input type="text" name="event-slot-day" value="${day}" placeholder="Ex: Sábado" 
                            class="w-full px-4 py-2.5 text-sm text-white bg-gray-900/80 border border-gray-700/50 rounded-xl focus:outline-none focus:border-purple-500 shadow-inner">
                    </div>
                    <div class="grid grid-cols-2 gap-4 items-end">
                        <div>
                            <label class="text-[10px] text-purple-400 font-bold uppercase mb-1.5 block tracking-wider">Hora</label>
                            <input type="text" name="event-slot-time" value="${time}" placeholder="09:00" 
                                class="w-full px-4 py-2.5 text-sm text-white bg-gray-900/80 border border-gray-700/50 rounded-xl focus:outline-none focus:border-purple-500 text-center shadow-inner">
                        </div>
                        <div>
                            <label class="text-[10px] text-purple-400 font-bold uppercase mb-1.5 block tracking-wider">Ringue</label>
                            <input type="number" name="event-slot-ring" value="${ring}" placeholder="1" 
                                class="w-full px-4 py-2.5 text-sm text-white bg-gray-900/80 border border-gray-700/50 rounded-xl focus:outline-none focus:border-purple-500 text-center shadow-inner font-bold">
                        </div>
                    </div>
                </div>

                 <div class="grid grid-cols-2 gap-4 pt-2">
                    <div>
                        <label class="text-[10px] text-purple-400 font-bold uppercase mb-1.5 block tracking-wider">Idade Mín.</label>
                        <input type="number" name="event-slot-min-age" value="${minAge}" placeholder="0" 
                            class="w-full px-4 py-2.5 text-sm text-white bg-gray-900/80 border border-gray-700/50 rounded-xl focus:outline-none focus:border-purple-500 text-center shadow-inner">
                    </div>
                    <div>
                        <label class="text-[10px] text-purple-400 font-bold uppercase mb-1.5 block tracking-wider">Idade Máx.</label>
                        <input type="number" name="event-slot-max-age" value="${maxAge}" placeholder="99" 
                            class="w-full px-4 py-2.5 text-sm text-white bg-gray-900/80 border border-gray-700/50 rounded-xl focus:outline-none focus:border-purple-500 text-center shadow-inner">
                    </div>
                </div>

                <div class="flex justify-end pt-2 border-t border-purple-600/10">
                    <button type="button" class="remove-event-slot-btn text-red-400 hover:text-red-300 px-4 py-2 text-xs font-bold uppercase flex items-center gap-2 bg-red-500/5 rounded-lg border border-red-500/10 transition-all hover:bg-red-500/10">
                        <i class="fas fa-trash-alt text-[10px]"></i> Remover Slot
                    </button>
                </div>
            </div>
        `;

        const programSelect = slotRow.querySelector('[name="event-slot-program"]');
        const beltBtn = slotRow.querySelector('.select-belts-btn');
        const beltDropdown = slotRow.querySelector('.belts-dropdown');
        const beltText = slotRow.querySelector('.selected-belts-text');

        // Toggle dropdown
        beltBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            beltDropdown.classList.toggle('hidden');
            beltBtn.querySelector('i').classList.toggle('rotate-180');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!beltBtn.contains(e.target) && !beltDropdown.contains(e.target)) {
                beltDropdown.classList.add('hidden');
                beltBtn.querySelector('i').classList.remove('rotate-180');
            }
        });

        programSelect.addEventListener('change', () => {
            updateBeltsForSlot(beltDropdown, beltText, programSelect.value, []);
        });

        // Initial population
        updateBeltsForSlot(beltDropdown, beltText, programId, selectedBelts);

        eventSlotsList.appendChild(slotRow);
    };

    if (addEventSlotBtn) {
        addEventSlotBtn.addEventListener('click', () => addEventSlotRow());
    }

    if (eventSlotsList) {
        eventSlotsList.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-event-slot-btn');
            if (btn) btn.closest('.event-slot-row').remove();
        });
    }

    const getEventConfigFromUI = () => {
        const slots = [];
        const rows = eventSlotsList.querySelectorAll('.event-slot-row');
        rows.forEach(row => {
            const programSelect = row.querySelector('[name="event-slot-program"]');
            const programId = programSelect ? programSelect.value : 'tradicional';
            
            // Get all checked belts
            const checkedBelts = Array.from(row.querySelectorAll('input[name="event-slot-belt"]:checked')).map(i => i.value);
            
            const day = row.querySelector('[name="event-slot-day"]').value.trim();
            const time = row.querySelector('[name="event-slot-time"]').value.trim();
            const ring = parseInt(row.querySelector('[name="event-slot-ring"]').value) || 0;
            const minAge = parseInt(row.querySelector('[name="event-slot-min-age"]').value) || null;
            const maxAge = parseInt(row.querySelector('[name="event-slot-max-age"]').value) || null;
            
            if (checkedBelts.length > 0) {
                slots.push({ 
                    variationNames: checkedBelts, // Storing as array
                    variationName: checkedBelts[0], // Backward compatibility
                    programId: programId,
                    day, 
                    time, 
                    ring, 
                    minAge, 
                    maxAge 
                });
            }
        });
        return {
            isEvent: productIsEventInput.checked,
            eventAddress: productEventAddressInput ? productEventAddressInput.value.trim() : '',
            eventConfig: {
                scheduleSlots: slots
            }
        };
    };

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
                </div>
            `;
        }

        if (sale.kitSelections && Object.keys(sale.kitSelections).length > 0) {
            const kitSelectionsHtml = Object.entries(sale.kitSelections).map(([itemName, option]) =>
                `<li>${itemName}: ${option}</li>`
            ).join('');
            productDetailsHtml += `
                <div class="mt-2">
                    <strong class="text-sm border-b border-gray-600 pb-1 text-gray-400 block mb-1">Opções do Kit:</strong>
                    <ul class="list-disc list-inside text-sm text-yellow-300 pl-2">
                        ${kitSelectionsHtml}
                    </ul>
                </div>
            `;
        }

        let paymentDetailsHtml = '';
        if (sale.paymentDetails) {
            const details = sale.paymentDetails;
            let method = details.method || 'N/A';
            
            // Map common Mercado Pago and manual payment methods to Portuguese
            const methodMap = {
                'credit_card': 'Cartão de Crédito',
                'debit_card': 'Cartão de Débito',
                'ticket': 'Boleto',
                'bank_transfer': 'Pix/Transferência',
                'account_money': 'Saldo Mercado Pago',
                'pix': 'PIX',
                'card': 'Cartão',
                'cash': 'Dinheiro',
                'manual_update': 'Manual (Admin)'
            };
            method = methodMap[method] || method;

            paymentDetailsHtml = `<div class="mt-4 pt-4 border-t border-gray-700/50">
                <h4 class="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Origem do Pagamento</h4>
                <p><span class="text-gray-400">Método:</span> <span class="text-white font-medium">${method}</span></p>`;

            if (details.cardLast4) {
                paymentDetailsHtml += `<p><span class="text-gray-400">Cartão:</span> <span class="text-white">**** **** **** ${details.cardLast4}</span></p>`;
            }
            if (details.cardBrand || details.paymentMethodId) {
                paymentDetailsHtml += `<p><span class="text-gray-400">Bandeira/Rede:</span> <span class="text-white uppercase">${details.cardBrand || details.paymentMethodId}</span></p>`;
            }
            if (details.installments && details.installments > 1) {
                paymentDetailsHtml += `<p><span class="text-gray-400">Parcelas:</span> <span class="text-white">${details.installments}x</span></p>`;
            }
            if (details.authCode) {
                paymentDetailsHtml += `<p><span class="text-gray-400">Cód. Autorização:</span> <span class="text-white">${details.authCode}</span></p>`;
            }
            if (details.updatedBy) {
                paymentDetailsHtml += `<p><span class="text-gray-400">Atualizado por:</span> <span class="text-white">${details.updatedBy}</span></p>`;
            }
            paymentDetailsHtml += `</div>`;
        }

        modalContent.innerHTML = `
            <div class="space-y-6">
                <!-- ID e Info Básica -->
                <div class="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1 font-bold">ID da Venda</p>
                    <p class="text-sm font-mono text-blue-400 break-all">${sale.id}</p>
                    ${sale.studentId ? `
                        <div class="mt-2 pt-2 border-t border-gray-700/50">
                            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1 font-bold">ID do Aluno</p>
                            <p class="text-sm font-mono text-gray-300 break-all">${sale.studentId}</p>
                        </div>
                    ` : ''}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Coluna 1: Cliente -->
                    <div class="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                        <h4 class="text-blue-400 font-bold mb-3 flex items-center gap-2">
                            <span>👤</span> Dados do Cliente
                        </h4>
                        <div class="space-y-2 text-sm">
                            <p><span class="text-gray-400">Nome:</span> <span class="text-white font-medium">${sale.userName || 'N/A'}</span></p>
                            <p><span class="text-gray-400">Email:</span> <span class="text-white break-all">${sale.userEmail || 'N/A'}</span></p>
                            <p><span class="text-gray-400">Telefone:</span> <span class="text-white">${sale.userPhone || 'N/A'}</span></p>
                            <p><span class="text-gray-400">CPF:</span> <span class="text-white">${sale.userCpf || 'N/A'}</span></p>
                            ${sale.userAge ? `<p><span class="text-gray-400">Idade:</span> <span class="text-white">${sale.userAge}</span></p>` : ''}
                            <p><span class="text-gray-400">Unidade:</span> <span class="text-white">${sale.userUnit || 'N/A'}</span></p>
                            <p><span class="text-gray-400">Programa:</span> <span class="text-white">${sale.userPrograma || 'N/A'}</span></p>
                            <p><span class="text-gray-400">Graduação:</span> <span class="text-white">${sale.userGraduacao || 'N/A'}</span></p>
                        </div>
                        </div>
                    </div>

                    <!-- Coluna 2: Produto e Pagamento -->
                    <div class="space-y-4">
                        <!-- Card Produto -->
                        <div class="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 h-full">
                            <h4 class="text-purple-400 font-bold mb-3 flex items-center gap-2">
                                <span>🛍️</span> Produto
                            </h4>
                            <div class="space-y-2 text-sm">
                                <p><span class="text-gray-400">Item:</span> <span class="text-white font-medium">${sale.productName || 'N/A'}</span></p>
                                ${sale.userSize ? `<p><span class="text-gray-400">Tamanho:</span> <span class="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded font-bold">${sale.userSize}</span></p>` : ''}
                                <div class="mt-2 text-gray-300">
                                    ${productDetailsHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Info Pagamento -->
                <div class="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                    <h4 class="text-green-400 font-bold mb-3 flex items-center gap-2">
                        <span>💳</span> Detalhes Financeiros
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div class="space-y-2">
                            <p><span class="text-gray-400">Valor Total:</span> <span class="text-green-400 font-bold text-lg">${(sale.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                            <p><span class="text-gray-400">Status:</span> ${renderStatusTag(sale.paymentStatus)}</p>
                            <p><span class="text-gray-400">Data:</span> <span class="text-white">${sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A'}</span></p>
                        </div>
                        <div class="border-l border-gray-700/50 pl-4">
                            ${paymentDetailsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load email logs
        await loadEmailLogs(saleId);

        modal.classList.remove('hidden');

        // Recover Cart button logic
        if (sale.paymentStatus === 'pending') {
            recoverCartBtnModal.classList.remove('hidden');
            recoverCartBtnModal.onclick = () => {
                if (!sale.mercadoPagoPreferenceId) {
                    alert('Não foi possível encontrar o ID do Mercado Pago (Preferência) salvo para esta venda.\n\nVendas criadas antes desta atualização podem não possuir este dado salvo.');
                    return;
                }
                const link = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${sale.mercadoPagoPreferenceId}`;
                
                navigator.clipboard.writeText(link).then(() => {
                    alert('Link de pagamento copiado para a área de transferência com sucesso!\n\nVocê já pode colar (Ctrl+V) no WhatsApp para o cliente.\n\nLink: ' + link);
                }).catch(() => {
                    prompt('Não foi possível copiar automaticamente. Selecione e copie o link abaixo:', link);
                });
            };
        } else {
            recoverCartBtnModal.classList.add('hidden');
            recoverCartBtnModal.onclick = null;
        }

        if (currentUser && (currentUser.isAdmin || currentUser.isStore)) {
            deleteSaleBtnModal.style.display = 'inline-block';
        } else {
            deleteSaleBtnModal.style.display = 'none';
        }

        // Fulfillment status logic
        if (fulfillmentStatusSelect) {
            fulfillmentStatusSelect.value = sale.fulfillmentStatus || 'pending';
            fulfillmentStatusSelect.onchange = async () => {
                const newStatus = fulfillmentStatusSelect.value;
                try {
                    const saleRef = doc(db, 'inscricoesFaixaPreta', saleId);
                    await updateDoc(saleRef, {
                        fulfillmentStatus: newStatus,
                        lastModifiedAt: serverTimestamp()
                    });
                    
                    // Update local state
                    sale.fulfillmentStatus = newStatus;
                    
                    alert('Status de entrega atualizado com sucesso!');
                } catch (error) {
                    console.error("Erro ao atualizar status de entrega:", error);
                    alert('Erro ao atualizar status de entrega. Verifique o console.');
                    // Revert UI if it failed
                    fulfillmentStatusSelect.value = sale.fulfillmentStatus || 'pending';
                }
            };
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
        const btn = e.target.closest('.update-status-btn');
        if (btn) {
            openModalWithSaleDetails(btn.dataset.saleId);
            return;
        }
        
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
        if (!currentUser || (!currentUser.isAdmin && !currentUser.isStore)) {
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
        await fetchMpAccounts(); // Fetch MP Accounts for product forms
        await fetchProducts(); // Fetch products first to populate filter
        fetchSales();   // Fetch sales
        populateFilters();    // Then populate filters with data from both
        populateEventFilter(); // Populate the events tab filter as well
        await fetchBanners();
        await fetchCoupons();
        // fetchCheckins() is now called when switching to the tab
        applyFilters();
    };

    // --- Events Tab Logic (Upgraded) ---
    const fetchEventSubscribers = async () => {
        const selectedProductId = eventProductFilter.value;
        if (!selectedProductId) {
            eventsTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-500 italic">Selecione um evento para visualizar os inscritos.</td></tr>';
            updateEventKPIs([]);
            if (eventRingFilter) eventRingFilter.innerHTML = '<option value="">Todos</option>';
            if (eventUnitFilter) eventUnitFilter.innerHTML = '<option value="">Todas</option>';
            return;
        }

        eventsTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-8">Carregando inscritos...</td></tr>';
        try {
            const q = query(
                collection(db, 'inscricoesFaixaPreta'),
                where('productId', '==', selectedProductId),
                where('paymentStatus', '==', 'paid'),
                orderBy('created', 'desc')
            );
            const querySnapshot = await getDocs(q);
            allCheckins = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Popula filtros dinâmicos de Ringue e Unidade com base nos inscritos deste evento
            const rings = new Set();
            const units = new Set();
            allCheckins.forEach(sub => {
                if (sub.eventRing) rings.add(sub.eventRing);
                if (sub.userUnit) units.add(sub.userUnit);
            });

            if (eventRingFilter) {
                const sortedRings = Array.from(rings).sort((a, b) => a - b);
                eventRingFilter.innerHTML = '<option value="">Todos</option>' + 
                    sortedRings.map(r => `<option value="${r}">Ringue ${r}</option>`).join('');
            }

            if (eventUnitFilter) {
                const sortedUnits = Array.from(units).sort();
                eventUnitFilter.innerHTML = '<option value="">Todas</option>' + 
                    sortedUnits.map(u => `<option value="${u}">${u}</option>`).join('');
            }

            applyEventFilters();
        } catch (error) {
            console.error('Error fetching event subscribers:', error);
            eventsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Erro ao carregar inscritos: ${error.message}</td></tr>`;
        }
    };

    const updateEventKPIs = (subscribers) => {
        if (totalEventSubscribersElem) totalEventSubscribersElem.textContent = subscribers.length;
        
        const checkins = subscribers.filter(s => s.checkinStatus === 'realizado');
        if (totalEventCheckinsElem) totalEventCheckinsElem.textContent = checkins.length;

        if (ringStatsList) {
            const rings = {};
            subscribers.forEach(s => {
                const ring = s.eventRing || 'S/R';
                rings[ring] = (rings[ring] || 0) + 1;
            });

            ringStatsList.innerHTML = Object.entries(rings)
                .sort((a, b) => a[0] - b[0])
                .map(([ring, count]) => `
                    <div class="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 min-w-[80px] text-center">
                        <p class="text-[10px] text-gray-500 uppercase">Ringue ${ring}</p>
                        <p class="text-lg font-bold text-blue-400">${count}</p>
                    </div>
                `).join('') || '<p class="text-xs text-gray-600 italic">Nenhum dado por ringue</p>';
        }
    };

    const populateEventFilter = () => {
        const eventProducts = allProducts.filter(p => p.isEvent || p.isTicket);
        eventProductFilter.innerHTML = '<option value="">Selecione um Evento...</option>';
        eventProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            eventProductFilter.appendChild(option);
        });
    };

    const displayEventSubscribers = (subscribers) => {
        eventsTableBody.innerHTML = '';
        if (subscribers.length === 0) {
            eventsTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-8">Nenhum inscrito encontrado com estes filtros.</td></tr>';
            return;
        }

        subscribers.forEach(sub => {
            const row = eventsTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700', 'hover:bg-gray-800', 'cursor-pointer', 'transition-colors');
            row.dataset.saleId = sub.id;

            const checkinStatusClass = sub.checkinStatus === 'realizado' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400';
            const checkinStatusText = sub.checkinStatus === 'realizado' ? 'Check-in OK' : 'Pendente';
            const graduation = sub.userGraduacao || sub.variationName || sub.chosenVariant || 'N/A';
            const program = sub.userPrograma ? ` (${sub.userPrograma})` : '';
            const variant = `${graduation}${program}`;
            const ring = sub.eventRing || '-';
            const dateTime = sub.eventDay && sub.eventTime ? `${sub.eventDay} às ${sub.eventTime}` : (sub.eventTime || '-');

            row.innerHTML = `
                <td class="p-4 font-mono text-xs text-blue-400">#${sub.attendeeNumber || '---'}</td>
                <td class="p-4">
                    <div class="font-medium">${sub.userName || 'N/A'}</div>
                    <div class="text-[10px] text-gray-500">${sub.userEmail || ''}</div>
                </td>
                <td class="p-4 text-xs">${variant}</td>
                <td class="p-4 text-center"><span class="px-2 py-1 bg-blue-500/10 rounded text-blue-400 font-bold">${ring}</span></td>
                <td class="p-4 text-xs text-gray-400">${dateTime}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${checkinStatusClass}">
                        ${checkinStatusText}
                    </span>
                </td>
            `;
        });
        updateEventKPIs(subscribers);
    };

    const applyEventFilters = () => {
        const searchTerm = eventSearchInput.value.toLowerCase();
        const ringFilter = eventRingFilter?.value || '';
        const unitFilter = eventUnitFilter?.value || '';

        let filtered = allCheckins.filter(sub => {
            const nameMatch = !searchTerm || (sub.userName && sub.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (sub.userEmail && sub.userEmail.toLowerCase().includes(searchTerm));
            const ringMatch = !ringFilter || (sub.eventRing == ringFilter);
            const unitMatch = !unitFilter || (sub.userUnit == unitFilter);
            
            return (nameMatch || emailMatch) && ringMatch && unitMatch;
        });
        displayEventSubscribers(filtered);
    };

    const exportEventToCSV = () => {
        if (allCheckins.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }
        const selectedProduct = allProducts.find(p => p.id === eventProductFilter.value);
        const eventName = selectedProduct ? selectedProduct.name.replace(/\s+/g, '_') : 'evento';
        const headers = ['Numero', 'Nome', 'Email', 'Telefone', 'CPF', 'Categoria', 'Ringue', 'Dia', 'Hora', 'Check-in', 'Data Compra'];
        const rows = allCheckins.map(sub => [
            sub.attendeeNumber || '',
            sub.userName || '',
            sub.userEmail || '',
            sub.userPhone || '',
            sub.userCPF || '',
            sub.variationName || sub.chosenVariant || '',
            sub.eventRing || '',
            sub.eventDay || '',
            sub.eventTime || '',
            sub.checkinStatus === 'realizado' ? 'SIM' : 'NAO',
            sub.created ? new Date(sub.created.toDate()).toLocaleString('pt-BR') : ''
        ]);
        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.map(field => `"${field}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `inscritos_${eventName}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (eventProductFilter) eventProductFilter.addEventListener('change', fetchEventSubscribers);
    if (eventSearchInput) eventSearchInput.addEventListener('keyup', applyEventFilters);
    if (eventRingFilter) eventRingFilter.addEventListener('change', applyEventFilters);
    if (eventUnitFilter) eventUnitFilter.addEventListener('change', applyEventFilters);
    if (exportEventCsvBtn) exportEventCsvBtn.addEventListener('click', exportEventToCSV);
    if (eventsTableBody) eventsTableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.saleId) openModalWithSaleDetails(row.dataset.saleId);
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

            if (isAdmin || isStore) {
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
