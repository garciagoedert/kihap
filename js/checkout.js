import { cart } from './cart.js';
import { db } from '../intranet/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { onAuthReady, getUserData } from '../members/js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const checkoutForm = document.getElementById('checkout-form');
    const urlParams = new URLSearchParams(window.location.search);
    const directProductId = urlParams.get('product');

    if (directProductId) {
        try {
            const productSnap = await getDoc(doc(db, 'products', directProductId));
            if (productSnap.exists()) {
                const product = { id: productSnap.id, ...productSnap.data() };
                
                // Check if product is complex (requires options)
                const isComplex = 
                    product.hasSizes || 
                    product.priceType === 'variable' || 
                    product.priceType === 'kit' || 
                    product.priceType === 'lotes' || 
                    product.askAge || 
                    product.askProfessor ||
                    (product.addons && product.addons.length > 0);

                if (isComplex) {
                    // Redirect to product page for configuration
                    window.location.href = `produto.html?id=${directProductId}`;
                    return;
                } else {
                    // Simple product: add to cart (clearing it first for direct link logic)
                    cart.clearCart();
                    cart.addItem({
                        productId: product.id,
                        productName: product.name,
                        imageUrl: product.imageUrl,
                        isSubscription: product.isSubscription || false,
                        subscriptionFrequency: product.subscriptionFrequency || null,
                        subscriptionPeriod: product.subscriptionPeriod || null,
                        priceType: product.priceType || 'fixed',
                        formDataList: [{ userAge: null, userSize: null, priceData: { amount: product.price } }],
                        totalAmount: product.price,
                        recommendedItems: [],
                        addedAt: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error("Error handling direct product link:", error);
        }
    }

    const unitSelector = document.getElementById('unidade');
    const programaSelector = document.getElementById('programa');
    const graduacaoSelector = document.getElementById('graduacao');
    const graduacaoContainer = document.getElementById('graduacao-container');
    const summaryItemsContainer = document.getElementById('checkout-summary-items');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTotal = document.getElementById('summary-total');
    const checkoutError = document.getElementById('checkout-error');
    const payBtn = document.getElementById('final-pay-btn');

    let currentUser = null;
    let unitsCache = [];

    const formatCurrency = (amount) => {
        return (amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const renderSummary = () => {
        const items = cart.getCart();
        if (items.length === 0) {
            window.location.href = 'cart.html';
            return;
        }

        summaryItemsContainer.innerHTML = '';
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'flex justify-between items-start text-sm border-b border-gray-700/50 pb-3 mb-3 last:border-0';
            
            let itemDetails = '';
            item.formDataList.forEach((form, idx) => {
                if (form.userSize) itemDetails += `Tamanho: ${form.userSize} `;
            });

            el.innerHTML = `
                <div>
                    <p class="font-bold text-white">${item.productName}</p>
                    <p class="text-xs text-gray-400">Qtd: ${item.formDataList.length} ${itemDetails ? `| ${itemDetails}` : ''}</p>
                </div>
                <span class="font-semibold text-gray-300">${formatCurrency(item.totalAmount)}</span>
            `;
            summaryItemsContainer.appendChild(el);
        });

        summarySubtotal.textContent = formatCurrency(cart.getTotalAmount());
        summaryTotal.textContent = formatCurrency(cart.getTotalAmount());
    };

    const fetchUnits = async () => {
        try {
            const functions = getFunctions();
            const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
            const result = await getPublicEvoUnits();
            unitsCache = result.data;
            populateUnits();
        } catch (error) {
            console.error("Error fetching units:", error);
            unitSelector.innerHTML = '<option value="">Erro ao carregar unidades</option>';
        }
    };

    const populateUnits = () => {
        unitSelector.innerHTML = '<option value="">Selecione sua unidade</option>';
        unitsCache.forEach(unit => {
            if (unit.toLowerCase() !== 'atadf') {
                const option = document.createElement('option');
                option.value = unit;
                option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
                unitSelector.appendChild(option);
            }
        });
    };

    const populateGraduacao = (program) => {
        const graduacoes = {
            tradicional: ['Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida', 'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida', 'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida', 'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida', 'Vermelha e preta', 'Preta'],
            littles: ['Littles Branca', 'Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta', 'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix']
        };
        const options = graduacoes[program];
        if (options) {
            graduacaoContainer.classList.remove('hidden');
            graduacaoSelector.innerHTML = '<option value="">Selecione sua graduação</option>';
            graduacaoSelector.required = true;
            options.forEach(grad => {
                const option = document.createElement('option');
                option.value = grad;
                option.textContent = grad;
                graduacaoSelector.appendChild(option);
            });
        } else {
            graduacaoContainer.classList.add('hidden');
            graduacaoSelector.required = false;
        }
    };

    programaSelector.addEventListener('change', () => populateGraduacao(programaSelector.value));

    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            if (userData) {
                currentUser = { uid: user.uid, ...userData };
                document.getElementById('nome').value = currentUser.name || '';
                document.getElementById('email').value = currentUser.email || '';
                document.getElementById('telefone').value = currentUser.phoneNumber || '';
                document.getElementById('cpf').value = currentUser.cpf || '';
                if (currentUser.unit) {
                    // Wait for units to load then select
                    const checkUnits = setInterval(() => {
                        if (unitsCache.length > 0) {
                            unitSelector.value = currentUser.unit;
                            clearInterval(checkUnits);
                        }
                    }, 500);
                }
            }
        }
    });

    const handleCheckout = async (e) => {
        e.preventDefault();
        payBtn.disabled = true;
        payBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processando...';
        checkoutError.classList.add('hidden');

        const items = cart.getCart();
        const globalUserData = {
            userName: document.getElementById('nome').value,
            userEmail: document.getElementById('email').value,
            userPhone: document.getElementById('telefone').value,
            userCpf: document.getElementById('cpf').value,
            userUnit: document.getElementById('unidade').value,
            userPrograma: document.getElementById('programa').value,
            userGraduacao: graduacaoSelector.required ? graduacaoSelector.value : null,
            userId: currentUser ? currentUser.uid : null
        };

        try {
            const totalAmount = cart.getTotalAmount();
            // Robust check for free purchases (handles potential float precision issues)
            const isFree = totalAmount <= 0;
            console.log(`[Checkout] Processing ${isFree ? 'FREE' : 'PAID'} purchase. Total: ${totalAmount/100}`);
            
            const endpoint = isFree 
                ? 'https://us-central1-intranet-kihap.cloudfunctions.net/processCartFreePurchase'
                : 'https://us-central1-intranet-kihap.cloudfunctions.net/createCartCheckoutSession';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartItems: items,
                    globalUserData: globalUserData,
                    totalAmount: totalAmount
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao processar o checkout.');
            }

            const data = await response.json();
            
            if (isFree && data.status === 'success') {
                cart.clearCart();
                window.location.href = 'compra-success.html';
            } else if (data.checkoutUrl) {
                cart.clearCart();
                window.location.href = data.checkoutUrl;
            } else {
                throw new Error('Resposta inválida do servidor.');
            }
        } catch (error) {
            console.error('Checkout Error:', error);
            checkoutError.textContent = error.message;
            checkoutError.classList.remove('hidden');
            payBtn.disabled = false;
            payBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Pagar Agora';
        }
    };

    checkoutForm.addEventListener('submit', handleCheckout);

    renderSummary();
    fetchUnits();
});
