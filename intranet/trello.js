import { db, appId } from './firebase-config.js';
import { collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents } from "./common-ui.js";

const deptsCol = collection(db, 'trello_departments');
const demandsCol = collection(db, 'trello_demands');

let departments = [];
let demands = [];
let activeFilters = new Set();
let searchQuery = '';
let currentDemandaId = null;

// DOM Elements
const kanbanBoard = document.getElementById('kanban-board');
const btnNovaDemanda = document.getElementById('btnNovaDemanda');
const btnManageDept = document.getElementById('btnManageDept');
const modalDemanda = document.getElementById('novaDemandaModal');
const modalDept = document.getElementById('deptModal');
const modalDetalhes = document.getElementById('demandaDetalhesModal');
const formDemanda = document.getElementById('demandaForm');
const formCreateDept = document.getElementById('createDeptForm');

const deptSelect = document.getElementById('form_departamento');
const deptList = document.getElementById('deptList');
const deptCheckboxes = document.getElementById('deptCheckboxes');

const searchInput = document.getElementById('searchInput');

// Load Data
function init() {
    loadComponents(); // Sidebar & Header
    setupListeners();
    observeDepartments();
    observeDemands();
}

function observeDepartments() {
    onSnapshot(deptsCol, (snapshot) => {
        departments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDepartments();
        renderDepartmentFilters();
        renderCards(); // Re-render cards to show updated colors
    });
}

function observeDemands() {
    onSnapshot(query(demandsCol, orderBy('createdAt', 'desc')), (snapshot) => {
        demands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCards();
    });
}

// Rendering
function renderDepartments() {
    // Populate Select
    deptSelect.innerHTML = '<option value="">Escolher Departamento</option>';

    // Populate List
    deptList.innerHTML = '';
    if (departments.length === 0) {
        deptList.innerHTML = '<li class="text-sm text-gray-500">Nenhum departamento cadastrado.</li>';
    }

    departments.forEach(dept => {
        // Select option
        const opt = document.createElement('option');
        opt.value = dept.id;
        opt.textContent = dept.name;
        deptSelect.appendChild(opt);

        // List item
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-gray-700/50 p-2 rounded border border-gray-600';
        li.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full" style="background-color: ${dept.color}"></div>
                <span class="text-sm text-gray-200 font-medium">${dept.name}</span>
            </div>
            <button class="delete-dept text-red-400 hover:text-red-300 transition-colors" data-id="${dept.id}"><i class="fas fa-trash"></i></button>
        `;
        deptList.appendChild(li);
    });

    // delete dept listeners
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

    // Add listener
    document.querySelectorAll('.dept-filter-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) activeFilters.add(e.target.value);
            else activeFilters.delete(e.target.value);

            // Adjust filter btn style
            const filterBtn = document.getElementById('deptFilterBtn');
            if (activeFilters.size > 0) filterBtn.classList.add('bg-blue-900', 'border-blue-500');
            else filterBtn.classList.remove('bg-blue-900', 'border-blue-500');

            renderCards();
        });
    });
}

function renderCards() {
    // Clear columns
    document.getElementById('col-backlog').innerHTML = '';
    document.getElementById('col-todo').innerHTML = '';
    document.getElementById('col-pendente').innerHTML = '';
    document.getElementById('col-concluido').innerHTML = '';

    let counts = { backlog: 0, todo: 0, pendente: 0, concluido: 0 };

    demands.forEach(d => {
        // Filter by text
        if (searchQuery && !d.demanda.toLowerCase().includes(searchQuery.toLowerCase()) && !d.nome.toLowerCase().includes(searchQuery.toLowerCase())) return;

        // Filter by dept
        if (activeFilters.size > 0 && !activeFilters.has(d.departamentoId)) return;

        const dept = departments.find(dep => dep.id === d.departamentoId);
        const color = dept ? dept.color : '#6b7280';
        const deptName = dept ? dept.name : 'Sem Depto';

        const parsedDate = new Date(d.dataMaxima);
        const formattedDate = !isNaN(parsedDate) ? parsedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

        const finalidadesHtml = Array.isArray(d.finalidade) ? d.finalidade.map(f => `<span class="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">${f}</span>`).join(' ') : '';


        const cardHTML = `
            <div class="bg-gray-800 border-l-4 rounded shadow p-3 cursor-grab hover:bg-gray-750 transition-colors card" 
                draggable="true" data-id="${d.id}" style="border-left-color: ${color};" 
                ondragstart="dragStart(event)" ondragend="dragEnd(event)" 
                onclick="window.openDemandaDetalhes('${d.id}')">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] bg-gray-900 text-gray-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold" style="color: ${color}; border: 1px solid ${color}40">${deptName}</span>
                </div>
                <div class="text-sm font-semibold text-white mb-1 line-clamp-2" title="${d.demanda}">${d.demanda}</div>
                <div class="text-xs text-gray-400 mb-2 truncate"><i class="fas fa-user mr-1"></i>${d.nome} - ${d.unidade}</div>
                <div class="flex flex-wrap gap-1 mb-3">${finalidadesHtml}</div>
                
                <div class="mt-auto pt-2 border-t border-gray-700 flex justify-between items-center text-[10px] text-gray-400">
                    <div class="flex items-center gap-1 ${parsedDate < new Date() && d.status !== 'concluido' ? 'text-red-400 font-bold' : ''}">
                        <i class="far fa-calendar-alt"></i> ${formattedDate}
                    </div>
                </div>
            </div>
        `;

        const targetColumn = document.getElementById(`col-${d.status}`) || document.getElementById('col-todo');
        targetColumn.insertAdjacentHTML('beforeend', cardHTML);
        if (counts[d.status] !== undefined) counts[d.status]++;
    });

    // Update counts
    document.querySelector('.kanban-column[data-column="backlog"] .count').textContent = counts.backlog;
    document.querySelector('.kanban-column[data-column="todo"] .count').textContent = counts.todo;
    document.querySelector('.kanban-column[data-column="pendente"] .count').textContent = counts.pendente;
    document.querySelector('.kanban-column[data-column="concluido"] .count').textContent = counts.concluido;
}


// Drag and Drop
window.dragStart = (e) => {
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
    // slightly delay so drag ghost looks correct
    setTimeout(() => e.target.style.opacity = '0.5', 0);
};

window.dragEnd = (e) => {
    e.target.classList.remove('dragging');
    e.target.style.opacity = '1';
    document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
};

const columns = document.querySelectorAll('.kanban-column');
columns.forEach(col => {
    col.addEventListener('dragover', e => {
        e.preventDefault();
        col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', e => {
        col.classList.remove('drag-over');
    });

    col.addEventListener('drop', async e => {
        e.preventDefault();
        col.classList.remove('drag-over');

        const cardId = e.dataTransfer.getData('text/plain');
        const newStatus = col.dataset.column;
        const demand = demands.find(d => d.id === cardId);

        if (demand && demand.status !== newStatus) {
            // Optimistic UI update
            demand.status = newStatus;
            renderCards();

            // update in fb
            try {
                await updateDoc(doc(demandsCol, cardId), { status: newStatus });
            } catch (err) {
                console.error("error updating status", err);
                // revert
                observeDemands();
            }
        }
    });
});


// Add Demand and Delete Demand
document.getElementById('submitDemandaBtn').addEventListener('click', async () => {
    if (!formDemanda.checkValidity()) {
        formDemanda.reportValidity();
        return;
    }

    const email = document.getElementById('form_email').value;
    const nome = document.getElementById('form_nome').value;
    const unidade = document.getElementById('form_unidade').value;
    const departamentoId = document.getElementById('form_departamento').value;
    const demandaText = document.getElementById('form_demanda').value;
    const dataMaxima = document.getElementById('form_data_maxima').value;

    const finalidades = [];
    document.querySelectorAll('input[name="finalidade"]:checked').forEach(cb => {
        if (cb.value === 'Outro') {
            const outroVal = document.getElementById('finalidade_outro').value;
            if (outroVal) finalidades.push(outroVal);
        } else {
            finalidades.push(cb.value);
        }
    });

    const newDoc = {
        email,
        nome,
        unidade,
        departamentoId,
        demanda: demandaText,
        finalidade: finalidades,
        dataMaxima,
        status: 'todo', // Default
        createdAt: serverTimestamp()
    };

    try {
        const btn = document.getElementById('submitDemandaBtn');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        btn.disabled = true;

        await addDoc(demandsCol, newDoc);

        formDemanda.reset();
        document.getElementById('finalidade_outro').disabled = true;
        closeModal(modalDemanda);
        alert('Demanda criada com sucesso!');

    } catch (err) {
        console.error("Error creating demand", err);
        alert('Erro ao criar demanda: ' + err.message);
    } finally {
        const btn = document.getElementById('submitDemandaBtn');
        btn.innerHTML = 'Enviar';
        btn.disabled = false;
    }

});

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

    document.getElementById('detalhe_nome').textContent = demand.nome;
    document.getElementById('detalhe_unidade').textContent = demand.unidade;
    document.getElementById('detalhe_email').textContent = demand.email;
    document.getElementById('detalhe_data').textContent = formattedDate;
    document.getElementById('detalhe_texto').textContent = demand.demanda;

    const finalidadesContainer = document.getElementById('detalhe_finalidades');
    if (Array.isArray(demand.finalidade) && demand.finalidade.length > 0) {
        finalidadesContainer.innerHTML = demand.finalidade.map(f => `<span class="bg-gray-700 text-gray-300 text-[10px] px-2 py-1 rounded tracking-wide uppercase">${f}</span>`).join('');
    } else {
        finalidadesContainer.innerHTML = '<span class="text-gray-500 italic text-sm">Nenhuma finalidade especificada.</span>';
    }

    openModal(modalDetalhes);
}

document.getElementById('btnExcluirDemanda').addEventListener('click', async () => {
    if (!currentDemandaId) return;
    if (confirm('Tem certeza que deseja apagar permanentemente esta demanda?')) {
        try {
            await deleteDoc(doc(demandsCol, currentDemandaId));
            closeModal(modalDetalhes);
        } catch (err) {
            alert('Erro ao excluir demanda.');
            console.error(err);
        }
    }
});


// Create Dept
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


// UI Interactions
function setupListeners() {
    // Other checkbox logic
    document.getElementById('check_outro').addEventListener('change', e => {
        const i = document.getElementById('finalidade_outro');
        i.disabled = !e.target.checked;
        if (e.target.checked) i.focus();
    });

    // Search
    searchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        renderCards();
    });

    // Modals
    btnNovaDemanda.addEventListener('click', () => openModal(modalDemanda));
    btnManageDept.addEventListener('click', () => openModal(modalDept));

    document.querySelectorAll('.closeModalBtn').forEach(b => b.addEventListener('click', () => closeModal(modalDemanda)));
    document.querySelectorAll('.closeDeptModalBtn').forEach(b => b.addEventListener('click', () => closeModal(modalDept)));
    document.querySelectorAll('.closeDetalhesModalBtn').forEach(b => b.addEventListener('click', () => closeModal(modalDetalhes)));

    [modalDemanda, modalDept, modalDetalhes].forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) closeModal(m);
        });
    });

    // Dept filter dropdown toggle
    const deptFilterDropdown = document.getElementById('deptFilterDropdown');
    const deptFilterBtn = document.getElementById('deptFilterBtn');
    deptFilterBtn.addEventListener('click', () => {
        deptFilterDropdown.classList.toggle('hidden');
    });

    // Close dept filter when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#deptFilterContainer')) {
            deptFilterDropdown.classList.add('hidden');
        }
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


// Start App
init();
