/**
 * Sistema de Pull-to-Refresh para o App Kihap
 * Proporciona carregamento elástico do feed ao puxar para baixo.
 */

export function initPullToRefresh(refreshCallback) {
    const mainContent = document.getElementById('main-content');
    const indicator = document.getElementById('ptr-indicator');
    const spinner = indicator.querySelector('.ptr-spinner');
    
    if (!mainContent || !indicator) return;

    let startY = 0;
    let currentY = 0;
    let pulling = false;
    const threshold = 70; // px para disparar refresh
    const maxPull = 120; // limite de tração visual

    const onTouchStart = (e) => {
        // Só ativa se estiver no topo absoluto da página
        if (window.scrollY === 0) {
            startY = e.touches[0].pageY;
            pulling = true;
            indicator.style.transition = 'none';
            mainContent.style.transition = 'none';
        }
    };

    const onTouchMove = (e) => {
        if (!pulling) return;
        
        currentY = e.touches[0].pageY;
        let pullDistance = currentY - startY;

        if (pullDistance > 0) {
            // Impedir o scroll padrão enquanto puxa
            if (e.cancelable) e.preventDefault();

            // Aplicar resistência (logarítmica/exponencial inversa)
            const elasticPull = Math.min(maxPull, Math.pow(pullDistance, 0.85) * 2);
            
            indicator.style.transform = `translateY(${elasticPull}px)`;
            mainContent.style.transform = `translateY(${elasticPull}px)`;
            
            // Girar o spinner conforme a puxada
            const rotation = (elasticPull / threshold) * 360;
            spinner.style.transform = `rotate(${rotation}deg)`;
            
            // Feedback de opacidade
            indicator.style.opacity = Math.min(1, elasticPull / threshold);
        } else {
            pulling = false;
        }
    };

    const onTouchEnd = () => {
        if (!pulling) return;
        pulling = false;

        const currentPull = parseFloat(indicator.style.transform.replace('translateY(', '').replace('px)', '')) || 0;

        if (currentPull >= threshold) {
            startRefreshing();
        } else {
            resetUI();
        }
    };

    const startRefreshing = () => {
        indicator.classList.add('ptr-refreshing');
        indicator.style.transition = 'transform 0.3s ease';
        mainContent.style.transition = 'transform 0.3s ease';
        
        indicator.style.transform = `translateY(${threshold}px)`;
        mainContent.style.transform = `translateY(${threshold}px)`;

        // Haptic Feedback (se Capacitor disponível)
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                // Tentar usar o plugin Haptics se carregado, senão ignora
                // console.log("Haptic vibration triggered");
            } catch (e) {}
        }

        if (refreshCallback) {
            refreshCallback().finally(() => {
                setTimeout(resetUI, 500); // Delay suave antes de subir
            });
        }
    };

    const resetUI = () => {
        indicator.classList.remove('ptr-refreshing');
        indicator.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s';
        mainContent.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
        
        indicator.style.transform = 'translateY(0)';
        mainContent.style.transform = 'translateY(0)';
        indicator.style.opacity = '0';
    };

    // Event Listeners
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
}
