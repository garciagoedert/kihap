import { getUserData } from './auth.js';
import { onAuthReady } from './auth.js';

function setupUIListeners() {
    // Sidebar toggle
    const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (sidebar && mainContent && sidebarOpenBtn && sidebarCloseBtn && backdrop) {
        const toggleSidebar = () => {
            // No mobile, a sidebar desliza por cima e o backdrop aparece.
            // No desktop (md:), a sidebar fica fixa e empurra o conteúdo.
            sidebar.classList.toggle('-translate-x-full');
            backdrop.classList.toggle('hidden');
            backdrop.classList.toggle('md:hidden'); // O backdrop deve sempre estar escondido no desktop.
        };

        sidebarOpenBtn.addEventListener('click', toggleSidebar);
        sidebarCloseBtn.addEventListener('click', toggleSidebar);
        backdrop.addEventListener('click', toggleSidebar);
    }
}

async function loadComponents(pageSpecificSetup) {
    const headerContainer = document.getElementById('header-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    try {
        const [headerRes, sidebarRes] = await Promise.all([
            fetch(`header.html?v=${new Date().getTime()}`),
            fetch(`sidebar.html?v=${new Date().getTime()}`)
        ]);

        if (!headerRes.ok || !sidebarRes.ok) {
            throw new Error('Failed to fetch components');
        }

        headerContainer.innerHTML = await headerRes.text();
        sidebarContainer.innerHTML = await sidebarRes.text();

        // Set active link in sidebar
        const sidebarLinks = sidebarContainer.querySelectorAll('nav a');
        sidebarLinks.forEach(link => {
            const linkPage = link.getAttribute('href').split('/').pop();
            if (linkPage === currentPage) {
                link.classList.add('bg-primary-light');
                link.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            }
        });
        
        // Setup listeners after components are loaded
        setupUIListeners();

        if (pageSpecificSetup && typeof pageSpecificSetup === 'function') {
            pageSpecificSetup();
        }

    } catch (error) {
        console.error('Error loading components:', error);
        headerContainer.innerHTML = '<p class="text-red-500 p-4">Error loading header.</p>';
        sidebarContainer.innerHTML = '<p class="text-red-500 p-4">Error loading sidebar.</p>';
    }
}

export { loadComponents };
