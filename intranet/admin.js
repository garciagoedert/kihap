import { getAllUsers } from './auth.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import { db, appId } from './firebase-config.js';
import { 
    doc, setDoc, getDoc, addDoc, collection, getDocs, deleteDoc, updateDoc 
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
    const userForm = document.getElementById('user-form');
    const formTitle = document.getElementById('form-title');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const isAdminInput = document.getElementById('isAdmin');
    const hiddenEmailInput = document.getElementById('user-email-hidden');
    const cancelEditBtn = document.getElementById('cancel-edit');

    async function renderUsers() {
        userTableBody.innerHTML = '';
        const users = await getAllUsers();
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-gray-700">${user.name}</td>
                <td class="py-2 px-4 border-b border-gray-700">${user.email}</td>
                <td class="py-2 px-4 border-b border-gray-700">${user.isAdmin ? 'Sim' : 'Não'}</td>
                <td class="py-2 px-4 border-b border-gray-700">
                    <button class="text-primary hover:text-primary-dark mr-2 edit-btn" data-id="${user.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-400 hover:text-red-600 delete-btn" data-id="${user.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const name = nameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;
        const isAdmin = isAdminInput.checked;
        const userId = hiddenEmailInput.value;

        if (userId) {
            // Editing user
            const updatedData = { name, isAdmin };
            // O email não pode ser alterado aqui. A senha requer reautenticação.
            await updateUser(userId, updatedData);
        } else {
            // Adding new user
            if (!password) {
                alert('A senha é obrigatória para novos usuários.');
                return;
            }
            await addUser({ name, email, password, isAdmin });
        }

        resetForm();
        renderUsers();
    }

    function resetForm() {
        formTitle.textContent = 'Adicionar Novo Usuário';
        userForm.reset();
        hiddenEmailInput.value = '';
        emailInput.disabled = false;
        cancelEditBtn.classList.add('hidden');
    }

    userTableBody.addEventListener('click', async function(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const userId = editBtn.dataset.id;
            const users = await getAllUsers();
            const user = users.find(u => u.id === userId);
            if (user) {
                formTitle.textContent = 'Editar Usuário';
                nameInput.value = user.name;
                emailInput.value = user.email;
                emailInput.disabled = true; // Não permitir edição de email
                isAdminInput.checked = user.isAdmin;
                hiddenEmailInput.value = user.id; // Armazenar UID
                passwordInput.placeholder = "Não é possível alterar a senha aqui";
                passwordInput.disabled = true;
                cancelEditBtn.classList.remove('hidden');
            }
        }

        if (deleteBtn) {
            const userId = deleteBtn.dataset.id;
            const userEmail = deleteBtn.closest('tr').querySelector('td:nth-child(2)').textContent;
            if (confirm(`Tem certeza que deseja excluir o usuário ${userEmail}?`)) {
                await deleteUser(userId);
                renderUsers();
            }
        }
    });

    cancelEditBtn.addEventListener('click', resetForm);
    userForm.addEventListener('submit', handleFormSubmit);

    renderUsers();
    setupUIListeners();
}

// A inicialização agora é tratada no arquivo HTML principal.
