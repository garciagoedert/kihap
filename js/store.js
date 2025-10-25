import { db } from '../intranet/firebase-config.js';
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const productsGrid = document.getElementById('products-grid');
    const bannerContainer = document.getElementById('banner-container');

    const fetchActiveBanner = async () => {
        if (!bannerContainer) return;

        try {
            const q = query(
                collection(db, 'banners'),
                where('active', '==', true),
                limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const banner = querySnapshot.docs[0].data();
                displayBanner(banner);
            }
        } catch (error) {
            console.error('Error fetching active banner:', error);
        }
    };

    const displayBanner = (banner) => {
        bannerContainer.innerHTML = `
            <a href="${banner.link || '#'}" target="_blank" class="block">
                <img src="${banner.imageUrl}" alt="Banner" class="w-full h-auto rounded-lg shadow-lg">
            </a>
        `;
    };

    const fetchPublicProducts = async () => {
        if (!productsGrid) return;
        productsGrid.innerHTML = '<p class="text-center col-span-full">Carregando produtos...</p>';

        try {
            const q = query(
                collection(db, 'products'),
                where('acessoPublico', '==', true),
                where('visible', '==', true)
            );
            const querySnapshot = await getDocs(q);
            const products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            displayProducts(products);
        } catch (error) {
            console.error('Error fetching public products:', error);
            productsGrid.innerHTML = '<p class="text-center col-span-full text-red-500">Erro ao carregar produtos.</p>';
        }
    };

    const displayProducts = (products) => {
        productsGrid.innerHTML = '';
        if (products.length === 0) {
            productsGrid.innerHTML = '<p class="text-center col-span-full">Nenhum produto disponível no momento.</p>';
            return;
        }

        products.forEach(product => {
            const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const productCard = `
                <a href="produto.html?id=${product.id}" class="course-card bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
                    <img src="${product.imageUrl || 'imgs/placeholder.jpg'}" alt="${product.name}" class="course-card-img">
                    <div class="course-card-content p-6">
                        <h3 class="text-xl font-bold mb-2">${product.name}</h3>
                        <p class="text-gray-400 mb-4">${product.description || ''}</p>
                        <div class="text-2xl font-black text-yellow-500">${price}</div>
                    </div>
                </a>
            `;
            productsGrid.innerHTML += productCard;
        });
    };

    fetchActiveBanner();
    fetchPublicProducts();
});
