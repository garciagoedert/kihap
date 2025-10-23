import { db } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function loadProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '<p>Carregando produtos...</p>';

    try {
        const q = query(collection(db, 'products'), orderBy('name'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            productList.innerHTML = '<p>Nenhum produto disponível no momento.</p>';
            return;
        }

        productList.innerHTML = ''; // Limpa a mensagem de "carregando"

        querySnapshot.forEach(doc => {
            const product = doc.data();
            const productId = doc.id;
            const productUrl = `/produto.html?id=${productId}`;
            const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const card = document.createElement('a');
            card.href = productUrl;
            card.className = 'product-card block hover:shadow-lg transition-shadow duration-300';
            
            card.innerHTML = `
                <img src="${product.imageUrl || 'https://via.placeholder.com/300x180.png?text=Sem+Imagem'}" alt="${product.name}" class="product-card-img">
                <div class="product-card-content">
                    <h3 class="text-xl font-bold text-white">${product.name}</h3>
                    <p class="text-gray-400 mt-2">${product.description || ''}</p>
                    <div class="mt-4 flex justify-between items-center">
                        <span class="text-lg font-semibold text-yellow-500">${price}</span>
                        <button class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">
                            Comprar
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
