document.addEventListener("DOMContentLoaded", function() {
    // Mobile Menu Toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    const isProgramsPage = window.location.pathname.includes('/programas/');
    const componentBasePath = isProgramsPage ? '../components/' : 'components/';
    const assetBasePath = isProgramsPage ? '../' : './';

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
});
