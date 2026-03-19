import { db, storage, appId } from './firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { loadComponents } from "./common-ui.js";

const deptsCol = collection(db, 'trello_departments');
const demandsCol = collection(db, 'trello_demands');
const auth = getAuth();

let departments = [];
let demands = [];
let activeFilters = new Set();
let searchQuery = '';
let currentDemandaId = null;
let currentUser = null;
let allUsers = []; // For @ mention autocomplete
let commentsUnsubscribe = null; // Unsubscribe fn for comments listener
let mentionQuery = null; // Current @ mention query string

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

// Load Data
function init() {
    loadComponents(); // Sidebar & Header
    onAuthStateChanged(auth, user => {
        currentUser = user;
    });
    loadUsers();
    setupListeners();
    observeDepartments();
    observeDemands();
}

async function loadUsers() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn('Could not load users for @mentions:', e.message);
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
        // Build Selection Card
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

    document.querySelectorAll('.dept-filter-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) activeFilters.add(e.target.value);
            else activeFilters.delete(e.target.value);
            const filterBtn = document.getElementById('deptFilterBtn');
            if (activeFilters.size > 0) filterBtn.classList.add('bg-blue-900', 'border-blue-500');
            else filterBtn.classList.remove('bg-blue-900', 'border-blue-500');
            renderCards();
        });
    });
}

function renderCards() {
    document.getElementById('col-backlog').innerHTML = '';
    document.getElementById('col-todo').innerHTML = '';
    document.getElementById('col-pendente').innerHTML = '';
    document.getElementById('col-concluido').innerHTML = '';

    let counts = { backlog: 0, todo: 0, pendente: 0, concluido: 0 };

    demands.forEach(d => {
        const titleSearch = (d.titulo || d.demanda || '').toLowerCase();
        if (searchQuery && !titleSearch.includes(searchQuery.toLowerCase()) && !d.nome.toLowerCase().includes(searchQuery.toLowerCase())) return;
        if (activeFilters.size > 0 && !activeFilters.has(d.departamentoId)) return;

        const dept = departments.find(dep => dep.id === d.departamentoId);
        const color = dept ? dept.color : '#6b7280';
        const deptName = dept ? dept.name : 'Sem Depto';

        const parsedDate = new Date(d.dataMaxima);
        const formattedDate = !isNaN(parsedDate) ? parsedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        const isOverdue = parsedDate < new Date() && d.status !== 'concluido';

        const finalidadesHtml = Array.isArray(d.finalidade) ? d.finalidade.map(f => `<span class="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">${f}</span>`).join(' ') : '';
        const hasAttachment = d.anexoUrl || d.linkRef;
        const attachBadge = hasAttachment ? `<span class="text-gray-500 text-[10px]"><i class="fas fa-paperclip"></i></span>` : '';

        const cardHTML = `
            <div class="bg-gray-800 border-l-4 rounded shadow p-3 cursor-pointer hover:bg-gray-750 transition-colors card"
                draggable="true" data-id="${d.id}" style="border-left-color: ${color};"
                ondragstart="dragStart(event)" ondragend="dragEnd(event)"
                onclick="window.openDemandaDetalhes('${d.id}')">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] bg-gray-900 text-gray-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold" style="color: ${color}; border: 1px solid ${color}40">${deptName}</span>
                    ${attachBadge}
                </div>
                <div class="text-sm font-semibold text-white mb-1 line-clamp-2" title="${d.titulo || d.demanda}">${d.titulo || d.demanda}</div>
                <div class="text-xs text-gray-400 mb-2 truncate"><i class="fas fa-user mr-1"></i>${d.nome} - ${d.unidade}</div>
                <div class="flex flex-wrap gap-1 mb-3">${finalidadesHtml}</div>
                <div class="mt-auto pt-2 border-t border-gray-700 flex justify-between items-center text-[10px] text-gray-400">
                    <div class="flex items-center gap-1 ${isOverdue ? 'text-red-400 font-bold' : ''}">
                        <i class="far fa-calendar-alt"></i> ${formattedDate}
                    </div>
                </div>
            </div>
        `;

        const targetColumn = document.getElementById(`col-${d.status}`) || document.getElementById('col-todo');
        targetColumn.insertAdjacentHTML('beforeend', cardHTML);
        if (counts[d.status] !== undefined) counts[d.status]++;
    });

    document.querySelector('.kanban-column[data-column="backlog"] .count').textContent = counts.backlog;
    document.querySelector('.kanban-column[data-column="todo"] .count').textContent = counts.todo;
    document.querySelector('.kanban-column[data-column="pendente"] .count').textContent = counts.pendente;
    document.querySelector('.kanban-column[data-column="concluido"] .count').textContent = counts.concluido;
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
    const linkRef = document.getElementById('form_link').value || null;
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

    try {
        let anexoUrl = null;
        let anexoNome = null;

        if (file) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando arquivo...';
            const fileRef = storageRef(storage, `trello_demands/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            anexoUrl = await getDownloadURL(fileRef);
            anexoNome = file.name;
        }

        const newDoc = {
            email, nome, unidade, departamentoId, titulo,
            demanda: demandaText, finalidade: finalidades,
            dataMaxima, status: 'todo',
            linkRef,
            anexoUrl,
            anexoNome,
            createdAt: serverTimestamp()
        };

        await addDoc(demandsCol, newDoc);

        formDemanda.reset();
        document.getElementById('finalidade_outro').disabled = true;
        closeModal(modalDemanda);

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

    const hasLink = demand.linkRef;
    const hasAnexo = demand.anexoUrl;

    if (hasLink || hasAnexo) {
        extrasSection.classList.remove('hidden');
        if (hasLink) {
            linkContainer.classList.remove('hidden');
            const linkEl = document.getElementById('detalhe_link');
            linkEl.href = demand.linkRef;
            document.getElementById('detalhe_link_text').textContent = demand.linkRef;
        } else {
            linkContainer.classList.add('hidden');
        }
        if (hasAnexo) {
            anexoContainer.classList.remove('hidden');
            document.getElementById('detalhe_anexo').href = demand.anexoUrl;
            document.getElementById('detalhe_anexo_nome').textContent = demand.anexoNome || 'Ver Anexo';
            const isPdf = demand.anexoNome && demand.anexoNome.toLowerCase().endsWith('.pdf');
            document.getElementById('detalhe_anexo_icon').className = `fas ${isPdf ? 'fa-file-pdf text-red-400' : 'fa-image text-green-400'} shrink-0`;
        } else {
            anexoContainer.classList.add('hidden');
        }
    } else {
        extrasSection.classList.add('hidden');
    }

    // Reset comment input
    document.getElementById('commentInput').value = '';

    // Load comments in realtime
    loadComments(id);

    openModal(modalDetalhes);
};

function loadComments(demandId) {
    if (commentsUnsubscribe) commentsUnsubscribe(); // Unsubscribe previous listener

    const commentsCol = collection(db, `trello_demands/${demandId}/comments`);
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
            // Highlight @mentions in blue
            const formattedText = (c.text || '').replace(/(@\S+)/g, '<span class="text-blue-400 font-semibold">$1</span>');

            const el = document.createElement('div');
            el.className = 'flex gap-2.5';
            el.innerHTML = `
                <div class="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">${initial}</div>
                <div class="flex-1">
                    <div class="flex items-baseline gap-2">
                        <span class="text-sm font-semibold text-gray-200">${c.authorName || 'Usuário'}</span>
                        <span class="text-[10px] text-gray-500">${time}</span>
                    </div>
                    <div class="text-sm text-gray-300 mt-0.5 bg-gray-800/60 p-2 rounded-lg">${formattedText}</div>
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
    if (!text || !currentDemandaId) return;

    const authorName = currentUser?.displayName || currentUser?.email || 'Usuário';

    try {
        const commentsCol = collection(db, `trello_demands/${currentDemandaId}/comments`);
        await addDoc(commentsCol, {
            text,
            authorId: currentUser?.uid || null,
            authorName,
            createdAt: serverTimestamp()
        });
        input.value = '';
        document.getElementById('mentionDropdown').classList.add('hidden');
    } catch (err) {
        alert('Erro ao enviar comentário: ' + err.message);
        console.error(err);
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
    deptSelectionContainer.classList.add('hidden');
    kanbanWrapper.classList.remove('hidden');
    kanbanTitle.textContent = `Demandas - ${dept.name}`;
    
    // Set the filter
    activeFilters.clear();
    activeFilters.add(dept.id);
    
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

    btnNovaDemanda.addEventListener('click', () => openModal(modalDemanda));
    btnManageDept.addEventListener('click', () => openModal(modalDept));
    if (btnManageDeptInSelection) btnManageDeptInSelection.addEventListener('click', () => openModal(modalDept));
    if (btnVoltarDepts) btnVoltarDepts.addEventListener('click', leaveDepartment);

    document.querySelectorAll('.closeModalBtn').forEach(b => b.addEventListener('click', () => closeModal(modalDemanda)));
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

// Start App
init();
