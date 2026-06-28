import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthReady } from './auth.js';

// DOM Elements
const scriptsList = document.getElementById('scripts-list');
const addScriptBtn = document.getElementById('add-script-btn');
const scriptModal = document.getElementById('script-modal');
const closeScriptModalBtn = document.getElementById('close-script-modal');
const cancelScriptBtn = document.getElementById('cancel-script-btn');
const deleteScriptBtn = document.getElementById('delete-script-btn');
const scriptForm = document.getElementById('script-form');
const scriptIdInput = document.getElementById('script-id');
const scriptTitleInput = document.getElementById('script-title');
const scriptCategoryInput = document.getElementById('script-category');
const modalTitle = document.getElementById('modal-title');
const searchInput = document.getElementById('search-input');

// View Modal Elements
const viewModal = document.getElementById('view-modal');
const closeViewModalBtn = document.getElementById('close-view-modal');
const viewScriptTitle = document.getElementById('view-script-title');
const viewScriptCategory = document.getElementById('view-script-category');
const viewScriptMeta = document.getElementById('view-script-meta');
const viewScriptContent = document.getElementById('view-script-content');
const editScriptBtnView = document.getElementById('edit-script-btn-view');

let currentUser = null;
let quill; // Quill instance
let allScripts = []; // Store scripts for searching local

// Initialization
onAuthReady(async (user) => {
    if (!user) return;

    // Initialize Quill
    if (document.getElementById('editor-container')) {
        quill = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                ]
            }
        });
    }

    // Check permissions ? Assuming all intranet users can see/add scripts. 
    // You might want to restrict editing to Admin/Instruction if needed, but for now open to auth users.

    currentUser = user;

    loadScripts();
    setupEventListeners();
});

function setupEventListeners() {
    addScriptBtn.addEventListener('click', openNewScriptModal);
    closeScriptModalBtn.addEventListener('click', closeModal);
    cancelScriptBtn.addEventListener('click', closeModal);
    scriptForm.addEventListener('submit', handleFormSubmit);

    // Search Listener
    searchInput.addEventListener('input', handleSearch);

    // Modal Delete Button
    deleteScriptBtn.addEventListener('click', () => {
        const id = scriptIdInput.value;
        if (id) deleteScript(id);
    });

    // View Modal Listeners
    closeViewModalBtn.addEventListener('click', closeViewModal);
    editScriptBtnView.addEventListener('click', () => {
        const id = editScriptBtnView.dataset.id;
        if (id) {
            closeViewModal();
            openEditScriptModal(id);
        }
    });
}

// --- Scripts CRUD ---

async function loadScripts() {
    scriptsList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin text-2xl"></i> Carregando scripts...</div>';

    try {
        const q = query(
            collection(db, "scripts"),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);

        allScripts = [];
        querySnapshot.forEach((doc) => {
            allScripts.push({ id: doc.id, ...doc.data() });
        });

        renderScripts(allScripts);

    } catch (error) {
        console.error("Erro ao carregar scripts:", error);
        scriptsList.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">Erro ao carregar scripts.</div>';
    }
}

function renderScripts(scripts) {
    scriptsList.innerHTML = '';

    if (scripts.length === 0) {
        scriptsList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">Nenhum script encontrado.</div>';
        return;
    }

    scripts.forEach(script => {
        const scriptEl = createScriptCard(script);
        scriptsList.appendChild(scriptEl);
    });
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase();

    if (!term) {
        renderScripts(allScripts);
        return;
    }

    const filtered = allScripts.filter(script => {
        const title = (script.title || '').toLowerCase();
        // Plain text content for searching
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = script.content || '';
        const contentText = (tempDiv.textContent || tempDiv.innerText || '').toLowerCase();

        return title.includes(term) || contentText.includes(term);
    });

    renderScripts(filtered);
}

function createScriptCard(script) {
    const div = document.createElement('div');
    div.className = 'bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl rounded-2xl p-5 shadow-sm hover:shadow-xl flex flex-col border border-gray-150/80 dark:border-gray-800/50 cursor-pointer group transition-all duration-300 hover:-translate-y-1 relative';

    // Category Badge Color
    let badgeClass = 'bg-gray-50 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400';
    if (script.category === 'Whatsapp') badgeClass = 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200/50 dark:border-green-900/30';
    if (script.category === 'Telefone') badgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30';
    if (script.category === 'Presencial') badgeClass = 'bg-amber-50 text-amber-750 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30';
    if (script.category === 'Email') badgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/30';

    // Snippet
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = script.content || '';
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const snippet = textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '');

    const dateCreated = script.createdAt ? new Date(script.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desc.';

    div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex flex-col w-full">
                <span class="${badgeClass} text-[10px] font-bold px-2 py-0.5 rounded w-fit mb-3 mt-2">${script.category || 'Geral'}</span>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white truncate w-full" title="${script.title}">${script.title}</h3>
            </div>
        </div>
        <div class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-3 border-b border-gray-100 dark:border-gray-800/80 pb-2 flex items-center gap-1.5">
            <i class="far fa-user text-[10px]"></i> ${script.authorName || 'Autor desconhecido'} 
            <span class="text-gray-300 dark:text-gray-700">•</span>
            <i class="far fa-calendar text-[10px]"></i> ${dateCreated}
        </div>
        <p class="text-gray-600 dark:text-gray-350 text-sm whitespace-pre-wrap flex-grow mb-4 overflow-hidden h-24 line-clamp-4 leading-relaxed">${snippet}</p>
        
        <div class="flex justify-end mt-auto pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] font-bold text-blue-500 dark:text-blue-400 group-hover:translate-x-1 transition-transform w-fit ml-auto">
            <span>Acessar Roteiro <i class="fas fa-arrow-right text-[10px] ml-1"></i></span>
        </div>
    `;

    // Click on card opens View Modal
    div.addEventListener('click', () => openViewModal(script));

    return div;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = scriptIdInput.value;
    const title = scriptTitleInput.value;
    const category = scriptCategoryInput.value;
    const content = quill.root.innerHTML;

    const scriptData = {
        title,
        category,
        content,
        updatedAt: serverTimestamp()
    };

    const submitBtn = document.getElementById('save-script-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        if (id) {
            // Update
            await updateDoc(doc(db, "scripts", id), scriptData);
        } else {
            // Create
            scriptData.createdAt = serverTimestamp();
            scriptData.createdBy = currentUser.id || currentUser.uid;
            scriptData.authorName = currentUser.name || currentUser.email;
            await addDoc(collection(db, "scripts"), scriptData);
        }

        closeModal();
        loadScripts();
    } catch (error) {
        console.error("Erro ao salvar script:", error);
        alert("Erro ao salvar script: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

async function deleteScript(id) {
    if (!confirm("Tem certeza que deseja excluir este script?")) return;

    try {
        await deleteDoc(doc(db, "scripts", id));
        closeModal();
        loadScripts();
    } catch (error) {
        console.error("Erro ao excluir script:", error);
        alert("Erro ao excluir script.");
    }
}

// --- Modals ---

function openNewScriptModal() {
    resetForm();
    modalTitle.textContent = "Novo Script";
    deleteScriptBtn.classList.add('hidden');
    scriptModal.classList.remove('hidden');
}

function openEditScriptModal(id) {
    // Find script in local array to avoid extra fetch if possible, 
    // but better fetch fresh to ensure no conflicts?
    // Let's use local first for speed
    const script = allScripts.find(s => s.id === id);
    if (!script) return; // Should not happen

    scriptIdInput.value = script.id;
    scriptTitleInput.value = script.title;
    scriptCategoryInput.value = script.category || 'Whatsapp';
    quill.root.innerHTML = script.content || '';

    modalTitle.textContent = "Editar Script";
    deleteScriptBtn.classList.remove('hidden');
    scriptModal.classList.remove('hidden');
}

function openViewModal(script) {
    const dateCreated = script.createdAt ? new Date(script.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desc.';

    viewScriptTitle.textContent = script.title;
    viewScriptContent.innerHTML = script.content; // Render HTML

    let badgeClass = 'bg-gray-50 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400';
    if (script.category === 'Whatsapp') badgeClass = 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200/50 dark:border-green-900/30';
    if (script.category === 'Telefone') badgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30';
    if (script.category === 'Presencial') badgeClass = 'bg-amber-50 text-amber-750 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30';
    if (script.category === 'Email') badgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/30';

    viewScriptCategory.textContent = script.category || 'Geral';
    viewScriptCategory.className = `text-xs font-bold px-2.5 py-1 rounded ${badgeClass}`;

    viewScriptMeta.textContent = `${script.authorName || 'Desconhecido'} • ${dateCreated}`;

    // Store ID for edit button
    editScriptBtnView.dataset.id = script.id;

    viewModal.classList.remove('hidden');
}

function closeViewModal() {
    viewModal.classList.add('hidden');
}

function closeModal() {
    scriptModal.classList.add('hidden');
    resetForm();
}

function resetForm() {
    scriptForm.reset();
    scriptIdInput.value = '';
    if (quill) quill.root.innerHTML = '';
}
