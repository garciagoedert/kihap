import { getAllUsers } from './auth.js';

function setupUIListeners(handlers = {}) {
    const {
        openFormModal,
        exportData,
        openImportModal,
        closeFormModal,
        handleFormSubmit,
        closeImportModal,
        handleImport,
        applyFilters,
        openQuickMessagesModal
    } = handlers;

    // Sidebar toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle && !menuToggle.dataset.listenerAttached) {
        menuToggle.dataset.listenerAttached = 'true';

        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
        const backdrop = document.getElementById('sidebar-backdrop');

        if (sidebar && mainContent && sidebarCloseBtn && backdrop) {
            const toggleSidebar = () => {
                const isHidden = sidebar.classList.contains('-translate-x-full');
                if (isHidden) {
                    sidebar.classList.remove('-translate-x-full');
                    backdrop.classList.remove('hidden');
                    // A classe md:ml-64 é gerenciada pelo Tailwind, não precisa de JS
                } else {
                    sidebar.classList.add('-translate-x-full');
                    backdrop.classList.add('hidden');
                    // A classe md:ml-64 é gerenciada pelo Tailwind, não precisa de JS
                }
            };
            menuToggle.addEventListener('click', toggleSidebar);
            sidebarCloseBtn.addEventListener('click', toggleSidebar);
            backdrop.addEventListener('click', toggleSidebar);

            // Garante que o layout se ajuste em redimensionamento
            window.addEventListener('resize', () => {
                if (window.innerWidth < 768) {
                    sidebar.classList.add('-translate-x-full');
                    backdrop.classList.add('hidden');
                }
            });
        }
    }

    // Modal Buttons (only if they exist on the page)
    const addProspectBtnHeader = document.getElementById('addProspectBtnHeader');
    if (addProspectBtnHeader) {
        if (window.location.pathname.includes('projetos.html')) {
            // Na página de projetos, o botão abre o modal de nova tarefa
            addProspectBtnHeader.addEventListener('click', () => {
                // Dispara um evento customizado que o projetos.js pode ouvir
                window.dispatchEvent(new CustomEvent('open-create-task-modal'));
            });
        } else if (openFormModal) {
            // Comportamento padrão para outras páginas
            addProspectBtnHeader.addEventListener('click', () => openFormModal());
        }
    }
    if (exportData) document.getElementById('exportBtnSidebar')?.addEventListener('click', exportData);
    if (openImportModal) document.getElementById('importBtnSidebar')?.addEventListener('click', openImportModal);
    if (openQuickMessagesModal) document.getElementById('quickMessagesBtn')?.addEventListener('click', openQuickMessagesModal);

    // Form and Modal controls (only if they exist on the page)
    if (closeFormModal) {
        document.getElementById('closeFormModalBtn')?.addEventListener('click', closeFormModal);
        document.getElementById('cancelFormBtn')?.addEventListener('click', closeFormModal);
    }
    if (handleFormSubmit) {
        const prospectForm = document.getElementById('prospectForm');
        prospectForm?.addEventListener('submit', handleFormSubmit);
    }
    if (closeImportModal) {
        document.getElementById('closeImportModalBtn')?.addEventListener('click', closeImportModal);
        document.getElementById('cancelImportBtn')?.addEventListener('click', closeImportModal);
    }
    if (handleImport) document.getElementById('processImportBtn')?.addEventListener('click', handleImport);

    // Filters (only if they exist on the page)
    if (applyFilters) {
        document.getElementById('searchInput')?.addEventListener('keyup', applyFilters);
        document.getElementById('priorityFilter')?.addEventListener('change', applyFilters);
        document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            document.getElementById('priorityFilter').value = '';
            applyFilters();
        });
    }

    // Add modal close listeners
    setupModalCloseListeners({ closeFormModal, closeImportModal, closeConfirmModal: handlers.closeConfirmModal });

    // Generic Submenu toggles
    const setupSubmenu = (btnId, menuId) => {
        const btn = document.getElementById(btnId);
        const menu = document.getElementById(menuId);
        if (btn && menu && !btn.dataset.listenerAttached) {
            btn.dataset.listenerAttached = 'true';
            btn.addEventListener('click', () => {
                menu.classList.toggle('hidden');
                const icon = btn.querySelector('i.fa-chevron-down');
                if (icon) {
                    icon.classList.toggle('rotate-180');
                }
            });
        }
    };

    setupSubmenu('prospeccao-menu-btn', 'prospeccao-submenu');
    setupSubmenu('administrativo-menu-btn', 'administrativo-submenu');
    setupSubmenu('tatame-menu-btn', 'tatame-submenu');
    setupSubmenu('store-menu-btn', 'store-submenu');
}

function setupModalCloseListeners(handlers = {}) {
    console.log('Setting up modal close listeners...');
    const { closeFormModal, closeImportModal, closeConfirmModal } = handlers;

    const formModal = document.getElementById('formModal');
    const importModal = document.getElementById('importModal');
    const confirmModal = document.getElementById('confirmModal');

    // Close on Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            console.log('Escape key pressed.');
            if (formModal && !formModal.classList.contains('hidden') && closeFormModal) {
                console.log('Closing form modal via Escape.');
                closeFormModal();
            }
            if (importModal && !importModal.classList.contains('hidden') && closeImportModal) {
                console.log('Closing import modal via Escape.');
                closeImportModal();
            }
            if (confirmModal && !confirmModal.classList.contains('hidden') && closeConfirmModal) {
                console.log('Closing confirm modal via Escape.');
                closeConfirmModal();
            }
        }
    });

    // Close on backdrop click
    if (formModal && closeFormModal) {
        formModal.addEventListener('click', (event) => {
            console.log('Form modal clicked. Target:', event.target);
            if (event.target === formModal) {
                console.log('Backdrop clicked, closing form modal.');
                closeFormModal();
            }
        });
    }
    if (importModal && closeImportModal) {
        importModal.addEventListener('click', (event) => {
            console.log('Import modal clicked. Target:', event.target);
            if (event.target === importModal) {
                console.log('Backdrop clicked, closing import modal.');
                closeImportModal();
            }
        });
    }
    if (confirmModal && closeConfirmModal) {
        confirmModal.addEventListener('click', (event) => {
            console.log('Confirm modal clicked. Target:', event.target);
            if (event.target === confirmModal) {
                console.log('Backdrop clicked, closing confirm modal.');
                closeConfirmModal();
            }
        });
    }
}

import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showNotification as showChatMessageNotification } from './notification.js';
import { getCurrentUser } from './auth.js';


// Atualiza ou remove o indicador de notificação (ponto ou contador)
function updateNotificationIndicator(element, count) {
    if (!element) return;

    let indicator = element.querySelector('.notification-indicator');

    if (count > 0) {
        if (!indicator) {
            indicator = document.createElement('span');
            // Classes para o indicador
            indicator.className = 'notification-indicator absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center';
            element.style.position = 'relative'; // Garante que o posicionamento absoluto funcione
            element.appendChild(indicator);
        }
        indicator.textContent = count;
    } else {
        if (indicator) {
            indicator.remove();
        }
    }
}


// Listener global para notificações de novas mensagens
async function listenForChatNotifications() {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.uid) return;

    const chatsCollection = collection(db, 'chats');
    const q = query(chatsCollection, where('members', 'array-contains', currentUser.uid));

    let isInitialLoad = true;

    onSnapshot(q, (snapshot) => {
        let totalUnreadCount = 0;
        const safeCurrentUserKey = currentUser.uid.replace(/\./g, '_');

        // 1. Processa todos os documentos para contagem
        snapshot.forEach(doc => {
            const chatData = doc.data();
            totalUnreadCount += chatData.unreadCount?.[safeCurrentUserKey] || 0;
        });

        // 2. Atualiza a UI global (indicadores na sidebar)
        const chatLink = document.getElementById('chat-link');
        updateNotificationIndicator(chatLink, totalUnreadCount);

        // 3. Dispara evento para a página de chat (se estiver aberta)
        document.dispatchEvent(new CustomEvent('chat-data-updated', {
            detail: { totalUnreadCount }
        }));

        // 4. Lógica para notificações push, ignorando o carregamento inicial
        if (!isInitialLoad) {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'modified') {
                    const chatData = change.doc.data();
                    const lastMessage = chatData.lastMessage;

                    if (lastMessage && lastMessage.senderId !== currentUser.uid) {
                        const unreadCount = chatData.unreadCount?.[safeCurrentUserKey] || 0;
                        if (unreadCount > 0) {
                            const activeChatId = sessionStorage.getItem('activeChatId');
                            if (change.doc.id === activeChatId) return; // Não mostra notificação para o chat ativo

                            const senderRef = doc(db, 'users', lastMessage.senderId);
                            const senderSnap = await getDoc(senderRef);
                            if (senderSnap.exists()) {
                                const senderData = senderSnap.data();
                                const isChatPage = window.location.pathname.includes('chat.html');
                                const notificationDetails = {
                                    title: `Nova mensagem de ${senderData.name || senderData.email}`,
                                    message: lastMessage.text,
                                    icon: senderData.profilePicture || './default-profile.svg'
                                };
                                if (!isChatPage) {
                                    notificationDetails.onClickUrl = `chat.html?chatId=${change.doc.id}`;
                                }
                                showChatMessageNotification(notificationDetails);
                            }
                        }
                    }
                }
            });
        }

        isInitialLoad = false;
    });
}


async function loadWhitelabelSettings() {
    try {
        const settingsRef = doc(db, 'settings', 'whitelabel');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error loading whitelabel settings:", error);
        return null;
    }
}

async function applyWhitelabelSettings() {
    const settings = await loadWhitelabelSettings();
    const primaryColor = settings?.primaryColor || '#FFC107'; // Default to Tailwind's blue-600

    // Apply header logo
    if (settings?.headerLogoUrl) {
        const headerLogo = document.querySelector('#header-container img');
        if (headerLogo) {
            headerLogo.src = settings.headerLogoUrl;
        }
    }
    // Apply sidebar logo
    if (settings?.sidebarLogoUrl) {
        const sidebarLogo = document.querySelector('#sidebar-container img');
        if (sidebarLogo) {
            sidebarLogo.src = settings.sidebarLogoUrl;
        }
    }

    // Apply primary color
    const style = document.createElement('style');
    style.innerHTML = `
        .bg-primary { background-color: ${primaryColor} !important; }
        .text-primary { color: ${primaryColor} !important; }
        .border-primary { border-color: ${primaryColor} !important; }
        .hover\\:bg-primary-dark:hover { background-color: ${shadeColor(primaryColor, -20)} !important; }
        .bg-primary-light { background-color: ${shadeColor(primaryColor, 20)} !important; }
        .hover\\:bg-primary:hover { background-color: ${primaryColor} !important; }
        .bg-primary, .bg-primary-light, .hover\\:bg-primary:hover, .hover\\:bg-primary-dark:hover { color: #111111 !important; }
    `;
    document.head.appendChild(style);
}

// Helper function to lighten or darken a hex color
function shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
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

        await applyWhitelabelSettings();

        // Set active link in sidebar
        const sidebarLinks = sidebarContainer.querySelectorAll('nav a');
        sidebarLinks.forEach(link => {
            const linkPage = link.getAttribute('href').split('/').pop();
            if (linkPage === currentPage) {
                link.classList.add('bg-primary-light');
                link.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'text-white');

                if (linkPage === 'index.html') {
                    const prospectActions = document.getElementById('prospect-actions');
                    if (prospectActions) {
                        prospectActions.classList.remove('hidden');
                        prospectActions.classList.add('flex');
                    }
                }
            }
        });

        // Show/hide elements based on page and user role
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        const adminOnlyElements = document.querySelectorAll('.admin-only');

        adminOnlyElements.forEach(el => {
            // Mostra o link de suporte para todos, mas outros elementos admin-only apenas para admins
            if (el.getAttribute('href') === 'suporte.html') {
                el.classList.remove('hidden');
            } else if (isAdmin) {
                el.classList.remove('hidden');
            }
        });

        const adminLink = document.getElementById('admin-link');
        if (isAdmin && adminLink) {
            adminLink.classList.remove('hidden');
        }

        const currentUserStr = sessionStorage.getItem('currentUser');
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : {};
        const isInstructor = currentUser.isInstructor === true;

        const planificadorLink = document.getElementById('planificador-link');
        if ((isAdmin || isInstructor) && planificadorLink) {
            planificadorLink.classList.remove('hidden');
        }

        // Controla a visibilidade do botão "Novo Prospect"
        const addProspectBtn = document.getElementById('addProspectBtnHeader');
        if (addProspectBtn) {
            const pagesToHideButton = [
                'processos.html',
                'processos-editor.html',
                'processos-viewer.html',
                'cursos.html',
                'projetos.html',
                'tarefas.html',
                'tatame.html',
                'conteudo-editor.html',
                'conteudo-viewer.html',
                'estoque.html',
                'pedidos.html',
                'chat.html',
                'feed.html',
                'store.html',
                'checkin.html',
                'suporte.html',
                'grade.html',
                'relatorios.html',
                'planificador.html'
            ];
            if (pagesToHideButton.includes(currentPage)) {
                addProspectBtn.classList.add('hidden');
            } else {
                addProspectBtn.classList.remove('hidden');
            }
        }


        // Setup listeners after components are loaded
        setupUIListeners();

        if (pageSpecificSetup && typeof pageSpecificSetup === 'function') {
            pageSpecificSetup();
        }

        // Inicia o listener de notificações de chat
        listenForChatNotifications();

    } catch (error) {
        console.error('Error loading components:', error);
        headerContainer.innerHTML = '<p class="text-red-500 p-4">Error loading header.</p>';
        sidebarContainer.innerHTML = '<p class="text-red-500 p-4">Error loading sidebar.</p>';
    }
}

function showAlert(message, title = "Aviso") {
    const alertModal = document.getElementById('alertModal');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const closeAlertBtn = document.getElementById('closeAlertBtn');

    if (!alertModal) return;

    alertTitle.textContent = title;
    alertMessage.textContent = message;

    alertModal.classList.remove('hidden');
    alertModal.classList.add('flex');

    closeAlertBtn.onclick = () => {
        alertModal.classList.add('hidden');
        alertModal.classList.remove('flex');
    };
}

function showInviteLinkModal(link) {
    const modal = document.getElementById('inviteLinkModal');
    const linkInput = document.getElementById('inviteLinkInput');
    const copyBtn = document.getElementById('copyInviteLinkBtn');
    const closeBtn = document.getElementById('closeInviteLinkModalBtn');

    if (!modal || !linkInput || !copyBtn || !closeBtn) return;

    linkInput.value = link;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const close = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    copyBtn.onclick = () => {
        linkInput.select();
        document.execCommand('copy');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
    };

    closeBtn.onclick = close;
}

function showConfirm(message, onConfirm, title = "Confirmar Ação") {
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    const confirmActionBtn = document.getElementById('confirmActionBtn');

    if (!confirmModal) return;

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;

    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');

    const close = () => {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
    };

    cancelConfirmBtn.onclick = close;
    confirmActionBtn.onclick = () => {
        close();
        onConfirm();
    };
}

export { setupUIListeners, loadComponents, getAllUsers, showAlert, showConfirm, showInviteLinkModal };
