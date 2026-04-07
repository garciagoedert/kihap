import { getAllUsers, updateUserPassword, updateUser, addUser } from './auth.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import { db, appId } from './firebase-config.js';
import {
    doc, setDoc, getDoc, addDoc, collection, getDocs, deleteDoc, updateDoc, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function deleteProspect(prospectId) {
    try {
        const prospectRef = doc(db, 'artifacts', appId, 'public', 'data', 'prospects', prospectId);
        await deleteDoc(prospectRef);
        alert('Prospect excluído com sucesso!');
    } catch (error) {
        console.error("Erro ao excluir prospect:", error);
        alert('Erro ao excluir prospect.');
    }
}


export function setupAdminPage() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        window.location.href = 'index.html';
        return;
    }

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
    const isFinanceiroInput = document.getElementById('isFinanceiro');
    const isAdministrativoInput = document.getElementById('isAdministrativo');
    const isStoreInput = document.getElementById('isStore');
    const isAcademyInput = document.getElementById('isAcademy');

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

    addUserBtn.addEventListener('click', () => {
        resetForm();
        userModal.classList.remove('hidden');
        formTitle.textContent = 'Adicionar Novo Usuário';
    });

    async function renderUsers(filter = '') {
        if (userTableBody) userTableBody.innerHTML = '';
        if (userMobileList) userMobileList.innerHTML = '';

        const users = await getAllUsers();
        const adminUsers = users.filter(user => !user.evoMemberId);

        const lowercasedFilter = filter.toLowerCase();
        const filteredUsers = adminUsers.filter(user => {
            return user.name.toLowerCase().includes(lowercasedFilter) ||
                user.email.toLowerCase().includes(lowercasedFilter);
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

            // Desktop Row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-gray-700">${user.name}</td>
                <td class="py-2 px-4 border-b border-gray-700">${user.email}</td>
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
                        <h3 class="font-bold text-white text-lg truncate">${user.name}</h3>
                        <p class="text-gray-400 text-sm truncate">${user.email}</p>
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
        const name = nameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;
        const isAdmin = isAdminInput.checked;
        const isInstructor = isInstructorInput.checked;
        const isRH = isRHInput.checked;
        const isFinanceiro = isFinanceiroInput.checked;
        const isAdministrativo = isAdministrativoInput.checked;
        const isStore = isStoreInput.checked;
        const isAcademy = isAcademyInput.checked;

        const userId = hiddenEmailInput.value;

        const userData = {
            name,
            isAdmin,
            isInstructor,
            isRH,
            isFinanceiro,
            isAdministrativo,
            isStore,
            isAcademy
        };

        if (userId) {
            // Editing user
            await updateUser(userId, userData);
        } else {
            // Adding new user
            if (!password) {
                alert('A senha é obrigatória para novos usuários.');
                return;
            }
            await addUser({ ...userData, email, password });
        }

        resetForm();
        renderUsers();
    }

    function resetForm() {
        formTitle.textContent = 'Adicionar Novo Usuário';
        userForm.reset();
        hiddenEmailInput.value = '';
        emailInput.disabled = false;
        passwordInput.disabled = false;
        passwordInput.placeholder = "";

        isAdminInput.checked = false;
        isInstructorInput.checked = false;
        isRHInput.checked = false;
        isFinanceiroInput.checked = false;
        isAdministrativoInput.checked = false;
        isStoreInput.checked = false;
        isAcademyInput.checked = false;

        cancelEditBtn.classList.remove('hidden');
        userModal.classList.add('hidden');
    }

    async function handleUserActions(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const changePasswordBtn = e.target.closest('.change-password-btn');

        if (changePasswordBtn) {
            const userId = changePasswordBtn.dataset.id;
            changePasswordUserIdInput.value = userId;
            changePasswordModal.classList.remove('hidden');
        }

        if (editBtn) {
            const userId = editBtn.dataset.id;
            const users = await getAllUsers();
            const user = users.find(u => u.id === userId);
            if (user) {
                userModal.classList.remove('hidden');
                formTitle.textContent = 'Editar Usuário';
                nameInput.value = user.name;
                emailInput.value = user.email;
                emailInput.disabled = true; // Não permitir edição de email
                isAdminInput.checked = user.isAdmin || false;
                isInstructorInput.checked = user.isInstructor || false;
                isRHInput.checked = user.isRH || false;
                isFinanceiroInput.checked = user.isFinanceiro || false;
                isAdministrativoInput.checked = user.isAdministrativo || false;
                isStoreInput.checked = user.isStore || false;
                isAcademyInput.checked = user.isAcademy || false;
                hiddenEmailInput.value = user.id; // Armazenar UID
                passwordInput.placeholder = "Não é possível alterar a senha aqui";
                passwordInput.disabled = true;
                cancelEditBtn.classList.remove('hidden');
            }
        }

        if (deleteBtn) {
            const userId = deleteBtn.dataset.id;
            // Try to find email in row or card
            let userEmail = "Usuário";
            const row = deleteBtn.closest('tr');
            if (row) {
                userEmail = row.querySelector('td:nth-child(2)').textContent;
            } else {
                const card = deleteBtn.closest('.mobile-user-card');
                if (card) {
                    userEmail = card.querySelector('p').textContent;
                }
            }

            if (confirm(`Tem certeza que deseja excluir o usuário ${userEmail}?`)) {
                await deleteUser(userId);
                renderUsers();
            }
        }
    }

    if (userTableBody) userTableBody.addEventListener('click', handleUserActions);
    if (userMobileList) userMobileList.addEventListener('click', handleUserActions);

    cancelChangePasswordBtn.addEventListener('click', () => {
        changePasswordModal.classList.add('hidden');
        changePasswordForm.reset();
    });

    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = changePasswordUserIdInput.value;
        const newPassword = newPasswordInput.value;

        if (userId && newPassword) {
            try {
                await updateUserPassword(userId, newPassword);
                alert('Senha atualizada com sucesso!');
                changePasswordModal.classList.add('hidden');
                changePasswordForm.reset();
            } catch (error) {
                console.error("Erro ao atualizar a senha:", error);
                alert('Erro ao atualizar a senha.');
            }
        }
    });

    cancelEditBtn.addEventListener('click', resetForm);
    if (closeModalBtn) closeModalBtn.addEventListener('click', resetForm);
    userForm.addEventListener('submit', handleFormSubmit);

    searchInput.addEventListener('input', (e) => {
        renderUsers(e.target.value);
    });

    setupTabs();
    renderUsers();
    renderLoginLogs();
    setupTabs();
    renderUsers();
    renderLoginLogs();
    renderQuotes();

    // Quotes Logic
    addQuoteBtn.addEventListener('click', () => {
        quoteForm.reset();
        quoteModal.classList.remove('hidden');
    });

    cancelQuoteBtn.addEventListener('click', () => {
        quoteModal.classList.add('hidden');
    });

    quoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = quoteTextInput.value;
        const author = quoteAuthorInput.value;

        if (text && author) {
            try {
                await addDoc(collection(db, "daily_quotes"), {
                    text,
                    author,
                    createdAt: new Date().toISOString()
                });
                alert('Frase adicionada com sucesso!');
                quoteModal.classList.add('hidden');
                renderQuotes();
            } catch (error) {
                console.error("Erro ao adicionar frase:", error);
                alert('Erro ao adicionar frase.');
            }
        }
    });

    async function renderQuotes() {
        if (!quotesTableBody) return;
        quotesTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center">Carregando...</td></tr>';

        try {
            const q = query(collection(db, "daily_quotes"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);

            quotesTableBody.innerHTML = '';

            if (querySnapshot.empty) {
                quotesTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-gray-500">Nenhuma frase cadastrada.</td></tr>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="py-2 px-4 border-b border-gray-700 text-sm italic">"${data.text}"</td>
                    <td class="py-2 px-4 border-b border-gray-700 text-sm font-semibold">${data.author}</td>
                    <td class="py-2 px-4 border-b border-gray-700">
                        <button class="text-red-400 hover:text-red-600 delete-quote-btn" data-id="${doc.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                quotesTableBody.appendChild(row);
            });

            // Add delete listeners
            document.querySelectorAll('.delete-quote-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (confirm('Tem certeza que deseja excluir esta frase?')) {
                        try {
                            await deleteDoc(doc(db, "daily_quotes", id));
                            renderQuotes();
                        } catch (error) {
                            console.error("Erro ao excluir frase:", error);
                            alert('Erro ao excluir frase.');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Erro ao carregar frases:", error);
            quotesTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-red-500">Erro ao carregar dados.</td></tr>';
        }
    }
}

function setupTabs() {
    const tabUsers = document.getElementById('tab-users');
    const tabLogs = document.getElementById('tab-logs');
    const tabQuotes = document.getElementById('tab-quotes');
    const contentUsers = document.getElementById('users-content');
    const contentLogs = document.getElementById('logs-content');
    const contentQuotes = document.getElementById('quotes-content');

    if (!tabUsers || !tabLogs) {
        console.error("Tab elements not found!");
        return;
    }

    tabUsers.addEventListener('click', () => {
        // Activate Users Tab
        tabUsers.classList.add('text-primary', 'border-b-2', 'border-primary');
        tabUsers.classList.remove('text-gray-400');

        // Deactivate Logs Tab
        tabLogs.classList.remove('text-primary', 'border-b-2', 'border-primary');
        tabLogs.classList.add('text-gray-400');

        // Show Users Content
        contentUsers.classList.remove('hidden');
        contentLogs.classList.add('hidden');
        contentQuotes.classList.add('hidden');

        tabQuotes.classList.remove('text-primary', 'border-b-2', 'border-primary');
        tabQuotes.classList.add('text-gray-400');
    });

    tabLogs.addEventListener('click', () => {
        // Activate Logs Tab
        tabLogs.classList.add('text-primary', 'border-b-2', 'border-primary');
        tabLogs.classList.remove('text-gray-400');

        // Deactivate Users Tab
        tabUsers.classList.remove('text-primary', 'border-b-2', 'border-primary');
        tabUsers.classList.add('text-gray-400');

        // Show Logs Content
        contentLogs.classList.remove('hidden');
        contentUsers.classList.add('hidden');
        contentQuotes.classList.add('hidden');

        tabQuotes.classList.remove('text-primary', 'border-b-2', 'border-primary');
        tabQuotes.classList.add('text-gray-400');
    });

    if (tabQuotes) {
        tabQuotes.addEventListener('click', () => {
            // Activate Quotes Tab
            tabQuotes.classList.add('text-primary', 'border-b-2', 'border-primary');
            tabQuotes.classList.remove('text-gray-400');

            // Deactivate other Tabs
            tabUsers.classList.remove('text-primary', 'border-b-2', 'border-primary');
            tabUsers.classList.add('text-gray-400');
            tabLogs.classList.remove('text-primary', 'border-b-2', 'border-primary');
            tabLogs.classList.add('text-gray-400');

            // Show Quotes Content
            contentQuotes.classList.remove('hidden');
            contentUsers.classList.add('hidden');
            contentLogs.classList.add('hidden');
        });
    }
}

// Imports already handled at the top of the file. 

async function renderLoginLogs() {
    const logsBody = document.getElementById('login-logs-body');
    if (!logsBody) return;

    logsBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">Carregando...</td></tr>';

    try {
        const q = query(
            collection(db, "login_logs"),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const querySnapshot = await getDocs(q);

        logsBody.innerHTML = '';

        if (querySnapshot.empty) {
            logsBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-500">Nenhum registro encontrado.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = new Date(data.timestamp);
            const formattedDate = date.toLocaleString('pt-BR');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-gray-700 text-sm">${formattedDate}</td>
                <td class="py-2 px-4 border-b border-gray-700 text-sm">${data.name || 'N/A'}</td>
                <td class="py-2 px-4 border-b border-gray-700 text-sm">${data.email || 'N/A'}</td>
                <td class="py-2 px-4 border-b border-gray-700 text-sm">
                    <span class="${data.userType === 'Aluno' ? 'text-green-400' : 'text-blue-400'}">
                        ${data.userType || 'N/A'}
                    </span>
                </td>
            `;
            logsBody.appendChild(row);
        });

    } catch (error) {
        console.error("Erro ao carregar logs de login:", error);
        logsBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">Erro ao carregar dados.</td></tr>';
    }
}

// A inicialização agora é tratada no arquivo HTML principal.
