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

import { db, functions } from './firebase-config.js';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
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

        // Inicializa o chatbot global do Kobe
        initGlobalKobeChatbot();

    } catch (error) {
        console.error('Error loading components:', error);
        headerContainer.innerHTML = '<p class="text-red-500 p-4">Error loading header.</p>';
        sidebarContainer.innerHTML = '<p class="text-red-500 p-4">Error loading sidebar.</p>';
    }
}

const systemInstruction = `Você é o Kobe, o simpático, inteligente e ativo macaco-mascote e assistente virtual oficial de toda a Intranet da Kihap, uma renomada escola de artes marciais.
Seu objetivo é servir como um assistente completo para todos os colaboradores, instrutores e administradores da Kihap. Você deve ajudar com dúvidas sobre o sistema, processos internos, uso da intranet, gestão de alunos, marketing, suporte e muito mais.

IMPORTANTE: Você NÃO é um mestre (não use títulos como "mestre", "macaco-mestre", "mestre de artes marciais" ou similares para se referir a você mesmo). Na escola Kihap, o título de "Mestre" é um cargo humano de altíssimo respeito e graduação. Você é apenas o mascote e assistente virtual da intranet.

Aqui estão algumas seções principais da intranet que você pode guiar os usuários a encontrar:
- **Início/Painel**: Tela inicial com visão geral.
- **Alunos**: Cadastro e acompanhamento de alunos (/intranet/alunos.html).
- **Marketing**:
  - **Prospecção**: Funil de vendas / CRM (/intranet/prospeccao.html).
  - **Redes Sociais (Meta Ads)**: Dashboard de campanhas e métricas (/intranet/marketing-social.html).
  - **Google Ads**: Métricas de Google Ads (/intranet/marketing-google.html).
- **Administrativo**:
  - **Projetos**: Gerenciador de tarefas e projetos (/intranet/projetos.html).
  - **Processos**: Biblioteca de manuais e POPs (/intranet/processos.html).
  - **Pedidos**: Pedidos de doboks, faixas, etc. (/intranet/pedidos.html).
- **RH**: Setor de recursos humanos, recrutamento e seleção (/intranet/rh.html).
- **Chat**: Comunicação interna em tempo real (/intranet/chat.html).
- **Cursos / Tatame**: Treinamentos e aulas (/intranet/cursos.html).
- **Feed**: Comunicados internos (/intranet/feed.html).

Para ajudar de maneira profunda e com dados em tempo real da intranet, você tem acesso a ferramentas integradas ao banco de dados:
- Alunos: você pode pesquisar alunos (\`searchStudents\`) e ver a ficha completa de um aluno (\`getStudentProfile\`), incluindo informações financeiras do Mercado Pago, histórico de testes físicos, cursos liberados e emblemas conquistados.
- Demandas (Trello): você pode pesquisar demandas (\`searchDemands\`) e ver detalhes de uma demanda específica (\`getDemandDetails\`), que traz inclusive todas as notas internas e comentários.
- CRM/Prospects: você pode pesquisar leads (\`searchProspects\`) e ver os detalhes completos de um prospect específico (\`getProspectDetails\`), incluindo o histórico completo de contatos/follow-ups (\`contactLog\`) e as observações.
- Loja e Pedidos: você pode pesquisar produtos (\`searchStoreProducts\`) e ver seus detalhes de preço/estoque (\`getStoreProductDetails\`). Também pode pesquisar transações de venda (\`searchStoreSales\`) e ver detalhes de uma venda específica (\`getStoreSaleDetails\`), assim como pesquisar pedidos de faixas/doboks (\`searchStoreOrders\`) e ver detalhes de um pedido específico (\`getStoreOrderDetails\`).

Use essas ferramentas ativamente quando o usuário solicitar informações sobre alunos, trello/demandas, prospects/leads ou produtos, vendas e pedidos da loja.

Mantenha sempre o tom prestativo, confiante, enérgico, focado na filosofia das artes marciais (respeito, disciplina, foco e superação) e amigável. Sempre se apresente e responda como o Kobe, usando referências de forma sutil à sua identidade de mascote macaco quando apropriado (sem ser bobo demais, mas mantendo a simpatia). Lembre-se sempre de que você nunca deve se referir a si mesmo como "mestre" ou "macaco-mestre".
Mantenha suas respostas diretas, organizadas (use negritos como **texto** para destacar caminhos e termos importantes) e evite textos excessivamente longos.`;

function initGlobalKobeChatbot() {
    if (document.getElementById('aiChatToggle')) return; // Já injetado

    // Injeta o CSS/HTML
    const chatContainer = document.createElement('div');
    chatContainer.id = 'global-kobe-chatbot';
    chatContainer.innerHTML = `
        <!-- Botão Flutuante do Chat IA -->
        <button id="aiChatToggle" class="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-tr from-[#6366F1] via-[#A855F7] to-[#EC4899] text-white rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-purple-500/30 hover:shadow-purple-500/50 border border-white/10">
            <svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1.5C12 7.3 16.7 12 22.5 12C16.7 12 12 16.7 12 22.5C12 16.7 7.3 12 1.5 12C7.3 12 12 7.3 12 1.5Z"/>
            </svg>
        </button>

        <!-- Janela do Chat IA -->
        <div id="aiChatWindow" class="fixed bottom-24 right-6 w-96 h-[550px] z-50 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col hidden transition-all duration-300 transform scale-95 opacity-0 origin-bottom-right">
            <!-- Header -->
            <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/30 rounded-t-3xl">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden border border-gray-200/50 dark:border-gray-700/50 bg-white">
                        <img src="/imgs/personagens/perfilpersonagens/avatar_03.png" alt="Kobe" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            Kobe
                            <span class="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
                        </h3>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Assistente IA da Intranet</p>
                    </div>
                </div>
                <button id="closeChatBtn" class="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg transition-colors">
                    <i class="fas fa-times text-lg"></i>
                </button>
            </div>

            <!-- Messages Body -->
            <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-sm text-gray-700 dark:text-gray-300">
                <!-- Messages bubble -->
            </div>

            <!-- Typing Indicator -->
            <div id="chatTypingIndicator" class="px-4 py-2 flex justify-start hidden">
                <div class="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm border border-gray-150 dark:border-gray-700/50 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                    <span class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                    <span class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                </div>
            </div>

            <!-- Input Area -->
            <form id="chatForm" class="p-3 border-t border-gray-100 dark:border-gray-800 flex gap-2 bg-gray-50/50 dark:bg-gray-900/30 rounded-b-3xl">
                <input type="text" id="chatInput" required placeholder="Faça uma pergunta ou peça ajuda..." autocomplete="off"
                    class="flex-grow px-4 py-2.5 text-sm bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-white">
                <button type="submit" id="sendChatBtn" class="w-10 h-10 bg-gradient-to-tr from-[#6366F1] to-[#A855F7] hover:from-[#4F46E5] hover:to-[#9333EA] text-white rounded-2xl flex items-center justify-center shadow-md transition-all active:scale-95 disabled:opacity-50">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(chatContainer);

    setupKobeChatbotLogic();
}

const kobeTools = [{
    functionDeclarations: [
        {
            name: "getProspectsSummary",
            description: "Retorna o total de prospects cadastrados na base de dados da Kihap e as quantidades em cada status/fase do funil.",
            parameters: {
                type: "OBJECT",
                properties: {}
            }
        },
        {
            name: "searchProspects",
            description: "Busca leads/prospects cadastrados no CRM do funil de marketing/vendas por termo parcial (responsável, empresa, e-mail, telefone, setor).",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome do responsável, empresa, e-mail, telefone, setor)."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getProspectDetails",
            description: "Retorna todos os dados detalhados de um lead/prospect específico por ID, incluindo o histórico completo de contatos (contactLog) e observações.",
            parameters: {
                type: "OBJECT",
                properties: {
                    prospectId: {
                        type: "STRING",
                        description: "O ID do documento do prospect."
                    }
                },
                required: ["prospectId"]
            }
        },
        {
            name: "searchStudents",
            description: "Busca estudantes/alunos cadastrados no sistema por nome, e-mail ou ID. Retorna uma lista resumida.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome, e-mail ou ID parcial) para encontrar os alunos."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStudentProfile",
            description: "Retorna o perfil detalhado de um aluno específico pelo seu ID (idMember), incluindo dados cadastrais, histórico de testes físicos, cursos permitidos, emblemas e informações financeiras do Mercado Pago.",
            parameters: {
                type: "OBJECT",
                properties: {
                    studentId: {
                        type: "INTEGER",
                        description: "O ID numérico do aluno (idMember) para obter os detalhes."
                    },
                    unitId: {
                        type: "STRING",
                        description: "O ID da unidade do aluno (ex: 'centro', 'coqueiros', etc.). Opcional."
                    }
                },
                required: ["studentId"]
            }
        },
        {
            name: "getTasksSummary",
            description: "Retorna o resumo de planos e tarefas cadastrados na base de dados da intranet.",
            parameters: {
                type: "OBJECT",
                properties: {}
            }
        },
        {
            name: "getDepartmentDemands",
            description: "Busca as demandas/tarefas em aberto do Trello da intranet, opcionalmente filtrando por setor/departamento (como 'rh', 'financeiro', 'comercial', 'juridico', etc.).",
            parameters: {
                type: "OBJECT",
                properties: {
                    department: {
                        type: "STRING",
                        description: "Nome do setor/departamento para filtrar as demandas (opcional)."
                    }
                }
            }
        },
        {
            name: "searchDemands",
            description: "Busca demandas (tarefas do painel/Trello da intranet) por palavra-chave no título ou descrição.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca para encontrar demandas no título ou descrição."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getDemandDetails",
            description: "Busca os detalhes completos de uma demanda específica por seu ID do documento, incluindo o histórico completo de comentários e notas internas.",
            parameters: {
                type: "OBJECT",
                properties: {
                    demandId: {
                        type: "STRING",
                        description: "O ID do documento da demanda."
                    }
                },
                required: ["demandId"]
            }
        },
        {
            name: "searchStoreProducts",
            description: "Busca produtos cadastrados no catálogo da loja por termo parcial (nome, categoria ou descrição).",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca para encontrar produtos no catálogo (ex: 'dobok', 'camiseta')."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStoreProductDetails",
            description: "Retorna os detalhes completos de um produto específico da loja pelo seu ID.",
            parameters: {
                type: "OBJECT",
                properties: {
                    productId: {
                        type: "STRING",
                        description: "O ID do documento do produto."
                    }
                },
                required: ["productId"]
            }
        },
        {
            name: "searchStoreSales",
            description: "Busca no log de transações/vendas realizadas na loja por termo parcial (nome do comprador, e-mail, CPF, unidade ou nome do produto).",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome, e-mail, CPF, unidade ou produto)."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStoreSaleDetails",
            description: "Retorna o detalhamento completo de uma transação/venda específica pelo ID da venda, incluindo dados do pagador, itens e status do pedido.",
            parameters: {
                type: "OBJECT",
                properties: {
                    saleId: {
                        type: "STRING",
                        description: "O ID do documento da venda/inscrição."
                    }
                },
                required: ["saleId"]
            }
        },
        {
            name: "searchStoreOrders",
            description: "Busca pedidos de uniformes e graduações (faixas coloridas, faixas pretas e doboks) nas coleções correspondentes por aluno, unidade ou status.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome do aluno, unidade ou status do pedido como 'Pendente', 'Entregue')."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStoreOrderDetails",
            description: "Retorna a ficha detalhada de um pedido específico por ID e tipo do pedido.",
            parameters: {
                type: "OBJECT",
                properties: {
                    orderId: {
                        type: "STRING",
                        description: "O ID do documento do pedido."
                    },
                    orderType: {
                        type: "STRING",
                        description: "O tipo do pedido: 'faixa' (para faixas coloridas), 'faixapreta' (para faixas pretas) ou 'dobok' (para doboks).",
                        enum: ["faixa", "faixapreta", "dobok"]
                    }
                },
                required: ["orderId", "orderType"]
            }
        }
    ]
}];

async function getProspectsSummary() {
    try {
        const prospectsRef = collection(db, 'prospects');
        const q = query(prospectsRef, limit(150));
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        
        const stats = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const phase = data.phase || data.status || 'Não Definido';
            stats[phase] = (stats[phase] || 0) + 1;
        });

        return {
            total: count,
            fases: stats,
            message: `Temos um total de ${count} prospects cadastrados na base (amostra de 150).`
        };
    } catch (e) {
        console.error("Erro ao buscar resumo de prospects:", e);
        return { error: e.message };
    }
}

async function searchProspects(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const prospectsRef = collection(db, 'prospects');
        const q = query(prospectsRef, limit(150));
        const snapshot = await getDocs(q);
        const results = [];
        const lowerQuery = searchQuery.toLowerCase();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const company = (data.empresa || '').toLowerCase();
            const resp = (data.responsavel || '').toLowerCase();
            const email = (data.email || '').toLowerCase();
            const phone = (data.telefone || '').toLowerCase();
            const sector = (data.setor || '').toLowerCase();
            
            if (company.includes(lowerQuery) || resp.includes(lowerQuery) || email.includes(lowerQuery) || phone.includes(lowerQuery) || sector.includes(lowerQuery)) {
                results.push({
                    id: doc.id,
                    empresa: data.empresa || 'Sem Empresa',
                    responsavel: data.responsavel || 'Sem Responsável',
                    email: data.email || '',
                    telefone: data.telefone || '',
                    fase: data.phase || data.status || 'Contato Inicial',
                    prioridade: data.prioridade || 'Média'
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca concluída. Encontramos ${results.length} prospects.`
        };
    } catch (e) {
        console.error("Erro ao buscar prospects:", e);
        return { error: e.message };
    }
}

async function getProspectDetails(args) {
    const { prospectId } = args;
    if (!prospectId) return { error: "prospectId não fornecido." };
    try {
        const docRef = doc(db, 'prospects', prospectId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { error: `Prospect com ID ${prospectId} não encontrado.` };
        }
        
        const data = docSnap.data();
        
        const logs = (data.contactLog || []).map(log => ({
            author: log.author || 'Usuário',
            description: log.description || '',
            timestamp: log.timestamp || ''
        }));
        
        return {
            id: docSnap.id,
            empresa: data.empresa || 'Sem Empresa',
            responsavel: data.responsavel || 'Sem Responsável',
            setor: data.setor || '',
            telefone: data.telefone || '',
            email: data.email || '',
            prioridade: data.prioridade || 'Média',
            ticketEstimado: data.ticketEstimado || '',
            origemLead: data.origemLead || '',
            cpf: data.cpf || '',
            cnpj: data.cnpj || '',
            endereco: data.endereco || '',
            redesSociais: data.redesSociais || '',
            siteAtual: data.siteAtual || '',
            observacoes: data.observacoes || '',
            contactLog: logs,
            fase: data.phase || data.status || 'Contato Inicial'
        };
    } catch (e) {
        console.error("Erro ao buscar detalhes do prospect:", e);
        return { error: e.message };
    }
}

async function searchStudents(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const listAlunosLocais = httpsCallable(functions, 'listAlunosLocais');
        const result = await listAlunosLocais({ unitId: 'all' });
        const students = result.data || [];
        
        const lowerQuery = searchQuery.toLowerCase();
        let matchedStudents = students.filter(s => {
            const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
            const idStr = String(s.idMember || '');
            return fullName.includes(lowerQuery) || idStr.includes(lowerQuery);
        });

        const results = matchedStudents.slice(0, 15).map(s => ({
            idMember: s.idMember,
            name: `${s.firstName || ''} ${s.lastName || ''}`,
            email: s.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description || 'Sem e-mail',
            phone: s.contacts?.find(c => c.contactType === 'Telefone' || c.idContactType === 1)?.description || 'Sem telefone',
            branchName: s.branchName || 'Centro',
            belt: s.belt || 'N/A',
            tuitionStatus: s.tuitionStatus || 'N/A'
        }));

        return {
            query: searchQuery,
            results: results,
            countFound: matchedStudents.length,
            message: `Busca finalizada. Encontramos ${matchedStudents.length} correspondentes.`
        };
    } catch (e) {
        console.error("Erro ao buscar alunos:", e);
        return { error: e.message };
    }
}

async function getStudentProfile(args) {
    const { studentId, unitId } = args;
    if (!studentId) return { error: "studentId não fornecido." };
    
    try {
        const idNum = parseInt(studentId, 10);
        const listAlunosLocais = httpsCallable(functions, 'listAlunosLocais');
        const listResult = await listAlunosLocais({ unitId: 'all' });
        const students = listResult.data || [];
        const student = students.find(s => s.idMember === idNum);
        
        if (!student) {
            return { error: `Aluno com ID ${studentId} não encontrado.` };
        }

        const resolvedUnitId = unitId || student.unitId || 'all';

        let userDoc = null;
        try {
            const usersRef = collection(db, "users");
            const uQuery = query(usersRef, where("evoMemberId", "==", idNum));
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
                const docData = uSnap.docs[0].data();
                userDoc = {
                    id: uSnap.docs[0].id,
                    isAdmin: docData.isAdmin || false,
                    isInstructor: docData.isInstructor || false,
                    earnedBadges: docData.earnedBadges || [],
                    accessibleContent: docData.accessibleContent || []
                };
            }
        } catch (err) {
            console.warn("Erro ao buscar usuário no Firestore:", err);
        }

        let physicalTests = [];
        try {
            const testsRef = collection(db, "physicalTests");
            const tQuery = query(testsRef, where("evoMemberId", "==", idNum), orderBy("date", "desc"));
            const tSnap = await getDocs(tQuery);
            tSnap.forEach(d => {
                const data = d.data();
                physicalTests.push({
                    date: data.date?.toDate?.()?.toLocaleDateString('pt-BR') || data.date || '',
                    score: data.score
                });
            });
        } catch (err) {
            console.warn("Erro ao buscar testes físicos:", err);
        }

        let financeInfo = null;
        try {
            const getStudentFinancialHub = httpsCallable(functions, 'getStudentFinancialHub');
            const finResult = await getStudentFinancialHub({
                idMember: idNum,
                unitId: resolvedUnitId
            });
            financeInfo = finResult.data || {};
        } catch (err) {
            console.warn("Erro ao buscar hub financeiro:", err);
        }

        return {
            student: {
                idMember: student.idMember,
                name: `${student.firstName || ''} ${student.lastName || ''}`,
                email: student.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description || student.email || '',
                phone: student.phone || student.contacts?.find(c => c.contactType === 'Telefone' || c.idContactType === 1)?.description || '',
                cpf: student.cpf || student.document || '',
                birthDate: student.birthDate || '',
                registerDate: student.registerDate || '',
                address: student.address || '',
                responsible: student.responsible || '',
                origin: student.origin || '',
                branchName: student.branchName || '',
                rankType: student.rankType || '',
                belt: student.belt || '',
                membershipStatus: student.membershipStatus || student.tuitionStatus || 'N/A'
            },
            userDoc,
            physicalTests,
            financialHub: financeInfo ? {
                tuitionStatus: financeInfo.tuitionStatus || 'N/A',
                registeredAt: financeInfo.registeredAt || '',
                mpDetails: financeInfo.mpDetails ? {
                    reason: financeInfo.mpDetails.reason || '',
                    status: financeInfo.mpDetails.status || '',
                    next_payment_date: financeInfo.mpDetails.next_payment_date || '',
                    charged_quantity: financeInfo.mpDetails.summarized?.charged_quantity || 0
                } : null
            } : null
        };
    } catch (e) {
        console.error("Erro ao montar perfil do estudante:", e);
        return { error: e.message };
    }
}

async function getTasksSummary() {
    try {
        const plansRef = collection(db, 'plans');
        const snapshot = await getDocs(plansRef);
        const count = snapshot.size;
        const stats = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'Pendente';
            stats[status] = (stats[status] || 0) + 1;
        });

        return {
            totalPlans: count,
            statusDistribution: stats,
            message: `Encontramos ${count} planos cadastrados na base.`
        };
    } catch (e) {
        console.error("Erro ao buscar resumo de planos/tarefas:", e);
        return { error: e.message };
    }
}

async function getDepartmentDemands(args) {
    const { department } = args;
    try {
        const demandsRef = collection(db, 'trello_demands');
        const q = query(demandsRef, limit(100));
        const snapshot = await getDocs(q);
        const results = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const dept = (data.department || data.setor || '').toLowerCase();
            if (!department || dept.includes(department.toLowerCase())) {
                results.push({
                    title: data.title || data.titulo || 'Sem Título',
                    status: data.status || 'Pendente',
                    department: data.department || data.setor || 'Geral',
                    description: data.description || data.descricao || ''
                });
            }
        });

        return {
            departmentRequested: department || 'Todos',
            totalDemands: results.length,
            demands: results.slice(0, 10),
            message: `Busca por demandas finalizada. ${results.length} encontradas.`
        };
    } catch (e) {
        console.error("Erro ao buscar demandas:", e);
        return { error: e.message };
    }
}

async function searchDemands(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const demandsRef = collection(db, 'trello_demands');
        const q = query(demandsRef, limit(150));
        const snapshot = await getDocs(q);
        const results = [];
        const lowerQuery = searchQuery.toLowerCase();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const title = (data.title || data.titulo || '').toLowerCase();
            const desc = (data.description || data.demanda || '').toLowerCase();
            const dept = (data.department || data.setor || '').toLowerCase();
            
            if (title.includes(lowerQuery) || desc.includes(lowerQuery) || dept.includes(lowerQuery)) {
                results.push({
                    id: doc.id,
                    title: data.title || data.titulo || 'Sem Título',
                    status: data.status || 'Pendente',
                    priority: data.priority || 'Média',
                    department: data.department || data.setor || 'Geral',
                    nomeSolicitante: data.nome || 'Sem Nome'
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca finalizada. Encontramos ${results.length} demandas.`
        };
    } catch (e) {
        console.error("Erro ao buscar demandas:", e);
        return { error: e.message };
    }
}

async function getDemandDetails(args) {
    const { demandId } = args;
    if (!demandId) return { error: "demandId não fornecido." };
    try {
        const docRef = doc(db, 'trello_demands', demandId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { error: `Demanda com ID ${demandId} não encontrada.` };
        }
        
        const data = docSnap.data();
        
        const commentsCol = collection(db, `trello_demands/${demandId}/comments`);
        const cSnap = await getDocs(query(commentsCol, orderBy('createdAt', 'asc')));
        const comments = [];
        cSnap.forEach(d => {
            const c = d.data();
            comments.push({
                author: c.authorName || 'Usuário',
                text: c.text || '',
                createdAt: c.createdAt?.toDate?.()?.toLocaleString('pt-BR') || c.createdAt || ''
            });
        });
        
        return {
            id: docSnap.id,
            title: data.title || data.titulo || 'Sem Título',
            description: data.description || data.demanda || '',
            status: data.status || 'Pendente',
            priority: data.priority || 'Média',
            department: data.department || data.setor || 'Geral',
            createdBy: data.nome || 'Sem Nome',
            email: data.email || '',
            unidade: data.unidade || '',
            createdAt: data.createdAt?.toDate?.()?.toLocaleString('pt-BR') || data.createdAt || '',
            dataMaxima: data.dataMaxima || '',
            links: data.linkRefs || [],
            comments: comments
        };
    } catch (e) {
        console.error("Erro ao obter detalhes da demanda:", e);
        return { error: e.message };
    }
}

async function searchStoreProducts(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, limit(150));
        const snapshot = await getDocs(q);
        const results = [];
        const lowerQuery = searchQuery.toLowerCase();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || '').toLowerCase();
            const cat = (data.category || '').toLowerCase();
            const desc = (data.description || '').toLowerCase();
            
            if (name.includes(lowerQuery) || cat.includes(lowerQuery) || desc.includes(lowerQuery)) {
                results.push({
                    id: doc.id,
                    name: data.name || 'Sem Nome',
                    category: data.category || 'Geral',
                    price: data.price ? data.price / 100 : 0,
                    visible: data.visible !== false,
                    available: data.available !== false,
                    stockQuantity: data.stockQuantity || 0
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca no catálogo concluída. ${results.length} produtos correspondentes encontrados.`
        };
    } catch (e) {
        console.error("Erro ao buscar produtos da loja:", e);
        return { error: e.message };
    }
}

async function getStoreProductDetails(args) {
    const { productId } = args;
    if (!productId) return { error: "productId não fornecido." };
    try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { error: `Produto com ID ${productId} não encontrado.` };
        }
        
        const data = docSnap.data();
        
        return {
            id: docSnap.id,
            name: data.name || '',
            category: data.category || 'Geral',
            description: data.description || '',
            imageUrl: data.imageUrl || null,
            priceType: data.priceType || 'fixed',
            price: data.price ? data.price / 100 : 0,
            priceVariants: (data.priceVariants || []).map(v => ({ name: v.name, price: v.price / 100 })),
            lotes: (data.lotes || []).map(l => ({ name: l.name, price: l.price / 100, startDate: l.startDate || '' })),
            kitItems: data.kitItems || [],
            visible: data.visible !== false,
            available: data.available !== false,
            controlStock: data.controlStock || false,
            stockQuantity: data.stockQuantity || 0,
            sizeStock: data.sizeStock || {},
            isSubscription: data.isSubscription || false,
            isEvent: data.isEvent || false,
            eventAddress: data.eventAddress || '',
            eventConfig: data.eventConfig || null,
            addons: (data.addons || []).map(a => ({ name: a.name, price: a.price / 100 }))
        };
    } catch (e) {
        console.error("Erro ao obter detalhes do produto:", e);
        return { error: e.message };
    }
}

async function searchStoreSales(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca de vendas." };
    try {
        const salesRef = collection(db, 'inscricoesFaixaPreta');
        const q = query(salesRef, limit(150));
        const snapshot = await getDocs(q);
        const results = [];
        const lowerQuery = searchQuery.toLowerCase();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const clientName = (data.userName || '').toLowerCase();
            const payerName = (data.payerName || '').toLowerCase();
            const email = (data.userEmail || '').toLowerCase();
            const phone = (data.userPhone || '').toLowerCase();
            const cpf = (data.userCpf || '').toLowerCase();
            const prodName = (data.productName || '').toLowerCase();
            const unit = (data.userUnit || '').toLowerCase();
            
            if (clientName.includes(lowerQuery) || payerName.includes(lowerQuery) || email.includes(lowerQuery) || phone.includes(lowerQuery) || cpf.includes(lowerQuery) || prodName.includes(lowerQuery) || unit.includes(lowerQuery)) {
                results.push({
                    id: doc.id,
                    userName: data.userName || 'N/A',
                    userEmail: data.userEmail || '',
                    productName: data.productName || '',
                    amountTotal: data.amountTotal ? data.amountTotal / 100 : 0,
                    paymentStatus: data.paymentStatus || 'pending',
                    fulfillmentStatus: data.fulfillmentStatus || 'pending',
                    created: data.created?.toDate?.()?.toLocaleString('pt-BR') || data.created || '',
                    saleType: data.saleType || 'online'
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca de vendas concluída. Encontramos ${results.length} transações.`
        };
    } catch (e) {
        console.error("Erro ao buscar transações de vendas:", e);
        return { error: e.message };
    }
}

async function getStoreSaleDetails(args) {
    const { saleId } = args;
    if (!saleId) return { error: "saleId não fornecido." };
    try {
        const docRef = doc(db, 'inscricoesFaixaPreta', saleId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { error: `Venda com ID ${saleId} não encontrada.` };
        }
        
        const data = docSnap.data();
        
        const logsRef = collection(db, 'inscricoesFaixaPreta', saleId, 'emailLogs');
        const logsSnap = await getDocs(query(logsRef, limit(50)));
        const emailLogs = [];
        logsSnap.forEach(d => {
            const log = d.data();
            emailLogs.push({
                type: log.type || '',
                sentAt: log.sentAt?.toDate?.()?.toLocaleString('pt-BR') || log.sentAt || '',
                status: log.status || 'success'
            });
        });
        
        return {
            id: docSnap.id,
            saleType: data.saleType || 'online',
            userName: data.userName || '',
            payerName: data.payerName || '',
            userEmail: data.userEmail || '',
            userPhone: data.userPhone || '',
            userCpf: data.userCpf || '',
            userUnit: data.userUnit || '',
            productName: data.productName || '',
            amountTotal: data.amountTotal ? data.amountTotal / 100 : 0,
            paymentStatus: data.paymentStatus || 'pending',
            fulfillmentStatus: data.fulfillmentStatus || 'pending',
            created: data.created?.toDate?.()?.toLocaleString('pt-BR') || data.created || '',
            details: data.details || '',
            paymentDetails: data.paymentDetails || {},
            items: data.items || [],
            recommendedItems: data.recommendedItems || [],
            emailLogs: emailLogs
        };
    } catch (e) {
        console.error("Erro ao obter detalhes da venda:", e);
        return { error: e.message };
    }
}

async function searchStoreOrders(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const lowerQuery = searchQuery.toLowerCase();
        const results = [];
        
        // 1. pedidosFaixas
        try {
            const snap = await getDocs(collection(db, "pedidosFaixas"));
            snap.forEach(d => {
                const data = d.data();
                const unit = (data.unidade || '').toLowerCase();
                const sol = (data.solicitante?.nome || '').toLowerCase();
                const status = (data.status || '').toLowerCase();
                const itemsSummary = (data.itens || []).map(i => `${i.quantidade}x ${i.faixa}`).join(', ').toLowerCase();
                
                if (unit.includes(lowerQuery) || sol.includes(lowerQuery) || status.includes(lowerQuery) || itemsSummary.includes(lowerQuery)) {
                    results.push({
                        id: d.id,
                        orderType: 'faixa',
                        unidade: data.unidade || '',
                        solicitante: data.solicitante?.nome || '',
                        aluno: 'Diversos (Coloridas)',
                        itensResumo: (data.itens || []).map(i => `${i.quantidade}x ${i.faixa} (${i.tamanho})`).join(', '),
                        status: data.status || 'Pendente',
                        data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || ''
                    });
                }
            });
        } catch (err) {
            console.error("Erro ao ler pedidosFaixas:", err);
        }
        
        // 2. pedidosFaixasPretas
        try {
            const snap = await getDocs(collection(db, "pedidosFaixasPretas"));
            snap.forEach(d => {
                const data = d.data();
                const unit = (data.unidade || '').toLowerCase();
                const aluno = (data.aluno || '').toLowerCase();
                const status = (data.status || '').toLowerCase();
                const faixa = (data.faixa || '').toLowerCase();
                
                if (unit.includes(lowerQuery) || aluno.includes(lowerQuery) || status.includes(lowerQuery) || faixa.includes(lowerQuery)) {
                    results.push({
                        id: d.id,
                        orderType: 'faixapreta',
                        unidade: data.unidade || '',
                        solicitante: data.solicitante?.nome || '',
                        aluno: data.aluno || '',
                        itensResumo: `${data.faixa || 'Faixa Preta'} (${data.tamanho || ''})`,
                        status: data.status || 'Pendente',
                        data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || ''
                    });
                }
            });
        } catch (err) {
            console.error("Erro ao ler pedidosFaixasPretas:", err);
        }
        
        // 3. pedidosDoboks
        try {
            const snap = await getDocs(collection(db, "pedidosDoboks"));
            snap.forEach(d => {
                const data = d.data();
                const unit = (data.unidade || '').toLowerCase();
                const aluno = (data.aluno || '').toLowerCase();
                const status = (data.status || '').toLowerCase();
                
                if (unit.includes(lowerQuery) || aluno.includes(lowerQuery) || status.includes(lowerQuery)) {
                    results.push({
                        id: d.id,
                        orderType: 'dobok',
                        unidade: data.unidade || '',
                        solicitante: data.solicitante?.nome || '',
                        aluno: data.aluno || '',
                        itensResumo: `Dobok ${data.isFaixaPreta ? 'Faixa Preta' : 'Comum'} (Tam: ${data.tamanho || ''}, Colarinho: ${data.colarinho || ''})`,
                        status: data.status || 'Pendente',
                        data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || ''
                    });
                }
            });
        } catch (err) {
            console.error("Erro ao ler pedidosDoboks:", err);
        }
        
        return {
            query: searchQuery,
            results: results.slice(0, 20),
            countFound: results.length,
            message: `Busca finalizada. Encontramos ${results.length} pedidos correspondentes.`
        };
    } catch (e) {
        console.error("Erro ao buscar pedidos:", e);
        return { error: e.message };
    }
}

async function getStoreOrderDetails(args) {
    const { orderId, orderType } = args;
    if (!orderId || !orderType) return { error: "orderId e orderType são obrigatórios." };
    
    try {
        let collectionName = '';
        if (orderType === 'faixa') collectionName = 'pedidosFaixas';
        else if (orderType === 'faixapreta') collectionName = 'pedidosFaixasPretas';
        else if (orderType === 'dobok') collectionName = 'pedidosDoboks';
        else return { error: `Tipo de pedido inválido: ${orderType}` };
        
        const docRef = doc(db, collectionName, orderId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { error: `Pedido com ID ${orderId} não encontrado na coleção ${collectionName}.` };
        }
        
        const data = docSnap.data();
        
        return {
            id: docSnap.id,
            orderType: orderType,
            unidade: data.unidade || '',
            status: data.status || 'Pendente',
            justificativa: data.justificativa || null,
            data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || '',
            solicitante: data.solicitante || null,
            lastUpdatedBy: data.lastUpdatedBy || null,
            lastUpdatedAt: data.lastUpdatedAt?.toDate?.()?.toLocaleString('pt-BR') || data.lastUpdatedAt || '',
            itens: data.itens || null,
            aluno: data.aluno || null,
            faixa: data.faixa || null,
            tamanho: data.tamanho || null,
            colarinho: data.colarinho || null,
            isFaixaPreta: data.isFaixaPreta || null
        };
    } catch (e) {
        console.error("Erro ao obter detalhes do pedido:", e);
        return { error: e.message };
    }
}

async function callGemini(history, systemInstruction, apiKey) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: history,
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            tools: kobeTools
        })
    });
    
    const json = await response.json();
    if (json.error) throw new Error(json.error.message);
    return json;
}

function setupKobeChatbotLogic() {
    const aiChatToggle = document.getElementById('aiChatToggle');
    const aiChatWindow = document.getElementById('aiChatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const chatTypingIndicator = document.getElementById('chatTypingIndicator');

    let chatHistory = [];
    try {
        const savedHistory = sessionStorage.getItem('kobe_chat_history');
        if (savedHistory) {
            chatHistory = JSON.parse(savedHistory);
        }
    } catch (e) {
        console.error("Erro ao carregar histórico do Kobe:", e);
    }

    function saveHistory() {
        try {
            sessionStorage.setItem('kobe_chat_history', JSON.stringify(chatHistory));
        } catch (e) {
            console.error("Erro ao salvar histórico do Kobe:", e);
        }
    }

    function formatMessageText(text) {
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    function appendMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start');

        const innerDiv = document.createElement('div');
        if (role === 'user') {
            innerDiv.className = 'bg-primary text-black font-semibold px-4 py-2.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm';
        } else {
            innerDiv.className = 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2.5 rounded-2xl rounded-tl-none max-w-[85%] border border-gray-200 dark:border-gray-700/50 shadow-sm';
        }

        innerDiv.innerHTML = formatMessageText(text);
        messageDiv.appendChild(innerDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function renderHistory() {
        chatMessages.innerHTML = '';
        chatHistory.forEach(msg => {
            const text = msg.parts?.[0]?.text;
            if (text && !text.includes('systemInstruction') && !text.includes('Faça uma análise inicial') && !text.includes('Analise o desempenho recente') && !text.includes('Boas-vindas à página')) {
                appendMessage(msg.role, text);
            }
        });
    }

    async function loadGeminiKey() {
        try {
            const local = localStorage.getItem('meta_ads_config');
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed.geminiKey) return parsed.geminiKey;
            }
            const docRef = doc(db, "config", "meta_ads");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().geminiKey;
            }
        } catch (e) {
            console.warn("Erro ao carregar chave do Gemini:", e);
        }
        return null;
    }

    function getMetaAdsMetricsFromDOM() {
        const spend = document.getElementById('totalSpend')?.textContent || 'R$ 0,00';
        const cpr = document.getElementById('avgCpr')?.textContent || 'R$ 0,00';
        const clicks = document.getElementById('totalClicks')?.textContent || '0';
        const msgs = document.getElementById('totalMsgs')?.textContent || '0';
        const likes = document.getElementById('totalLikes')?.textContent || '0';

        const campaigns = [];
        const rows = document.querySelectorAll('#campaignsTableBody tr');
        rows.forEach((row, idx) => {
            if (idx < 3) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 9) {
                    const name = cells[1]?.textContent || '';
                    const msgsVal = cells[2]?.textContent || '0';
                    const clicksVal = cells[3]?.textContent || '0';
                    const spendVal = cells[8]?.textContent || 'R$ 0,00';
                    campaigns.push(`${name} (Gasto: ${spendVal}, Conversas: ${msgsVal}, Cliques: ${clicksVal})`);
                }
            }
        });

        return { spend, cpr, clicks, msgs, likes, campaigns };
    }

    async function triggerWelcomeMessage() {
        chatTypingIndicator.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const isMetaAdsPage = window.location.pathname.includes('marketing-social.html');
        let prompt = '';

        const currentUserStr = localStorage.getItem('currentUser');
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : {};
        const userName = currentUser.name || currentUser.displayName || '';

        if (isMetaAdsPage) {
            const metrics = getMetaAdsMetricsFromDOM();
            prompt = `
Olá! Faça uma análise inicial de boas-vindas. Se apresente como o Kobe, o macaco-mascote e assistente virtual da Intranet da Kihap. O usuário logado chama-se ${userName ? userName : 'campeão(ã)'}. Diga olá especificamente para essa pessoa na saudação inicial de forma calorosa e pessoal pelo nome. Como o usuário está na página de Redes Sociais (Meta Ads), dê as boas-vindas e comente brevemente sobre os dados atuais do dashboard:
- Investimento Total: ${metrics.spend}
- Custo por Resultado: ${metrics.cpr}
- Cliques: ${metrics.clicks}
- Mensagens Iniciadas: ${metrics.msgs}
- Novos Seguidores (Ads): ${metrics.likes}
- Top Campanhas: ${JSON.stringify(metrics.campaigns)}

Lembrete crucial: Você NÃO é um mestre (como 'mestre de artes marciais' ou 'macaco-mestre'). Nunca use essas nomenclaturas para si mesmo. Você é o mascote e assistente virtual da intranet.

Por favor, faça uma saudação muito amigável como Kobe e forneça um resumo rápido do desempenho atual da conta com 2 insights principais e 1 recomendação de ação imediata. Mantenha a resposta concisa.
`;
        } else {
            const pageTitle = document.title || 'Intranet Kihap';
            prompt = `
Olá! Faça uma mensagem de boas-vindas. Se apresente como o Kobe, o macaco-mascote e assistente virtual oficial de toda a Intranet da Kihap. O usuário logado chama-se ${userName ? userName : 'campeão(ã)'}. Diga olá especificamente para essa pessoa na saudação inicial de forma muito calorosa e pessoal pelo nome (ex: "Olá, Mr. Garcia!" ou "Que energia boa ver você por aqui, Mr. Garcia!"). Como o usuário está na página de "${pageTitle}", dê as boas-vindas com entusiasmo, mantendo a filosofia das artes marciais (energia positiva, foco, respeito) e ofereça ajuda para tirar dúvidas sobre o sistema, processos internos ou qualquer suporte. Mantenha a saudação curta, amigável e direta.

Lembrete crucial: Você NÃO é um mestre (como 'mestre de artes marciais' ou 'macaco-mestre'). Nunca use essas nomenclaturas para si mesmo. Você é o mascote e assistente virtual da intranet.
`;
        }

        try {
            const apiKey = await loadGeminiKey();
            if (!apiKey) {
                throw new Error("Chave da API do Gemini não encontrada. Configure-a no painel do Meta Ads.");
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    }
                })
            });

            const json = await response.json();
            if (json.error) throw new Error(json.error.message);

            const aiText = json.candidates?.[0]?.content?.parts?.[0]?.text || "Olá! Como posso te ajudar hoje?";

            chatHistory.push({
                role: 'user',
                parts: [{ text: isMetaAdsPage ? "Analise o desempenho recente da minha conta." : `Boas-vindas à página ${document.title || 'Intranet'}` }]
            });
            chatHistory.push({
                role: 'model',
                parts: [{ text: aiText }]
            });
            saveHistory();

            appendMessage('model', aiText);

        } catch (e) {
            console.error("Erro na saudação inicial do Kobe:", e);
            appendMessage('model', `<span class="text-red-500 font-medium">Erro ao carregar saudação do Kobe: ${e.message}</span><br><br>Certifique-se de configurar uma chave válida do Gemini nas configurações da página de Meta Ads.`);
        } finally {
            chatTypingIndicator.classList.add('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    aiChatToggle?.addEventListener('click', () => {
        const isHidden = aiChatWindow.classList.contains('hidden');
        if (isHidden) {
            aiChatWindow.classList.remove('hidden');
            setTimeout(() => {
                aiChatWindow.classList.remove('scale-95', 'opacity-0');
                aiChatWindow.classList.add('scale-100', 'opacity-100');
            }, 10);

            if (chatHistory.length === 0) {
                triggerWelcomeMessage();
            } else {
                renderHistory();
            }
        } else {
            aiChatWindow.classList.remove('scale-100', 'opacity-100');
            aiChatWindow.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                aiChatWindow.classList.add('hidden');
            }, 300);
        }
    });

    closeChatBtn?.addEventListener('click', () => {
        aiChatWindow.classList.remove('scale-100', 'opacity-100');
        aiChatWindow.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            aiChatWindow.classList.add('hidden');
        }, 300);
    });

    chatForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';
        appendMessage('user', text);

        chatHistory.push({
            role: 'user',
            parts: [{ text: text }]
        });
        saveHistory();

        chatTypingIndicator.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const apiKey = await loadGeminiKey();
            if (!apiKey) {
                throw new Error("Chave da API do Gemini não configurada.");
            }

            let responseJson = await callGemini(chatHistory, systemInstruction, apiKey);
            
            let loops = 0;
            const maxLoops = 5;
            
            while (loops < maxLoops) {
                const candidate = responseJson.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                const functionCalls = parts.filter(p => p.functionCall);
                
                if (functionCalls.length === 0) {
                    const aiText = parts[0]?.text || "Desculpe, não consegui obter uma resposta.";
                    chatHistory.push({
                        role: 'model',
                        parts: [{ text: aiText }]
                    });
                    saveHistory();
                    appendMessage('model', aiText);
                    break;
                }
                
                chatHistory.push({
                    role: 'model',
                    parts: parts
                });
                saveHistory();
                
                const responseParts = [];
                for (const call of functionCalls) {
                    const funcName = call.functionCall.name;
                    const args = call.functionCall.args || {};
                    
                    let result = {};
                    if (funcName === "getProspectsSummary") {
                        result = await getProspectsSummary();
                    } else if (funcName === "searchProspects") {
                        result = await searchProspects(args);
                    } else if (funcName === "getProspectDetails") {
                        result = await getProspectDetails(args);
                    } else if (funcName === "searchStudents") {
                        result = await searchStudents(args);
                    } else if (funcName === "getStudentProfile") {
                        result = await getStudentProfile(args);
                    } else if (funcName === "getTasksSummary") {
                        result = await getTasksSummary();
                    } else if (funcName === "getDepartmentDemands") {
                        result = await getDepartmentDemands(args);
                    } else if (funcName === "searchDemands") {
                        result = await searchDemands(args);
                    } else if (funcName === "getDemandDetails") {
                        result = await getDemandDetails(args);
                    } else if (funcName === "searchStoreProducts") {
                        result = await searchStoreProducts(args);
                    } else if (funcName === "getStoreProductDetails") {
                        result = await getStoreProductDetails(args);
                    } else if (funcName === "searchStoreSales") {
                        result = await searchStoreSales(args);
                    } else if (funcName === "getStoreSaleDetails") {
                        result = await getStoreSaleDetails(args);
                    } else if (funcName === "searchStoreOrders") {
                        result = await searchStoreOrders(args);
                    } else if (funcName === "getStoreOrderDetails") {
                        result = await getStoreOrderDetails(args);
                    } else {
                        result = { error: "Função desconhecida." };
                    }
                    
                    responseParts.push({
                        functionResponse: {
                            name: funcName,
                            response: result
                        }
                    });
                }
                
                chatHistory.push({
                    role: 'user',
                    parts: responseParts
                });
                saveHistory();
                
                responseJson = await callGemini(chatHistory, systemInstruction, apiKey);
                loops++;
            }
            
            if (loops >= maxLoops) {
                appendMessage('model', "Erro: Limite de chamadas de ferramentas excedido.");
            }

        } catch (e) {
            console.error("Erro ao enviar mensagem para a IA:", e);
            appendMessage('model', `<span class="text-red-500 font-medium">Erro na comunicação com a IA: ${e.message}</span>`);
            chatHistory.pop();
            saveHistory();
        } finally {
            chatTypingIndicator.classList.add('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
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
