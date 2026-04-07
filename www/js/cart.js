export class CartManager {
    constructor() {
        this.storageKey = 'kihap_cart';
        this.items = this.loadCart();
        this.initFloatingCart();
    }

    loadCart() {
        const cartStr = localStorage.getItem(this.storageKey);
        return cartStr ? JSON.parse(cartStr) : [];
    }

    saveCart() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        this.updateFloatingCartCount();
    }

    addItem(item) {
        // Gera um ID único para o item no carrinho (já que o mesmo produto pode ser adicionado com dados de aluno diferentes)
        item.cartId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        this.items.push(item);
        this.saveCart();
    }

    removeItem(cartId) {
        this.items = this.items.filter(item => item.cartId !== cartId);
        this.saveCart();
    }

    clearCart() {
        this.items = [];
        this.saveCart();
    }

    getCart() {
        return this.items;
    }

    getTotalAmount() {
        return this.items.reduce((total, item) => total + item.totalAmount, 0);
    }

    initFloatingCart() {
        // Só renderiza se não formos a header ou footer ou se não estiver no checkout ou cart page
        if (window.location.pathname.includes('cart.html')) return;
        
        let cartContainer = document.getElementById('kihap-floating-cart');
        if (!cartContainer) {
            cartContainer = document.createElement('div');
            cartContainer.id = 'kihap-floating-cart';
            cartContainer.className = 'fixed bottom-6 right-6 z-50 transition-transform duration-300 hover:scale-110';
            
            cartContainer.innerHTML = `
                <a href="/cart.html" class="flex items-center justify-center w-16 h-16 bg-yellow-500 text-black rounded-full shadow-2xl relative">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span id="kihap-cart-count" class="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-gray-900 shadow">
                        0
                    </span>
                </a>
            `;
            document.body.appendChild(cartContainer);
        }
        this.updateFloatingCartCount();
    }

    updateFloatingCartCount() {
        const countSpan = document.getElementById('kihap-cart-count');
        const cartContainer = document.getElementById('kihap-floating-cart');
        
        if (countSpan && cartContainer) {
            const count = this.items.length;
            countSpan.textContent = count;
            
            // Sempre visível, mas pode adicionar animação quando itens são adicionados
            if (count > 0) {
                cartContainer.classList.add('animate-bounce');
                setTimeout(() => cartContainer.classList.remove('animate-bounce'), 1000);
            }
        }
    }
}

// Instância global
export const cart = new CartManager();
