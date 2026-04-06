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
            tr.className = 'table-row-hover transition-colors cursor-pointer group';
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
                <td class="p-4">
                    <div class="font-medium text-white group-hover:text-blue-400 transition-colors">${sub.userName}</div>
                    <div class="text-xs text-gray-500">${sub.userEmail} &bull; ${sub.userUnit || 'Não informada'}</div>
                </td>
                <td class="p-4">
                    <span class="inline-flex items-center gap-1.5 py-1 px-2 rounded-md bg-gray-700/50 text-gray-300 font-medium">
                        ${sub.productName}
                    </span>
                </td>
                <td class="p-4 font-medium text-yellow-400">${priceFmt}</td>
                <td class="p-4 text-center">
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </td>
                <td class="p-4 text-gray-400">${dateStr}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button class="sync-sub-btn p-2 text-gray-400 hover:text-blue-400 transition-colors" data-id="${sub.idx}" title="Sincronizar Status">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="view-sub-btn p-2 text-gray-400 hover:text-white transition-colors" data-id="${sub.idx}" title="Ver Detalhes">
                            <i class="fas fa-eye"></i>
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
        const priceFmt = (sub.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        subModalContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Info Section -->
                <div class="space-y-6">
                    <div>
                        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Informações do Aluno</h3>
                        <p class="text-lg font-bold text-white">${sub.userName}</p>
                        <p class="text-sm text-gray-400">${sub.userEmail}</p>
                        <p class="text-sm text-gray-400">Unidade: ${sub.userUnit || 'Não informada'}</p>
                    </div>
                    <div>
                        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Plano / Produto</h3>
                        <p class="text-lg font-bold text-blue-400">${sub.productName}</p>
                        <p class="text-xs text-gray-500">ID da Venda: #sub_${sub.idx}</p>
                    </div>
                </div>

                <!-- Status Section -->
                <div class="space-y-6">
                    <div>
                        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status da Assinatura</h3>
                        <span class="status-badge ${statusClass} text-sm">${statusLabel}</span>
                    </div>
                    <div>
                        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Valor Recorrente</h3>
                        <p class="text-2xl font-bold text-yellow-400">${priceFmt}</p>
                        <p class="text-xs text-gray-500">Cobrança mensal automatizada</p>
                    </div>
                </div>
            </div>

            <div class="pt-6 border-t border-[#333]">
                <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-400">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-calendar-alt text-blue-500"></i>
                        <span>Início em: <strong>${dateStr}</strong></span>
                    </div>
                    <div class="flex items-center gap-2">
                        <i class="fas fa-credit-card text-emerald-500"></i>
                        <span>Gateway: <strong>Mercado Pago</strong></span>
                    </div>
                </div>
            </div>
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
