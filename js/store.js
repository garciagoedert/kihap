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
        
        bannerContainer.innerHTML = `
            <div class="banner-wrapper aspect-[2/1] md:aspect-[4/1]">
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

        setInterval(rotateBanners, 5000);
    };

    let allProducts = [];
    let selectedCategory = 'all';

    const fetchPublicProducts = async () => {
        if (!productsGrid) return;
        productsGrid.innerHTML = '<p class="text-center col-span-full py-12">Carregando produtos...</p>';

        try {
            const q = query(
                collection(db, 'products'),
                where('acessoPublico', '==', true),
                where('visible', '==', true)
            );
            const querySnapshot = await getDocs(q);
            allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            renderCategoryFilters();
            applyFilters();
        } catch (error) {
            console.error('Error fetching public products:', error);
            productsGrid.innerHTML = '<p class="text-center col-span-full text-red-500 py-12">Erro ao carregar produtos.</p>';
        }
    };

    const renderCategoryFilters = () => {
        const categoryFilters = document.getElementById('category-filters');
        if (!categoryFilters) return;

        // Extract unique categories
        const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
        
        // Always start with "Todos"
        let html = `
            <button class="category-chip ${selectedCategory === 'all' ? 'active text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white'} py-3 px-1 text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all" data-category="all">
                TODOS <i class="fas fa-chevron-down ml-1 text-[9px] opacity-50"></i>
            </button>
        `;

        categories.forEach(cat => {
            const isActive = selectedCategory === cat;
            html += `
                <button class="category-chip ${isActive ? 'active text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white'} py-3 px-1 text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all" data-category="${cat}">
                    ${cat.toUpperCase()} <i class="fas fa-chevron-down ml-1 text-[9px] opacity-50"></i>
                </button>
            `;
        });

        categoryFilters.innerHTML = html;

        // Add Click Listeners
        categoryFilters.querySelectorAll('.category-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                selectedCategory = chip.dataset.category;
                
                categoryFilters.querySelectorAll('.category-chip').forEach(c => {
                    c.classList.remove('active', 'text-yellow-500', 'border-b-2', 'border-yellow-500');
                    c.classList.add('text-gray-400', 'hover:text-white');
                });
                chip.classList.add('active', 'text-yellow-500', 'border-b-2', 'border-yellow-500');
                chip.classList.remove('text-gray-400', 'hover:text-white');

                applyFilters();
            });
        });
    };

    const applyFilters = () => {
        const searchInput = document.getElementById('store-search');
        const searchInputMobile = document.getElementById('store-search-mobile');
        const searchTerm = (searchInput?.value || searchInputMobile?.value || '').toLowerCase().trim();

        const filtered = allProducts.filter(product => {
            const matchesSearch = !searchTerm || 
                (product.name || '').toLowerCase().includes(searchTerm) || 
                (product.description || '').toLowerCase().includes(searchTerm);
            
            const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });

        displayProducts(filtered);
    };

    const displayProducts = (products) => {
        productsGrid.innerHTML = '';
        if (products.length === 0) {
            productsGrid.innerHTML = '<p class="text-center col-span-full py-12 text-gray-400">Nenhum produto encontrado neste filtro.</p>';
            return;
        }

        // Update grid to be more compact (4 columns on larger screens)
        productsGrid.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6";

        products.forEach(product => {
            const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const productCard = `
                <a href="produto.html?id=${product.id}" class="group block bg-[#0f172a]/40 border border-gray-800 rounded-xl overflow-hidden hover:border-yellow-500/50 transition-all duration-300">
                    <div class="relative aspect-square overflow-hidden bg-gray-900">
                        <img src="${product.imageUrl || 'imgs/placeholder.jpg'}" alt="${product.name}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500">
                        ${product.category ? `<span class="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[9px] font-bold uppercase tracking-widest text-white px-2 py-0.5 rounded border border-white/10">${product.category}</span>` : ''}
                    </div>
                    <div class="p-3 md:p-4">
                        <h3 class="text-sm md:text-base font-bold text-white mb-0.5 group-hover:text-yellow-500 transition-colors line-clamp-1">${product.name}</h3>
                        <p class="text-gray-400 text-[10px] md:text-xs mb-2 line-clamp-2 h-6 md:h-8 leading-tight">${product.description || ''}</p>
                        <div class="flex items-center justify-between mt-auto">
                            <span class="text-base md:text-lg font-black text-yellow-500">${price}</span>
                            <div class="w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-plus"></i>
                            </div>
                        </div>
                    </div>
                </a>
            `;
            productsGrid.innerHTML += productCard;
        });
    };

    const setupMobileMenu = () => {
        const openButton = document.getElementById('mobile-menu-button');
        const closeButton = document.getElementById('mobile-menu-close-button');
        const menu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('mobile-menu-overlay');

        if (openButton && menu && overlay && closeButton) {
            const openMenu = () => {
                menu.classList.add('is-open');
                overlay.classList.add('is-open');
                document.body.classList.add('no-scroll');
            };

            const closeMenu = () => {
                menu.classList.remove('is-open');
                overlay.classList.remove('is-open');
                document.body.classList.remove('no-scroll');
            };

            openButton.addEventListener('click', openMenu);
            closeButton.addEventListener('click', closeMenu);
            overlay.addEventListener('click', closeMenu);
            
            const menuLinks = menu.querySelectorAll('a');
            menuLinks.forEach(link => {
                link.addEventListener('click', closeMenu);
            });
        }
    };

    const searchInput = document.getElementById('store-search');
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    fetchActiveBanners();
    fetchPublicProducts();
    setupMobileMenu();
});
