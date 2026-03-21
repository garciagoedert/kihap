import { db } from '../../intranet/firebase-config.js';
import { collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const auth = getAuth();
    
    const loadingEl = document.getElementById('loading');
    const emptyStateEl = document.getElementById('empty-state');
    const ordersContainer = document.getElementById('orders-container');

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        try {
            await fetchOrders(user.uid);
        } catch (error) {
            console.error("Erro ao carregar pedidos:", error);
            loadingEl.innerHTML = `<p class="text-red-500 text-center">Erro ao carregar pedidos. Tente novamente mais tarde.</p>`;
        }
    });

    const formatCurrency = (amount) => {
        return (amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Data desconhecida';
        const date = timestamp.toDate();
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const fetchOrders = async (userId) => {
        // Query to get orders for the logged-in user
        // We will query inscricoesFaixaPreta where userId == user.uid
        const ordersRef = collection(db, 'inscricoesFaixaPreta');
        const q = query(
            ordersRef,
            where('userId', '==', userId)
            // It might fail without an index if we order by 'created', so we just fetch and sort locally
        );

        const querySnapshot = await getDocs(q);
        
        loadingEl.classList.add('hidden');

        if (querySnapshot.empty) {
            emptyStateEl.classList.remove('hidden');
            return;
        }

        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });

        // Sort by date descending
        orders.sort((a, b) => {
            if (!a.created || !b.created) return 0;
            return b.created.toMillis() - a.created.toMillis();
        });

        renderOrders(orders);
    };

    const renderOrders = (orders) => {
        ordersContainer.innerHTML = '';
        
        orders.forEach(order => {
            let statusMarkup = '';
            
            if (order.paymentStatus === 'paid') {
                statusMarkup = `<span class="px-3 py-1 bg-green-900/50 text-green-400 border border-green-700/50 rounded-full text-xs font-bold uppercase tracking-wider"><i class="fas fa-check-circle mr-1"></i> Aprovado</span>`;
            } else if (order.paymentStatus === 'pending') {
                statusMarkup = `<span class="px-3 py-1 bg-yellow-900/50 text-yellow-500 border border-yellow-700/50 rounded-full text-xs font-bold uppercase tracking-wider"><i class="fas fa-clock mr-1"></i> Aguardando Pagamento</span>`;
            } else if (order.paymentStatus === 'canceled' || order.paymentStatus === 'failed') {
                statusMarkup = `<span class="px-3 py-1 bg-red-900/50 text-red-400 border border-red-700/50 rounded-full text-xs font-bold uppercase tracking-wider"><i class="fas fa-times-circle mr-1"></i> Cancelado</span>`;
            } else {
                statusMarkup = `<span class="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs font-bold uppercase tracking-wider">${order.paymentStatus || 'Desconhecido'}</span>`;
            }

            const itemCard = document.createElement('div');
            itemCard.className = `bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300`;
            
            itemCard.innerHTML = `
                <div class="p-6 md:p-8">
                    <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 border-b border-gray-700 pb-4">
                        <div>
                            <span class="text-xs text-gray-400 font-mono tracking-widest uppercase block mb-1">ID do Pedido: ${order.id.slice(-8)}</span>
                            <span class="text-sm text-gray-400 block"><i class="far fa-calendar-alt mr-2"></i>${formatDate(order.created)}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            ${statusMarkup}
                        </div>
                    </div>
                    
                    <div class="flex flex-col md:flex-row items-center gap-6">
                        <div class="flex-grow w-full">
                            <h3 class="text-xl font-bold text-white mb-2">${order.productName || 'Produto Kihap'}</h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-gray-900/50 rounded-lg p-4">
                                <div>
                                    <span class="text-xs text-gray-500 block uppercase tracking-wider">Aluno(a)</span>
                                    <span class="text-sm font-medium text-gray-300">${order.userName || 'N/A'}</span>
                                </div>
                                <div>
                                    <span class="text-xs text-gray-500 block uppercase tracking-wider">Unidade</span>
                                    <span class="text-sm font-medium text-gray-300">${order.userUnit || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex flex-col items-end md:items-center md:pl-8 md:border-l border-gray-700 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0">
                            <span class="text-sm text-gray-400 mb-1">Valor Total</span>
                            <span class="text-3xl font-black text-yellow-500">${formatCurrency(order.amountTotal)}</span>
                        </div>
                    </div>
                </div>
            `;
            
            ordersContainer.appendChild(itemCard);
        });

        ordersContainer.classList.remove('hidden');
    };
});
