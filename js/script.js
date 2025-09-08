document.addEventListener("DOMContentLoaded", function() {
    const isSubPage = window.location.pathname.includes('/programas/') || window.location.pathname.includes('/unidades/') || window.location.pathname.includes('/desenvolvimento/');
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
                    
                    if (containerId === 'header-container' || containerId === 'footer-container') {
                        container.outerHTML = adjustedData;
                        if (containerId === 'header-container') {
                            // Dispara um evento para notificar que o header foi carregado
                            document.dispatchEvent(new Event('headerLoaded'));
                        }
                    } else {
                        container.innerHTML = adjustedData;
                    }
                });
        }
    };

    loadComponent('header-container', 'header.html');
    loadComponent('footer-container', 'footer.html');
    loadComponent('testimonials-container', 'testimonials.html');
    loadComponent('video-container', 'video.html');
    loadComponent('cta-container', 'form-cta.html');

    // A lógica do menu será adicionada após o carregamento do header
    document.addEventListener('headerLoaded', setupMobileMenu);

    function setupMobileMenu() {
        const openButton = document.getElementById('mobile-menu-button');
        const closeButton = document.getElementById('mobile-menu-close-button');
        const menu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('mobile-menu-overlay');
        const menuLinks = menu.querySelectorAll('a');

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

        if (openButton && menu && overlay && closeButton) {
            openButton.addEventListener('click', openMenu);
            closeButton.addEventListener('click', closeMenu);
            overlay.addEventListener('click', closeMenu);
            menuLinks.forEach(link => {
                link.addEventListener('click', closeMenu);
            });
        }
    }

    // Inicializar o Swiper
    var swiper = new Swiper('.program-swiper', {
        loop: true,
        slidesPerView: 'auto',
        spaceBetween: 15,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        breakpoints: {
            640: {
                slidesPerView: 2,
                spaceBetween: 20,
            },
            768: {
                slidesPerView: 3,
                spaceBetween: 30,
            },
            1024: {
                slidesPerView: 4,
                spaceBetween: 40,
            },
        }
    });

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
});
