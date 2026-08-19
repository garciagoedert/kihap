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

    // Lógica de Filtragem dos Programas por M3 Chips / Abas
    const filterButtons = document.querySelectorAll('.filter-tab-btn, .m3-chip');
    const programCards = document.querySelectorAll('.program-card-clean');

    if (filterButtons.length > 0 && programCards.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Resetar estados ativos de todos os chips
                filterButtons.forEach(b => {
                    b.classList.remove('active');
                });

                // Definir estado ativo para o chip clicado
                btn.classList.add('active');

                const filterValue = btn.getAttribute('data-filter');

                programCards.forEach(card => {
                    const cardCategory = card.getAttribute('data-category');
                    
                    if (filterValue === 'all' || cardCategory === filterValue) {
                        card.style.display = '';
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1)';
                        }, 20);
                    } else {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            const activeBtn = document.querySelector('.m3-chip.active, .filter-tab-btn.active');
                            const currentFilter = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
                            if (currentFilter !== 'all' && cardCategory !== currentFilter) {
                                card.style.display = 'none';
                            }
                        }, 250);
                    }
                });
            });
        });
    }

    // Lógica da Barra Fixa de Conversão Mobile (Sticky CTA Bottom Bar)
    const mobileStickyBar = document.getElementById('mobile-sticky-cta');
    if (mobileStickyBar) {
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            if (window.scrollY > 250) {
                mobileStickyBar.classList.add('visible');
                document.body.classList.add('has-mobile-cta');
            } else {
                mobileStickyBar.classList.remove('visible');
                document.body.classList.remove('has-mobile-cta');
            }
            lastScrollY = window.scrollY;
        }, { passive: true });
    }

    // Aplicar fundos dinâmicos aos cards de unidade
    document.querySelectorAll('.unit-card').forEach(card => {
        const bgImage = card.getAttribute('data-bg-image');
        if (bgImage) {
            card.style.setProperty('--bg-image', `url('${bgImage}')`);
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

    // --- Lógica do Modal de Unidades Dinâmico ---
    const UNIT_DATA = {
        'asa-sul': {
            name: 'Asa Sul',
            city: 'Brasília - DF',
            address: 'Asa Sul CLS 115 BL C Lj 28 - Asa Sul, Brasília - DF, 70385-530',
            whatsapp: 'https://wa.me/556183007146',
            image: 'unidades/asasul.jpg',
            query: 'Kihap Asa Sul'
        },
        'sudoeste': {
            name: 'Sudoeste',
            city: 'Brasília - DF',
            address: 'SIG Quadra 3 Bloco C Lote 38, Edifício Office 300 - Sudoeste, Brasília - DF, 70610-430',
            whatsapp: 'https://wa.me/556182107146',
            image: 'unidades/sudoeste.jpg',
            query: 'Kihap Sudoeste Brasília'
        },
        'lago-sul': {
            name: 'Lago Sul',
            city: 'Brasília - DF',
            address: 'SHIS QI 9 - Lago Sul, Brasília - DF, 71625-009',
            whatsapp: 'https://wa.me/556192028980',
            image: 'unidades/lagosul.jpg',
            query: 'Kihap Lago Sul Brasília'
        },
        'noroeste': {
            name: 'Noroeste',
            city: 'Brasília - DF',
            address: 'CLNW 10/11 Bloco A - Noroeste, Brasília - DF, 70685-610',
            whatsapp: 'https://wa.me/556184170472',
            image: 'unidades/noroeste.jpg',
            query: 'Kihap Noroeste Brasília'
        },
        'jardim-botanico': {
            name: 'Jardim Botânico',
            city: 'Brasília - DF',
            address: 'Av. das Castanheiras, Centro Comercial Jardim Botânico - Jardim Botânico, Brasília - DF, 71680-385',
            whatsapp: 'https://wa.me/556184171059',
            image: 'unidades/jardimbotanico.jpg',
            query: 'Kihap Jardim Botânico Brasília'
        },
        'escola-eleva': {
            name: 'Escola Eleva',
            city: 'Brasília - DF',
            address: 'SGAS 606 - Asa Sul, Brasília - DF, 70200-660',
            whatsapp: 'https://wa.me/556182823380',
            image: 'novofundoheroback.png',
            query: 'Escola Eleva Brasília'
        },
        'escola-kingdom-kids': {
            name: 'Escola Kingdom Kids',
            city: 'Brasília - DF',
            address: 'SGAS 915 - Asa Sul, Brasília - DF, 70390-150',
            whatsapp: 'https://wa.me/556182823380',
            image: 'novofundoheroback.png',
            query: 'Kingdom School Brasília'
        },
        'escola-kingdom-school': {
            name: 'Escola Kingdom School',
            city: 'Brasília - DF',
            address: 'SGAS 915 - Asa Sul, Brasília - DF, 70390-150',
            whatsapp: 'https://wa.me/556182823380',
            image: 'novofundoheroback.png',
            query: 'Kingdom School Brasília'
        },
        'centro': {
            name: 'Centro',
            city: 'Florianópolis - SC',
            address: 'Rua Hermann Blumenau, 102 - Casarão - Centro, Florianópolis - SC, 88020-020',
            whatsapp: 'https://wa.me/554892182423',
            image: 'unidades/centro.jpg',
            query: 'Kihap Centro Florianópolis'
        },
        'coqueiros': {
            name: 'Coqueiros',
            city: 'Florianópolis - SC',
            address: 'Rua Desembargador Pedro Silva, 2644 - Coqueiros, Florianópolis - SC, 88080-701',
            whatsapp: 'https://wa.me/554896296941',
            image: 'unidades/coqueiros.jpg',
            query: 'Kihap Coqueiros Florianópolis'
        },
        'santa-monica': {
            name: 'Santa Mônica',
            city: 'Florianópolis - SC',
            address: 'Av. Madre Benvenuta, 1157 - Santa Mônica, Florianópolis - SC, 88035-001',
            whatsapp: 'https://wa.me/554892172423',
            image: 'unidades/santamonica.jpg',
            query: 'Kihap Santa Monica Florianópolis'
        },
        'jardim-america': {
            name: 'Jardim América',
            city: 'Dourados - MS',
            address: 'R. João Rosa Góes, 710 - Sl 02 - Jardim America, Dourados - MS, 79825-070',
            whatsapp: 'https://wa.me/556799597001',
            image: 'unidades/dourados.jpg',
            query: 'Kihap Dourados'
        }
    };
    UNIT_DATA['dourados'] = UNIT_DATA['jardim-america'];

    const injectUnitModal = () => {
        if (document.getElementById('unit-modal')) return;

        const modalHTML = `
            <div id="unit-modal" class="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none transition-all duration-300 opacity-0">
                <!-- Backdrop -->
                <div class="absolute inset-0 bg-black/0 backdrop-blur-none transition-all duration-300" id="unit-modal-backdrop"></div>
                
                <!-- Modal Container -->
                <div class="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden transform transition-all duration-300 scale-95 z-10 flex flex-col max-h-[90vh]" id="unit-modal-container">
                    <!-- Close button -->
                    <button id="unit-modal-close" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-white/80 hover:bg-white rounded-full p-2 shadow-sm transition-all z-20" aria-label="Fechar modal">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                    
                    <!-- Facade Image Header -->
                    <div class="h-48 w-full bg-gray-100 relative overflow-hidden flex-shrink-0">
                        <img id="unit-modal-image" src="" alt="Fachada da Unidade" class="w-full h-full object-cover">
                        <!-- Gradient Overlay -->
                        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
                        <!-- Title -->
                        <div class="absolute bottom-4 left-6 right-16">
                            <h3 id="unit-modal-title" class="text-2xl md:text-3xl font-black text-white uppercase tracking-wide font-title leading-tight"></h3>
                            <p id="unit-modal-city" class="text-yellow-400 font-bold uppercase text-xs tracking-wider mt-0.5"></p>
                        </div>
                    </div>
                    
                    <!-- Modal Body -->
                    <div class="p-6 overflow-y-auto space-y-6 flex-grow">
                        <!-- Address -->
                        <div>
                            <h4 class="text-xs uppercase font-bold text-gray-400 tracking-wider mb-2">Endereço</h4>
                            <p id="unit-modal-address" class="text-gray-700 text-sm leading-relaxed"></p>
                        </div>
                        
                        <!-- Map Embed -->
                        <div class="rounded-xl overflow-hidden border border-gray-100 shadow-inner bg-gray-50 h-[220px]">
                            <iframe id="unit-modal-map" src="" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>
                        </div>
                        
                        <!-- CTA button -->
                        <div class="pt-2 flex flex-col sm:flex-row gap-3">
                            <a id="unit-modal-whatsapp" href="" target="_blank" class="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2">
                                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24" style="filter: drop-shadow(0px 1px 1px rgba(0,0,0,0.1));">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.588 1.485 5.407 1.486 5.485.002 9.948-4.456 9.951-9.941a9.92 9.92 0 0 0-2.915-7.07 9.94 9.94 0 0 0-7.078-2.923C6.531.815 2.069 5.272 2.065 10.758c-.001 1.902.504 3.759 1.465 5.378l-.994 3.633 3.52-.924zm11.378-5.326c-.302-.151-1.785-.882-2.063-.982-.277-.1-.479-.151-.68.151-.202.302-.782.982-.958 1.183-.176.202-.352.226-.654.076-.301-.15-1.272-.469-2.422-1.494-.894-.797-1.498-1.78-1.674-2.081-.176-.302-.018-.465.133-.615.136-.135.302-.352.453-.529.151-.176.201-.302.302-.503.101-.201.05-.377-.026-.528-.075-.151-.68-1.634-.932-2.238-.245-.589-.496-.51-.68-.52-.176-.008-.377-.01-.578-.01-.201 0-.528.075-.805.377-.277.301-1.057 1.031-1.057 2.515 0 1.485 1.081 2.918 1.232 3.119.15.202 2.128 3.25 5.156 4.557.72.311 1.282.497 1.721.637.723.23 1.381.197 1.901.12.579-.086 1.785-.73 2.037-1.435.251-.704.251-1.307.176-1.435-.076-.127-.277-.201-.578-.352z"/>
                                </svg>
                                Falar no WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    };

    const openUnitModal = (unitId) => {
        injectUnitModal();
        const unit = UNIT_DATA[unitId];
        if (!unit) return;

        const modal = document.getElementById('unit-modal');
        const backdrop = document.getElementById('unit-modal-backdrop');
        const container = document.getElementById('unit-modal-container');
        
        // Fill content
        document.getElementById('unit-modal-title').textContent = unit.name;
        document.getElementById('unit-modal-city').textContent = unit.city;
        document.getElementById('unit-modal-address').textContent = unit.address;
        
        // Set image with assetBasePath
        const imageEl = document.getElementById('unit-modal-image');
        imageEl.src = `${assetBasePath}imgs/${unit.image}`;
        
        // Set WhatsApp href
        const waMsg = encodeURIComponent(`Olá! Quero saber mais sobre a unidade ${unit.name} da Kihap.`);
        document.getElementById('unit-modal-whatsapp').href = `${unit.whatsapp}?text=${waMsg}`;
        
        // Set Map iframe src
        const mapQ = encodeURIComponent(unit.query);
        document.getElementById('unit-modal-map').src = `https://maps.google.com/maps?q=${mapQ}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
        
        // Show animation
        modal.classList.remove('pointer-events-none');
        modal.classList.add('opacity-100');
        
        backdrop.classList.add('bg-black/60', 'backdrop-blur-sm');
        backdrop.classList.remove('bg-black/0', 'backdrop-blur-none');
        
        container.classList.add('scale-100');
        container.classList.remove('scale-95');
        
        document.body.classList.add('no-scroll');
    };

    const closeUnitModal = () => {
        const modal = document.getElementById('unit-modal');
        if (!modal) return;
        
        const backdrop = document.getElementById('unit-modal-backdrop');
        const container = document.getElementById('unit-modal-container');
        
        modal.classList.add('pointer-events-none');
        modal.classList.remove('opacity-100');
        
        backdrop.classList.remove('bg-black/60', 'backdrop-blur-sm');
        backdrop.classList.add('bg-black/0', 'backdrop-blur-none');
        
        container.classList.remove('scale-100');
        container.classList.add('scale-95');
        
        document.body.classList.remove('no-scroll');
        
        // Reset iframe src after animation finishes to stop loading in background
        setTimeout(() => {
            const mapIframe = document.getElementById('unit-modal-map');
            if (mapIframe) mapIframe.src = '';
        }, 300);
    };

    // Registrar Event Delegation para cliques no modal
    document.addEventListener('click', (e) => {
        const clickable = e.target.closest('[data-unit-id]');
        if (clickable) {
            const unitId = clickable.getAttribute('data-unit-id');
            openUnitModal(unitId);
        }
        
        if (e.target.id === 'unit-modal-close' || e.target.closest('#unit-modal-close') || e.target.id === 'unit-modal-backdrop') {
            closeUnitModal();
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUnitModal();
        }
    });
});

