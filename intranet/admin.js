import { getAllUsers } from './auth.js';

export function setupAdminPage() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        window.location.href = 'index.html';
        return;
    }

    const userCardsContainer = document.getElementById('user-cards-container');
    const searchInput = document.getElementById('search-users');
    const userModal = document.getElementById('user-modal');
    const addUserBtn = document.getElementById('add-user-btn');
    const cancelBtn = document.getElementById('cancel-edit');
    const userForm = document.getElementById('user-form');
    const formTitle = document.getElementById('form-title');
    const permissionsContainer = document.getElementById('permissions-container');

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const isAdminInput = document.getElementById('isAdmin');
    const hiddenIdInput = document.getElementById('user-id-hidden');

    const modules = [
        { id: 'cursos', name: 'Cursos' },
        { id: 'marketing', name: 'Marketing' },
        { id: 'calendario', name: 'Calendário' },
        { id: 'tarefas', name: 'Tarefas' },
        { id: 'mapasMentais', name: 'Mapas Mentais' },
        { id: 'arquivo', name: 'Arquivo' },
        { id: 'analysis', name: 'Análise' },
        { id: 'admin', name: 'Admin' }
    ];

    let allUsers = [];

    function renderPermissions(userPermissions = {}) {
        permissionsContainer.innerHTML = '';
        modules.forEach(module => {
            const isChecked = userPermissions[module.id] || false;
            const checkboxHtml = `
                <div class="flex items-center">
                    <input type="checkbox" id="perm-${module.id}" data-module="${module.id}" class="h-4 w-4 text-primary bg-gray-700 border-gray-600 rounded" ${isChecked ? 'checked' : ''}>
                    <label for="perm-${module.id}" class="ml-2 block text-sm text-gray-300">${module.name}</label>
                </div>
            `;
            permissionsContainer.innerHTML += checkboxHtml;
        });
    }

    function renderUsers(usersToRender) {
        userCardsContainer.innerHTML = '';
        if (usersToRender.length === 0) {
            userCardsContainer.innerHTML = '<p class="text-gray-400 col-span-full text-center">Nenhum usuário encontrado.</p>';
            return;
        }
        usersToRender.forEach(user => {
            const card = document.createElement('div');
            card.className = 'bg-[#1a1a1a] p-4 rounded-lg shadow-lg flex flex-col justify-between';
            card.innerHTML = `
                <div>
                    <h3 class="text-lg font-bold">${user.name}</h3>
                    <p class="text-sm text-gray-400">${user.email}</p>
                    <div class="mt-2 text-xs">
                        <span class="font-semibold py-1 px-2 rounded ${user.isAdmin ? 'bg-primary/20 text-primary' : 'bg-gray-600 text-gray-300'}">
                            ${user.isAdmin ? 'Admin' : 'Usuário'}
                        </span>
                    </div>
                </div>
                <div class="mt-4 flex justify-end space-x-2">
                    <button class="text-primary hover:text-primary-dark edit-btn" data-id="${user.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-400 hover:text-red-600 delete-btn" data-id="${user.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            userCardsContainer.appendChild(card);
        });
    }

    function filterUsers() {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredUsers = allUsers.filter(user =>
            user.name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );
        renderUsers(filteredUsers);
    }

    function openModal() { userModal.classList.add('flex'); }
    function closeModal() { userModal.classList.remove('flex'); resetForm(); }

    function resetForm() {
        userForm.reset();
        hiddenIdInput.value = '';
        formTitle.textContent = 'Adicionar Novo Usuário';
        emailInput.disabled = false;
        passwordInput.disabled = false;
        passwordInput.placeholder = "Senha para novo usuário";
        renderPermissions();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const name = nameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;
        const isAdmin = isAdminInput.checked;
        const userId = hiddenIdInput.value;

        const permissions = {};
        permissionsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            permissions[cb.dataset.module] = cb.checked;
        });
        
        // Garante que admin sempre tenha permissão de admin
        if (isAdmin) {
            permissions.admin = true;
        }

        const userData = { name, email, isAdmin, permissions };

        if (userId) {
            // Editando
            delete userData.email; // Não se deve atualizar o email
            await window.updateUser(userId, userData);
        } else {
            // Adicionando
            if (!password) {
                alert('A senha é obrigatória para novos usuários.');
                return;
            }
            userData.password = password;
            await window.addUser(userData);
        }

        closeModal();
        loadUsers();
    }

    async function loadUsers() {
        allUsers = await getAllUsers();
        renderUsers(allUsers);
    }

    addUserBtn.addEventListener('click', () => {
        resetForm();
        openModal();
    });

    cancelBtn.addEventListener('click', closeModal);
    userForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('keyup', filterUsers);

    userCardsContainer.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const userId = editBtn.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                formTitle.textContent = 'Editar Usuário';
                hiddenIdInput.value = user.id;
                nameInput.value = user.name;
                emailInput.value = user.email;
                emailInput.disabled = true;
                isAdminInput.checked = user.isAdmin;
                passwordInput.placeholder = "Deixe em branco para não alterar";
                passwordInput.disabled = false;
                renderPermissions(user.permissions);
                openModal();
            }
        }

        if (deleteBtn) {
            const userId = deleteBtn.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (confirm(`Tem certeza que deseja excluir o usuário ${user.email}?`)) {
                await window.deleteUser(userId);
                loadUsers();
            }
        }
    });

    loadUsers();
}
