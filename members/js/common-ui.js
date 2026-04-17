import { getUserData, onAuthReady, getCurrentUser } from './auth.js';
import { db } from '../../intranet/firebase-config.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showNotification as showChatMessageNotification } from './notification.js';
import { notificationsManager } from '../../intranet/notifications-manager.js';

function setupUIListeners() {
    // Sidebar toggle
    const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (sidebar && mainContent && sidebarOpenBtn && sidebarCloseBtn && backdrop) {
        // Initialize backdrop with highly optimized solid dimming layer
        backdrop.className = 'fixed inset-0 bg-black/60 z-[120] transition-opacity duration-300 opacity-0 pointer-events-none transform-gpu';

        const toggleSidebar = () => {
            const isClosed = sidebar.classList.toggle('-translate-x-full');
            if (isClosed) {
                backdrop.classList.replace('opacity-100', 'opacity-0');
                backdrop.classList.replace('pointer-events-auto', 'pointer-events-none');
            } else {
                backdrop.classList.replace('opacity-0', 'opacity-100');
                backdrop.classList.replace('pointer-events-none', 'pointer-events-auto');
            }
        };

        sidebarOpenBtn.addEventListener('click', toggleSidebar);
        sidebarCloseBtn.addEventListener('click', toggleSidebar);
        backdrop.addEventListener('click', toggleSidebar);
    }
}

function setupProfileMenu() {
    const profileToggle = document.getElementById('profile-menu-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileChevron = document.getElementById('profile-chevron');

    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = profileDropdown.classList.contains('hidden');
            
            if (isHidden) {
                profileDropdown.classList.remove('hidden');
                if (profileChevron) profileChevron.classList.add('rotate-180');
            } else {
                profileDropdown.classList.add('hidden');
                if (profileChevron) profileChevron.classList.remove('rotate-180');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileToggle.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.add('hidden');
                if (profileChevron) profileChevron.classList.remove('rotate-180');
            }
        });
    }
}

async function updateUserProfileUI() {
    const userNameEl = document.getElementById('header-user-name');
    const userUnitEl = document.getElementById('header-user-unit');
    const userAvatarEl = document.getElementById('header-user-avatar');
    const userEmailEl = document.getElementById('dropdown-user-email');

    if (!userNameEl) return;

    try {
        let currentUser = null;
        const currentUserStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        
        if (currentUserStr) {
            currentUser = JSON.parse(currentUserStr);
        } else {
            currentUser = await getCurrentUser();
            if (currentUser) {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
        }

        if (currentUser) {
            userNameEl.textContent = currentUser.name || currentUser.displayName || 'Usuário';
            if (userUnitEl) userUnitEl.textContent = currentUser.unit || currentUser.unidade || 'Kihap Member';
            if (userAvatarEl && currentUser.profilePicture) userAvatarEl.src = currentUser.profilePicture;
            if (userEmailEl) userEmailEl.textContent = currentUser.email || '';
        }
    } catch (error) {
        console.error("Error updating profile UI:", error);
    }
}

function updateNotificationIndicator(element, count) {
    if (!element) return;

    let indicator = element.querySelector('.notification-indicator');
    if (count > 0) {
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'notification-indicator absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#1a1a1a] shadow-sm';
            element.classList.add('relative');
            element.appendChild(indicator);
        }
        indicator.textContent = count > 9 ? '9+' : count;
    } else if (indicator) {
        indicator.remove();
    }
}

function listenForChatNotifications(userId) {
    const chatLink = document.getElementById('chat-link');
    if (!chatLink) return;

    const chatsCollection = collection(db, 'chats');
    const q = query(chatsCollection, where('members', 'array-contains', userId));

    onSnapshot(q, (snapshot) => {
        let totalUnread = 0;
        const safeUserKey = userId.replace(/\./g, '_');

        snapshot.docChanges().forEach(change => {
            const chatData = change.doc.data();
            const unreadCount = chatData.unreadCount?.[safeUserKey] || 0;
            
            // Notificar apenas em novas mensagens se não estiver no chat
            if (change.type === "modified" && unreadCount > 0 && window.location.pathname.indexOf('chat.html') === -1) {
                const lastMsg = chatData.lastMessage;
                if (lastMsg && lastMsg.senderId !== userId) {
                    showChatMessageNotification({
                        title: chatData.isGroup ? `Grupo: ${chatData.name}` : 'Nova Mensagem',
                        message: lastMsg.text,
                        onClickUrl: 'chat.html'
                    });
                }
            }
        });

        snapshot.forEach(doc => {
            totalUnread += (doc.data().unreadCount?.[safeUserKey] || 0);
        });

        updateNotificationIndicator(chatLink, totalUnread);
    });
}

async function loadComponents(pageSpecificSetup) {
    const headerContainer = document.getElementById('header-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    try {
        const [headerRes, sidebarRes, bottomNavRes] = await Promise.all([
            fetch(`header.html?v=${new Date().getTime()}`),
            fetch(`sidebar.html?v=${new Date().getTime()}`),
            fetch(`bottom-nav.html?v=${new Date().getTime()}`)
        ]);

        if (!headerRes.ok || !sidebarRes.ok || !bottomNavRes.ok) {
            throw new Error('Failed to fetch components');
        }

        if (headerContainer) {
            headerContainer.innerHTML = await headerRes.text();
            headerContainer.className = 'w-full bg-[#1a1a1a]';
            headerContainer.style.cssText = 'position: sticky; top: 0; z-index: 40;';
        }
        if (sidebarContainer) sidebarContainer.innerHTML = await sidebarRes.text();

        // Inject Bottom Nav dynamically if not present
        let bottomNavContainer = document.getElementById('bottom-nav-container');
        if (!bottomNavContainer) {
            bottomNavContainer = document.createElement('div');
            bottomNavContainer.id = 'bottom-nav-container';
            document.body.appendChild(bottomNavContainer);
        }
        bottomNavContainer.innerHTML = await bottomNavRes.text();

        // Set active link in sidebar
        if (sidebarContainer) {
            const sidebarLinks = sidebarContainer.querySelectorAll('nav a');
            sidebarLinks.forEach(link => {
                const linkPage = link.getAttribute('href').split('/').pop();
                if (linkPage === currentPage) {
                    link.classList.remove('text-gray-300', 'font-medium');
                    link.classList.add('text-yellow-500', 'font-bold', 'bg-white/5');
                }
            });
        }

        // Set active link in bottom nav
        if (bottomNavContainer) {
            const bottomNavLinks = bottomNavContainer.querySelectorAll('nav a');
            bottomNavLinks.forEach(link => {
                const linkPage = link.getAttribute('href').split('/').pop();
                // Associa painel/index como "Feed" para não deixar a barra inferior sem marcação em algumas páginas
                if (linkPage === currentPage || 
                    (currentPage === 'index.html' && linkPage === 'feed.html') || 
                    (currentPage === '' && linkPage === 'feed.html') || 
                    (currentPage.startsWith('busca') && linkPage === 'busca.html') ||
                    (currentPage.startsWith('notificacoes') && linkPage === 'notificacoes.html')) {
                    link.classList.add('active');
                }
            });
        }
        
        // Setup listeners and UI
        setupUIListeners();
        setupProfileMenu();
        updateUserProfileUI();


        onAuthReady((user) => {
            if (user) {
                listenForChatNotifications(user.id);
                // Inicializa o gerenciador de notificações (filtros, listeners, etc)
                notificationsManager.init();
            }
        });

        if (pageSpecificSetup && typeof pageSpecificSetup === 'function') {
            pageSpecificSetup();
        }

    } catch (error) {
        console.error('Error loading components:', error);
    }
}

export { loadComponents };
