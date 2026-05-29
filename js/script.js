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
                });
        }
    };

    loadComponent('header-container', 'header.html');
    loadComponent('footer-container', 'footer.html');
    loadComponent('testimonials-container', 'testimonials.html');
    loadComponent('video-container', 'video.html');
    loadComponent('cta-container', 'form-cta.html');
    
    // Injeta container do banner de app e carrega se for mobile
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

    // A lógica do menu será adicionada após o carregamento do header
    document.addEventListener('headerLoaded', setupMobileMenu);

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
                            }
                        }, 450); // Combina com os 0.5s de transição de CSS
                    }
                });
            });
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
