document.addEventListener("DOMContentLoaded", function () {
    const isSubPage = window.location.pathname.includes('/programas/') ||
        window.location.pathname.includes('/unidades/') ||
        window.location.pathname.includes('/desenvolvimento/') ||
        window.location.pathname.includes('/members/');
    const componentBasePath = isSubPage ? '../components/' : 'components/';
    const assetBasePath = isSubPage ? '../' : './';

    const loadComponent = (containerId, filePath) => {
        const container = document.getElementById(containerId);
        if (container) {
            fetch(`${componentBasePath}${filePath}`)
                .then(response => response.text())
                .then(data => {
                    let processedData = data;

                    // If it's the footer, replace the year placeholder
                    if (filePath === 'footer.html') {
                        processedData = processedData.replace('{{YEAR}}', new Date().getFullYear());
                    }


                    // Adjust paths inside the loaded HTML
                    const adjustedData = processedData.replace(/((href|src)=["'])(?!(https?:\/\/|\/))/g, `$1${assetBasePath}`);

                    container.innerHTML = adjustedData;

                    if (containerId === 'header-container') {
                        // Dispara um evento para notificar que o header foi carregado
                        document.dispatchEvent(new Event('headerLoaded'));
                    }
                    if (containerId === 'cta-container') {
                        // Dispara um evento para notificar que o form-cta foi carregado
                        document.dispatchEvent(new Event('ctaLoaded'));
                    }
                });
        }
    };

    loadComponent('header-container', 'header.html');
    loadComponent('footer-container', 'footer.html');
    loadComponent('testimonials-container', 'testimonials.html');
    loadComponent('video-container', 'video.html');
    loadComponent('cta-container', 'form-cta.html');
    
    // O banner do app foi removido para priorizar a experiência e visibilidade do chatbot Miles
    /*
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const isApp = navigator.userAgent.includes('KihapApp') || window.location.search.includes('isApp=true');
    const bannerClosed = localStorage.getItem('appBannerClosed');

    if (isMobile && !isApp && !bannerClosed) {
        const appBannerContainer = document.createElement('div');
        appBannerContainer.id = 'app-banner-container';
        document.body.appendChild(appBannerContainer);
        loadComponent('app-banner-container', 'app-banner.html');
        
        // Polling para garantir que o componente carregou antes de configurar
        const checkBannerInterval = setInterval(() => {
            const banner = document.getElementById('app-promo-banner');
            if (banner) {
                clearInterval(checkBannerInterval);
                setupAppBanner();
            }
        }, 100);
    }
    */

    // A lógica do menu e header sticky será adicionada após o carregamento do header
    document.addEventListener('headerLoaded', () => {
        setupMobileMenu();
        setupStickyHeader();
    });

    setupWhatsAppButton();

    function setupStickyHeader() {
        const header = document.getElementById('main-header');
        const logo = document.getElementById('header-logo');
        if (!header) return;

        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('bg-black/90', 'backdrop-blur-md', 'shadow-lg', 'py-4');
                header.classList.remove('py-6');
                if (logo) {
                    logo.classList.add('h-6');
                    logo.classList.remove('h-8');
                }
            } else {
                header.classList.remove('bg-black/90', 'backdrop-blur-md', 'shadow-lg', 'py-4');
                header.classList.add('py-6');
                if (logo) {
                    logo.classList.remove('h-6');
                    logo.classList.add('h-8');
                }
            }
        });
    }

    function setupWhatsAppButton() {
        const waButton = document.createElement('a');
        waButton.id = 'floating-whatsapp';
        
        // Determinar a mensagem baseada na página atual
        const pageTitle = document.title || 'site';
        const path = window.location.pathname.toLowerCase();
        const isKids = path.includes('kids');
        const isAdultos = path.includes('adultos');
        const isLittles = path.includes('littles') || path.includes('baby');
        
        let message = `Olá! Estou na página ${pageTitle} do site e gostaria de tirar uma dúvida.`;
        if (isKids) message = "Olá! Estava vendo o programa Kids no site e gostaria de saber mais.";
        else if (isAdultos) message = "Olá! Estava vendo o programa de Adultos no site e gostaria de saber mais.";
        else if (isLittles) message = "Olá! Estava vendo o programa Littles no site e gostaria de saber mais.";

        const defaultPhone = '556183007146'; // Asa Sul default
        waButton.href = `https://wa.me/${defaultPhone}?text=${encodeURIComponent(message)}`;
        waButton.target = '_blank';
        waButton.className = 'fixed bottom-6 left-6 z-[9999] bg-[#25D366] text-white p-3 md:p-4 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center';
        waButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
        `;
        document.body.appendChild(waButton);
    }

    function setupStickyHeader() {
        const header = document.getElementById('main-header');
        const logo = document.getElementById('header-logo');
        if (!header) return;

        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('bg-black/90', 'backdrop-blur-md', 'shadow-lg', 'py-4');
                header.classList.remove('py-6');
                if (logo) {
                    logo.classList.add('h-6');
                    logo.classList.remove('h-8');
                }
            } else {
                header.classList.remove('bg-black/90', 'backdrop-blur-md', 'shadow-lg', 'py-4');
                header.classList.add('py-6');
                if (logo) {
                    logo.classList.remove('h-6');
                    logo.classList.add('h-8');
                }
            }
        });
    }

    function setupMobileMenu() {
        const openButton = document.getElementById('mobile-menu-button');
        const closeButton = document.getElementById('mobile-menu-close-button');
        const menu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('mobile-menu-overlay');

        const openMenu = () => {
            if (menu && overlay) {
                menu.classList.add('is-open');
                overlay.classList.add('is-open');
                document.body.classList.add('no-scroll');
            }
        };

        const closeMenu = () => {
            if (menu && overlay) {
                menu.classList.remove('is-open');
                overlay.classList.remove('is-open');
                document.body.classList.remove('no-scroll');
            }
        };

        if (openButton && menu && overlay && closeButton) {
            const menuLinks = menu.querySelectorAll('a');
            openButton.addEventListener('click', openMenu);
            closeButton.addEventListener('click', closeMenu);
            overlay.addEventListener('click', closeMenu);
            menuLinks.forEach(link => {
                link.addEventListener('click', closeMenu);
            });
        }
    }

    // Lógica de Filtragem dos Programas por Abas (Tabs)
    const filterButtons = document.querySelectorAll('.filter-tab-btn');
    const programCards = document.querySelectorAll('.program-card-clean');

    if (filterButtons.length > 0 && programCards.length > 0) {
        // Inicialmente definimos a aba 'Todos' como ativa visualmente
        const initialActiveTab = document.querySelector('.filter-tab-btn[data-filter="all"]');
        if (initialActiveTab) {
            initialActiveTab.classList.add('bg-yellow-500', 'text-black', 'border-yellow-500', 'shadow-lg', 'shadow-yellow-500/20');
            initialActiveTab.classList.remove('bg-white', 'text-gray-700', 'border-amber-200/40');
        }

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Resetar estados ativos de todas as abas
                filterButtons.forEach(b => {
                    b.classList.remove('active', 'bg-yellow-500', 'text-black', 'border-yellow-500', 'shadow-lg', 'shadow-yellow-500/20');
                    b.classList.add('bg-white', 'text-gray-700', 'border-amber-200/40');
                });

                // Definir estado ativo para a aba clicada
                btn.classList.add('active', 'bg-yellow-500', 'text-black', 'border-yellow-500', 'shadow-lg', 'shadow-yellow-500/20');
                btn.classList.remove('bg-white', 'text-gray-700', 'border-amber-200/40');

                const filterValue = btn.getAttribute('data-filter');

                programCards.forEach(card => {
                    const cardCategory = card.getAttribute('data-category');
                    
                    if (filterValue === 'all' || cardCategory === filterValue) {
                        // Mostrar card
                        card.classList.remove('filtered-out');
                        card.classList.add('swiper-slide');
                        
                        // Fade in suave
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1)';
                        }, 50);
                    } else {
                        // Fade out suave
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        
                        // Colapso físico após fade out
                        setTimeout(() => {
                            // Verifica se o filtro ainda é o mesmo (evita bugs de clique rápido)
                            const currentActiveTab = document.querySelector('.filter-tab-btn.active');
                            const currentActiveFilter = currentActiveTab ? currentActiveTab.getAttribute('data-filter') : 'all';
                            if (currentActiveFilter !== 'all' && cardCategory !== currentActiveFilter) {
                                card.classList.add('filtered-out');
                                card.classList.remove('swiper-slide');
                            }
                            if (window.programsSwiper) window.programsSwiper.update();
                        }, 450); // Combina com os 0.5s de transição de CSS
                    }
                });
                
                setTimeout(() => {
                    if (window.programsSwiper) window.programsSwiper.update();
                }, 100);
            });
        });
    }

    // Initialize Swipers
    if (typeof Swiper !== 'undefined') {
        window.programsSwiper = new Swiper('.programs-swiper', {
            slidesPerView: 1,
            spaceBetween: 24,
            pagination: {
                el: '.programs-pagination',
                clickable: true,
            },
            breakpoints: {
                640: { slidesPerView: 2 },
                1024: { slidesPerView: 3 },
            }
        });

        const testimonialsSwiper = new Swiper('.testimonials-swiper', {
            slidesPerView: 1,
            spaceBetween: 24,
            pagination: {
                el: '.testimonials-pagination',
                clickable: true,
            },
            breakpoints: {
                768: { slidesPerView: 2 },
                1024: { slidesPerView: 3 },
            }
        });
    }

    // Aplicar fundos dinâmicos aos cards de unidade
    document.querySelectorAll('.unit-card').forEach(card => {
        const bgImage = card.getAttribute('data-bg-image');
        if (bgImage) {
            const style = document.createElement('style');
            const uniqueId = `unit-card-${Math.random().toString(36).substr(2, 9)}`;
            card.classList.add(uniqueId);
            style.innerHTML = `
                .${uniqueId}::before {
                    background-image: url('${bgImage}');
                }
            `;
            document.head.appendChild(style);
        }
    });

    // --- Lógica do Modal Academy ---
    const openModalBtn = document.getElementById('open-academy-modal');
    const closeModalBtn = document.getElementById('close-academy-modal');
    const modal = document.getElementById('academy-modal');

    if (openModalBtn && closeModalBtn && modal) {
        openModalBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            document.body.classList.add('no-scroll');
        });

        const closeModal = () => {
            modal.classList.add('hidden');
            document.body.classList.remove('no-scroll');
        };

        closeModalBtn.addEventListener('click', closeModal);

        // Fechar o modal clicando fora dele
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    function setupAppBanner() {
        const banner = document.getElementById('app-promo-banner');
        const closeBtn = document.getElementById('close-app-banner');
        const linkBtn = document.getElementById('app-banner-link');
        
        if (!banner || !closeBtn || !linkBtn) return;

        // Detectar OS para o link correto
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const appStoreUrl = 'https://apps.apple.com/br/app/kihap/id6761770657';
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.kihap.app';
        
        linkBtn.href = isIOS ? appStoreUrl : playStoreUrl;

        // Mostrar banner com delay
        setTimeout(() => {
            banner.classList.remove('hidden');
        }, 2000);

        closeBtn.addEventListener('click', () => {
            banner.classList.add('hidden');
            // Salvar no localStorage para não mostrar novamente nesta sessão/dispositivo
            localStorage.setItem('appBannerClosed', 'true');
        });
    }
});
