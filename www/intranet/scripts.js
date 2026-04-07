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
    div.className = 'bg-gray-800 rounded-lg p-5 shadow-lg flex flex-col hover:bg-gray-750 transition-colors border border-gray-700 cursor-pointer group relative';

    // Category Badge Color
    let badgeClass = 'bg-gray-600';
    if (script.category === 'Whatsapp') badgeClass = 'bg-green-600';
    if (script.category === 'Telefone') badgeClass = 'bg-blue-600';
    if (script.category === 'Presencial') badgeClass = 'bg-yellow-600';
    if (script.category === 'Email') badgeClass = 'bg-purple-600';

    // Snippet
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = script.content || '';
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const snippet = textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '');

    const dateCreated = script.createdAt ? new Date(script.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desc.';

    div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex flex-col w-full">
                <span class="${badgeClass} text-white text-[10px] font-bold px-2 py-0.5 rounded w-fit mb-3 mt-2">${script.category || 'Geral'}</span>
                <h3 class="text-xl font-bold text-white truncate w-full" title="${script.title}">${script.title}</h3>
            </div>
        </div>
        <div class="text-xs text-gray-500 mb-3 font-mono border-b border-gray-700 pb-2">
            ${script.authorName || 'Autor desconhecido'} • ${dateCreated}
        </div>
        <p class="text-gray-400 text-sm whitespace-pre-wrap flex-grow mb-4 overflow-hidden h-24">${snippet}</p>
        
        <div class="flex justify-end space-x-2 mt-auto pt-2 border-t border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-xs text-blue-400">Ver detalhes</span>
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

    let badgeClass = 'bg-gray-600';
    if (script.category === 'Whatsapp') badgeClass = 'bg-green-600';
    if (script.category === 'Telefone') badgeClass = 'bg-blue-600';
    if (script.category === 'Presencial') badgeClass = 'bg-yellow-600';
    if (script.category === 'Email') badgeClass = 'bg-purple-600';

    viewScriptCategory.textContent = script.category || 'Geral';
    viewScriptCategory.className = `text-white text-xs px-2 py-1 rounded ${badgeClass}`;

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
