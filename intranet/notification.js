// Função para garantir que o container de notificações exista no DOM
async function ensureNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        try {
            const response = await fetch('notification-container.html');
            if (!response.ok) throw new Error('Failed to fetch notification-container.html');
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);
            container = document.getElementById('notification-container');
        } catch (error) {
            console.error('Erro ao carregar o container de notificações:', error);
            return null;
        }
    }
    return container;
}

// Função para mostrar uma notificação
async function showNotification(options) {
    const container = await ensureNotificationContainer();
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = 'notification-item bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-4 flex items-start animate-fade-in-down';
    
    notification.innerHTML = `
        <img src="${options.icon || './default-profile.svg'}" alt="Ícone" class="w-10 h-10 rounded-full mr-4">
        <div class="flex-1">
            <h4 class="font-bold text-gray-900 dark:text-white">${options.title}</h4>
            <p class="text-sm text-gray-600 dark:text-gray-300">${options.message}</p>
        </div>
        <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
    `;

    if (options.onClickUrl) {
        notification.style.cursor = 'pointer';
        notification.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                window.location.href = options.onClickUrl;
            }
        });
    }

    const closeButton = notification.querySelector('button');
    closeButton.addEventListener('click', () => {
        notification.classList.add('animate-fade-out-up');
        setTimeout(() => notification.remove(), 500);
    });

    container.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('animate-fade-out-up');
            setTimeout(() => notification.remove(), 500);
        }
    }, options.timeout || 5000);
}

export { showNotification };
