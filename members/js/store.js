import { db } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function loadProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '<p>Carregando produtos...</p>';

    try {
        const q = query(collection(db, 'products'), where('visible', '==', true), orderBy('name'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            productList.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <i class="fas fa-box-open text-4xl text-gray-700 mb-4"></i>
                    <p class="text-gray-500 uppercase tracking-widest text-xs font-bold">Nenhum produto disponível no momento.</p>
                </div>`;
            return;
        }

        productList.innerHTML = ''; // Limpa a mensagem de "carregando"

        querySnapshot.forEach(doc => {
            const product = doc.data();
            const productId = doc.id;
            const isAvailable = product.available !== false;
            const productUrl = isAvailable ? `/produto.html?id=${productId}` : '#';
            const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const card = document.createElement('a');
            if (isAvailable) card.href = productUrl;
            card.className = `product-card group ${!isAvailable ? 'opacity-60 cursor-not-allowed grayscale' : ''}`;
            
            card.innerHTML = `
                <div class="relative overflow-hidden">
                    <img src="${product.imageUrl || 'https://via.placeholder.com/300x180.png?text=Sem+Imagem'}" alt="${product.name}" class="product-card-img ${!isAvailable ? 'opacity-40' : ''}">
                    
                    ${product.category ? `
                        <div class="absolute top-2 left-2">
                            <span class="bg-yellow-500 text-black text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg">
                                ${product.category}
                            </span>
                        </div>
                    ` : ''}

                    ${!isAvailable ? `
                        <div class="absolute inset-0 flex items-center justify-center p-2 bg-black/40 backdrop-blur-[2px]">
                            <span class="bg-red-600 text-white text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded shadow-2xl transform -rotate-6 border-2 border-white/30 text-center">
                                ESGOTADO
                            </span>
                        </div>
                    ` : ''}

                    ${isAvailable ? `
                        <div class="absolute bottom-2 right-2 translate-y-10 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <div class="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-lg">
                                <i class="fas fa-plus text-xs"></i>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="product-card-content flex flex-col h-full bg-gray-50/30 dark:bg-transparent">
                    <h3 class="text-xs md:text-sm font-bold text-gray-900 dark:text-white group-hover:text-yellow-500 transition-colors line-clamp-2 mb-1 tracking-tight leading-tight">${product.name}</h3>
                    <div class="mt-auto flex items-center justify-between">
                        <span class="text-sm md:text-lg font-black text-yellow-600 dark:text-yellow-500">
                            ${price}
                        </span>
                        <div class="px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/5">Ver</div>
                    </div>
                </div>
            `;
            productList.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading products:", error);
        productList.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-900/50 mb-4"></i>
                <p class="text-red-500 uppercase tracking-widest text-xs font-bold">Erro ao carregar a vitrine. Tente novamente.</p>
            </div>`;
    }
}
