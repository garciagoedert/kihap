import { db, storage } from './firebase-config.js';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { onAuthReady } from './auth.js';

// DOM Elements
const plansList = document.getElementById('plans-list');
const addPlanBtn = document.getElementById('add-plan-btn');
const planModal = document.getElementById('plan-modal');
const closePlanModalBtn = document.getElementById('close-plan-modal');
const cancelPlanBtn = document.getElementById('cancel-plan-btn');
const deletePlanBtn = document.getElementById('delete-plan-btn');
const planForm = document.getElementById('plan-form');
const planIdInput = document.getElementById('plan-id');
const planTitleInput = document.getElementById('plan-title');
const mediaUploadInput = document.getElementById('media-upload');
const mediaListContainer = document.getElementById('media-list');
const uploadStatus = document.getElementById('upload-status');
const modalTitle = document.getElementById('modal-title');
const youtubeLinkInput = document.getElementById('youtube-link');
const addYoutubeBtn = document.getElementById('add-youtube-btn');
const planCategoryInput = document.getElementById('plan-category');
const planAgeGroupInput = document.getElementById('plan-age-group');

// New Layout Elements
const layoutSimpleBtn = document.getElementById('layout-simple-btn');
const layoutGridBtn = document.getElementById('layout-grid-btn');
const planLayoutInput = document.getElementById('plan-layout');
const loadPresetLittlesBtn = document.getElementById('load-preset-littles-btn');
const loadPresetAdultsBtn = document.getElementById('load-preset-adults-btn');
const simpleEditorView = document.getElementById('simple-editor-view');
const gridEditorView = document.getElementById('grid-editor-view');
const simpleBlocksList = document.getElementById('simple-blocks-list');
const gridBlocksList = document.getElementById('grid-blocks-list');
const addBlockSimpleBtn = document.getElementById('add-block-simple-btn');
const addBlockGridBtn = document.getElementById('add-block-grid-btn');

// View Modal Elements
const viewModal = document.getElementById('view-modal');
const closeViewModalBtn = document.getElementById('close-view-modal');
const viewPlanTitle = document.getElementById('view-plan-title');
const viewPlanCategory = document.getElementById('view-plan-category');
const viewPlanMeta = document.getElementById('view-plan-meta');
const viewPlanBody = document.getElementById('view-plan-body');
const viewMediaList = document.getElementById('view-media-list');
const editPlanBtnView = document.getElementById('edit-plan-btn-view');
const printPlanBtn = document.getElementById('print-plan-btn');

// Weeks Inputs
const week1DatesInput = document.getElementById('week-1-dates');
const week2DatesInput = document.getElementById('week-2-dates');
const week3DatesInput = document.getElementById('week-3-dates');
const week4DatesInput = document.getElementById('week-4-dates');

let currentMediaFiles = []; // Array to store { name, url, type, path }
let currentUser = null;
let allLoadedPlans = [];

// Presets Constants
const presetLittles = [
    { title: "AQUECIMENTO", content: "" },
    { title: "BÁSICOS", content: "" },
    { title: "DESAFIO COM OS RESPONSÁVEIS", content: "" },
    { title: "VALOR DA SEMANA", content: "" },
    { title: "QUEBRAMENTO DE MADEIRA", content: "" },
    { title: "AVISOS DA SEMANA", content: "" }
];

const presetAdultos = [
    { title: "AQUECIMENTO MOBILIDADE 5'", style: "normal", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "DISCIPLINA", style: "normal", unified: true, contents: { w1: "" } },
    { title: "CHUTES 5' (aquecimento)", style: "highlight", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "VARIAÇÕES CHUTES BÁSICOS 10'", style: "normal", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "DESAFIO FÍSICO 10'", style: "highlight", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "DISCIPLINA", style: "normal", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "COMBINAÇÃO SPARRING 5'", style: "normal", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "SPARRING COM ÊNFASE EM... 15'", style: "highlight", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "QUEBRAMENTO 5'", style: "normal", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } },
    { title: "REVISÃO E SPOILER", style: "highlight", unified: false, contents: { w1: "", w2: "", w3: "", w4: "" } }
];

// Section switcher helper
function showSection(sectionName, updateUrl = true, planId = null, action = null) {
    const catalogSection = document.getElementById('plans-catalog-section');
    const viewSection = document.getElementById('plan-view-section');
    const editSection = document.getElementById('plan-edit-section');

    if (catalogSection) catalogSection.classList.add('hidden');
    if (viewSection) viewSection.classList.add('hidden');
    if (editSection) editSection.classList.add('hidden');

    if (sectionName === 'catalog') {
        if (catalogSection) catalogSection.classList.remove('hidden');
        if (updateUrl) {
            history.pushState({ view: 'catalog' }, '', 'planificador.html');
        }
    } else if (sectionName === 'view') {
        if (viewSection) viewSection.classList.remove('hidden');
        if (updateUrl && planId) {
            history.pushState({ view: 'view', planId }, '', `planificador.html?id=${planId}`);
        }
    } else if (sectionName === 'edit') {
        if (editSection) editSection.classList.remove('hidden');
        if (updateUrl) {
            const url = planId ? `planificador.html?id=${planId}&action=edit` : `planificador.html?action=new`;
            history.pushState({ view: 'edit', planId, action }, '', url);
        }
    }

    const mainContainer = document.querySelector('main .overflow-y-auto') || window;
    if (mainContainer.scrollTo) mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialization
onAuthReady(async (user) => {
    if (!user) return; // Auth redirects handled in auth.js

    currentUser = user;

    const canEditPlan = user.isAdmin === true || user.isColarinhoPreto === true || user.isBlackCollar === true || user.colarinhoPreto === true;
    if (!canEditPlan && addPlanBtn) {
        addPlanBtn.classList.add('hidden');
    }

    await loadPlans();
    setupEventListeners();

    // Check URL params on initial load
    const urlParams = new URLSearchParams(window.location.search);
    const initialPlanId = urlParams.get('id');
    const initialAction = urlParams.get('action');

    if (initialPlanId && initialAction === 'edit') {
        openEditPlanModal(initialPlanId, false);
    } else if (initialPlanId) {
        openViewModal(initialPlanId, false);
    } else if (initialAction === 'new') {
        openNewPlanModal(false);
    } else {
        showSection('catalog', false);
    }
});

window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('id');
    const action = urlParams.get('action');

    if (planId && action === 'edit') {
        openEditPlanModal(planId, false);
    } else if (planId) {
        openViewModal(planId, false);
    } else if (action === 'new') {
        openNewPlanModal(false);
    } else {
        showSection('catalog', false);
    }
});

function setupEventListeners() {
    addPlanBtn.addEventListener('click', () => openNewPlanModal(true));
    cancelPlanBtn.addEventListener('click', closeModal);
    planForm.addEventListener('submit', handleFormSubmit);
    mediaUploadInput.addEventListener('change', handleFileUpload);
    if (addYoutubeBtn) addYoutubeBtn.addEventListener('click', handleYouTubeAdd);
    if (youtubeLinkInput) {
        youtubeLinkInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleYouTubeAdd();
            }
        });
    }

    // Back to catalog buttons
    const backBtnView = document.getElementById('back-to-catalog-btn-view');
    if (backBtnView) backBtnView.addEventListener('click', () => showSection('catalog'));

    const backBtnEdit = document.getElementById('back-to-catalog-btn-edit');
    if (backBtnEdit) backBtnEdit.addEventListener('click', () => showSection('catalog'));

    // Layout Toggle Events
    layoutSimpleBtn.addEventListener('click', () => setFormLayout('simple'));
    layoutGridBtn.addEventListener('click', () => setFormLayout('grid'));

    // Preset Load Events
    loadPresetLittlesBtn.addEventListener('click', loadLittlesPreset);
    loadPresetAdultsBtn.addEventListener('click', loadAdultsPreset);

    // Add Block Events
    addBlockSimpleBtn.addEventListener('click', () => addSimpleBlockDOM());
    addBlockGridBtn.addEventListener('click', () => addGridRowDOM());

    // Modal Delete Button
    deletePlanBtn.addEventListener('click', () => {
        const id = planIdInput.value;
        if (id) deletePlan(id);
    });

    // Print Button
    printPlanBtn.addEventListener('click', () => window.print());

    // View Modal Listeners
    if (closeViewModalBtn) closeViewModalBtn.addEventListener('click', closeViewModal);
    editPlanBtnView.addEventListener('click', () => {
        const id = editPlanBtnView.dataset.id;
        if (id) {
            openEditPlanModal(id, true);
        }
    });

    // Search and Filter Listeners
    const searchInput = document.getElementById('searchPlansInput');
    const filterAgeGroup = document.getElementById('filterAgeGroup');
    const filterCategory = document.getElementById('filterCategory');
    const filterLayout = document.getElementById('filterLayout');

    if (searchInput) searchInput.addEventListener('input', filterAndRenderPlans);
    if (filterAgeGroup) filterAgeGroup.addEventListener('change', filterAndRenderPlans);
    if (filterCategory) filterCategory.addEventListener('change', filterAndRenderPlans);
    if (filterLayout) filterLayout.addEventListener('change', filterAndRenderPlans);
}

// Layout Switch Handler
function setFormLayout(layout) {
    planLayoutInput.value = layout;
    if (layout === 'simple') {
        layoutSimpleBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm flex items-center justify-center gap-1.5";
        layoutGridBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center gap-1.5";
        simpleEditorView.classList.remove('hidden');
        gridEditorView.classList.add('hidden');
    } else {
        layoutGridBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm flex items-center justify-center gap-1.5";
        layoutSimpleBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center gap-1.5";
        gridEditorView.classList.remove('hidden');
        simpleEditorView.classList.add('hidden');
    }
}

// Preset Loader Handlers
function loadLittlesPreset() {
    if (confirm("Carregar o modelo padrão Littles irá limpar a lista de blocos atual. Deseja prosseguir?")) {
        setFormLayout('simple');
        simpleBlocksList.innerHTML = '';
        presetLittles.forEach(block => addSimpleBlockDOM(block));
    }
}

function loadAdultsPreset() {
    if (confirm("Carregar o modelo padrão Adultos irá limpar a lista de blocos atual. Deseja prosseguir?")) {
        setFormLayout('grid');
        gridBlocksList.innerHTML = '';
        presetAdultos.forEach(row => addGridRowDOM(row));
    }
}

// Render dynamic DOM for Simple Blocks (Vertical Layout)
function addSimpleBlockDOM(block = { title: '', content: '' }) {
    const div = document.createElement('div');
    div.className = 'simple-block-item bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/80 flex flex-col gap-2.5';
    
    div.innerHTML = `
        <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 flex-1">
                <span class="text-gray-400 cursor-grab"><i class="fas fa-grip-lines"></i></span>
                <input type="text" placeholder="Título do Bloco (ex: AQUECIMENTO)" class="block-title-input flex-1 bg-white dark:bg-[#111] text-xs text-gray-950 dark:text-white rounded-lg px-2.5 py-1.5 border border-gray-200/80 dark:border-gray-800 font-bold" value="${block.title || ''}">
            </div>
            <div class="flex items-center gap-1">
                <button type="button" class="move-up-btn text-gray-500 hover:text-gray-950 dark:hover:text-white p-1.5" title="Mover para Cima"><i class="fas fa-arrow-up text-xs"></i></button>
                <button type="button" class="move-down-btn text-gray-500 hover:text-gray-950 dark:hover:text-white p-1.5" title="Mover para Baixo"><i class="fas fa-arrow-down text-xs"></i></button>
                <button type="button" class="delete-block-btn text-red-500 hover:text-red-650 p-1.5" title="Excluir Bloco"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>
        </div>
        <textarea placeholder="Conteúdo do bloco..." rows="2" class="block-content-input w-full bg-white dark:bg-[#111] text-xs text-gray-950 dark:text-white rounded-lg px-2.5 py-2 border border-gray-200/80 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-primary">${block.content || ''}</textarea>
    `;

    // Bind DOM event listeners
    div.querySelector('.move-up-btn').addEventListener('click', () => {
        if (div.previousElementSibling) {
            simpleBlocksList.insertBefore(div, div.previousElementSibling);
        }
    });

    div.querySelector('.move-down-btn').addEventListener('click', () => {
        if (div.nextElementSibling) {
            simpleBlocksList.insertBefore(div.nextElementSibling, div);
        }
    });

    div.querySelector('.delete-block-btn').addEventListener('click', () => {
        div.remove();
    });

    simpleBlocksList.appendChild(div);
}

// Render dynamic DOM for Grid Rows (Weekly Layout)
function addGridRowDOM(row = { title: '', style: 'normal', unified: false, contents: { w1: '', w2: '', w3: '', w4: '' } }) {
    const div = document.createElement('div');
    div.className = 'grid-block-item bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/80 flex flex-col gap-3';
    
    div.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/60 dark:border-gray-800/60 pb-2">
            <div class="flex items-center gap-2 flex-1 min-w-[200px]">
                <span class="text-gray-400 cursor-grab"><i class="fas fa-grip-lines"></i></span>
                <input type="text" placeholder="Nome da Linha (ex: CHUTES 5')" class="grid-row-title w-full bg-white dark:bg-[#111] text-xs text-gray-950 dark:text-white rounded-lg px-2.5 py-1.5 border border-gray-200 dark:border-gray-800 font-semibold" value="${row.title || ''}">
            </div>
            <div class="flex items-center gap-3 text-xs">
                <select class="grid-row-style bg-white dark:bg-gray-800 text-[10px] rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">
                    <option value="normal" ${row.style === 'normal' ? 'selected' : ''}>Estilo: Normal</option>
                    <option value="highlight" ${row.style === 'highlight' ? 'selected' : ''}>Estilo: Destaque</option>
                </select>
                <label class="flex items-center gap-1.5 cursor-pointer text-gray-650 dark:text-gray-300 font-semibold select-none">
                    <input type="checkbox" class="grid-row-unified" ${row.unified ? 'checked' : ''}>
                    Unificar Colunas
                </label>
                <div class="flex items-center gap-1">
                    <button type="button" class="grid-move-up text-gray-500 hover:text-gray-950 dark:hover:text-white p-1" title="Subir"><i class="fas fa-arrow-up text-xs"></i></button>
                    <button type="button" class="grid-move-down text-gray-500 hover:text-gray-950 dark:hover:text-white p-1" title="Descer"><i class="fas fa-arrow-down text-xs"></i></button>
                    <button type="button" class="grid-delete text-red-500 hover:text-red-650 p-1" title="Excluir"><i class="fas fa-trash-alt text-xs"></i></button>
                </div>
            </div>
        </div>
        
        <div class="grid-weeks-container grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div class="col-span-1 grid-week-1-col">
                <textarea placeholder="Semana 1..." rows="2" class="grid-cell-w1 w-full bg-white dark:bg-[#111] text-xs text-gray-950 dark:text-white rounded-lg px-2.5 py-2 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-primary">${row.contents?.w1 || ''}</textarea>
            </div>
            <div class="col-span-1 grid-week-2-col">
                <textarea placeholder="Semana 2..." rows="2" class="grid-cell-w2 w-full bg-white dark:bg-[#111] text-xs text-gray-950 dark:text-white rounded-lg px-2.5 py-2 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-primary">${row.contents?.w2 || ''}</textarea>
            </div>
            <div class="col-span-1 grid-week-3-col">
                <textarea placeholder="Semana 3..." rows="2" class="grid-cell-w3 w-full bg-white dark:bg-[#111] text-xs text-gray-950 dark:text-white rounded-lg px-2.5 py-2 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-primary">${row.contents?.w3 || ''}</textarea>
            </div>
            <div class="col-span-1 grid-week-4-col">
                <textarea placeholder="Semana 4..." rows="2" class="grid-cell-w4 w-full bg-white dark:bg-[#111] text-xs text-gray-950 dark:text-white rounded-lg px-2.5 py-2 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-primary">${row.contents?.w4 || ''}</textarea>
            </div>
        </div>
    `;

    // Bind dynamic hide/show columns
    const unifiedCheck = div.querySelector('.grid-row-unified');
    const w1Col = div.querySelector('.grid-week-1-col');
    const w2Col = div.querySelector('.grid-week-2-col');
    const w3Col = div.querySelector('.grid-week-3-col');
    const w4Col = div.querySelector('.grid-week-4-col');
    const w1Text = div.querySelector('.grid-cell-w1');

    function updateUnifiedUI() {
        if (unifiedCheck.checked) {
            w1Col.className = 'col-span-full';
            w1Text.placeholder = 'Conteúdo unificado para todas as semanas da linha...';
            w2Col.classList.add('hidden');
            w3Col.classList.add('hidden');
            w4Col.classList.add('hidden');
        } else {
            w1Col.className = 'col-span-1';
            w1Text.placeholder = 'Semana 1...';
            w2Col.classList.remove('hidden');
            w3Col.classList.remove('hidden');
            w4Col.classList.remove('hidden');
        }
    }

    unifiedCheck.addEventListener('change', updateUnifiedUI);
    updateUnifiedUI();

    // Up, Down, Delete Row Buttons
    div.querySelector('.grid-move-up').addEventListener('click', () => {
        if (div.previousElementSibling) {
            gridBlocksList.insertBefore(div, div.previousElementSibling);
        }
    });

    div.querySelector('.grid-move-down').addEventListener('click', () => {
        if (div.nextElementSibling) {
            gridBlocksList.insertBefore(div.nextElementSibling, div);
        }
    });

    div.querySelector('.grid-delete').addEventListener('click', () => {
        div.remove();
    });

    gridBlocksList.appendChild(div);
}

// Media Add Function
function handleYouTubeAdd() {
    if (!youtubeLinkInput) return;
    const url = youtubeLinkInput.value.trim();
    if (!url) return;

    const videoId = extractYouTubeID(url);
    if (!videoId) {
        alert("Link do YouTube não reconhecido. Por favor, cole um link válido (ex: https://www.youtube.com/watch?v=... ou https://youtu.be/...)");
        return;
    }

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    currentMediaFiles.push({
        name: 'Vídeo do YouTube',
        url: url,
        videoId: videoId,
        type: 'youtube',
        thumbnail: thumbnailUrl
    });

    youtubeLinkInput.value = '';
    renderMediaList();
}

function extractYouTubeID(url) {
    if (!url) return null;
    const trimmed = url.trim();
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = trimmed.match(regExp);
    return match ? match[1] : null;
}

// --- Load & Filter Plans (Grid View) ---
async function loadPlans() {
    plansList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin text-2xl"></i> Carregando planos...</div>';

    try {
        const q = query(
            collection(db, "plans"),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            allLoadedPlans = [];
            filterAndRenderPlans();
            return;
        }

        allLoadedPlans = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        filterAndRenderPlans();
    } catch (error) {
        console.error("Erro ao carregar planos:", error);
        plansList.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">Erro ao carregar planos.</div>';
    }
}

function filterAndRenderPlans() {
    if (!plansList) return;

    const queryTerm = document.getElementById('searchPlansInput')?.value.toLowerCase().trim() || '';
    const selectedAgeGroup = document.getElementById('filterAgeGroup')?.value || '';
    const selectedCategory = document.getElementById('filterCategory')?.value || '';
    const selectedLayout = document.getElementById('filterLayout')?.value || '';

    const filtered = allLoadedPlans.filter(plan => {
        // Auto detect ageGroup from title if missing
        let planAge = plan.ageGroup || '';
        if (!planAge && plan.title) {
            const t = plan.title.toLowerCase();
            if (t.includes('baby littles') || t.includes('baby')) planAge = 'Baby Littles';
            else if (t.includes('littles')) planAge = 'Littles';
            else if (t.includes('kids')) planAge = 'Kids';
            else if (t.includes('adulto') || t.includes('adultos')) planAge = 'Adultos';
        }

        // Age Group filter
        if (selectedAgeGroup && planAge !== selectedAgeGroup) return false;

        // Category filter
        if (selectedCategory && plan.category !== selectedCategory) return false;

        // Layout filter
        if (selectedLayout && plan.layout !== selectedLayout) return false;

        // Search query filter
        if (!queryTerm) return true;

        const title = (plan.title || '').toLowerCase();
        const author = (plan.authorName || '').toLowerCase();
        const content = (plan.content || '').toLowerCase();
        const category = (plan.category || '').toLowerCase();

        // Search inside blocks (simple layout)
        let blocksText = '';
        if (Array.isArray(plan.blocks)) {
            blocksText = plan.blocks.map(b => `${b.title || ''} ${b.content || ''}`).join(' ').toLowerCase();
        }

        // Search inside weeks (grid layout)
        let weeksText = '';
        if (Array.isArray(plan.weeks)) {
            weeksText = plan.weeks.map(w => {
                const rowTitle = w.title || '';
                const contents = w.contents ? Object.values(w.contents).join(' ') : '';
                return `${rowTitle} ${contents}`;
            }).join(' ').toLowerCase();
        }

        return title.includes(queryTerm) ||
            author.includes(queryTerm) ||
            content.includes(queryTerm) ||
            category.includes(queryTerm) ||
            planAge.toLowerCase().includes(queryTerm) ||
            blocksText.includes(queryTerm) ||
            weeksText.includes(queryTerm);
    });

    plansList.innerHTML = '';

    if (filtered.length === 0) {
        if (allLoadedPlans.length === 0) {
            plansList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10 font-medium text-sm">Nenhum plano de aula encontrado.</div>';
        } else {
            plansList.innerHTML = `
                <div class="col-span-full text-center text-gray-500 dark:text-gray-400 py-12 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-150 dark:border-gray-800">
                    <i class="fas fa-search text-3xl mb-3 opacity-30"></i>
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-200">Nenhum resultado encontrado</p>
                    <p class="text-xs text-gray-400 mt-1">Tente buscar por outros termos ou alterar os filtros selecionados.</p>
                </div>
            `;
        }
        return;
    }

    filtered.forEach(plan => {
        const planEl = createPlanCard(plan.id, plan);
        plansList.appendChild(planEl);
    });
}

function createPlanCard(id, plan) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 shadow-sm hover:shadow-md flex flex-col border border-gray-150 dark:border-gray-800/80 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group relative';

    // Category Badge Color - New visual theme
    let badgeClass = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
    if (plan.category === 'A') badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    if (plan.category === 'B') badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    if (plan.category === 'C') badgeClass = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';

    // Detect or read Age Group
    let ageGroup = plan.ageGroup || '';
    if (!ageGroup && plan.title) {
        const t = plan.title.toLowerCase();
        if (t.includes('baby littles') || t.includes('baby')) ageGroup = 'Baby Littles';
        else if (t.includes('littles')) ageGroup = 'Littles';
        else if (t.includes('kids')) ageGroup = 'Kids';
        else if (t.includes('adulto') || t.includes('adultos')) ageGroup = 'Adultos';
    }

    let ageBadgeClass = 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
    if (ageGroup === 'Baby Littles') ageBadgeClass = 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20';
    else if (ageGroup === 'Littles') ageBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    else if (ageGroup === 'Kids') ageBadgeClass = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20';
    else if (ageGroup === 'Adultos') ageBadgeClass = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';

    // Clean snippet preview formatting for cards
    let snippetLines = [];

    if (Array.isArray(plan.blocks) && plan.blocks.length > 0) {
        plan.blocks.forEach(b => {
            const title = (b.title || '').trim();
            const content = (b.content || '').trim();
            if (title && content) {
                snippetLines.push(`${title}: ${content}`);
            } else if (title) {
                snippetLines.push(title);
            } else if (content) {
                snippetLines.push(content);
            }
        });
    } else if (Array.isArray(plan.weeks) && plan.weeks.length > 0) {
        plan.weeks.forEach(w => {
            const rowTitle = (w.title || '').trim();
            const cellTexts = w.contents ? Object.values(w.contents).map(c => (c || '').trim()).filter(Boolean).join(' - ') : '';
            if (rowTitle && cellTexts) {
                snippetLines.push(`${rowTitle}: ${cellTexts}`);
            } else if (rowTitle) {
                snippetLines.push(rowTitle);
            } else if (cellTexts) {
                snippetLines.push(cellTexts);
            }
        });
    }

    if (snippetLines.length === 0 && plan.content) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = (plan.content || '')
            .replace(/<\/(div|p|h[1-6]|li|tr|br)>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n');
        const rawText = tempDiv.textContent || tempDiv.innerText || '';
        snippetLines = rawText
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
    }

    let snippetHtml = '';
    if (snippetLines.length > 0) {
        const displayLines = snippetLines.slice(0, 3);
        snippetHtml = displayLines.map(line => {
            return `<div class="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-1 leading-relaxed flex items-start gap-1.5"><span class="text-amber-500 font-bold shrink-0">•</span><span class="truncate">${line}</span></div>`;
        }).join('');
        if (snippetLines.length > 3) {
            snippetHtml += `<div class="text-[10px] text-gray-400 font-semibold italic pt-1">+ mais ${snippetLines.length - 3} tópico(s)</div>`;
        }
    } else {
        snippetHtml = `<div class="text-xs text-gray-400 italic">Sem conteúdo detalhado registrado.</div>`;
    }

    const dateCreated = plan.createdAt ? new Date(plan.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desc.';

    div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-1.5 flex-wrap">
                <span class="${badgeClass} text-[9px] font-bold px-2 py-0.5 rounded w-fit uppercase">TIPO ${plan.category || 'A'}</span>
                ${ageGroup ? `<span class="${ageBadgeClass} text-[9px] font-bold px-2 py-0.5 rounded w-fit uppercase">${ageGroup}</span>` : ''}
            </div>
            ${plan.media && plan.media.length > 0 ? '<i class="fas fa-paperclip text-gray-400 text-xs mt-1" title="Possui anexos"></i>' : ''}
        </div>
        <h3 class="text-base font-extrabold text-gray-900 dark:text-white truncate mb-1 mt-1" title="${plan.title}">${plan.title}</h3>
        <div class="text-[10px] text-gray-400 mb-3 border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center justify-between">
            <span>${plan.authorName || 'Professor'} • ${dateCreated}</span>
        </div>
        <div class="flex-grow space-y-1 mb-4 overflow-hidden min-h-[4.5rem]">
            ${snippetHtml}
        </div>
        
        <div class="flex justify-end space-x-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800/80 opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-[10px] text-gray-400 font-semibold flex items-center gap-1">Clique para visualizar <i class="fas fa-arrow-right text-[9px]"></i></span>
        </div>
    `;

    // Click on card opens View Modal
    div.addEventListener('click', () => openViewModal(id));

    return div;
}

// --- Submit and Save ---
async function handleFormSubmit(e) {
    e.preventDefault();

    // Auto-process pending YouTube link if user typed/pasted it into input without clicking "Adicionar"
    if (youtubeLinkInput && youtubeLinkInput.value.trim()) {
        handleYouTubeAdd();
    }

    const id = planIdInput.value;
    const title = planTitleInput.value;
    const category = planCategoryInput.value;
    const ageGroup = planAgeGroupInput ? planAgeGroupInput.value : '';
    const layout = planLayoutInput.value;

    let blocks = [];
    let weeks = [];
    let content = '';

    if (layout === 'simple') {
        const blockElements = simpleBlocksList.querySelectorAll('.simple-block-item');
        blockElements.forEach((el, index) => {
            const blockTitle = el.querySelector('.block-title-input').value.trim();
            const blockContent = el.querySelector('.block-content-input').value.trim();
            if (blockTitle || blockContent) {
                blocks.push({
                    id: 'b_' + index + '_' + Date.now(),
                    title: blockTitle,
                    content: blockContent
                });
            }
        });
        
        // Output clean HTML compiled text for older versions fallback
        content = blocks.map(b => `<h3><strong>${b.title}</strong></h3><p>${b.content.replace(/\n/g, '<br>')}</p>`).join('<br>');
    } else {
        // Grid weekly setup
        const week1 = week1DatesInput.value.trim() || 'Semana 1';
        const week2 = week2DatesInput.value.trim() || 'Semana 2';
        const week3 = week3DatesInput.value.trim() || 'Semana 3';
        const week4 = week4DatesInput.value.trim() || 'Semana 4';

        weeks = [
            { id: 'w1', name: 'Semana 1', dates: week1 },
            { id: 'w2', name: 'Semana 2', dates: week2 },
            { id: 'w3', name: 'Semana 3', dates: week3 },
            { id: 'w4', name: 'Semana 4', dates: week4 }
        ];

        const gridElements = gridBlocksList.querySelectorAll('.grid-block-item');
        gridElements.forEach((el, index) => {
            const blockTitle = el.querySelector('.grid-row-title').value.trim();
            const style = el.querySelector('.grid-row-style').value;
            const unified = el.querySelector('.grid-row-unified').checked;
            
            const w1 = el.querySelector('.grid-cell-w1').value.trim();
            const w2 = el.querySelector('.grid-cell-w2').value.trim();
            const w3 = el.querySelector('.grid-cell-w3').value.trim();
            const w4 = el.querySelector('.grid-cell-w4').value.trim();

            if (blockTitle) {
                blocks.push({
                    id: 'row_' + index + '_' + Date.now(),
                    title: blockTitle,
                    style,
                    unified,
                    contents: unified ? { w1 } : { w1, w2, w3, w4 }
                });
            }
        });

        // Output table HTML for fallback rendering
        let html = '<table border="1" cellpadding="5" style="border-collapse:collapse; width:100%;">';
        html += `<tr><th>Bloco</th><th>${week1}</th><th>${week2}</th><th>${week3}</th><th>${week4}</th></tr>`;
        blocks.forEach(b => {
            if (b.unified) {
                html += `<tr><td><strong>${b.title}</strong></td><td colspan="4">${b.contents.w1}</td></tr>`;
            } else {
                html += `<tr><td><strong>${b.title}</strong></td><td>${b.contents.w1 || ''}</td><td>${b.contents.w2 || ''}</td><td>${b.contents.w3 || ''}</td><td>${b.contents.w4 || ''}</td></tr>`;
            }
        });
        html += '</table>';
        content = html;
    }

    const planData = {
        title,
        category,
        ageGroup,
        layout,
        blocks,
        weeks,
        content,
        media: currentMediaFiles,
        updatedAt: serverTimestamp()
    };

    const submitBtn = document.getElementById('save-plan-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> Salvando...';

    try {
        if (id) {
            // Update
            await updateDoc(doc(db, "plans", id), planData);
        } else {
            // Create
            planData.createdAt = serverTimestamp();
            planData.createdBy = currentUser.id || currentUser.uid;
            planData.authorName = currentUser.name || currentUser.email;
            await addDoc(collection(db, "plans"), planData);
        }

        closeModal();
        loadPlans();
    } catch (error) {
        console.error("Erro ao salvar plano:", error);
        alert("Erro ao salvar plano: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// --- Deletion ---
async function deletePlan(id) {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
        await deleteDoc(doc(db, "plans", id));
        closeModal();
        loadPlans();
    } catch (error) {
        console.error("Erro ao excluir plano:", error);
        alert("Erro ao excluir plano.");
    }
}

// --- Modals Setup ---
function openNewPlanModal(updateUrl = true) {
    const canEdit = currentUser && (currentUser.isAdmin === true || currentUser.isColarinhoPreto === true || currentUser.isBlackCollar === true || currentUser.colarinhoPreto === true);
    if (!canEdit) {
        alert("Apenas usuários com a permissão 'Colarinho Preto' ou Administradores podem adicionar novos planificadores.");
        return;
    }
    resetForm();
    modalTitle.textContent = "Novo Plano de Aula";
    deletePlanBtn.classList.add('hidden');
    showSection('edit', updateUrl, null, 'new');
    setFormLayout('simple');
}

async function openEditPlanModal(id, updateUrl = true) {
    const canEdit = currentUser && (currentUser.isAdmin === true || currentUser.isColarinhoPreto === true || currentUser.isBlackCollar === true || currentUser.colarinhoPreto === true);
    if (!canEdit) {
        alert("Apenas usuários com a permissão 'Colarinho Preto' ou Administradores podem editar planificadores.");
        return;
    }
    try {
        const docSnap = await getDoc(doc(db, "plans", id));
        if (!docSnap.exists()) {
            alert("Plano não encontrado!");
            return;
        }

        const data = docSnap.data();

        planIdInput.value = id;
        planTitleInput.value = data.title;
        planCategoryInput.value = data.category || 'A';
        if (planAgeGroupInput) planAgeGroupInput.value = data.ageGroup || '';
        currentMediaFiles = data.media || [];

        renderMediaList();

        const layout = data.layout || 'simple';
        setFormLayout(layout);

        if (layout === 'simple') {
            simpleBlocksList.innerHTML = '';
            if (data.blocks && data.blocks.length > 0) {
                data.blocks.forEach(b => addSimpleBlockDOM(b));
            } else if (data.content) {
                // Legado parsing fallback
                addSimpleBlockDOM({ title: 'CONTEÚDO DO PLANO', content: stripHTML(data.content) });
            }
        } else {
            gridBlocksList.innerHTML = '';
            if (data.weeks && data.weeks.length >= 4) {
                week1DatesInput.value = data.weeks[0].dates || '';
                week2DatesInput.value = data.weeks[1].dates || '';
                week3DatesInput.value = data.weeks[2].dates || '';
                week4DatesInput.value = data.weeks[3].dates || '';
            } else {
                week1DatesInput.value = '';
                week2DatesInput.value = '';
                week3DatesInput.value = '';
                week4DatesInput.value = '';
            }

            if (data.blocks && data.blocks.length > 0) {
                data.blocks.forEach(b => addGridRowDOM(b));
            }
        }

        modalTitle.textContent = "Editar Plano de Aula";
        deletePlanBtn.classList.remove('hidden');
        showSection('edit', updateUrl, id, 'edit');
    } catch (error) {
        console.error("Erro ao abrir plano:", error);
        alert("Erro ao carregar detalhes do plano.");
    }
}

async function openViewModal(id, updateUrl = true) {
    try {
        const docSnap = await getDoc(doc(db, "plans", id));
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const dateCreated = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desc.';

        viewPlanTitle.textContent = data.title;
        viewPlanMeta.textContent = `${data.authorName || 'Desconhecido'} • ${dateCreated}`;
        
        // Visual theme badge classes
        viewPlanCategory.textContent = `TIPO ${data.category || 'A'}`;
        viewPlanCategory.className = `text-[10px] font-bold px-2.5 py-0.5 rounded border ${
            data.category === 'B' 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : data.category === 'C' 
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' 
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
        }`;

        // Faixa Etária badge in View Modal
        const viewPlanAgeGroup = document.getElementById('view-plan-age-group');
        let ageGroup = data.ageGroup || '';
        if (!ageGroup && data.title) {
            const t = data.title.toLowerCase();
            if (t.includes('baby littles') || t.includes('baby')) ageGroup = 'Baby Littles';
            else if (t.includes('littles')) ageGroup = 'Littles';
            else if (t.includes('kids')) ageGroup = 'Kids';
            else if (t.includes('adulto') || t.includes('adultos')) ageGroup = 'Adultos';
        }
        if (viewPlanAgeGroup) {
            if (ageGroup) {
                viewPlanAgeGroup.textContent = ageGroup;
                let ageBadgeClass = 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
                if (ageGroup === 'Baby Littles') ageBadgeClass = 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
                else if (ageGroup === 'Littles') ageBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                else if (ageGroup === 'Kids') ageBadgeClass = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
                else if (ageGroup === 'Adultos') ageBadgeClass = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';

                viewPlanAgeGroup.className = `text-[10px] font-bold px-2.5 py-0.5 rounded border ${ageBadgeClass}`;
                viewPlanAgeGroup.classList.remove('hidden');
            } else {
                viewPlanAgeGroup.classList.add('hidden');
            }
        }

        // Render content depending on layout
        viewPlanBody.innerHTML = '';
        const layout = data.layout;

        if (layout === 'simple') {
            const container = document.createElement('div');
            container.className = 'space-y-4';
            if (data.blocks && data.blocks.length > 0) {
                data.blocks.forEach(b => {
                    const blockEl = document.createElement('div');
                    blockEl.className = 'bg-gray-50 dark:bg-gray-900/30 p-5 rounded-2xl border border-gray-150/80 dark:border-gray-800 shadow-sm';
                    blockEl.innerHTML = `
                        <h4 class="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 border-b border-gray-150/85 dark:border-gray-850 pb-1.5">${b.title}</h4>
                        <p class="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">${b.content}</p>
                    `;
                    container.appendChild(blockEl);
                });
            } else {
                container.innerHTML = `<p class="text-gray-500 italic">Sem conteúdo.</p>`;
            }
            viewPlanBody.appendChild(container);
        } else if (layout === 'grid') {
            const week1 = data.weeks?.[0]?.dates || 'Semana 1';
            const week2 = data.weeks?.[1]?.dates || 'Semana 2';
            const week3 = data.weeks?.[2]?.dates || 'Semana 3';
            const week4 = data.weeks?.[3]?.dates || 'Semana 4';

            const container = document.createElement('div');
            container.className = 'overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm bg-white dark:bg-[#111] print-table';
            
            let html = `
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-gray-50 dark:bg-gray-900 border-b border-gray-150 dark:border-gray-800">
                            <th class="p-3.5 font-bold text-gray-800 dark:text-gray-300 w-1/5 min-w-[150px] border-r border-gray-150 dark:border-gray-800">Bloco</th>
                            <th class="p-3.5 font-bold text-gray-800 dark:text-gray-300 w-1/5 min-w-[150px] border-r border-gray-150 dark:border-gray-800 text-center">
                                <div class="font-bold">Semana 1</div>
                                <div class="text-[10px] text-gray-500">${week1}</div>
                            </th>
                            <th class="p-3.5 font-bold text-gray-800 dark:text-gray-300 w-1/5 min-w-[150px] border-r border-gray-150 dark:border-gray-800 text-center">
                                <div class="font-bold">Semana 2</div>
                                <div class="text-[10px] text-gray-500">${week2}</div>
                            </th>
                            <th class="p-3.5 font-bold text-gray-800 dark:text-gray-300 w-1/5 min-w-[150px] border-r border-gray-150 dark:border-gray-800 text-center">
                                <div class="font-bold">Semana 3</div>
                                <div class="text-[10px] text-gray-500">${week3}</div>
                            </th>
                            <th class="p-3.5 font-bold text-gray-800 dark:text-gray-300 w-1/5 min-w-[150px] text-center">
                                <div class="font-bold">Semana 4</div>
                                <div class="text-[10px] text-gray-500">${week4}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-150 dark:divide-gray-800">
            `;

            if (data.blocks && data.blocks.length > 0) {
                data.blocks.forEach(b => {
                    const isHighlight = b.style === 'highlight';
                    const headerClass = isHighlight ? 'block-header-orange font-bold' : 'block-header-gray font-semibold';
                    const cellClass = isHighlight ? 'block-cell-orange' : 'block-cell-gray';
                    
                    html += `<tr class="border-b border-gray-150 dark:border-gray-800">`;
                    html += `<td class="p-3.5 ${headerClass} border-r border-gray-150 dark:border-gray-850 font-bold uppercase tracking-wider">${b.title}</td>`;
                    
                    if (b.unified) {
                        html += `<td colspan="4" class="p-3.5 ${cellClass} whitespace-pre-wrap leading-relaxed text-center font-medium">${b.contents?.w1 || ''}</td>`;
                    } else {
                        html += `<td class="p-3.5 ${cellClass} border-r border-gray-150 dark:border-gray-850 whitespace-pre-wrap leading-relaxed">${b.contents?.w1 || ''}</td>`;
                        html += `<td class="p-3.5 ${cellClass} border-r border-gray-150 dark:border-gray-850 whitespace-pre-wrap leading-relaxed">${b.contents?.w2 || ''}</td>`;
                        html += `<td class="p-3.5 ${cellClass} border-r border-gray-150 dark:border-gray-850 whitespace-pre-wrap leading-relaxed">${b.contents?.w3 || ''}</td>`;
                        html += `<td class="p-3.5 ${cellClass} whitespace-pre-wrap leading-relaxed">${b.contents?.w4 || ''}</td>`;
                    }
                    html += `</tr>`;
                });
            } else {
                html += `<tr><td colspan="5" class="p-8 text-center text-gray-500 italic">Nenhum bloco cadastrado.</td></tr>`;
            }

            html += `
                    </tbody>
                </table>
            `;
            container.innerHTML = html;
            viewPlanBody.appendChild(container);
        } else {
            // Legacy / Quill formatting compatibility rendering
            const container = document.createElement('div');
            container.className = 'prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/35 p-5 rounded-2xl border border-gray-150 dark:border-gray-800';
            container.innerHTML = data.content || '';
            viewPlanBody.appendChild(container);
        }

        editPlanBtnView.dataset.id = id;
        const canEdit = currentUser && (currentUser.isAdmin === true || currentUser.isColarinhoPreto === true || currentUser.isBlackCollar === true || currentUser.colarinhoPreto === true);
        if (canEdit) {
            editPlanBtnView.classList.remove('hidden');
        } else {
            editPlanBtnView.classList.add('hidden');
        }

        // Render Media for View
        viewMediaList.innerHTML = '';
        if (data.media && data.media.length > 0) {
            data.media.forEach(media => {
                const item = document.createElement('div');

                if (media.type === 'youtube') {
                    const videoId = media.videoId || extractYouTubeID(media.url);
                    if (videoId) {
                        item.className = 'col-span-full w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 bg-black aspect-video my-1.5';
                        item.innerHTML = `
                            <iframe 
                                src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" 
                                title="Vídeo do YouTube" 
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen 
                                class="w-full h-full rounded-2xl min-h-[220px] sm:min-h-[300px]">
                            </iframe>
                        `;
                    } else {
                        item.className = 'bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-250/50 dark:border-gray-800 h-40 flex items-center justify-center relative group';
                        item.innerHTML = `
                            <a href="${media.url}" target="_blank" class="w-full h-full flex items-center justify-center text-xs text-red-500 font-bold gap-1.5">
                                <i class="fab fa-youtube text-lg"></i> Abrir Vídeo no YouTube
                            </a>
                        `;
                    }
                } else if (media.type === 'image') {
                    item.className = 'bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-250/50 dark:border-gray-800 h-40 flex items-center justify-center relative group';
                    item.innerHTML = `
                        <a href="${media.url}" target="_blank" class="w-full h-full flex items-center justify-center">
                            <img src="${media.url}" class="w-full h-full object-cover">
                        </a>
                    `;
                } else {
                    item.className = 'bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-250/50 dark:border-gray-800 h-40 flex items-center justify-center relative group';
                    item.innerHTML = `
                        <a href="${media.url}" target="_blank" class="w-full h-full flex items-center justify-center">
                            <div class="text-center">
                                <i class="fas fa-video text-4xl mb-2 text-blue-500"></i>
                                <p class="text-xs truncate max-w-[120px] px-2 font-medium">${media.name}</p>
                            </div>
                        </a>
                    `;
                }

                viewMediaList.appendChild(item);
            });
        } else {
            viewMediaList.innerHTML = '<p class="text-gray-500 text-xs italic col-span-full">Nenhum anexo.</p>';
        }

        showSection('view', updateUrl, id);
    } catch (error) {
        console.error("Erro ao abrir visualização:", error);
    }
}

function closeViewModal() {
    showSection('catalog');
}

function closeModal() {
    showSection('catalog');
    resetForm();
}

function resetForm() {
    planForm.reset();
    planIdInput.value = '';
    if (planAgeGroupInput) planAgeGroupInput.value = '';
    simpleBlocksList.innerHTML = '';
    gridBlocksList.innerHTML = '';
    currentMediaFiles = [];
    mediaListContainer.innerHTML = '';
    uploadStatus.textContent = '';
}

// Legacy HTML string clean helper
function stripHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}

// --- Media Upload (Storage) ---
async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files.length) return;

    uploadStatus.textContent = 'Enviando...';

    for (const file of files) {
        try {
            const timestamp = Date.now();
            const storagePath = `plans_media/${currentUser.uid}/${timestamp}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            const type = file.type.startsWith('image/') ? 'image' : 'video';

            currentMediaFiles.push({
                name: file.name,
                url: downloadURL,
                path: storagePath,
                type: type
            });
        } catch (error) {
            console.error("Erro no upload:", error);
            alert(`Erro ao enviar ${file.name}`);
        }
    }

    uploadStatus.textContent = 'Upload concluído!';
    setTimeout(() => uploadStatus.textContent = '', 2000);

    renderMediaList();
    e.target.value = ''; // Reset input
}

function renderMediaList() {
    mediaListContainer.innerHTML = '';

    currentMediaFiles.forEach((media, index) => {
        const div = document.createElement('div');
        div.className = 'relative group bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-250/50 dark:border-gray-800 h-32 flex items-center justify-center';

        let content = '';
        if (media.type === 'image') {
            content = `<img src="${media.url}" class="w-full h-full object-cover">`;
        } else if (media.type === 'youtube') {
            const videoId = media.videoId || extractYouTubeID(media.url);
            const thumb = media.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : 'https://img.youtube.com/vi/default/0.jpg');
            content = `
                <div class="relative w-full h-full">
                    <img src="${thumb}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black/35 flex items-center justify-center">
                        <i class="fab fa-youtube text-red-650 text-3xl bg-white rounded-full p-0.5 shadow-md"></i>
                    </div>
                    <span class="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">YouTube</span>
                </div>
            `;
        } else {
            content = `
                <div class="text-center">
                    <i class="fas fa-video text-3xl mb-1 text-blue-500"></i>
                    <p class="text-xs truncate max-w-[100px] px-2 font-medium">${media.name}</p>
                </div>
            `;
        }

        div.innerHTML = `
            ${content}
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                <a href="${media.url}" target="_blank" class="text-blue-400 hover:text-blue-300 p-1" title="Visualizar">
                    <i class="fas fa-external-link-alt"></i>
                </a>
                <button type="button" class="text-red-400 hover:text-red-300 p-1 delete-media-btn" data-index="${index}" title="Remover">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        div.querySelector('.delete-media-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeMedia(index);
        });

        mediaListContainer.appendChild(div);
    });
}

function removeMedia(index) {
    currentMediaFiles.splice(index, 1);
    renderMediaList();
}
