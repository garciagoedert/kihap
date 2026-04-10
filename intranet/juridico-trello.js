import { db, storage, appId } from './firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { loadComponents } from "./common-ui.js";

const deptsCol = collection(db, 'juridico_departments');
const demandsCol = collection(db, 'juridico_demands');
const auth = getAuth();

let departments = [];
let demands = [];
let activeFilters = new Set();
let searchQuery = '';
let currentUser = null;
let currentUserId = null;
let currentDeptId = null; // Currently viewed department ID
let currentDemandaId = null; // Currently viewed/edited demand ID
let currentEditId = null; // Currently edited demand ID in the form
let allUsers = []; // For @ mention and assignee
let selectedAssignees = []; // Array of {id, name, photoUrl}

let commentsUnsubscribe = null;
let mentionQuery = null;
let selectedCommentFile = null;

// DOM Elements
const kanbanBoard = document.getElementById('kanban-board');
const btnNovaDemanda = document.getElementById('btnNovaDemanda');
const btnManageDept = document.getElementById('btnManageDept');
const modalDemanda = document.getElementById('novaDemandaModal');
const modalDept = document.getElementById('deptModal');
const modalDetalhes = document.getElementById('demandaDetalhesModal');
const formDemanda = document.getElementById('demandaForm');
const deptSelectionContainer = document.getElementById('dept-selection-container');
const btnManageDeptInSelection = document.getElementById('btnManageDeptInSelection');
const kanbanWrapper = document.getElementById('kanban-wrapper');
const kanbanTitle = document.getElementById('kanban-title');
const btnVoltarDepts = document.getElementById('btnVoltarDepts');
const deptCardsContainer = document.getElementById('dept-cards-container');
const formCreateDept = document.getElementById('createDeptForm');
const deptSelect = document.getElementById('form_departamento');
const deptList = document.getElementById('deptList');
const deptCheckboxes = document.getElementById('deptCheckboxes');
const searchInput = document.getElementById('searchInput');
const formAssignee = document.getElementById('form_assignee');
const assigneeSearchInput = document.getElementById('assigneeSearchInput');
const assigneeDropdown = document.getElementById('assigneeDropdown');
const btnAddLink = document.getElementById('btnAddLink');
const linksContainer = document.getElementById('linksContainer');
const btnEditDemanda = document.getElementById('btnEditDemanda');
const checklistContainer = document.getElementById('detalhe_checklist');
const checklistInput = document.getElementById('checklist_input');
const btnAddChecklistItem = document.getElementById('btnAddChecklistItem');
const commentAnexo = document.getElementById('commentAnexo');
const commentAnexoPreview = document.getElementById('commentAnexoPreview');
const btnRemoveCommentAnexo = document.getElementById('btnRemoveCommentAnexo');

// Load Data
function init() {
    loadComponents(); 
    onAuthStateChanged(auth, user => {
        currentUser = user;
        if (user) {
            currentUserId = user.uid;
        }
    });
    loadUsers();
    setupListeners();
    observeDepartments();
    // Demandas are now observed per department or globally filtered in renderCards
    observeDemands(); 
}

async function loadUsers() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        // Filtra apenas usuários da intranet (que não possuem evoMemberId)
        allUsers = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => !u.evoMemberId);
        renderAssigneeOptions();
    } catch (e) {
        console.warn('Could not load users:', e.message);
    }
}

function renderSelectedAssignees() {
    const container = document.getElementById('selectedAssigneesContainer');
    container.innerHTML = '';
    selectedAssignees.forEach(u => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 bg-blue-900/50 border border-blue-700 text-blue-100 text-xs px-2 py-1 pl-1 rounded-full';
        const initial = u.name[0].toUpperCase();
        const photoHtml = u.photoUrl 
            ? `<img src="${u.photoUrl}" class="w-5 h-5 rounded-full object-cover shrink-0">`
            : `<div class="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">${initial}</div>`;
        
        div.innerHTML = `
            ${photoHtml}
            <span class="font-medium">${u.name}</span>
            <button type="button" class="text-blue-300 hover:text-red-400 ml-1 transition-colors outline-none" onclick="removeAssignee('${u.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

window.removeAssignee = (id) => {
    selectedAssignees = selectedAssignees.filter(u => u.id !== id);
    renderSelectedAssignees();
};

function renderAssigneeOptions(filter = '') {
    assigneeDropdown.innerHTML = '';
    const filteredUsers = allUsers.filter(u => {
        const name = (u.displayName || u.name || u.email).toLowerCase();
        return name.includes(filter.toLowerCase()) && !selectedAssignees.some(sa => sa.id === u.id); // Exclude already selected
    });

    if (filteredUsers.length === 0) {
        assigneeDropdown.innerHTML = '<div class="p-3 text-gray-500 text-xs italic">Nenhum usuário encontrado.</div>';
    } else {
        filteredUsers.forEach(u => {
            const name = u.displayName || u.name || u.email;
            const div = document.createElement('div');
            div.className = 'p-2.5 flex items-center gap-3 cursor-pointer hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0';
            
            const initial = name[0].toUpperCase();
            const photoHtml = u.photoUrl 
                ? `<img src="${u.photoUrl}" class="w-6 h-6 rounded-full">`
                : `<div class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">${initial}</div>`;

            div.innerHTML = `
                ${photoHtml}
                <div class="flex-1">
                    <div class="text-sm font-medium text-white">${name}</div>
                    <div class="text-[10px] text-gray-400">${u.email}</div>
                </div>
                <i class="fas fa-plus text-blue-500"></i>
            `;
            div.onclick = () => {
                selectedAssignees.push({ id: u.id, name, photoUrl: (u.photoUrl || null) });
                renderSelectedAssignees();
                assigneeSearchInput.value = '';
                assigneeDropdown.classList.add('hidden');
                assigneeSearchInput.focus();
            };
            assigneeDropdown.appendChild(div);
        });
    }
}

function observeDepartments() {
    onSnapshot(deptsCol, (snapshot) => {
        departments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDepartments();
        renderDepartmentFilters();
        renderCards();
    });
}

function observeDemands() {
    onSnapshot(query(demandsCol, orderBy('createdAt', 'desc')), (snapshot) => {
        demands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCards();

        // Se houver uma demanda aberta, atualiza o checklist para refletir as mudanças
        if (currentDemandaId && !modalDetalhes.classList.contains('hidden')) {
            const openDemand = demands.find(d => d.id === currentDemandaId);
            if (openDemand) {
                renderChecklist(openDemand);
            }
        }
    });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderDepartments() {
    deptSelect.innerHTML = '<option value="">Escolher Departamento</option>';
    deptList.innerHTML = '';
    deptCardsContainer.innerHTML = '';

    if (departments.length === 0) {
        deptList.innerHTML = '<li class="text-sm text-gray-500">Nenhum departamento cadastrado.</li>';
        deptCardsContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12 text-lg">Nenhum departamento encontrado. Crie um novo para acessar o Kanban.</div>';
    }

    departments.forEach(dept => {
        // ... build selection card code (omitted for brevity in replacement, but I must match it exactly)
        const card = document.createElement('div');
        card.className = "bg-gray-800 border-l-4 rounded-xl shadow-lg p-6 cursor-pointer hover:bg-gray-700 transition-all transform hover:-translate-y-1 flex flex-col items-center justify-center text-center group h-48";
        card.style.borderLeftColor = dept.color || '#3b82f6';
        
        card.innerHTML = `
            <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shrink-0" style="background-color: ${dept.color}20; color: ${dept.color}">
                <i class="fas fa-folder-open text-2xl"></i>
            </div>
            <h3 class="text-lg font-bold text-white mb-2 line-clamp-2" title="${dept.name}">${dept.name}</h3>
            <span class="text-[10px] text-gray-400 bg-gray-900 px-3 py-1.5 rounded-full uppercase tracking-wider font-semibold border mt-auto" style="border-color: ${dept.color}40">Acessar Kanban</span>
        `;
        
        card.addEventListener('click', () => {
            enterDepartment(dept);
        });
        
        deptCardsContainer.appendChild(card);
        const opt = document.createElement('option');
        opt.value = dept.id;
        opt.textContent = dept.name;
        deptSelect.appendChild(opt);

        const li = document.createElement('li');
        li.className = 'bg-gray-700/50 p-4 rounded-lg border border-gray-600 space-y-3';
        const cols = dept.columns || [
            { id: 'backlog', title: 'Backlog', color: 'gray' },
            { id: 'todo', title: 'To do', color: 'blue' },
            { id: 'pendente', title: 'Pendente', color: 'yellow' },
            { id: 'concluido', title: 'Concluído', color: 'green' }
        ];

        let colsHtml = cols.map((c, i) => `
            <div class="flex gap-2 items-center">
                <input type="text" value="${c.title}" data-index="${i}" data-deptid="${dept.id}" class="flex-1 bg-gray-800 border border-gray-700 rounded p-1 text-xs col-title-input">
                <select data-index="${i}" data-deptid="${dept.id}" class="bg-gray-800 border border-gray-700 rounded p-1 text-xs col-color-select">
                    <option value="gray" ${c.color === 'gray' ? 'selected' : ''}>Cinza</option>
                    <option value="blue" ${c.color === 'blue' ? 'selected' : ''}>Azul</option>
                    <option value="yellow" ${c.color === 'yellow' ? 'selected' : ''}>Amarelo</option>
                    <option value="green" ${c.color === 'green' ? 'selected' : ''}>Verde</option>
                    <option value="red" ${c.color === 'red' ? 'selected' : ''}>Vermelho</option>
                </select>
                <button class="remove-col-btn text-red-500 hover:text-red-400" data-index="${i}" data-deptid="${dept.id}"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        li.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 rounded-full" style="background-color: ${dept.color}"></div>
                    <span class="text-sm text-gray-200 font-bold">${dept.name}</span>
                </div>
                <button class="delete-dept text-red-400 hover:text-red-300 transition-colors" data-id="${dept.id}"><i class="fas fa-trash"></i></button>
            </div>
            <div class="space-y-2 pt-2 border-t border-gray-600">
                <p class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Colunas do Kanban</p>
                ${colsHtml}
                <button class="add-col-btn text-blue-400 hover:text-blue-300 text-[10px] font-bold uppercase tracking-wider" data-id="${dept.id}">+ Adicionar Coluna</button>
            </div>
        `;
        deptList.appendChild(li);
    });

    // Add Column Listeners
    document.querySelectorAll('.add-col-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const deptId = e.currentTarget.dataset.id;
            const dept = departments.find(d => d.id === deptId);
            const newCols = [...(dept.columns || []), { id: `col_${Date.now()}`, title: 'Nova Coluna', color: 'gray' }];
            await updateDoc(doc(deptsCol, deptId), { columns: newCols });
        });
    });

    document.querySelectorAll('.col-title-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const deptId = e.target.dataset.deptid;
            const index = parseInt(e.target.dataset.index);
            const dept = departments.find(d => d.id === deptId);
            const newCols = [...(dept.columns || [])];
            newCols[index].title = e.target.value;
            await updateDoc(doc(deptsCol, deptId), { columns: newCols });
        });
    });

    document.querySelectorAll('.col-color-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const deptId = e.target.dataset.deptid;
            const index = parseInt(e.target.dataset.index);
            const dept = departments.find(d => d.id === deptId);
            const newCols = [...(dept.columns || [])];
            newCols[index].color = e.target.value;
            await updateDoc(doc(deptsCol, deptId), { columns: newCols });
        });
    });

    document.querySelectorAll('.remove-col-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const deptId = e.currentTarget.dataset.deptid;
            const index = parseInt(e.currentTarget.dataset.index);
            const dept = departments.find(d => d.id === deptId);
            const newCols = dept.columns.filter((_, i) => i !== index);
            await updateDoc(doc(deptsCol, deptId), { columns: newCols });
        });
    });

    document.querySelectorAll('.delete-dept').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm('Tem certeza que deseja excluir este departamento? Demandas vinculadas não serão excluídas.')) {
                await deleteDoc(doc(deptsCol, id));
            }
        });
    });
}

function renderDepartmentFilters() {
    // This function can be kept or removed if filters are no longer used globally
    // but the user wants to filter by department, so let's keep it but it might need adjustment
    // for the new dynamic column structure.
    deptCheckboxes.innerHTML = '';
    departments.forEach(dept => {
        const div = document.createElement('label');
        div.className = 'flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-1.5 rounded transition-colors';
        const checked = activeFilters.has(dept.id) ? 'checked' : '';
        div.innerHTML = `
            <input type="checkbox" value="${dept.id}" class="dept-filter-cb w-4 h-4 accent-blue-500" ${checked}>
            <div class="w-3 h-3 rounded-full" style="background-color: ${dept.color}"></div>
            <span class="text-sm text-gray-300 truncate">${dept.name}</span>
        `;
        deptCheckboxes.appendChild(div);
    });

    document.querySelectorAll('.dept-filter-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const val = e.target.value;
            if (e.target.checked) activeFilters.add(String(val));
            else activeFilters.delete(String(val));
            renderCards();
        });
    });
}

function renderCards() {
    kanbanBoard.innerHTML = '';
    
    // Get current department columns or use defaults
    const currentDept = departments.find(d => d.id === currentDeptId);
    let boardColumns = currentDept?.columns || [
        { id: 'backlog', title: 'Backlog', color: 'gray' },
        { id: 'todo', title: 'To do', color: 'blue' },
        { id: 'pendente', title: 'Pendente', color: 'yellow' },
        { id: 'concluido', title: 'Concluído', color: 'green' }
    ];

    // Create column structure
    boardColumns.forEach(col => {
        const colHtml = `
            <div class="bg-[#1a1a1a] rounded-lg p-4 flex flex-col shadow-lg border border-gray-800 kanban-column shrink-0 w-80 md:flex-1 md:min-w-[300px] max-w-[400px] max-h-full min-h-0" data-column="${col.id}">
                <h2 class="font-bold mb-4 pb-2 border-b border-gray-700 flex justify-between items-center" style="color: ${getColorHex(col.color)}">
                    <span>${col.title}</span>
                    <span class="bg-gray-800 text-xs py-1 px-2 rounded-full count" id="count-${col.id}">0</span>
                </h2>
                <div class="flex-1 overflow-y-auto custom-scrollbar column-body space-y-3" id="col-${col.id}"></div>
            </div>
        `;
        kanbanBoard.insertAdjacentHTML('beforeend', colHtml);
    });

    // Re-setup drag & drop for dynamic columns
    setupDragAndDrop();

    let counts = {};
    boardColumns.forEach(c => counts[c.id] = 0);

    demands.forEach(d => {
        const titleSearch = (d.titulo || d.demanda || '').toLowerCase();
        if (searchQuery && !titleSearch.includes(searchQuery.toLowerCase()) && !d.nome.toLowerCase().includes(searchQuery.toLowerCase())) return;
        
        // Filter by current viewed department
        if (currentDeptId && d.departamentoId !== currentDeptId) return;

        // Fallback or additional filters (e.g. from the management dropdown)
        if (activeFilters.size > 0) {
            if (!d.departamentoId || !activeFilters.has(String(d.departamentoId))) return;
        }

        const dept = departments.find(dep => dep.id === d.departamentoId);
        const color = dept ? dept.color : '#6b7280';
        const deptName = dept ? dept.name : 'Sem Depto';

        const parsedDate = new Date(d.dataMaxima);
        const formattedDate = !isNaN(parsedDate) ? parsedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        const isOverdue = parsedDate < new Date() && d.status !== 'concluido';

        const finalidadesHtml = Array.isArray(d.finalidade) ? d.finalidade.map(f => `<span class="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">${f}</span>`).join(' ') : '';
        const hasAttachment = d.anexoUrl || d.linkRefs?.length > 0;
        const attachBadge = hasAttachment ? `<span class="text-gray-500 text-[10px]"><i class="fas fa-paperclip"></i></span>` : '';
        
        // Priority Badge
        const priorityColors = { 'Baixa': 'text-gray-400', 'Média': 'text-blue-400', 'Alta': 'text-orange-400', 'Urgente': 'text-red-500 font-bold animate-pulse' };
        const priorityHtml = d.priority ? `<span class="text-[9px] ${priorityColors[d.priority] || 'text-gray-400'} uppercase tracking-tighter">${d.priority}</span>` : '';

        // Assignee Photo/Initial
        let assigneeHtml = '';
        if (d.assignees && d.assignees.length > 0) {
            assigneeHtml = `<div class="flex -space-x-2 mr-2">`;
            d.assignees.slice(0, 3).forEach(a => {
                const initial = (a.name || '?')[0].toUpperCase();
                if (a.photoUrl) {
                    assigneeHtml += `<img src="${a.photoUrl}" title="${a.name}" class="w-6 h-6 rounded-full border-2 border-gray-800 object-cover relative hover:z-10 bg-gray-700 shadow-sm">`;
                } else {
                    assigneeHtml += `<div title="${a.name}" class="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white border-2 border-gray-800 relative hover:z-10 shadow-sm">${initial}</div>`;
                }
            });
            if (d.assignees.length > 3) {
                assigneeHtml += `<div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-white border-2 border-gray-800 relative z-10 shadow-sm">+${d.assignees.length - 3}</div>`;
            }
            assigneeHtml += `</div>`;
        } else if (d.assigneeId) {
            const user = allUsers.find(u => u.id === d.assigneeId);
            const initial = (user?.displayName || user?.name || '?')[0].toUpperCase();
            if (user?.photoUrl) {
                assigneeHtml = `<img src="${user.photoUrl}" title="${user.displayName || user.name}" class="w-6 h-6 rounded-full border border-gray-800 object-cover shadow-sm mr-2">`;
            } else {
                assigneeHtml = `<div title="${user?.displayName || user?.name}" class="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white border border-gray-800 shadow-sm mr-2">${initial}</div>`;
            }
        }

        const cardHTML = `
            <div class="bg-gray-800 border-l-4 rounded shadow p-3 cursor-pointer hover:bg-gray-750 transition-colors card"
                draggable="true" data-id="${d.id}" style="border-left-color: ${color};"
                ondragstart="dragStart(event)" ondragend="dragEnd(event)"
                onclick="window.openDemandaDetalhes('${d.id}')">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] bg-gray-900 text-gray-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold" style="color: ${color}; border: 1px solid ${color}40">${deptName}</span>
                    <div class="flex items-center gap-1">
                        ${priorityHtml}
                        ${attachBadge}
                    </div>
                </div>
                <div class="text-sm font-semibold text-white mb-1 line-clamp-2" title="${d.titulo || d.demanda}">${d.titulo || d.demanda}</div>
                <div class="text-xs text-gray-400 mb-2 truncate"><i class="fas fa-user mr-1"></i>${d.nome} - ${d.unidade}</div>
                <div class="flex flex-wrap gap-1 mb-3">${finalidadesHtml}</div>
                <div class="mt-auto pt-2 border-t border-gray-700 flex justify-between items-center text-[10px] text-gray-400">
                    <div class="flex items-center gap-1 ${isOverdue ? 'text-red-400 font-bold' : ''}">
                        <i class="far fa-calendar-alt"></i> ${formattedDate}
                    </div>
                    ${assigneeHtml}
                </div>
            </div>
        `;

        const targetColumn = document.getElementById(`col-${d.status}`);
        if (targetColumn) {
            targetColumn.insertAdjacentHTML('beforeend', cardHTML);
            if (counts[d.status] !== undefined) counts[d.status]++;
        }
    });

    boardColumns.forEach(col => {
        const countSpan = document.getElementById(`count-${col.id}`);
        if (countSpan) countSpan.textContent = counts[col.id];
    });
}

function getColorHex(color) {
    const colors = { gray: '#9ca3af', blue: '#3b82f6', yellow: '#eab308', green: '#22c55e', red: '#ef4444' };
    return colors[color] || color;
}

// ─── Drag and Drop ────────────────────────────────────────────────────────────

window.dragStart = (e) => {
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
    setTimeout(() => e.target.style.opacity = '0.5', 0);
};

window.dragEnd = (e) => {
    e.target.classList.remove('dragging');
    e.target.style.opacity = '1';
    document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
};

function setupDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', e => { col.classList.remove('drag-over'); });
        col.addEventListener('drop', async e => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const cardId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.column;
            const demand = demands.find(d => d.id === cardId);
            if (demand && demand.status !== newStatus) {
                demand.status = newStatus;
                renderCards();
                try {
                    await updateDoc(doc(demandsCol, cardId), { status: newStatus });
                } catch (err) {
                    console.error("error updating status", err);
                    observeDemands();
                }
            }
        });
    });
}

// ─── Create Demand ────────────────────────────────────────────────────────────

document.getElementById('submitDemandaBtn').addEventListener('click', async () => {
    if (!formDemanda.checkValidity()) {
        formDemanda.reportValidity();
        return;
    }

    const email = document.getElementById('form_email').value;
    const nome = document.getElementById('form_nome').value;
    const unidade = document.getElementById('form_unidade').value;
    const departamentoId = document.getElementById('form_departamento').value;
    const titulo = document.getElementById('form_titulo').value;
    const demandaText = document.getElementById('form_demanda').value;
    const dataMaxima = document.getElementById('form_data_maxima').value;
    const fileInput = document.getElementById('form_anexo');
    const file = fileInput.files[0] || null;

    const finalidades = [];
    document.querySelectorAll('input[name="finalidade"]:checked').forEach(cb => {
        if (cb.value === 'Outro') {
            const outroVal = document.getElementById('finalidade_outro').value;
            if (outroVal) finalidades.push(outroVal);
        } else {
            finalidades.push(cb.value);
        }
    });

    const btn = document.getElementById('submitDemandaBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    const linkRefInputs = document.querySelectorAll('input[name="form_link"]');
    const linkRefs = Array.from(linkRefInputs).map(i => i.value).filter(v => !!v);
    const priority = document.getElementById('form_prioridade').value || 'Média';

    const data = {
        titulo: titulo || "",
        demanda: demandaText || "",
        unidade: unidade || "",
        departamentoId: departamentoId || "",

        priority,
        linkRefs,
        assignees: selectedAssignees,
        updatedAt: serverTimestamp()
    };


    try {
        if (currentEditId) {
            await updateDoc(doc(demandsCol, currentEditId), data);
            alert("Demanda atualizada!");
        } else {
            let anexoUrl = null;
            let anexoNome = null;
            if (file) {
                const fileRef = storageRef(storage, `juridico_demands/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                anexoUrl = await getDownloadURL(fileRef);
                anexoNome = file.name;
            }
            data.nome = nome;
            data.email = email;
            data.status = 'todo';
            data.createdAt = serverTimestamp();
            data.createdBy = currentUserId;
            data.anexoUrl = anexoUrl;
            data.anexoNome = anexoNome;
            data.finalidade = finalidades;
            data.dataMaxima = dataMaxima;
            await addDoc(demandsCol, data);
            alert("Demanda enviada com sucesso!");
        }
        
        closeModal(modalDemanda);
        formDemanda.reset();
        currentEditId = null;
    } catch (err) {
        console.error("Error creating demand", err);
        alert('Erro ao criar demanda: ' + err.message);
    } finally {
        btn.innerHTML = 'Enviar';
        btn.disabled = false;
    }
});

// ─── Demand Details Modal ─────────────────────────────────────────────────────

window.openDemandaDetalhes = (id) => {
    currentDemandaId = id;
    const demand = demands.find(d => d.id === id);
    if (!demand) return;

    const dept = departments.find(dep => dep.id === demand.departamentoId);
    const color = dept ? dept.color : '#6b7280';
    const deptName = dept ? dept.name : 'Sem Depto';
    const parsedDate = new Date(demand.dataMaxima);
    const formattedDate = !isNaN(parsedDate) ? parsedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    const tag = document.getElementById('detalhe_dept_tag');
    tag.textContent = deptName;
    tag.style.backgroundColor = color + '40';
    tag.style.color = color;
    tag.style.border = `1px solid ${color}`;

    document.getElementById('detalhe_titulo_header').textContent = demand.titulo || "Demanda sem título";
    document.getElementById('detalhe_nome').textContent = demand.nome;
    document.getElementById('detalhe_unidade').textContent = demand.unidade;
    document.getElementById('detalhe_email').textContent = demand.email;
    document.getElementById('detalhe_data').textContent = formattedDate;
    document.getElementById('detalhe_texto').textContent = demand.demanda;

    // Render Assignees in Modal
    const assigneesContainer = document.getElementById('detalhe_assignees_container');
    if (assigneesContainer) {
        let items = demand.assignees || [];
        if (items.length === 0 && demand.assigneeId) {
            items = [{ id: demand.assigneeId, name: demand.assigneeName || 'Usuário', photoUrl: demand.assigneePhotoUrl || null }];
        }
        
        if (items.length > 0) {
            assigneesContainer.innerHTML = items.map(a => {
                const initial = (a.name || '?')[0].toUpperCase();
                const photo = a.photoUrl 
                    ? `<img src="${a.photoUrl}" class="w-6 h-6 rounded-full object-cover">`
                    : `<div class="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white">${initial}</div>`;
                return `<div class="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1.5 pr-3 w-fit"><span class="shrink-0">${photo}</span><span class="text-sm font-medium text-gray-200">${a.name}</span></div>`;
            }).join('');
            assigneesContainer.parentElement.classList.remove('hidden');
        } else {
            assigneesContainer.parentElement.classList.add('hidden');
        }
    }

    const finalidadesContainer = document.getElementById('detalhe_finalidades');
    if (Array.isArray(demand.finalidade) && demand.finalidade.length > 0) {
        finalidadesContainer.innerHTML = demand.finalidade.map(f => `<span class="bg-gray-700 text-gray-300 text-[10px] px-2 py-1 rounded tracking-wide uppercase">${f}</span>`).join('');
    } else {
        finalidadesContainer.innerHTML = '<span class="text-gray-500 italic text-sm">Nenhuma finalidade especificada.</span>';
    }

    // Show references / attachments
    const extrasSection = document.getElementById('detalhe_extras');
    const linkContainer = document.getElementById('detalhe_link_container');
    const anexoContainer = document.getElementById('detalhe_anexo_container');

    const hasLinks = demand.linkRefs && demand.linkRefs.length > 0;
    const hasAnexo = demand.anexoUrl;

    if (hasLinks || hasAnexo) {
        extrasSection.classList.remove('hidden');
        if (hasLinks) {
            linkContainer.classList.remove('hidden');
            linkContainer.innerHTML = demand.linkRefs.map(link => `
                <a href="${link}" target="_blank" rel="noopener noreferrer"
                    class="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm bg-gray-800 p-3 rounded-lg border border-gray-700 transition-colors mb-2 last:mb-0">
                    <i class="fas fa-link shrink-0"></i>
                    <span class="truncate flex-1">${link}</span>
                    <i class="fas fa-external-link-alt ml-auto shrink-0 opacity-60"></i>
                </a>
            `).join('');
        } else {
            linkContainer.classList.add('hidden');
        }
        if (hasAnexo) {
            anexoContainer.classList.remove('hidden');
            document.getElementById('detalhe_anexo').href = demand.anexoUrl;
            document.getElementById('detalhe_anexo_nome').textContent = demand.anexoNome || 'Ver Anexo';
            const nameLower = (demand.anexoNome || '').toLowerCase();
            let iconClass = 'fa-file text-gray-400';
            if (nameLower.endsWith('.pdf')) iconClass = 'fa-file-pdf text-red-400';
            else if (nameLower.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) iconClass = 'fa-image text-green-400';
            else if (nameLower.match(/\.(zip|rar|7z)$/)) iconClass = 'fa-file-archive text-yellow-400';
            else if (nameLower.match(/\.(doc|docx)$/)) iconClass = 'fa-file-word text-blue-400';
            else if (nameLower.match(/\.(xls|xlsx|csv)$/)) iconClass = 'fa-file-excel text-green-500';
            else if (nameLower.match(/\.(ppt|pptx)$/)) iconClass = 'fa-file-powerpoint text-orange-500';
            document.getElementById('detalhe_anexo_icon').className = `fas ${iconClass} shrink-0`;
        } else {
            anexoContainer.classList.add('hidden');
        }
    } else {
        extrasSection.classList.add('hidden');
    }

    // Render Checklist
    renderChecklist(demand);

    // Reset comment input & preview
    document.getElementById('commentInput').value = '';
    commentAnexoPreview.classList.add('hidden');
    selectedCommentFile = null;

    // Load comments in realtime
    loadComments(id);

    openModal(modalDetalhes);
};

function renderChecklist(demand) {
    checklistContainer.innerHTML = '';
    const items = demand.checklist || [];
    if (items.length === 0) {
        checklistContainer.innerHTML = '<p class="text-gray-500 text-xs italic">Nenhum item no checklist.</p>';
        return;
    }

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 group';
        div.innerHTML = `
            <input type="checkbox" ${item.completed ? 'checked' : ''} class="w-4 h-4 accent-blue-500 rounded cursor-pointer checklist-toggle" data-index="${index}">
            <span class="text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-300'} flex-1">${item.text}</span>
            <button class="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity checklist-remove" data-index="${index}"><i class="fas fa-times text-xs"></i></button>
        `;
        checklistContainer.appendChild(div);
    });

    document.querySelectorAll('.checklist-toggle').forEach(cb => {
        cb.addEventListener('change', async (e) => {
            const index = parseInt(e.target.dataset.index);
            const newChecklist = [...items];
            newChecklist[index].completed = e.target.checked;
            await updateDoc(doc(demandsCol, demand.id), { checklist: newChecklist });
        });
    });

    document.querySelectorAll('.checklist-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            const newChecklist = items.filter((_, i) => i !== index);
            await updateDoc(doc(demandsCol, demand.id), { checklist: newChecklist });
        });
    });
}

function loadComments(demandId) {
    if (commentsUnsubscribe) commentsUnsubscribe(); // Unsubscribe previous listener

    const commentsCol = collection(db, `juridico_demands/${demandId}/comments`);
    commentsUnsubscribe = onSnapshot(query(commentsCol, orderBy('createdAt', 'asc')), (snapshot) => {
        const commentsList = document.getElementById('commentsList');
        if (snapshot.empty) {
            commentsList.innerHTML = '<p class="text-gray-500 text-sm italic text-center py-4">Nenhum comentário ainda.</p>';
            return;
        }
        commentsList.innerHTML = '';
        snapshot.docs.forEach(docSnap => {
            const c = docSnap.data();
            const time = c.createdAt ? new Date(c.createdAt.toDate()).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            const initial = (c.authorName || '?')[0].toUpperCase();
            // Auto-link URLs and highlight @mentions
            let textContent = c.text || '';
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            textContent = textContent.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">$1</a>');
            const formattedText = textContent.replace(/(@\S+)/g, '<span class="text-blue-500 font-semibold bg-blue-500/10 px-1 rounded">$1</span>');
            
            let anexoHtml = '';
            if (c.anexoUrl) {
                const nameLower = (c.anexoNome || '').toLowerCase();
                const isImage = nameLower.match(/\.(jpg|jpeg|png|gif|webp)$/i) || !c.anexoNome;
                if (isImage) {
                    anexoHtml = `<div class="mt-2"><img src="${c.anexoUrl}" class="max-w-full rounded-lg border border-gray-700 cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open('${c.anexoUrl}', '_blank')"></div>`;
                } else {
                    let iconClass = 'fa-file text-gray-400';
                    if (nameLower.endsWith('.pdf')) iconClass = 'fa-file-pdf text-red-400';
                    else if (nameLower.match(/\.(zip|rar|7z)$/)) iconClass = 'fa-file-archive text-yellow-400';
                    else if (nameLower.match(/\.(doc|docx)$/)) iconClass = 'fa-file-word text-blue-400';
                    else if (nameLower.match(/\.(xls|xlsx|csv)$/)) iconClass = 'fa-file-excel text-green-500';
                    else if (nameLower.match(/\.(ppt|pptx)$/)) iconClass = 'fa-file-powerpoint text-orange-500';
                    
                    anexoHtml = `
                        <div class="mt-2">
                            <a href="${c.anexoUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 bg-gray-900 border border-gray-700 p-2 rounded hover:bg-gray-800 transition-colors w-fit">
                                <i class="fas ${iconClass}"></i>
                                <span class="text-xs text-blue-400 underline truncate max-w-[200px] block">${c.anexoNome}</span>
                            </a>
                        </div>
                    `;
                }
            }

            const el = document.createElement('div');
            el.className = 'flex gap-2.5';
            el.innerHTML = `
                <div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm">${initial}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                        <span class="text-sm font-semibold text-gray-200">${c.authorName || 'Usuário'}</span>
                        <span class="text-[10px] text-gray-500 shrink-0">${time}</span>
                    </div>
                    <div class="text-sm text-gray-300 mt-0.5 bg-gray-800/80 p-2.5 rounded-r-lg rounded-bl-lg break-words whitespace-pre-wrap shadow-sm border border-gray-700/50">
                        ${formattedText}
                        ${anexoHtml}
                    </div>
                </div>

            `;
            commentsList.appendChild(el);
        });
        // Auto-scroll to bottom
        commentsList.scrollTop = commentsList.scrollHeight;
    });
}

document.getElementById('btnEnviarComentario').addEventListener('click', async () => {
    const input = document.getElementById('commentInput');
    const text = (input.value || '').trim();
    if (!text && !selectedCommentFile) return;
    if (!currentDemandaId) return;

    const authorName = currentUser?.displayName || currentUser?.email || 'Usuário';
    const btn = document.getElementById('btnEnviarComentario');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        let anexoUrl = null;
        let anexoNome = null;
        if (selectedCommentFile) {
            const fileRef = storageRef(storage, `juridico_comments/${Date.now()}_${selectedCommentFile.name}`);
            await uploadBytes(fileRef, selectedCommentFile);
            anexoUrl = await getDownloadURL(fileRef);
            anexoNome = selectedCommentFile.name;
        }

        const commentsCol = collection(db, `juridico_demands/${currentDemandaId}/comments`);
        await addDoc(commentsCol, {
            text,
            anexoUrl,
            anexoNome,
            authorId: currentUser?.uid || null,
            authorName,
            createdAt: serverTimestamp()
        });
        
        input.value = '';
        selectedCommentFile = null;
        commentAnexoPreview.classList.add('hidden');
        document.getElementById('mentionDropdown').classList.add('hidden');
    } catch (err) {
        alert('Erro ao enviar comentário: ' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Enviar';
    }
});

// @mention autocomplete
document.getElementById('commentInput').addEventListener('input', (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    const dropdown = document.getElementById('mentionDropdown');

    if (atMatch) {
        mentionQuery = atMatch[1].toLowerCase();
        const matches = allUsers.filter(u => {
            const name = (u.displayName || u.name || u.email || '').toLowerCase();
            return name.includes(mentionQuery);
        }).slice(0, 6);

        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(u => {
                const name = u.displayName || u.name || u.email || 'Usuário';
                return `<button class="mention-item w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2" data-name="${name}">
                    <span class="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0">${name[0].toUpperCase()}</span>
                    ${name}
                </button>`;
            }).join('');
            dropdown.classList.remove('hidden');

            dropdown.querySelectorAll('.mention-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const chosen = btn.dataset.name;
                    const newVal = val.slice(0, cursorPos).replace(/@(\w*)$/, `@${chosen} `) + val.slice(cursorPos);
                    e.target.value = newVal;
                    dropdown.classList.add('hidden');
                    e.target.focus();
                });
            });
        } else {
            dropdown.classList.add('hidden');
        }
    } else {
        dropdown.classList.add('hidden');
    }
});

// Close mention dropdown when clicking outside comment area
document.addEventListener('click', (e) => {
    if (!e.target.closest('#commentInput') && !e.target.closest('#mentionDropdown')) {
        document.getElementById('mentionDropdown').classList.add('hidden');
    }
});

// Close modal on Escape key inside textarea
document.getElementById('commentInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        document.getElementById('btnEnviarComentario').click();
    }
});

document.getElementById('btnExcluirDemanda').addEventListener('click', async () => {
    if (!currentDemandaId) return;
    if (confirm('Tem certeza que deseja apagar permanentemente esta demanda?')) {
        try {
            if (commentsUnsubscribe) commentsUnsubscribe();
            await deleteDoc(doc(demandsCol, currentDemandaId));
            closeModal(modalDetalhes);
        } catch (err) {
            alert('Erro ao excluir demanda.');
            console.error(err);
        }
    }
});

// ─── Departments ──────────────────────────────────────────────────────────────

formCreateDept.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('deptName').value;
    const color = document.getElementById('deptColor').value;
    try {
        await addDoc(deptsCol, { name, color, createdAt: serverTimestamp() });
        formCreateDept.reset();
        document.getElementById('deptColor').value = '#3b82f6';
    } catch (err) {
        alert("Erro ao criar departamento");
        console.error(err);
    }
});

// ─── UI Listeners ─────────────────────────────────────────────────────────────

function enterDepartment(dept) {
    currentDeptId = dept.id;
    deptSelectionContainer.classList.add('hidden');
    kanbanWrapper.classList.remove('hidden');
    kanbanTitle.textContent = `Demandas - ${dept.name}`;
    
    // Set the filter
    activeFilters.clear();
    activeFilters.add(String(dept.id));
    
    // Pre-fill "Nova Demanda" form for this dept
    document.getElementById('form_departamento').value = dept.id;
    if (currentUser) {
        document.getElementById('form_email').value = currentUser.email || '';
        document.getElementById('form_nome').value = currentUser.displayName || currentUser.name || currentUser.email?.split('@')[0] || '';
    }
    document.getElementById('form_unidade').value = 'Todas';

    // Re-render cards
    renderCards();
}

function leaveDepartment() {
    kanbanWrapper.classList.add('hidden');
    deptSelectionContainer.classList.remove('hidden');
    
    activeFilters.clear();
    renderCards();
}

function setupListeners() {
    document.getElementById('check_outro').addEventListener('change', e => {
        const i = document.getElementById('finalidade_outro');
        i.disabled = !e.target.checked;
        if (e.target.checked) i.focus();
    });

    searchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        renderCards();
    });

    btnNovaDemanda.addEventListener('click', () => {
        document.getElementById('modalDemandaTitle').textContent = 'Solicitação de Demanda';
        document.getElementById('submitDemandaBtn').innerHTML = 'Enviar';
        currentEditId = null;
        formDemanda.reset();
        
        // Reset links
        linksContainer.innerHTML = `
            <div class="flex gap-2">
                <input type="url" name="form_link"
                    class="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    placeholder="Ex: https://drive.google.com/...">
            </div>
        `;
        // Reset assignee
        selectedAssignees = [];
        renderSelectedAssignees();
        assigneeSearchInput.value = '';
        
        // Pre-fill logic after reset
        if (currentUser) {
            document.getElementById('form_email').value = currentUser.email || '';
            document.getElementById('form_nome').value = currentUser.displayName || currentUser.name || currentUser.email?.split('@')[0] || '';
        }
        document.getElementById('form_unidade').value = 'Todas';
        if (currentDeptId) {
            document.getElementById('form_departamento').value = currentDeptId;
        }

        openModal(modalDemanda);
    });
    btnManageDept.addEventListener('click', () => openModal(modalDept));
    if (btnManageDeptInSelection) btnManageDeptInSelection.addEventListener('click', () => openModal(modalDept));
    if (btnVoltarDepts) btnVoltarDepts.addEventListener('click', leaveDepartment);

    btnAddLink.addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'flex gap-2';
        div.innerHTML = `
            <input type="url" name="form_link"
                class="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                placeholder="Ex: https://drive.google.com/...">
            <button type="button" class="text-red-400 hover:text-red-300 remove-link-btn"><i class="fas fa-trash"></i></button>
        `;
        linksContainer.appendChild(div);
        div.querySelector('.remove-link-btn').addEventListener('click', () => div.remove());
    });

    btnAddChecklistItem.addEventListener('click', async () => {
        const text = checklistInput.value.trim();
        if (!text || !currentDemandaId) return;
        const demand = demands.find(d => d.id === currentDemandaId);
        const newChecklist = [...(demand.checklist || []), { text, completed: false }];
        await updateDoc(doc(demandsCol, currentDemandaId), { checklist: newChecklist });
        checklistInput.value = '';
    });

    checklistInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAddChecklistItem.click();
        }
    });

    commentAnexo.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedCommentFile = file;
            const imgPreview = document.getElementById('commentAnexoImg');
            const filePreview = document.getElementById('commentAnexoFile');
            const namePreview = document.getElementById('commentAnexoName');
            
            namePreview.textContent = file.name;
            
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    imgPreview.src = ev.target.result;
                    imgPreview.classList.remove('hidden');
                    filePreview.classList.add('hidden');
                    commentAnexoPreview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                imgPreview.classList.add('hidden');
                imgPreview.src = '';
                
                const nameLower = file.name.toLowerCase();
                let iconClass = 'fa-file text-gray-400';
                if (nameLower.endsWith('.pdf')) iconClass = 'fa-file-pdf text-red-400';
                else if (nameLower.match(/\.(zip|rar|7z)$/)) iconClass = 'fa-file-archive text-yellow-400';
                else if (nameLower.match(/\.(doc|docx)$/)) iconClass = 'fa-file-word text-blue-400';
                else if (nameLower.match(/\.(xls|xlsx|csv)$/)) iconClass = 'fa-file-excel text-green-500';
                else if (nameLower.match(/\.(ppt|pptx)$/)) iconClass = 'fa-file-powerpoint text-orange-500';
                
                filePreview.innerHTML = `<i class="fas ${iconClass}"></i>`;
                filePreview.classList.remove('hidden');
                commentAnexoPreview.classList.remove('hidden');
            }
        }
    });

    btnRemoveCommentAnexo.addEventListener('click', () => {
        selectedCommentFile = null;
        commentAnexo.value = '';
        commentAnexoPreview.classList.add('hidden');
    });

    btnEditDemanda.addEventListener('click', () => {
        openEditModal(currentDemandaId);
    });

    assigneeSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        renderAssigneeOptions(val);
        assigneeDropdown.classList.remove('hidden');
        if (!val) formAssignee.value = '';
    });

    assigneeSearchInput.addEventListener('focus', () => {
        renderAssigneeOptions(assigneeSearchInput.value);
        assigneeDropdown.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!assigneeSearchInput.contains(e.target) && !assigneeDropdown.contains(e.target)) {
            assigneeDropdown.classList.add('hidden');
        }
    });

    document.querySelectorAll('.closeModalBtn').forEach(b => b.addEventListener('click', () => {
        closeModal(modalDemanda);
        // Reset dynamic links
        linksContainer.innerHTML = `
            <div class="flex gap-2">
                <input type="url" name="form_link"
                    class="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    placeholder="Ex: https://drive.google.com/...">
            </div>
        `;
        // Reset assignee search
        assigneeSearchInput.value = '';
        selectedAssignees = [];
        renderSelectedAssignees();
    }));
    document.querySelectorAll('.closeDeptModalBtn').forEach(b => b.addEventListener('click', () => closeModal(modalDept)));
    document.querySelectorAll('.closeDetalhesModalBtn').forEach(b => b.addEventListener('click', () => {
        if (commentsUnsubscribe) commentsUnsubscribe();
        closeModal(modalDetalhes);
    }));

    [modalDemanda, modalDept, modalDetalhes].forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) {
                if (m === modalDetalhes && commentsUnsubscribe) commentsUnsubscribe();
                closeModal(m);
            }
        });
    });

    const deptFilterDropdown = document.getElementById('deptFilterDropdown');
    const deptFilterBtn = document.getElementById('deptFilterBtn');
    deptFilterBtn.addEventListener('click', () => deptFilterDropdown.classList.toggle('hidden'));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#deptFilterContainer')) deptFilterDropdown.classList.add('hidden');
    });
}

function openModal(modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function closeModal(modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.openEditModal = (id) => {
    const demand = demands.find(d => d.id === id);
    if (!demand) return;

    currentEditId = id;
    document.getElementById('modalDemandaTitle').textContent = 'Editar Demanda';
    document.getElementById('submitDemandaBtn').innerHTML = '<i class="fas fa-save mr-1"></i> Salvar';

    // Fill form
    document.getElementById('form_titulo').value = demand.titulo || '';
    document.getElementById('form_demanda').value = demand.demanda || '';
    document.getElementById('form_unidade').value = demand.unidade || 'Todas';
    document.getElementById('form_departamento').value = demand.departamentoId || '';
    document.getElementById('form_prioridade').value = demand.priority || 'Média';
    
    // Fill links
    linksContainer.innerHTML = '';
    if (demand.linkRefs && demand.linkRefs.length > 0) {
        demand.linkRefs.forEach(link => {
            const div = document.createElement('div');
            div.className = 'flex gap-2';
            div.innerHTML = `
                <input type="url" name="form_link" value="${link}"
                    class="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm">
                <button type="button" class="bg-red-500/10 text-red-500 p-2.5 rounded-lg hover:bg-red-500/20 transition-colors btnRemoveLink">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            linksContainer.appendChild(div);
        });
    } else {
        linksContainer.innerHTML = `
            <div class="flex gap-2">
                <input type="url" name="form_link"
                    class="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    placeholder="Ex: https://drive.google.com/...">
            </div>
        `;
    }

    // Fill assignee
    selectedAssignees = demand.assignees || [];
    if (demand.assigneeId && selectedAssignees.length === 0) {
        selectedAssignees.push({
            id: demand.assigneeId,
            name: demand.assigneeName || 'Usuário',
            photoUrl: demand.assigneePhotoUrl || null
        });
    }
    renderSelectedAssignees();
    assigneeSearchInput.value = '';

    closeModal(modalDetalhes);
    openModal(modalDemanda);
};

// Start App
init();
