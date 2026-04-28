import { getAllUsers, updateUser, addUser, deleteUser, updateUserPassword } from './auth.js';
import { db } from './firebase-config.js';
import { addDoc, collection, query, orderBy, getDocs, deleteDoc, doc, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function setupAdminPage() {
    // A validação de admin agora é feita globalmente no common-ui.js
    // antes de carregar os componentes da página.
    continueSetup();
}

function continueSetup() {
    console.log('[AdminCheck] Inicializando painel administrativo...');
    
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

    async function renderUsers(filter = '') {
        if (userTableBody) userTableBody.innerHTML = '';
        if (userMobileList) userMobileList.innerHTML = '';

        const users = await getAllUsers();
        const adminUsers = users.filter(user => !user.evoMemberId);

        const lowercasedFilter = filter.toLowerCase();
        const filteredUsers = adminUsers.filter(user => {
            return (user.name || '').toLowerCase().includes(lowercasedFilter) ||
                (user.email || '').toLowerCase().includes(lowercasedFilter);
        });

        filteredUsers.forEach(user => {
            const roles = [];
            if (user.isAdmin) roles.push('<span class="bg-red-900 text-red-200 text-xs px-2 py-1 rounded">Admin</span>');
            if (user.isInstructor) roles.push('<span class="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded">Instrutor</span>');
            if (user.isRH) roles.push('<span class="bg-purple-900 text-purple-200 text-xs px-2 py-1 rounded">RH</span>');
            if (user.isFinanceiro) roles.push('<span class="bg-green-900 text-green-200 text-xs px-2 py-1 rounded">Financeiro</span>');
            if (user.isAdministrativo) roles.push('<span class="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded">Admin.</span>');
            if (user.isStore) roles.push('<span class="bg-yellow-900 text-yellow-200 text-xs px-2 py-1 rounded">Store</span>');
            if (user.isAcademy) roles.push('<span class="bg-indigo-900 text-indigo-200 text-xs px-2 py-1 rounded">Academy</span>');
            if (user.isJuridico) roles.push('<span class="bg-teal-900 text-teal-200 text-xs px-2 py-1 rounded">Jurídico</span>');

            // Desktop Row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-gray-700">${user.name || 'N/A'}</td>
                <td class="py-2 px-4 border-b border-gray-700">${user.email || 'N/A'}</td>
                <td class="py-2 px-4 border-b border-gray-700 flex flex-wrap gap-1">${roles.join(' ') || '<span class="text-gray-500 text-xs">Sem cargo</span>'}</td>
                <td class="py-2 px-4 border-b border-gray-700">
                    <button class="text-primary hover:text-primary-dark mr-2 edit-btn" data-id="${user.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-400 hover:text-red-600 delete-btn" data-id="${user.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="text-yellow-400 hover:text-yellow-600 change-password-btn ml-2" data-id="${user.id}">
                        <i class="fas fa-key"></i>
                    </button>
                </td>
            `;
            if (userTableBody) userTableBody.appendChild(row);

            // Mobile Card
            const card = document.createElement('div');
            card.className = 'mobile-user-card bg-[#1e1e1e] p-4 rounded-xl border border-gray-700 shadow-sm relative hover:border-gray-600 transition-colors';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="min-w-0 flex-1 pr-4">
                        <h3 class="font-bold text-white text-lg truncate">${user.name || 'N/A'}</h3>
                        <p class="text-gray-400 text-sm truncate">${user.email || 'N/A'}</p>
                    </div>
                    <div class="flex space-x-3 shrink-0">
                        <button class="text-primary hover:text-primary-dark edit-btn p-1" data-id="${user.id}">
                            <i class="fas fa-edit text-lg"></i>
                        </button>
                        <button class="text-yellow-400 hover:text-yellow-600 change-password-btn p-1" data-id="${user.id}">
                            <i class="fas fa-key text-lg"></i>
                        </button>
                        <button class="text-red-400 hover:text-red-600 delete-btn p-1" data-id="${user.id}">
                            <i class="fas fa-trash text-lg"></i>
                        </button>
                    </div>
                </div>
                <div class="pt-3 border-t border-gray-700/50 flex flex-wrap gap-2">
                    ${roles.join(' ') || '<span class="text-gray-500 text-xs italic">Sem permissões registradas</span>'}
                </div>
            `;
            if (userMobileList) userMobileList.appendChild(card);
        });
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
        renderUsers();
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
                renderUsers();
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
        searchInput.addEventListener('input', (e) => renderUsers(e.target.value));
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
                renderQuotes();
            } catch (error) {
                alert('Erro ao adicionar frase.');
            }
        });
    }

    async function renderQuotes() {
        if (!quotesTableBody) return;
        
        try {
            const q = query(collection(db, "daily_quotes"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            quotesTableBody.innerHTML = '';

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="py-2 px-4 border-b border-gray-700 text-sm italic">"${data.text}"</td>
                    <td class="py-2 px-4 border-b border-gray-700 text-sm font-semibold">${data.author}</td>
                    <td class="py-2 px-4 border-b border-gray-700">
                        <button class="text-red-400 hover:text-red-600 delete-quote-btn" data-id="${docSnap.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                quotesTableBody.appendChild(row);
            });

            document.querySelectorAll('.delete-quote-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Excluir frase?')) {
                        await deleteDoc(doc(db, "daily_quotes", e.currentTarget.dataset.id));
                        renderQuotes();
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
                    document.getElementById(`tab-${t}`)?.classList.remove('text-primary', 'border-b-2', 'border-primary');
                    document.getElementById(`tab-${t}`)?.classList.add('text-gray-400');
                    document.getElementById(`${t}-content`)?.classList.add('hidden');
                });
                btn.classList.add('text-primary', 'border-b-2', 'border-primary');
                btn.classList.remove('text-gray-400');
                document.getElementById(`${tab}-content`)?.classList.remove('hidden');
            });
        }
    });
}

async function renderLoginLogs() {
    const logsBody = document.getElementById('login-logs-body');
    if (!logsBody) return;
    
    try {
        const q = query(collection(db, "login_logs"), orderBy("timestamp", "desc"), limit(50));
        const snapshot = await getDocs(q);
        logsBody.innerHTML = '';

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-gray-700 text-sm">${new Date(data.timestamp).toLocaleString('pt-BR')}</td>
                <td class="py-2 px-4 border-b border-gray-700 text-sm">${data.name || 'N/A'}</td>
                <td class="py-2 px-4 border-b border-gray-700 text-sm">${data.email || 'N/A'}</td>
                <td class="py-2 px-4 border-b border-gray-700 text-sm">
                    <span class="${data.userType === 'Aluno' ? 'text-green-400' : 'text-blue-400'}">${data.userType || 'N/A'}</span>
                </td>
            `;
            logsBody.appendChild(row);
        });
    } catch (error) {
        console.error(error);
    }
}

// A inicialização agora é tratada no arquivo HTML principal.
