import { getCurrentUser } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export async function setupAssinaturasPage() {
    
    // User Profile Display -> not strictly needed here since loadComponents handles header
    const currentUser = await getCurrentUser();
    if (!currentUser) return; // Se não logado auth.js vai chutar.

    const loadSubscriptions = async () => {
        const tableBody = document.getElementById('subscriptions-table-body');
        const emptyState = document.getElementById('empty-state');
        const loadingBadge = document.getElementById('loading-badge');
        
        try {
            const functions = getFunctions();
            // Call our Cloud Function that polls the MP status of all subscriptions
            const getLiveSubscriptions = httpsCallable(functions, 'adminGetLiveSubscriptions');
            const result = await getLiveSubscriptions();
            
            const subscriptions = result.data;
            tableBody.innerHTML = '';
            
            loadingBadge.classList.add('hidden'); // Sincronização finalizada
            
            if (!subscriptions || subscriptions.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }
            
            emptyState.classList.add('hidden');

            let totalMrr = 0;
            let activeCount = 0;
            let cancelledCount = 0;

            subscriptions.forEach(sub => {
                const tr = document.createElement('tr');
                tr.className = 'table-row-hover transition-colors';
                
                // Status Badge Logic
                let statusClass = 'status-pending';
                let statusLabel = 'Pendente';
                
                if (sub.paymentStatus === 'authorized' || sub.paymentStatus === 'paid') {
                    statusClass = 'status-authorized';
                    statusLabel = 'Ativo';
                    totalMrr += sub.amountTotal;
                    activeCount++;
                } else if (sub.paymentStatus === 'cancelled') {
                    statusClass = 'status-cancelled';
                    statusLabel = 'Cancelado';
                    cancelledCount++;
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
                        <div class="font-medium text-white">${sub.userName}</div>
                        <div class="text-xs text-gray-500">${sub.userEmail} &bull; ${sub.userUnit}</div>
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
                    <td class="p-4 text-right">
                        ${sub.paymentStatus === 'authorized' 
                            ? `<button class="btn-cancel text-red-400 hover:text-red-300 hover:underline text-xs font-semibold px-3 py-2 rounded-lg bg-red-400/10 transition-colors" data-id="${sub.idx}">
                                <i class="fas fa-ban mr-1"></i> Cancelar Faturamento
                               </button>`
                            : `<span class="text-xs text-gray-600 cursor-not-allowed">Encerrado</span>`
                        }
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            // Update KPIs
            document.getElementById('kpi-total').textContent = subscriptions.length;
            document.getElementById('kpi-mrr').textContent = (totalMrr / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('kpi-active').textContent = activeCount;
            document.getElementById('kpi-cancelled').textContent = cancelledCount;

            // Attach Cancel Listeners
            document.querySelectorAll('.btn-cancel').forEach(btn => {
                btn.addEventListener('click', handleCancelSubscription);
            });

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

                // Reload UI
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

    // Auto-init
    loadSubscriptions();

}
