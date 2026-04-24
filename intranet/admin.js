import { getAllUsers, updateUser, addUser, deleteUser, updateUserPassword } from './auth.js';
import { db } from './firebase-config.js';
import { addDoc, collection, query, orderBy, getDocs, deleteDoc, doc, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function setupAdminPage() {
    // A validação de admin agora é feita globalmente no common-ui.js
    // antes de carregar os componentes da página.
    continueSetup();
}

let cachedUsers = [];
let cachedLoginLogs = [];
let cachedQuotes = [];

function continueSetup() {
    console.log('[AdminCheck] Inicializando painel administrativo...');
    
    let searchTimeout = null;
    const userTableBody = document.getElementById('user-table-body');
    const userMobileList = document.getElementById('user-mobile-list');
    const userForm = document.getElementById('user-form');
    const userModal = document.getElementById('user-modal');
    const formTitle = document.getElementById('form-title');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const isAdminInput = document.getElementById('isAdmin');
    const isInstructorInput = document.getElementById('isInstructor');
    const isRHInput = document.getElementById('isRH');
    const isMarketingInput = document.getElementById('isMarketing');
    const isFinanceiroInput = document.getElementById('isFinanceiro');
    const isAdministrativoInput = document.getElementById('isAdministrativo');
    const isStoreInput = document.getElementById('isStore');
    const isAcademyInput = document.getElementById('isAcademy');
    const isJuridicoInput = document.getElementById('isJuridico');

    const hiddenEmailInput = document.getElementById('user-email-hidden');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addUserBtn = document.getElementById('add-user-btn');
    const searchInput = document.getElementById('search-users');
    const changePasswordModal = document.getElementById('change-password-modal');
    const changePasswordForm = document.getElementById('change-password-form');
    const cancelChangePasswordBtn = document.getElementById('cancel-change-password');
    const changePasswordUserIdInput = document.getElementById('change-password-user-id');
    const newPasswordInput = document.getElementById('new-password');

    // Quotes Elements
    const quotesTableBody = document.getElementById('quotes-table-body');
    const addQuoteBtn = document.getElementById('add-quote-btn');
    const quoteModal = document.getElementById('quote-modal');
    const quoteForm = document.getElementById('quote-form');
    const quoteTextInput = document.getElementById('quote-text');
    const quoteAuthorInput = document.getElementById('quote-author-input');
    const cancelQuoteBtn = document.getElementById('cancel-quote-btn');

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            resetForm();
            userModal.classList.remove('hidden');
            formTitle.textContent = 'Adicionar Novo Usuário';
        });
    }

    async function renderUsers(filter = '', forceRefresh = false) {
        if (!userTableBody || !userMobileList) return;

        // Otimização: Cache de usuários para evitar múltiplas chamadas ao Firestore
        if (cachedUsers.length === 0 || forceRefresh) {
            console.log('[Admin] Carregando usuários do banco...');
            const allUsers = await getAllUsers();
            cachedUsers = allUsers.filter(user => !user.evoMemberId);
        }

        const lowercasedFilter = filter.toLowerCase();
        const filteredUsers = cachedUsers.filter(user => {
            return (user.name || '').toLowerCase().includes(lowercasedFilter) ||
                (user.email || '').toLowerCase().includes(lowercasedFilter);
        });

        // Batch DOM Updates using DocumentFragment for better performance
        const tableFragment = document.createDocumentFragment();
        const listFragment = document.createDocumentFragment();

        filteredUsers.forEach(user => {
            const roles = [];
            if (user.isAdmin) roles.push('<span class="badge-soft bg-red-500/10 text-red-600 dark:text-red-400">Admin</span>');
            if (user.isInstructor) roles.push('<span class="badge-soft bg-blue-500/10 text-blue-600 dark:text-blue-400">Instrutor</span>');
            if (user.isRH) roles.push('<span class="badge-soft bg-purple-500/10 text-purple-600 dark:text-purple-400">RH</span>');
            if (user.isFinanceiro) roles.push('<span class="badge-soft bg-green-500/10 text-green-600 dark:text-green-400">Financeiro</span>');
            if (user.isAdministrativo) roles.push('<span class="badge-soft bg-gray-500/10 text-gray-600 dark:text-gray-400">Admin.</span>');
            if (user.isStore) roles.push('<span class="badge-soft bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">Store</span>');
            if (user.isAcademy) roles.push('<span class="badge-soft bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Academy</span>');
            if (user.isJuridico) roles.push('<span class="badge-soft bg-teal-500/10 text-teal-600 dark:text-teal-400">Jurídico</span>');

            const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            
            // Suporte para imagem de perfil se existir (vários campos possíveis no Firestore)
            const userPhoto = user.photoURL || user.photoUrl || user.profilePic || user.profilePicture || user.avatarUrl;
            const profileDisplay = userPhoto 
                ? `<img src="${userPhoto}" class="absolute inset-0 w-full h-full object-cover z-10" onerror="this.style.display='none'">`
                : '';

            // Desktop Row
            const row = document.createElement('tr');
            row.className = 'premium-row-hover group';
            row.innerHTML = `
                <td class="py-4 px-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shadow-md relative overflow-hidden shrink-0">
                            ${profileDisplay}
                            <span class="relative z-0">${initials}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-900 dark:text-white">${user.name || 'N/A'}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">${user.email || 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-6">
                    <div class="flex flex-wrap gap-1.5">
                        ${roles.join('') || '<span class="text-gray-400 text-[10px] italic">Sem cargos</span>'}
                    </div>
                </td>
                <td class="py-4 px-6 text-right">
                    <div class="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all edit-btn" data-id="${user.id}" title="Editar">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-all change-password-btn" data-id="${user.id}" title="Senha">
                            <i class="fas fa-key text-xs"></i>
                        </button>
                        <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-all delete-btn" data-id="${user.id}" title="Excluir">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            `;
            tableFragment.appendChild(row);

            // Mobile Card
            const card = document.createElement('div');
            card.className = 'glass-panel p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm relative transition-all active:scale-[0.98]';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold shadow-sm shrink-0 relative overflow-hidden">
                             ${profileDisplay}
                             <span class="relative z-0">${initials}</span>
                        </div>
                        <div class="min-w-0">
                            <h3 class="font-bold text-gray-900 dark:text-white truncate text-base">${user.name || 'N/A'}</h3>
                            <p class="text-gray-500 dark:text-gray-400 text-xs truncate">${user.email || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                         <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary edit-btn" data-id="${user.id}">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-600 delete-btn" data-id="${user.id}">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
                    ${roles.join('') || '<span class="text-gray-400 text-[10px] italic">Sem cargos</span>'}
                </div>
            `;
            listFragment.appendChild(card);
        });

        userTableBody.innerHTML = '';
        userMobileList.innerHTML = '';
        userTableBody.appendChild(tableFragment);
        userMobileList.appendChild(listFragment);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const userData = {
            name: nameInput.value,
            isAdmin: isAdminInput.checked,
            isInstructor: isInstructorInput.checked,
            isRH: isRHInput.checked,
            isMarketing: isMarketingInput.checked,
            isFinanceiro: isFinanceiroInput.checked,
            isAdministrativo: isAdministrativoInput.checked,
            isStore: isStoreInput.checked,
            isAcademy: isAcademyInput.checked,
            isJuridico: isJuridicoInput.checked
        };

        const userId = hiddenEmailInput.value;

        if (userId) {
            await updateUser(userId, userData);
        } else {
            if (!passwordInput.value) {
                alert('A senha é obrigatória para novos usuários.');
                return;
            }
            await addUser({ ...userData, email: emailInput.value, password: passwordInput.value });
        }

        resetForm();
        renderUsers('', true); // Força atualização do cache após salvar
    }

    function resetForm() {
        if (formTitle) formTitle.textContent = 'Adicionar Novo Usuário';
        if (userForm) userForm.reset();
        if (hiddenEmailInput) hiddenEmailInput.value = '';
        if (emailInput) emailInput.disabled = false;
        if (passwordInput) {
            passwordInput.disabled = false;
            passwordInput.placeholder = "";
        }
        if (userModal) userModal.classList.add('hidden');
    }

    async function handleUserActions(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const changePasswordBtn = e.target.closest('.change-password-btn');

        if (changePasswordBtn) {
            changePasswordUserIdInput.value = changePasswordBtn.dataset.id;
            changePasswordModal.classList.remove('hidden');
        }

        if (editBtn) {
            const userId = editBtn.dataset.id;
            const users = await getAllUsers();
            const user = users.find(u => u.id === userId);
            if (user) {
                userModal.classList.remove('hidden');
                formTitle.textContent = 'Editar Usuário';
                nameInput.value = user.name || '';
                emailInput.value = user.email || '';
                emailInput.disabled = true;
                isAdminInput.checked = user.isAdmin || false;
                isInstructorInput.checked = user.isInstructor || false;
                isRHInput.checked = user.isRH || false;
                isMarketingInput.checked = user.isMarketing || false;
                isFinanceiroInput.checked = user.isFinanceiro || false;
                isAdministrativoInput.checked = user.isAdministrativo || false;
                isStoreInput.checked = user.isStore || false;
                isAcademyInput.checked = user.isAcademy || false;
                isJuridicoInput.checked = user.isJuridico || false;
                hiddenEmailInput.value = user.id;
                passwordInput.placeholder = "Não editável aqui";
                passwordInput.disabled = true;
            }
        }

        if (deleteBtn) {
            if (confirm('Tem certeza que deseja excluir este usuário?')) {
                await deleteUser(deleteBtn.dataset.id);
                renderUsers('', true); // Força atualização do cache
            }
        }
    }

    if (userTableBody) userTableBody.addEventListener('click', handleUserActions);
    if (userMobileList) userMobileList.addEventListener('click', handleUserActions);

    if (cancelChangePasswordBtn) {
        cancelChangePasswordBtn.addEventListener('click', () => {
            changePasswordModal.classList.add('hidden');
            changePasswordForm.reset();
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await updateUserPassword(changePasswordUserIdInput.value, newPasswordInput.value);
                alert('Senha atualizada!');
                changePasswordModal.classList.add('hidden');
                changePasswordForm.reset();
            } catch (error) {
                alert('Erro ao atualizar senha.');
            }
        });
    }

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);
    if (closeModalBtn) closeModalBtn.addEventListener('click', resetForm);
    if (userForm) userForm.addEventListener('submit', handleFormSubmit);

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // Otimização: Debounce na busca para evitar re-renderizações excessivas
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderUsers(e.target.value);
            }, 300);
        });
    }

    setupTabs();
    renderUsers();
    renderLoginLogs();
    renderQuotes();

    // Quotes Logic
    if (addQuoteBtn) {
        addQuoteBtn.addEventListener('click', () => {
            quoteForm.reset();
            quoteModal.classList.remove('hidden');
        });
    }

    if (cancelQuoteBtn) {
        cancelQuoteBtn.addEventListener('click', () => quoteModal.classList.add('hidden'));
    }

    if (quoteForm) {
        quoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await addDoc(collection(db, "daily_quotes"), {
                    text: quoteTextInput.value,
                    author: quoteAuthorInput.value,
                    createdAt: new Date().toISOString()
                });
                alert('Frase adicionada!');
                quoteModal.classList.add('hidden');
                renderQuotes(true); // Força refresh do cache
            } catch (error) {
                alert('Erro ao adicionar frase.');
            }
        });
    }

    async function renderQuotes(forceRefresh = false) {
        if (!quotesTableBody) return;
        
        try {
            if (cachedQuotes.length === 0 || forceRefresh) {
                console.log('[Admin] Carregando frases do banco...');
                const q = query(collection(db, "daily_quotes"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                cachedQuotes = [];
                snapshot.forEach(docSnap => cachedQuotes.push({ id: docSnap.id, ...docSnap.data() }));
            }

            const fragment = document.createDocumentFragment();
            cachedQuotes.forEach((data) => {
                const row = document.createElement('tr');
                row.className = 'premium-row-hover';
                row.innerHTML = `
                    <td class="py-4 px-6 text-sm italic text-gray-700 dark:text-gray-300">"${data.text}"</td>
                    <td class="py-4 px-6 text-sm font-bold text-gray-900 dark:text-white">${data.author}</td>
                    <td class="py-4 px-6 text-right">
                        <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-all delete-quote-btn" data-id="${data.id}">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });
            
            quotesTableBody.innerHTML = '';
            quotesTableBody.appendChild(fragment);

            document.querySelectorAll('.delete-quote-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Excluir frase?')) {
                        await deleteDoc(doc(db, "daily_quotes", e.currentTarget.dataset.id));
                        renderQuotes(true); // Força refresh
                    }
                });
            });
        } catch (error) {
            console.error(error);
        }
    }
}

function setupTabs() {
    const tabs = ['users', 'logs', 'quotes'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) {
            btn.addEventListener('click', () => {
                tabs.forEach(t => {
                    const tBtn = document.getElementById(`tab-${t}`);
                    if (tBtn) {
                        tBtn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-primary', 'shadow-sm');
                        tBtn.classList.add('text-gray-500', 'dark:text-gray-400');
                    }
                    document.getElementById(`${t}-content`)?.classList.add('hidden');
                });
                
                btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-primary', 'shadow-sm');
                btn.classList.remove('text-gray-500', 'dark:text-gray-400');
                document.getElementById(`${tab}-content`)?.classList.remove('hidden');
            });
        }
    });
}

async function renderLoginLogs(forceRefresh = false) {
    const logsBody = document.getElementById('login-logs-body');
    if (!logsBody) return;
    
    try {
        if (cachedLoginLogs.length === 0 || forceRefresh) {
            console.log('[Admin] Carregando logs do banco...');
            const q = query(collection(db, "login_logs"), orderBy("timestamp", "desc"), limit(50));
            const snapshot = await getDocs(q);
            cachedLoginLogs = [];
            snapshot.forEach(docSnap => cachedLoginLogs.push({ id: docSnap.id, ...docSnap.data() }));
        }

        const fragment = document.createDocumentFragment();
        cachedLoginLogs.forEach((data) => {
            const row = document.createElement('tr');
            row.className = 'premium-row-hover';
            row.innerHTML = `
                <td class="py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">${new Date(data.timestamp).toLocaleString('pt-BR')}</td>
                <td class="py-4 px-6">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-gray-900 dark:text-white">${data.name || 'N/A'}</span>
                        <span class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">${data.email || 'N/A'}</span>
                    </div>
                </td>
                <td class="py-4 px-6 text-sm">
                    <span class="badge-soft ${data.userType === 'Aluno' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}">
                        ${data.userType || 'N/A'}
                    </span>
                </td>
            `;
            fragment.appendChild(row);
        });

        logsBody.innerHTML = '';
        logsBody.appendChild(fragment);
    } catch (error) {
        console.error(error);
    }
}

// A inicialização agora é tratada no arquivo HTML principal.
