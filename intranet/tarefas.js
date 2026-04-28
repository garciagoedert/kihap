import { getAllUsers } from './common-ui.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Função principal que será exportada e chamada pelo HTML
export function initializeAppWithFirebase(firebaseConfig) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const auth = getAuth(app);
    const appId = firebaseConfig.appId || 'default-app';
    const tasksCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'tasks');
    const prospectsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'prospects');

    onAuthStateChanged(auth, async (user) => {
        if (user && localStorage.getItem('isLoggedIn') === 'true') {
            // Usuário autenticado, inicializa a página de tarefas
            await initializeTasksPage(tasksCollectionRef, prospectsCollectionRef, auth, db);
        } else {
            // Usuário não autenticado, redireciona para o login
            window.location.href = 'login.html';
        }
    });
}

async function initializeTasksPage(tasksCollectionRef, prospectsCollectionRef, auth, db) {
    let tasks = []; // O array será populado pelo Firebase
    let users = []; // Lista de usuários para o sistema
    let prospects = []; // Array para os cards do Kanban
    let showDone = false; // Estado para controlar a visibilidade de tarefas concluídas

    // Elementos do DOM
    const createTaskBtn = document.getElementById('create-task-btn');
    const modal = document.getElementById('task-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const taskForm = document.getElementById('task-form');
    const tasksContainer = document.getElementById('tasks-container');
    const modalTitle = document.getElementById('modal-title');
    
    const searchInput = document.getElementById('search-input');
    const filterAssignee = document.getElementById('filter-assignee');
    const filterStatus = document.getElementById('filter-status');
    const filterPriority = document.getElementById('filter-priority');
    const showDoneTasksCheckbox = document.getElementById('show-done-tasks');
    const taskAssigneeSelect = document.getElementById('task-assignee');
    const taskLinkedCardSearch = document.getElementById('task-linked-card-search');
    const taskLinkedCardId = document.getElementById('task-linked-card-id');
    const taskLinkedCardResults = document.getElementById('task-linked-card-results');

    // Funções auxiliares
    const getPriorityClass = (priority) => {
        switch (priority) {
            case 'urgent': return 'text-red-500 dark:text-red-400 font-bold';
            case 'high': return 'text-orange-500 dark:text-orange-400 font-semibold';
            case 'normal': return 'text-blue-500 dark:text-blue-400';
            case 'low': return 'text-emerald-500 dark:text-emerald-400';
            default: return 'text-gray-500 dark:text-gray-400';
        }
    };

    const getStatusBadge = (status) => {
        const baseClasses = 'text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border';
        switch (status) {
            case 'pending': return `<span class="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 ${baseClasses}">Pendente</span>`;
            case 'in_progress': return `<span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 ${baseClasses}">Em Progresso</span>`;
            case 'done': return `<span class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 ${baseClasses}">Concluída</span>`;
            default: return '';
        }
    };

    const applyFiltersAndRender = () => {
        if (!tasksContainer) return;
        
        const searchTerm = searchInput?.value?.toLowerCase() || '';
        const assigneeVal = filterAssignee?.value || '';
        const statusVal = filterStatus?.value || '';
        const priorityVal = filterPriority?.value || '';
        
        const filteredTasks = tasks.filter(task => {
            if (!showDone && task.status === 'done') return false;
            if (statusVal && task.status !== statusVal) return false;
            if (priorityVal && task.priority !== priorityVal) return false;
            if (assigneeVal && task.assignee_email !== assigneeVal) return false;
            if (searchTerm) {
                const titleMatch = task.title && task.title.toLowerCase().includes(searchTerm);
                const descriptionMatch = task.description && task.description.toLowerCase().includes(searchTerm);
                if (!titleMatch && !descriptionMatch) return false;
            }
            return true;
        });

        tasksContainer.innerHTML = '';
        if (filteredTasks.length === 0) {
            tasksContainer.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">Nenhuma tarefa encontrada.</td></tr>`;
            return;
        }

        filteredTasks.forEach(task => {
            const row = document.createElement('tr');
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
            row.className = `border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''}`;
            row.addEventListener('click', () => openModalForEdit(task));

            const assignee = users.find(u => u.email === task.assignee_email);
            const linkedCard = prospects.find(p => p.id === task.linked_card_id);
            const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : 'N/A';
            
            const clientLinkHTML = linkedCard 
                ? `<a href="index.html?cardId=${linkedCard.id}" class="text-primary hover:underline" onclick="event.stopPropagation()">${linkedCard.empresa}</a>`
                : (task.parent_entity || 'N/A');

            row.innerHTML = `
                <td class="px-6 py-4 font-semibold text-gray-900 dark:text-white">${task.title}</td>
                <td class="px-6 py-4">${clientLinkHTML}</td>
                <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${assignee?.name || task.assignee_email || 'N/A'}</td>
                <td class="px-6 py-4 ${isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-300'}">${dueDate}</td>
                <td class="px-6 py-4 ${getPriorityClass(task.priority)}">${task.priority?.toUpperCase() || 'NORMAL'}</td>
                <td class="px-6 py-4">${getStatusBadge(task.status)}</td>
                <td class="px-6 py-4 text-xs text-gray-400 dark:text-gray-500">${task.createdBy || 'N/A'}</td>
            `;
            tasksContainer.appendChild(row);
        });
    };

    const openModalForEdit = (task) => {
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-assignee').value = task.assignee_email || '';
        document.getElementById('task-due-date').value = task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '';
        document.getElementById('task-priority').value = task.priority || 'normal';
        document.getElementById('task-status').value = task.status || 'pending';
        document.getElementById('task-parent-entity').value = task.parent_entity || '';
        taskLinkedCardId.value = task.linked_card_id || '';
        const linkedCard = prospects.find(p => p.id === task.linked_card_id);
        taskLinkedCardSearch.value = linkedCard ? linkedCard.empresa : '';

        const createdByContainer = document.getElementById('createdByContainer');
        const createdByInfo = document.getElementById('createdByInfo');
        if (task.createdBy) {
            createdByInfo.textContent = task.createdBy;
            createdByContainer.classList.remove('hidden');
        } else {
            createdByContainer.classList.add('hidden');
        }
        
        modalTitle.textContent = 'Editar Tarefa';
        deleteTaskBtn.classList.remove('hidden');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        taskForm.reset();
        document.getElementById('task-id').value = '';
        modalTitle.textContent = 'Nova Tarefa';
        deleteTaskBtn.classList.add('hidden');
    };

    // Load users and populate selects
    try {
        users = await getAllUsers();
        if (filterAssignee) {
            filterAssignee.innerHTML = '<option value="">Todos os Responsáveis</option>';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.name;
                filterAssignee.appendChild(option);
            });
        }
        if (taskAssigneeSelect) {
            taskAssigneeSelect.innerHTML = '<option value="">Selecione um Responsável</option>';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.name;
                taskAssigneeSelect.appendChild(option);
            });
        }
        applyFiltersAndRender();
    } catch (e) {
        console.error("Erro ao carregar usuários:", e);
    }

    // Load prospects
    try {
        const snapshot = await getDocs(prospectsCollectionRef);
        prospects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Erro ao carregar prospects:", e);
    }

    // Snapshot for real-time tasks
    onSnapshot(tasksCollectionRef, (snapshot) => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Tarefas] ${tasks.length} tarefas carregadas.`);
        
        // Sort tasks
        tasks.sort((a, b) => {
            const statusOrder = { 'pending': 1, 'in_progress': 2, 'done': 3 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            const dateA = a.createdAt?.toDate() || 0;
            const dateB = b.createdAt?.toDate() || 0;
            return dateB - dateA;
        });
        
        applyFiltersAndRender();
    }, (error) => {
        console.error("Erro ao buscar tarefas:", error);
        if (tasksContainer) {
            tasksContainer.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-red-500">Erro ao carregar as tarefas.</td></tr>`;
        }
    });

    // Event Listeners
    createTaskBtn?.addEventListener('click', () => {
        taskForm.reset();
        document.getElementById('task-id').value = '';
        modalTitle.textContent = 'Nova Tarefa';
        deleteTaskBtn.classList.add('hidden');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    });
    closeModalBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    taskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = document.getElementById('task-id').value;
        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            assignee_email: document.getElementById('task-assignee').value,
            due_date: document.getElementById('task-due-date').value,
            priority: document.getElementById('task-priority').value,
            status: document.getElementById('task-status').value,
            parent_entity: document.getElementById('task-parent-entity').value,
            linked_card_id: taskLinkedCardId.value,
            updatedAt: serverTimestamp()
        };

        try {
            if (taskId) {
                const taskRef = doc(tasksCollectionRef, taskId);
                await updateDoc(taskRef, taskData);
            } else {
                taskData.createdAt = serverTimestamp();
                taskData.createdBy = localStorage.getItem('userName') || (auth.currentUser ? auth.currentUser.email : 'Desconhecido');
                await addDoc(tasksCollectionRef, taskData);
            }
            closeModal();
        } catch (error) {
            console.error("Erro ao salvar tarefa:", error);
            alert("Erro ao salvar tarefa.");
        }
    });

    deleteTaskBtn?.addEventListener('click', async () => {
        const taskId = document.getElementById('task-id').value;
        if (!taskId) return;
        if (confirm('Deseja apagar esta tarefa?')) {
            try {
                await deleteDoc(doc(tasksCollectionRef, taskId));
                closeModal();
            } catch (error) {
                console.error("Erro ao apagar:", error);
            }
        }
    });

    searchInput?.addEventListener('input', applyFiltersAndRender);
    filterAssignee?.addEventListener('change', applyFiltersAndRender);
    filterStatus?.addEventListener('change', applyFiltersAndRender);
    filterPriority?.addEventListener('change', applyFiltersAndRender);
    showDoneTasksCheckbox?.addEventListener('change', () => {
        showDone = showDoneTasksCheckbox.checked;
        applyFiltersAndRender();
    });

    taskLinkedCardSearch?.addEventListener('keyup', () => {
        const term = taskLinkedCardSearch.value.toLowerCase();
        if (term.length < 2) {
            taskLinkedCardResults.classList.add('hidden');
            return;
        }
        const results = prospects.filter(p => p.empresa?.toLowerCase().includes(term));
        taskLinkedCardResults.innerHTML = '';
        if (results.length === 0) {
            taskLinkedCardResults.classList.add('hidden');
            return;
        }
        results.forEach(p => {
            const div = document.createElement('div');
            div.className = 'p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm';
            div.textContent = p.empresa;
            div.addEventListener('click', () => {
                taskLinkedCardSearch.value = p.empresa;
                taskLinkedCardId.value = p.id;
                taskLinkedCardResults.classList.add('hidden');
            });
            taskLinkedCardResults.appendChild(div);
        });
        taskLinkedCardResults.classList.remove('hidden');
    });
}
