import { db } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function loadProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '<p>Carregando produtos...</p>';

    try {
        const q = query(collection(db, 'products'), where('visible', '==', true), orderBy('name'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            productList.innerHTML = '<p>Nenhum produto disponível no momento.</p>';
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
            card.className = `product-card block hover:shadow-lg transition-shadow duration-300 ${!isAvailable ? 'opacity-60 cursor-not-allowed' : ''}`;
            
            card.innerHTML = `
                <div class="relative">
                    <img src="${product.imageUrl || 'https://via.placeholder.com/300x180.png?text=Sem+Imagem'}" alt="${product.name}" class="product-card-img ${!isAvailable ? 'grayscale' : ''}">
                    ${!isAvailable ? `
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded shadow-lg transform -rotate-6 border border-white/20">
                                FORA DE ESTOQUE
                            </span>
                        </div>
                    ` : ''}
                </div>
                <div class="product-card-content">
                    <h3 class="text-xl font-bold text-white">${product.name}</h3>
                    <p class="text-gray-500 dark:text-gray-400 mt-2">${product.description || ''}</p>
                    <div class="mt-4 flex justify-between items-center">
                        <span class="text-lg font-semibold ${isAvailable ? 'text-yellow-500' : 'text-gray-500'}">${price}</span>
                        <button class="${isAvailable ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 cursor-not-allowed'} text-white font-bold py-2 px-4 rounded-lg transition" ${!isAvailable ? 'disabled' : ''}>
                            ${isAvailable ? 'Comprar' : 'Indisponível'}
                        </button>
                    </div>
                </div>
            `;
            productList.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading products:", error);
        productList.innerHTML = '<p class="text-red-500">Erro ao carregar os produtos. Tente novamente mais tarde.</p>';
    }
}
