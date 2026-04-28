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
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    
    if (sidebar && !sidebar.dataset.listenerAttached) {
        sidebar.dataset.listenerAttached = 'true';

        const toggleSidebar = () => {
            // Toggle apenas para mobile
            if (window.innerWidth < 768) {
                const isHidden = sidebar.classList.contains('-translate-x-full');
                if (isHidden) {
                    sidebar.classList.remove('-translate-x-full');
                    sidebar.classList.add('translate-x-0');
                    if (backdrop) backdrop.classList.remove('hidden');
                } else {
                    sidebar.classList.add('-translate-x-full');
                    sidebar.classList.remove('translate-x-0');
                    if (backdrop) backdrop.classList.add('hidden');
                }
            }
        };

        const menuToggle = document.getElementById('menu-toggle');
        const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

        if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
        if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', toggleSidebar);
        if (backdrop) backdrop.addEventListener('click', toggleSidebar);

        // Garante estado correto no resize
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) {
                sidebar.classList.remove('-translate-x-full');
                sidebar.classList.add('md:translate-x-0');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                // Ao voltar pro mobile, se não estiver visível (translate-x-0), garantir q tem translate-x-full
                if (!sidebar.classList.contains('translate-x-0')) {
                    sidebar.classList.add('-translate-x-full');
                }
            }
        });
    }

    // Profile Menu toggle
    setupProfileMenu();

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

    // Generic Submenu toggles (Event Delegation)
    if (sidebar && !sidebar.dataset.delegatedListenerAttached) {
        sidebar.dataset.delegatedListenerAttached = 'true';
        sidebar.addEventListener('click', (event) => {
            const toggleBtn = event.target.closest('.sidebar-dropdown-toggle');
            if (toggleBtn) {
                // Determine the submenu ID based on the button ID pattern provided in HTML
                // Pattern: {name}-menu-btn -> {name}-submenu
                const btnId = toggleBtn.id;
                if (btnId && btnId.endsWith('-menu-btn')) {
                    const baseName = btnId.replace('-menu-btn', '');
                    const submenuId = `${baseName}-submenu`;
                    const submenu = document.getElementById(submenuId);

                    if (submenu) {
                        submenu.classList.toggle('hidden');
                        const icon = toggleBtn.querySelector('i.fa-chevron-down');
                        if (icon) {
                            icon.classList.toggle('rotate-180');
                        }
                    }
                }
            }
        });
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
                profileDropdown.classList.remove('hidden', 'opacity-0', 'scale-95');
                profileDropdown.classList.add('opacity-100', 'scale-100');
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
        // Busca dados frescos do Firestore para garantir que permissões e perfil estejam atualizados
        currentUser = await getCurrentUser();
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }

        if (currentUser) {
            userNameEl.textContent = currentUser.name || currentUser.displayName || 'Usuário';
            
            if (userUnitEl) {
                userUnitEl.textContent = currentUser.unit || currentUser.unidade || 'Kihap';
            }
            
            if (userAvatarEl && currentUser.profilePicture) {
                userAvatarEl.src = currentUser.profilePicture;
            }

            if (userEmailEl) {
                userEmailEl.textContent = currentUser.email || '';
            }
            
            // Handle admin-only elements in dropdown
            const isAdmin = currentUser.isAdmin === true;
            localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
            
            document.querySelectorAll('#profile-dropdown .admin-only').forEach(el => {
                if (isAdmin) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        }
    } catch (error) {
        console.error("Error updating profile UI:", error);
    }
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
import { getCurrentUser, ensureAdmin } from './auth.js';
import { notificationsManager } from './notifications-manager.js';


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

    // Apply header logo - REMOVED for clean UI (Logo is on Sidebar)
    /*
    if (settings?.headerLogoUrl) {
        const headerLogo = document.querySelector('#header-container img');
        if (headerLogo) {
            headerLogo.src = settings.headerLogoUrl;
        }
    }
    */
    // Apply sidebar logo
    if (settings?.sidebarLogoUrl) {
        const sidebarLogo = document.querySelector('#sidebar-container img');
        if (sidebarLogo) {
            sidebarLogo.src = settings.sidebarLogoUrl;
            // Ensure inversion is applied if it's a white logo
            sidebarLogo.classList.add('invert', 'dark:invert-0');
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

    // Configurações de Cache
    const CACHE_VERSION = '1.0.7'; 
    const getCached = (key) => {
        const item = localStorage.getItem(`kihap_intranet_${key}`);
        if (item) {
            const parsed = JSON.parse(item);
            if (parsed.version === CACHE_VERSION) return parsed.html;
        }
        return null;
    };
    const setCached = (key, html) => {
        localStorage.setItem(`kihap_intranet_${key}`, JSON.stringify({ version: CACHE_VERSION, html }));
    };

    // Lista de páginas que exigem acesso administrativo
    const adminPages = [
        'admin.html',
        'newsletter.html',
        'arquivo.html',
        'analise.html',
        'contas-mp.html',
        'planificador.html',
        'unidades-planos.html',
        'comunicados.html',
        'grade.html',
        'relatorios.html',
        'snapshots-history.html',
        'sales-history.html',
        'gerenciar-emblemas.html'
    ];

    // Páginas específicas do Jurídico
    const juridicoPages = ['juridico-trello.html', 'juridico-novademanda.html'];

    try {
        const loadComp = async (id, file, container) => {
            if (!container) return;
            
            // 1. Tentar carregar do cache IMEDIATAMENTE
            let html = getCached(id);
            if (html) {
                container.innerHTML = html;
            }

            // 2. Sempre buscar a versão mais recente em background
            try {
                const res = await fetch(`${file}?v=${CACHE_VERSION}`);
                if (res.ok) {
                    const freshHtml = await res.text();
                    // Só atualiza o DOM se o conteúdo for diferente para evitar re-renders desnecessários
                    if (freshHtml !== html) {
                        container.innerHTML = freshHtml;
                        setCached(id, freshHtml);
                    }
                }
            } catch (e) {
                console.warn(`Erro ao buscar componente ${id}:`, e);
            }
        };

        // Inicia o carregamento dos componentes IMEDIATAMENTE do cache/network
        const componentsPromise = Promise.all([
            loadComp('header', '/intranet/header.html', headerContainer),
            loadComp('sidebar', '/intranet/sidebar.html', sidebarContainer)
        ]);

        // Aguarda os componentes serem injetados antes de prosseguir com ACL da sidebar
        await componentsPromise;

        // Garante que o container principal tenha a classe correta para o layout fixo
        const mainEl = document.getElementById('main-content');
        if (mainEl && window.innerWidth >= 768) {
            mainEl.style.marginLeft = '0';
            mainEl.style.width = '100%';
        }

        // Enquanto os componentes carregam (ou logo após), buscamos o usuário para ACL
        // Usamos o cache do localStorage se disponível para rapidez total, depois validamos
        const cachedUser = localStorage.getItem('currentUser');
        let userData = cachedUser ? JSON.parse(cachedUser) : null;
        
        // Se não tem cache, busca do Firestore (mais lento)
        if (!userData) {
            const currentUserData = await getCurrentUser();
            userData = currentUserData || {};
        } else {
            // Se tem cache, valida em background
            getCurrentUser().then(fresh => {
                if (fresh) localStorage.setItem('currentUser', JSON.stringify(fresh));
            });
        }

        const isAdmin = userData.isAdmin === true;
        const isJuridico = userData.isJuridico === true;
        const isStore = userData.isStore === true;
        const isRH = userData.isRH === true;
        const isMarketing = userData.isMarketing === true;
        const isInstructor = userData.isInstructor === true;
        const isAdministrativo = userData.isAdministrativo === true;

        // Se for uma página administrativa, valida acesso
        if (adminPages.includes(currentPage)) {
            const isStorePage = ['sales-history.html', 'store.html'].includes(currentPage);
            if (!isAdmin && !(isStore && isStorePage)) {
                window.location.href = 'index.html';
                return;
            }
        }

        // Se for uma página do Jurídico, valida acesso
        if (juridicoPages.includes(currentPage)) {
            if (!isAdmin && !isJuridico) {
                window.location.href = 'index.html';
                return;
            }
        }

        applyWhitelabelSettings(); // Non-blocking apply

        // Set active link in sidebar
        const sidebarLinks = sidebarContainer.querySelectorAll('nav a');
        sidebarLinks.forEach(link => {
            const linkPage = link.getAttribute('href').split('/').pop();
            if (linkPage === currentPage) {
                link.classList.add('bg-primary');
                link.classList.remove('bg-white', 'dark:bg-gray-700', 'hover:bg-gray-100', 'dark:hover:bg-gray-600', 'text-gray-700', 'dark:text-white', 'border-gray-200');
                link.classList.add('text-black', 'border-transparent');

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
        localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
        localStorage.setItem('isStore', isStore ? 'true' : 'false');

        const adminOnlyElements = document.querySelectorAll('.admin-only');
        adminOnlyElements.forEach(el => {
            if (el.getAttribute('href') === 'suporte.html' || isAdmin) {
                el.classList.remove('hidden');
            }
        });

        const adminLink = document.getElementById('admin-link');
        if (isAdmin && adminLink) {
            adminLink.classList.remove('hidden');
        }


        // VISIBILIDADE DA SIDEBAR
        // VISIBILIDADE DA SIDEBAR
        
        // Jurídico: Visível para Admin ou Juridico
        const juridicoMenu = document.getElementById('juridico-menu-btn')?.parentElement;
        if (juridicoMenu && !isAdmin && !isJuridico) juridicoMenu.classList.add('hidden');

        // RH: Visível para Admin ou RH
        const rhMenu = document.getElementById('rh-menu-btn')?.parentElement;
        if (rhMenu && !isAdmin && !isRH) rhMenu.classList.add('hidden');

        // Marketing: Visível para Admin ou Marketing ou Instrutor ou Administrativo
        const marketingMenu = document.getElementById('prospeccao-menu-btn')?.parentElement;
        if (marketingMenu && !isAdmin && !isMarketing && !isInstructor && !isAdministrativo) marketingMenu.classList.add('hidden');


        // Outras seções: Esconder apenas se for um usuário RESTRITO (Jurídico)
        if (isJuridico && !isAdmin) {
            // Oculta Alunos, Cursos, Livrinhos, Feed e outras seções administrativas
            const selectorsToHide = [
                'a[href="alunos.html"]',
                'a[href="cursos.html"]',
                'a[href="feed.html"]',
                'a[href*="livrinhos"]',
                '#administrativo-menu-btn',
                '#tatame-menu-btn',
                '#store-menu-btn'
            ];
            selectorsToHide.forEach(selector => {
                const el = sidebarContainer.querySelector(selector);
                if (el) {
                    const container = el.tagName === 'BUTTON' ? el.parentElement : el;
                    container.classList.add('hidden');
                }
            });
        } else if (isStore && !isAdmin) {
            // Oculta apenas o Admin se for um usuário de Store (outras seções podem ser úteis)
            const adminLink = sidebarContainer.querySelector('#admin-link');
            if (adminLink) adminLink.classList.add('hidden');
        }





        const currentUserStr = localStorage.getItem('currentUser');
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : {};
        // isInstructor já foi declarado acima usando userData do Firestore




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

        // Inicializa o sistema de notificações
        notificationsManager.init();

        // Atualiza as informações do perfil no header e garante localStorage atualizado
        await updateUserProfileUI();

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
