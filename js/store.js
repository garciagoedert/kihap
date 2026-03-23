import { db } from '../intranet/firebase-config.js';
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const productsGrid = document.getElementById('products-grid');
    const bannerContainer = document.getElementById('banner-container');

    const fetchActiveBanners = async () => {
        if (!bannerContainer) return;

        try {
            const q = query(collection(db, 'banners'), where('active', '==', true));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const banners = querySnapshot.docs.map(doc => doc.data());
                displayBanners(banners);
            }
        } catch (error) {
            console.error('Error fetching active banners:', error);
        }
    };

    const displayBanners = (banners) => {
        if (!banners || banners.length === 0) return;
        
        // Create the wrapper with a fixed aspect ratio to prevent layout shift
        // Using a wider aspect ratio (3/1 or 4/1) to make it shorter
        bannerContainer.innerHTML = `
            <div class="banner-wrapper aspect-[4/1] md:aspect-[4/1] aspect-[2/1]">
                ${banners.map((banner, index) => `
                    <div class="banner-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                        <a href="${banner.link || '#'}" target="_blank" class="block h-full">
                            <img src="${banner.imageUrl}" alt="Banner ${index + 1}" class="w-full h-full object-cover">
                        </a>
                    </div>
                `).join('')}
            </div>
        `;

        const slides = bannerContainer.querySelectorAll('.banner-slide');
        if (slides.length <= 1) return;

        let currentIndex = 0;
        const rotateBanners = () => {
            slides[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % slides.length;
            slides[currentIndex].classList.add('active');
        };

        setInterval(rotateBanners, 5000); // Rotate every 5 seconds
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

    fetchActiveBanners();
    fetchPublicProducts();
});
