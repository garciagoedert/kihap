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
        const toggleSidebar = () => {
            sidebar.classList.toggle('-translate-x-full');
            backdrop.classList.toggle('hidden');
            backdrop.classList.toggle('md:hidden');
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
        const currentUserStr = sessionStorage.getItem('currentUser');
        
        if (currentUserStr) {
            currentUser = JSON.parse(currentUserStr);
        } else {
            currentUser = await getCurrentUser();
            if (currentUser) {
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
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
        
        // Setup listeners and UI
        setupUIListeners();
        setupProfileMenu();
        updateUserProfileUI();


        onAuthReady((user) => {
            if (user) {
                listenForChatNotifications(user.id);
                // Inicializa o gerenciador de notificações para o aluno
                notificationsManager.init();
                notificationsManager.listen(user.id);
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
