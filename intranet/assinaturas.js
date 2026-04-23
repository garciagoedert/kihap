import { getCurrentUser } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export async function setupAssinaturasPage() {
    
    // User Profile Display -> not strictly needed here since loadComponents handles header
    const currentUser = await getCurrentUser();
    if (!currentUser) return; // Se não logado auth.js vai chutar.

    // State
    let allSubscriptions = [];
    let currentOpenSub = null;
    
    // UI Elements
    const tableBody = document.getElementById('subscriptions-table-body');
    const emptyState = document.getElementById('empty-state');
    const loadingBadge = document.getElementById('loading-badge');
    const searchInput = document.getElementById('sub-search-input');
    const unitFilter = document.getElementById('filter-unit');
    const statusFilter = document.getElementById('filter-status');
    const productFilter = document.getElementById('filter-product');
    const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    const filterGridContainer = document.getElementById('filter-grid-container');

    // Modal Elements
    const subModal = document.getElementById('subscription-details-modal');
    const subModalContent = document.getElementById('sub-modal-content');
    const closeSubModalBtn = document.getElementById('close-sub-modal-btn');
    const closeSubModalFooterBtn = document.getElementById('close-sub-modal-footer-btn');
    const cancelSubBtnModal = document.getElementById('cancel-sub-btn-modal');

    const renderSubscriptions = (subscriptions) => {
        tableBody.innerHTML = '';
        
        if (!subscriptions || subscriptions.length === 0) {
            emptyState.classList.remove('hidden');
            updateKPIs(subscriptions);
            return;
        }
        
        emptyState.classList.add('hidden');
        subscriptions.forEach(sub => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group';
            tr.setAttribute('data-id', sub.idx);
            
            // Status Badge Logic
            let statusClass = 'status-pending';
            let statusLabel = 'Pendente';
            
            if (sub.paymentStatus === 'authorized' || sub.paymentStatus === 'paid') {
                statusClass = 'status-authorized';
                statusLabel = 'Ativo';
            } else if (sub.paymentStatus === 'cancelled') {
                statusClass = 'status-cancelled';
                statusLabel = 'Cancelado';
            } else if (sub.paymentStatus === 'paused') {
                statusClass = 'status-paused';
                statusLabel = 'Pausado';
            }

            // Date Formation
            const dateObj = new Date(sub.created._seconds * 1000);
            const dateStr = dateObj.toLocaleDateString('pt-BR');

            // Currency Fmt
            const priceFmt = (sub.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            tr.innerHTML = `
                <td class="p-6">
                    <div class="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${sub.userName}</div>
                    <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span class="truncate max-w-[150px]">${sub.userEmail}</span>
                        <span class="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full"></span>
                        <span class="font-medium text-gray-600 dark:text-gray-400">${sub.userUnit || 'Unidade Geral'}</span>
                    </div>
                </td>
                <td class="p-6">
                    <span class="inline-flex items-center py-1 px-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                        ${sub.productName}
                    </span>
                </td>
                <td class="p-6 font-bold text-emerald-600 dark:text-emerald-400">${priceFmt}</td>
                <td class="p-6 text-center">
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </td>
                <td class="p-6 text-gray-500 dark:text-gray-400 text-xs font-medium">${dateStr}</td>
                <td class="p-6 text-center">
                    <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="sync-sub-btn w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-all shadow-sm" data-id="${sub.idx}" title="Sincronizar">
                            <i class="fas fa-sync-alt text-sm"></i>
                        </button>
                        <button class="view-sub-btn w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-sm" data-id="${sub.idx}" title="Detalhes">
                            <i class="fas fa-eye text-sm"></i>
                        </button>
                    </div>
                </td>
            `;

            // Event Decorators instead of global click if we want specific buttons
            tr.querySelector('.view-sub-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openSubscriptionModal(sub);
            });
            
            tr.querySelector('.sync-sub-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                syncSingleSubscription(sub.idx);
            });

            tableBody.appendChild(tr);
        });

        updateKPIs(subscriptions);
    };

    const openSubscriptionModal = (sub) => {
        currentOpenSub = sub;
        
        // Status Badge Logic for Modal
        let statusClass = 'status-pending';
        let statusLabel = 'Pendente';
        if (sub.paymentStatus === 'authorized' || sub.paymentStatus === 'paid') {
            statusClass = 'status-authorized';
            statusLabel = 'Ativo';
        } else if (sub.paymentStatus === 'cancelled') {
            statusClass = 'status-cancelled';
            statusLabel = 'Cancelado';
        } else if (sub.paymentStatus === 'paused') {
            statusClass = 'status-paused';
            statusLabel = 'Pausado';
        }

        const dateObj = new Date(sub.created._seconds * 1000);
        const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const priceFmt = (sub.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });        subModalContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                <!-- Info Section -->
                <div class="space-y-8">
                    <div>
                        <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Informações do Aluno</h3>
                        <div class="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <p class="text-lg font-bold text-gray-900 dark:text-white">${sub.userName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${sub.userEmail}</p>
                            <div class="mt-3 flex items-center gap-2">
                                <span class="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg uppercase border border-blue-100 dark:border-blue-500/20">
                                    ${sub.userUnit || 'Geral'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Plano / Produto</h3>
                        <div class="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/10">
                            <p class="text-lg font-bold text-blue-700 dark:text-blue-400">${sub.productName}</p>
                            <p class="text-[10px] font-bold text-blue-500 dark:text-blue-500/70 mt-1 uppercase tracking-tighter">ID: #sub_${sub.idx}</p>
                        </div>
                    </div>
                </div>

                <!-- Status Section -->
                <div class="space-y-8">
                    <div>
                        <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Status da Assinatura</h3>
                        <div class="flex">
                            <span class="status-badge ${statusClass} py-1.5 px-4 text-xs font-bold">${statusLabel}</span>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Valor Recorrente</h3>
                        <div class="flex flex-col">
                            <p class="text-3xl font-bold text-gray-900 dark:text-white tracking-tighter">${priceFmt}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Cobrança mensal automatizada</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pt-8 border-t border-gray-50 dark:border-gray-800/50">
                <div class="flex flex-col sm:flex-row sm:items-center gap-6 text-sm">
                    <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <div class="w-8 h-8 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center text-blue-500">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <span>Início em: <strong class="text-gray-900 dark:text-white font-semibold">${dateStr}</strong></span>
                    </div>
                    <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <div class="w-8 h-8 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center text-emerald-500">
                            <i class="fas fa-credit-card"></i>
                        </div>
                        <span>Gateway: <strong class="text-gray-900 dark:text-white font-semibold">Mercado Pago</strong></span>
                    </div>
                </div>
            </div>
        `;
    `;

        // Show/Hide Cancel Button
        if (sub.paymentStatus === 'authorized' || sub.paymentStatus === 'paid') {
            cancelSubBtnModal.classList.remove('hidden');
            cancelSubBtnModal.setAttribute('data-id', sub.idx);
        } else {
            cancelSubBtnModal.classList.add('hidden');
        }

        subModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    const closeSubscriptionModal = () => {
        subModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        currentOpenSub = null;
    };

    const updateKPIs = (subscriptions) => {
        let totalMrr = 0;
        let activeCount = 0;
        let cancelledCount = 0;

        subscriptions.forEach(sub => {
            if (sub.paymentStatus === 'authorized' || sub.paymentStatus === 'paid') {
                totalMrr += sub.amountTotal;
                activeCount++;
            } else if (sub.paymentStatus === 'cancelled') {
                cancelledCount++;
            }
        });

        document.getElementById('kpi-total').textContent = subscriptions.length;
        document.getElementById('kpi-mrr').textContent = (totalMrr / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpi-active').textContent = activeCount;
        document.getElementById('kpi-cancelled').textContent = cancelledCount;
    };

    const populateFilters = (subscriptions) => {
        // Populate units
        const units = [...new Set(subscriptions.map(sub => sub.userUnit).filter(Boolean))];
        unitFilter.innerHTML = '<option value="">Todas as Unidades</option>';
        units.sort().forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
            unitFilter.appendChild(option);
        });

        // Populate products
        const products = [...new Set(subscriptions.map(sub => sub.productName).filter(Boolean))];
        productFilter.innerHTML = '<option value="">Todos os Planos</option>';
        products.sort().forEach(prod => {
            const option = document.createElement('option');
            option.value = prod;
            option.textContent = prod;
            productFilter.appendChild(option);
        });
    };

    const applyFilters = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedUnit = unitFilter.value;
        const selectedStatus = statusFilter.value;
        const selectedProduct = productFilter.value;

        const filtered = allSubscriptions.filter(sub => {
            const nameMatch = !searchTerm || (sub.userName && sub.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (sub.userEmail && sub.userEmail.toLowerCase().includes(searchTerm));
            const unitMatch = !selectedUnit || sub.userUnit === selectedUnit;
            const statusMatch = !selectedStatus || sub.paymentStatus === selectedStatus;
            const productMatch = !selectedProduct || sub.productName === selectedProduct;

            return (nameMatch || emailMatch) && unitMatch && statusMatch && productMatch;
        });

        renderSubscriptions(filtered);
    };

    const loadSubscriptions = async () => {
        try {
            const functions = getFunctions();
            // Call our Cloud Function that polls the MP status of all subscriptions
            const getLiveSubscriptions = httpsCallable(functions, 'adminGetLiveSubscriptions');
            const result = await getLiveSubscriptions();
            
            allSubscriptions = result.data || [];
            loadingBadge.classList.add('hidden'); // Sincronização finalizada
            
            populateFilters(allSubscriptions);
            renderSubscriptions(allSubscriptions);

        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            loadingBadge.textContent = 'Erro de Sincronização';
            loadingBadge.classList.replace('bg-yellow-500', 'bg-red-500');
            loadingBadge.classList.remove('animate-pulse');
        }
    };

    const handleCancelSubscription = async (e) => {
        const saleId = e.currentTarget.getAttribute('data-id');
        
        const confirmResult = await Swal.fire({
            title: 'Tem certeza?',
            text: "Isso irá cancelar as cobranças recorrentes no cartão deste aluno imediatamente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#374151',
            confirmButtonText: 'Sim, Cancelar Assinatura',
            cancelButtonText: 'Não, Voltar'
        });

        if (confirmResult.isConfirmed) {
            Swal.fire({
                title: 'Processando...',
                text: 'Comunicando com Mercado Pago',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading() }
            });

            try {
                const functions = getFunctions();
                const cancelSub = httpsCallable(functions, 'adminCancelSubscription');
                const result = await cancelSub({ saleId });

                Swal.fire(
                    'Cancelado!',
                    'A assinatura foi desativada com sucesso.',
                    'success'
                );

                closeSubscriptionModal();
                loadSubscriptions();
                
            } catch (err) {
                console.error("Erro ao cancelar:", err);
                Swal.fire(
                    'Erro',
                    err.message || 'Falha ao processar cancelamento.',
                    'error'
                );
            }
        }
    };

    const syncSingleSubscription = async (saleId) => {
        try {
            Swal.fire({
                title: 'Sincronizando...',
                text: 'Consultando o Mercado Pago',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading() }
            });

            const functions = getFunctions();
            // We use the same syncSingleMercadoPagoSale that I've updated in the backend
            const syncSingle = httpsCallable(functions, 'syncSingleMercadoPagoSale');
            const result = await syncSingle({ saleId });

            if (result.data.success) {
                Swal.fire({
                    title: 'Sincronizado!',
                    text: `O status atual é: ${result.data.status}`,
                    icon: 'success',
                    timer: 2000
                });
                loadSubscriptions(); // Reload table
            } else {
                Swal.fire('Aviso', result.data.msg || 'Não foi possível atualizar o status.', 'info');
            }
        } catch (err) {
            console.error('Erro ao sincronizar:', err);
            Swal.fire('Erro', 'Falha na comunicação com o servidor.', 'error');
        }
    };

    // Event Listeners
    if (toggleFiltersBtn) {
        toggleFiltersBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterGridContainer.classList.toggle('hidden');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keyup', applyFilters);
    }

    [unitFilter, statusFilter, productFilter].forEach(el => {
        if (el) el.addEventListener('change', applyFilters);
    });

    if (closeSubModalBtn) closeSubModalBtn.addEventListener('click', closeSubscriptionModal);
    if (closeSubModalFooterBtn) closeSubModalFooterBtn.addEventListener('click', closeSubscriptionModal);
    if (cancelSubBtnModal) cancelSubBtnModal.addEventListener('click', handleCancelSubscription);

    if (subModal) {
        subModal.addEventListener('click', (e) => {
            if (e.target === subModal) closeSubscriptionModal();
        });
    }

    // Auto-init
    loadSubscriptions();

}
