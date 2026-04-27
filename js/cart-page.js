import { cart } from './cart.js';
import { db } from '../intranet/firebase-config.js';
import { getDocs, query, collection, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cart-items-container');
    const emptyCartMessage = document.getElementById('cart-empty');
    const cartContent = document.getElementById('cart-content');
    const subtotalDisplay = document.getElementById('cart-subtotal');
    const totalDisplay = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const checkoutStatus = document.getElementById('checkout-status');
    
    const couponInput = document.getElementById('coupon-code');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponStatus = document.getElementById('coupon-status');

    let appliedCoupon = null;

    const formatCurrency = (amount) => {
        return (amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const renderCart = () => {
        const items = cart.getCart();
        
        if (items.length === 0) {
            cartContent.classList.add('hidden');
            emptyCartMessage.classList.remove('hidden');
            return;
        }

        emptyCartMessage.classList.add('hidden');
        cartContent.classList.remove('hidden');
        
        cartItemsContainer.innerHTML = '';
        
        items.forEach((item) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'bg-gray-800 p-6 rounded-lg shadow-md flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 border border-gray-700';
            
            // Build descriptions of what was bought 
            let detailsHtml = `<p class="text-sm text-gray-400 mt-1">Quantidade: ${item.formDataList.length}</p>`;
            
            item.formDataList.forEach((form, idx) => {
                let addontsText = '';
                if (form.addonsSelected && form.addonsSelected.length > 0) {
                    addontsText = ' + ' + form.addonsSelected.map(a => a.name).join(', ');
                }
                
                detailsHtml += `
                    <div class="mt-2 text-sm bg-gray-700/50 p-2 rounded text-gray-300 border border-gray-600/50">
                        <span class="text-xs text-gray-500 uppercase font-bold tracking-wider">Item ${idx + 1}</span>
                        ${form.userSize ? `<br>Tamanho: <span class="text-yellow-500 font-bold">${form.userSize}</span>` : ''}
                        ${form.userAge ? `<br>Idade: <span class="text-white">${form.userAge} anos</span>` : ''}
                        ${form.userProfessor ? `<br>Professor: <span class="text-white">${form.userProfessor}</span>` : ''}
                        ${form.variantName ? `<br>Opção: <span class="text-white">${form.variantName}</span>` : ''}
                        ${addontsText ? `<br>Extras: <span class="text-white">${addontsText}</span>` : ''}
                    </div>
                `;
            });

            itemElement.innerHTML = `
                <img src="${item.imageUrl || 'imgs/placeholder.jpg'}" alt="${item.productName}" class="w-24 h-24 object-cover rounded-md flex-shrink-0">
                <div class="flex-grow">
                    <h3 class="text-xl font-bold text-white">${item.productName}</h3>
                    ${detailsHtml}
                </div>
                <div class="flex flex-col items-end justify-between self-stretch sm:self-auto min-w-[120px]">
                    <span class="text-xl font-black text-yellow-500">${formatCurrency(item.totalAmount)}</span>
                    <button class="remove-item-btn text-red-500 hover:text-red-400 text-sm mt-4 sm:mt-0 flex items-center" data-cart-id="${item.cartId}">
                        <i class="fas fa-trash-alt mr-1"></i> Remover
                    </button>
                </div>
            `;
            cartItemsContainer.appendChild(itemElement);
        });

        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cartId = e.target.closest('button').dataset.cartId;
                cart.removeItem(cartId);
                renderCart();
            });
        });

        updateTotals();
    };

    const updateTotals = () => {
        let subtotal = cart.getTotalAmount();
        let total = subtotal;

        subtotalDisplay.textContent = formatCurrency(subtotal);

        if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
                total -= total * (appliedCoupon.value / 100);
            } else if (appliedCoupon.type === 'fixed') {
                total -= appliedCoupon.value;
            }
        }

        total = Math.max(0, total); // Prevent negative totals
        totalDisplay.textContent = formatCurrency(total);
    };

    const applyCoupon = async () => {
        const code = couponInput.value.trim();
        if (!code) {
            couponStatus.textContent = 'Por favor, insira um código de cupom.';
            couponStatus.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const q = query(collection(db, 'coupons'), where('code', '==', code));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                couponStatus.textContent = 'Cupom inválido.';
                couponStatus.className = 'mt-2 text-sm text-red-400';
                appliedCoupon = null;
                updateTotals();
                return;
            }

            const couponDoc = querySnapshot.docs[0];
            const coupon = { id: couponDoc.id, ...couponDoc.data() };

            if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
                couponStatus.textContent = 'Cupom expirado.';
                couponStatus.className = 'mt-2 text-sm text-red-400';
                appliedCoupon = null;
                updateTotals();
                return;
            }

            appliedCoupon = coupon;
            couponStatus.textContent = 'Cupom aplicado com sucesso!';
            couponStatus.className = 'mt-2 text-sm text-green-400';
            updateTotals();

        } catch (error) {
            console.error('Error applying coupon:', error);
            couponStatus.textContent = 'Erro ao aplicar o cupom.';
            couponStatus.className = 'mt-2 text-sm text-red-400';
        }
    };

    applyCouponBtn.addEventListener('click', applyCoupon);

    checkoutBtn.addEventListener('click', () => {
        const items = cart.getCart();
        if (items.length === 0) return;
        
        // Redireciona para o checkout unificado
        window.location.href = 'checkout.html';
    });

    renderCart();
});
