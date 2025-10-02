import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, query, where, getDocs, collectionGroup, addDoc, doc, updateDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, app } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';

// --- INITIALIZATION ---
const auth = getAuth(app);
let allTasks = [];
let users = [];
let projectsMap = {};
let calendar;

// --- UI ELEMENTS ---
const taskListView = document.getElementById('task-list-view');
const kanbanView = document.getElementById('kanban-view');
const searchInput = document.getElementById('search-input');
const projectFilter = document.getElementById('project-filter');
const executorFilter = document.getElementById('executor-filter');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const createTaskBtn = document.getElementById('create-task-btn');
const createProjectBtn = document.getElementById('create-project-btn');
const taskModal = document.getElementById('task-modal');
const taskModalTitle = document.getElementById('task-modal-title');
const taskModalContent = document.getElementById('task-modal-content');
const taskModalFooter = document.getElementById('task-modal-footer');
const closeTaskModalBtn = document.getElementById('close-task-modal-btn');
const projectsModal = document.getElementById('projects-modal');
const projectsModalContent = document.getElementById('projects-modal-content');
const closeProjectsModalBtn = document.getElementById('close-projects-modal-btn');
const addProjectBtn = document.getElementById('add-project-btn');
const manageProjectsBtn = document.getElementById('manage-projects-btn');

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (sessionStorage.getItem('isLoggedIn') === 'true') {
            loadComponents(() => setupUIListeners());
            loadInitialData();
        } else {
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// --- DATA LOADING ---
async function loadInitialData() {
    await Promise.all([loadUsers(), loadProjects()]);
    setupTasksListener();
    applyFiltersBtn.addEventListener('click', renderTasks);
    searchInput.addEventListener('keyup', renderTasks);
    manageProjectsBtn.addEventListener('click', openProjectsModal);
    closeTaskModalBtn.addEventListener('click', closeTaskModal);

    document.querySelectorAll('[data-view]').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
    window.addEventListener('open-create-task-modal', () => openTaskModal());
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            closeTaskModal();
        }
    });
    closeProjectsModalBtn.addEventListener('click', closeProjectsModal);
    addProjectBtn.addEventListener('click', () => populateProjectsModal({ id: '', name: '', description: '' }));
}

async function loadUsers() {
    try {
        const usersCollection = collection(db, 'users');
        const snapshot = await getDocs(usersCollection);
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateExecutorFilter();
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

async function loadProjects() {
    const projectsCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects');
    try {
        const snapshot = await getDocs(projectsCollection);
        snapshot.docs.forEach(doc => {
            projectsMap[doc.id] = doc.data().name;
        });
        populateProjectFilter();
    } catch (error) {
        console.error("Error loading projects:", error);
    }
}

function setupTasksListener() {
    const tasksQuery = collectionGroup(db, 'nodes');
    
    onSnapshot(tasksQuery, (snapshot) => {
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), projectId: doc.ref.parent.parent.id }));
        renderTasks();
    }, (error) => {
        console.error("Error fetching tasks:", error);
        taskListView.innerHTML = `<p class="text-red-500 text-center">Não foi possível carregar as tarefas.</p>`;
    });
}

// --- UI RENDERING ---
function populateExecutorFilter() {
    executorFilter.innerHTML = '<option value="all">Todos</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        executorFilter.appendChild(option);
    });
}

function populateProjectFilter() {
    projectFilter.innerHTML = '<option value="all">Todos</option>';
    for (const [id, name] of Object.entries(projectsMap)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        projectFilter.appendChild(option);
    }
}

function renderTasks() {
    const executorId = executorFilter.value;
    const projectId = projectFilter.value;
    const searchTerm = searchInput.value.toLowerCase();

    let filteredTasks = allTasks;

    if (searchTerm) {
        filteredTasks = filteredTasks.filter(task => task.text.toLowerCase().includes(searchTerm));
    }

    if (executorId !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.assignee === executorId);
    }

    if (projectId !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.projectId === projectId);
    }

    // Grouping tasks by status and due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedTasks = filteredTasks.filter(t => t.status === 'Concluída');
    const activeTasks = filteredTasks.filter(t => t.status !== 'Concluída');

    const lateTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < today);
    const todayTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() === today.getTime());
    const upcomingTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) > today);
    const noDateTasks = activeTasks.filter(t => !t.dueDate);
    
    taskListView.innerHTML = ''; // Clear view

    if (filteredTasks.length === 0) {
        taskListView.innerHTML = `<p class="text-gray-500 text-center">Nenhuma tarefa encontrada.</p>`;
        return;
    }

    taskListView.appendChild(createTaskGroup('Atrasadas', lateTasks));
    taskListView.appendChild(createTaskGroup('Hoje', todayTasks));
    taskListView.appendChild(createTaskGroup('Próximas', upcomingTasks));
    taskListView.appendChild(createTaskGroup('Sem Data', noDateTasks));
    taskListView.appendChild(createTaskGroup('Concluídas', completedTasks));
}

function switchView(view) {
    // Esconde todas as visualizações
    taskListView.classList.add('hidden');
    kanbanView.classList.add('hidden');

    // Mostra a visualização selecionada
    if (view === 'list') {
        taskListView.classList.remove('hidden');
        renderTasks();
    } else if (view === 'kanban') {
        kanbanView.classList.remove('hidden');
        renderKanbanView();
    }

    // Atualiza o estado ativo da aba
    document.querySelectorAll('[data-view]').forEach(tab => {
        tab.classList.toggle('active-tab', tab.dataset.view === view);
        tab.classList.toggle('border-blue-500', tab.dataset.view === view);
    });
}

function renderKanbanView() {
    kanbanView.innerHTML = ''; // Limpa a visualização
    kanbanView.className = 'grid grid-cols-1 md:grid-cols-3 gap-4'; // Layout responsivo
    const statuses = ['Pendente', 'Em Progresso', 'Concluída'];

    statuses.forEach(status => {
        const column = document.createElement('div');
        column.className = 'bg-gray-800 rounded-lg p-2 flex flex-col';
        column.innerHTML = `<h3 class="font-bold p-2 text-center border-b border-gray-700">${status}</h3><div class="task-cards flex-grow space-y-2 overflow-y-auto p-2"></div>`;
        
        const tasksInStatus = allTasks.filter(task => task.status === status);
        
        const cardsContainer = column.querySelector('.task-cards');
        tasksInStatus.forEach(task => {
            const card = document.createElement('div');
            card.className = 'bg-gray-700 p-3 rounded-lg shadow-md cursor-pointer';
            
            const executor = users.find(u => u.id === task.assignee);
            const priorityColor = task.priority === 'Alta' ? 'bg-red-500' : (task.priority === 'Normal' ? 'bg-yellow-500' : 'bg-green-500');

            card.innerHTML = `
                <p class="font-semibold mb-2">${task.text}</p>
                <div class="flex justify-between items-center text-xs text-gray-400">
                    <div>
                        <span class="font-semibold">${projectsMap[task.projectId] || ''}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full ${priorityColor}" title="Prioridade: ${task.priority || 'Normal'}"></span>
                        ${executor ? `<img src="${executor.photoURL || 'default-profile.svg'}" class="w-6 h-6 rounded-full" title="${executor.name}">` : ''}
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openTaskModal(task));
            cardsContainer.appendChild(card);
        });

        kanbanView.appendChild(column);
    });
}


function createTaskGroup(title, tasks) {
    const groupEl = document.createElement('div');
    if (tasks.length === 0) return groupEl;

    groupEl.className = 'mb-6';
    groupEl.innerHTML = `
        <h2 class="text-lg font-semibold text-gray-400 mb-2">${title} (${tasks.length})</h2>
        <div class="bg-gray-800 rounded-lg">
            <div class="grid grid-cols-12 gap-4 p-4 border-b border-gray-700 text-xs font-semibold text-gray-400">
                <div class="col-span-4">TAREFA</div>
                <div class="col-span-2">PROJETO</div>
                <div class="col-span-2">EXECUTOR</div>
                <div class="col-span-2">PRAZO</div>
                <div class="col-span-1">PRIORIDADE</div>
            </div>
        </div>
    `;

    const tasksContainer = groupEl.querySelector('.bg-gray-800');
    tasks.forEach(task => {
        const taskRowEl = createTaskRow(task);
        tasksContainer.appendChild(taskRowEl);
    });

    return groupEl;
}

function createTaskRow(task) {
    const executor = users.find(u => u.id === task.assignee);
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'N/A';
    
    const row = document.createElement('div');
    row.className = "grid grid-cols-12 gap-4 p-4 border-b border-gray-700 items-center hover:bg-gray-700 transition-colors cursor-pointer";
    row.innerHTML = `
        <div class="col-span-4">
            <p>${task.text}</p>
        </div>
        <div class="col-span-2">
            <span class="text-sm text-gray-400">${projectsMap[task.projectId] || 'Projeto desconhecido'}</span>
        </div>
        <div class="col-span-2 flex items-center gap-2">
            <img src="${executor?.photoURL || 'default-profile.svg'}" class="w-6 h-6 rounded-full">
            <span class="text-sm">${executor?.name || 'N/A'}</span>
        </div>
        <div class="col-span-2">
            <span class="px-2 py-1 text-xs rounded-full bg-orange-500 text-black">${dueDate}</span>
        </div>
        <div class="col-span-1">
            <span class="text-sm">${task.priority || 'Normal'}</span>
        </div>
    `;
    row.addEventListener('click', () => openTaskModal(task));
    return row;
}

function openTaskModal(task = null) {
    const isNew = task === null;
    taskModalTitle.textContent = isNew ? "Criar Nova Tarefa" : "Editar Tarefa";

    const userOptions = users.map(u => `<option value="${u.id}" ${task?.assignee === u.id ? 'selected' : ''}>${u.name}</option>`).join('');
    const projectOptions = Object.entries(projectsMap).map(([id, name]) => `<option value="${id}" ${task?.projectId === id ? 'selected' : ''}>${name}</option>`).join('');

    const todoListHtml = (task?.todos || []).map((todo, index) => `
        <div class="flex items-center gap-2 p-2 rounded-md bg-gray-900/50 todo-item">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} class="form-checkbox h-5 w-5 bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500 rounded">
            <input type="text" value="${todo.text}" class="flex-grow bg-transparent border-none text-gray-300 focus:ring-0 focus:outline-none">
            <button type="button" class="text-gray-500 hover:text-red-500 remove-todo-btn">&times;</button>
        </div>
    `).join('');

    taskModalContent.innerHTML = `
        <form id="task-form" class="space-y-4">
            <input type="hidden" id="task-id" value="${task?.id || ''}">
            <div>
                <label for="task-project" class="block text-sm font-medium text-gray-300 mb-1">Projeto</label>
                <select id="task-project" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2" ${!isNew ? 'disabled' : ''}>
                    ${projectOptions}
                </select>
            </div>
            <div>
                <label for="task-title" class="block text-sm font-medium text-gray-300 mb-1">Título</label>
                <input type="text" id="task-title" value="${task?.text || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
            </div>
            <div>
                <label for="task-description" class="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
                <textarea id="task-description" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">${task?.description || ''}</textarea>
            </div>
            
            <!-- Seção de Checklist -->
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Checklist</label>
                <div id="todo-list" class="space-y-2 mb-2">
                    ${todoListHtml}
                </div>
                <div class="flex items-center gap-2">
                    <input type="text" id="new-todo-input" placeholder="Adicionar novo item..." class="flex-grow bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm">
                    <button type="button" id="add-todo-btn" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-lg text-sm">+</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="task-assignee" class="block text-sm font-medium text-gray-300 mb-1">Executor</label>
                    <select id="task-assignee" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                        <option value="">Ninguém</option>
                        ${userOptions}
                    </select>
                </div>
                <div>
                    <label for="task-dueDate" class="block text-sm font-medium text-gray-300 mb-1">Prazo</label>
                    <input type="date" id="task-dueDate" value="${task?.dueDate || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                </div>
            </div>
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="task-status" class="block text-sm font-medium text-gray-300 mb-1">Status</label>
                    <select id="task-status" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                        <option value="Pendente" ${task?.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Em Progresso" ${task?.status === 'Em Progresso' ? 'selected' : ''}>Em Progresso</option>
                        <option value="Concluída" ${task?.status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
                <div>
                    <label for="task-priority" class="block text-sm font-medium text-gray-300 mb-1">Prioridade</label>
                    <select id="task-priority" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                        <option value="Baixa" ${task?.priority === 'Baixa' ? 'selected' : ''}>Baixa</option>
                        <option value="Normal" ${task?.priority === 'Normal' ? 'selected' : ''}>Normal</option>
                        <option value="Alta" ${task?.priority === 'Alta' ? 'selected' : ''}>Alta</option>
                        <option value="Urgente" ${task?.priority === 'Urgente' ? 'selected' : ''}>Urgente</option>
                    </select>
                </div>
            </div>
        </form>
    `;
    
    // Event Listeners para a Checklist
    document.getElementById('add-todo-btn').addEventListener('click', addTodoItem);
    document.getElementById('todo-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-todo-btn')) {
            e.target.closest('.todo-item').remove();
        }
    });
    document.getElementById('new-todo-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTodoItem();
        }
    });

    taskModalFooter.innerHTML = `
        <div>
            ${!isNew ? '<button id="delete-btn" class="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Excluir</button>' : ''}
        </div>
        <div>
            <button id="cancel-btn" class="bg-gray-600 hover:bg-gray-500 font-semibold py-2 px-4 rounded-lg">Cancelar</button>
            <button id="save-btn" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg ml-4">Salvar</button>
        </div>
    `;
    document.getElementById('cancel-btn').addEventListener('click', closeTaskModal);
    document.getElementById('save-btn').addEventListener('click', saveTask);
    
    if (!isNew) {
        document.getElementById('delete-btn').addEventListener('click', () => deleteTask(task));
    }

    taskModal.classList.remove('hidden');
    taskModal.classList.add('flex');
}

function addTodoItem() {
    const input = document.getElementById('new-todo-input');
    const text = input.value.trim();
    if (text === '') return;

    const todoList = document.getElementById('todo-list');
    const newItem = document.createElement('div');
    newItem.className = 'flex items-center gap-2 p-2 rounded-md bg-gray-900/50 todo-item';
    newItem.innerHTML = `
        <input type="checkbox" class="form-checkbox h-5 w-5 bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500 rounded">
        <input type="text" value="${text}" class="flex-grow bg-transparent border-none text-gray-300 focus:ring-0 focus:outline-none">
        <button type="button" class="text-gray-500 hover:text-red-500 remove-todo-btn">&times;</button>
    `;
    todoList.appendChild(newItem);
    input.value = '';
    input.focus();
}

function closeTaskModal() {
    taskModal.classList.add('hidden');
    taskModal.classList.remove('flex');
}

function openProjectsModal() {
    populateProjectsModal();
    projectsModal.classList.remove('hidden');
    projectsModal.classList.add('flex');
}

function closeProjectsModal() {
    projectsModal.classList.add('hidden');
    projectsModal.classList.remove('flex');
}

function populateProjectsModal(editingProject = null) {
    if (editingProject) {
        // Formulário de Edição/Criação
        projectsModalContent.innerHTML = `
            <form id="project-form" class="space-y-4">
                <input type="hidden" id="project-id" value="${editingProject.id || ''}">
                <div>
                    <label for="project-name" class="block text-sm font-medium text-gray-300 mb-1">Nome do Projeto</label>
                    <input type="text" id="project-name" value="${editingProject.name || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                </div>
                <div>
                    <label for="project-description" class="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
                    <textarea id="project-description" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">${editingProject.description || ''}</textarea>
                </div>
            </form>
        `;
        addProjectBtn.textContent = 'Salvar Projeto';
        addProjectBtn.onclick = saveProject;
    } else {
        // Lista de Projetos
        projectsModalContent.innerHTML = '';
        for (const [id, name] of Object.entries(projectsMap)) {
            const projectEl = document.createElement('div');
            projectEl.className = 'flex justify-between items-center p-2 rounded-lg hover:bg-gray-700';
            projectEl.innerHTML = `
                <span>${name}</span>
                <div>
                    <button data-id="${id}" class="edit-project-btn text-gray-400 hover:text-blue-500 mr-2"><i class="fas fa-pen"></i></button>
                    <button data-id="${id}" data-name="${name}" class="delete-project-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>
                </div>
            `;
            projectsModalContent.appendChild(projectEl);
        }
        addProjectBtn.textContent = 'Adicionar Novo Projeto';
        addProjectBtn.onclick = () => populateProjectsModal({ id: '', name: '', description: '' });
    }

    document.querySelectorAll('.edit-project-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const projectId = e.currentTarget.dataset.id;
            const projectRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId);
            const projectSnap = await getDoc(projectRef);
            populateProjectsModal({ id: projectSnap.id, ...projectSnap.data() });
        });
    });

    document.querySelectorAll('.delete-project-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { id, name } = e.currentTarget.dataset;
            deleteProject(id, name);
        });
    });
}

async function deleteTask(task) {
    if (!confirm(`Tem certeza que deseja excluir a tarefa "${task.text}"?`)) {
        return;
    }

    try {
        const taskRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', task.projectId, 'nodes', task.id);
        await deleteDoc(taskRef);
        closeTaskModal();
    } catch (error) {
        console.error("Erro ao deletar tarefa:", error);
        alert("Ocorreu um erro ao deletar a tarefa.");
    }
}

async function saveProject() {
    const user = auth.currentUser;
    const projectId = document.getElementById('project-id').value;
    const isNew = projectId === '';

    const projectData = {
        name: document.getElementById('project-name').value,
        description: document.getElementById('project-description').value,
        owner: user.uid,
        updatedAt: serverTimestamp()
    };

    if (!projectData.name) {
        alert("O nome do projeto é obrigatório.");
        return;
    }

    try {
        if (isNew) {
            projectData.createdAt = serverTimestamp();
            projectData.isArchived = false;
            const projectsCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects');
            const docRef = await addDoc(projectsCollection, projectData);
            projectsMap[docRef.id] = projectData.name;
        } else {
            const projectRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId);
            await updateDoc(projectRef, projectData);
            projectsMap[projectId] = projectData.name;
        }
        populateProjectFilter();
        populateProjectsModal(); // Volta para a lista
    } catch (error) {
        console.error("Error saving project:", error);
        alert("Não foi possível salvar o projeto.");
    }
}

async function deleteProject(projectId, projectName) {
    if (!confirm(`Tem certeza que deseja EXCLUIR o projeto "${projectName}" e todas as suas tarefas?`)) return;
    try {
        const projectRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId);
        await deleteDoc(projectRef);
        delete projectsMap[projectId];
        populateProjectsModal();
        populateProjectFilter();
        renderTasks(); // Re-renderiza as tarefas para remover as do projeto excluído
    } catch (error) {
        console.error("Error deleting project:", error);
        alert("Não foi possível excluir o projeto.");
    }
}

async function saveTask() {
    const taskId = document.getElementById('task-id').value;
    const isNew = taskId === '';
    
    let projectId;
    if (isNew) {
        projectId = document.getElementById('task-project').value;
    } else {
        // No modo de edição, o projeto não pode ser alterado. Buscamos o ID do projeto da tarefa original.
        const task = allTasks.find(t => t.id === taskId);
        projectId = task.projectId;
    }

    if (!projectId) {
        alert("Por favor, selecione um projeto.");
        return;
    }

    const todos = Array.from(document.querySelectorAll('#todo-list .todo-item')).map(item => {
        return {
            text: item.querySelector('input[type="text"]').value,
            completed: item.querySelector('input[type="checkbox"]').checked
        };
    });

    const taskData = {
        text: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        assignee: document.getElementById('task-assignee').value,
        dueDate: document.getElementById('task-dueDate').value,
        status: document.getElementById('task-status').value,
        priority: document.getElementById('task-priority').value,
        todos: todos,
        updatedAt: serverTimestamp()
    };

    try {
        let taskRef;
        if (isNew) {
            taskData.createdAt = serverTimestamp();
            const nodesCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes');
            taskRef = await addDoc(nodesCollection, taskData);
        } else {
            taskRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes', taskId);
            await updateDoc(taskRef, taskData);
        }
        closeTaskModal();
    } catch (error) {
        console.error("Erro ao salvar tarefa:", error);
        alert("Ocorreu um erro ao salvar a tarefa.");
    }
}
