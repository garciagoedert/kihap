import { onAuthReady, checkAdminStatus } from './auth.js';
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert, showConfirm } from './common-ui.js';

// --- CHECKLIST MODELO PADRÃO KIHAP ---
export const DEFAULT_TEMPLATE_TASKS = [
    // Documentação & Societário
    {
        id: "task_doc_drive",
        title: "Pasta no drive com os documentos pessoais dos responsáveis",
        category: "Documentação & Societário",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_cnpj",
        title: "Abertura CNPJ",
        category: "Documentação & Societário",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_aluguel",
        title: "Troca contrato de aluguel",
        category: "Documentação & Societário",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_extratos",
        title: "Extratos bancários dos últimos 3 meses",
        category: "Documentação & Societário",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },

    // Sistemas EVO & TI
    {
        id: "task_evo_espelhar",
        title: "EVO - Espelhar unidade existente",
        category: "Sistemas EVO & TI",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_evo_contratos",
        title: "EVO - Ajustar contratos",
        category: "Sistemas EVO & TI",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_evo_disparos",
        title: "EVO - Ajustar disparos automáticos",
        category: "Sistemas EVO & TI",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_email_google",
        title: "Cadastrar email unidade no Google",
        category: "Sistemas EVO & TI",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_evo_email",
        title: "EVO - Ajustar e-mail da unidade",
        category: "Sistemas EVO & TI",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_evo_venda_online",
        title: "EVO - Habilitar venda online",
        category: "Sistemas EVO & TI",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },

    // Financeiro & Contas
    {
        id: "task_stone_conta",
        title: "Abertura conta Stone",
        category: "Financeiro & Contas",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_stone_maquininha",
        title: "Solicitar maquininha",
        category: "Financeiro & Contas",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_pasta_pagar",
        title: "Criar pasta de documentos a pagar",
        category: "Financeiro & Contas",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_ponto_equilibrio",
        title: "Ponto de equilíbrio ($) em número de contratos",
        category: "Financeiro & Contas",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_planilha_custos",
        title: "Planilha de custos/saídas da unidade",
        category: "Financeiro & Contas",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },

    // Marketing & Presença Digital
    {
        id: "task_acesso_drive",
        title: "Dar acesso ao KIHAP Drive",
        category: "Marketing & Presença Digital",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_google_negocio",
        title: "Cadastrar Google Meu Negócio",
        category: "Marketing & Presença Digital",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_contas_meta",
        title: "Acesso contas Meta (Facebook/Instagram)",
        category: "Marketing & Presença Digital",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_landing_page",
        title: "Criar landing page para agendar matrícula",
        category: "Marketing & Presença Digital",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_narrativa_prevenda",
        title: "Narrativa para alunos e/ou pré venda matrículas",
        category: "Marketing & Presença Digital",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },

    // Comercial & Metodologia
    {
        id: "task_grade_horarios",
        title: "Grade de horários IDV KIHAP",
        category: "Comercial & Metodologia",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_valores_planos",
        title: "Documento com valores e planos IDV KIHAP",
        category: "Comercial & Metodologia",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_lista_alunos",
        title: "Lista de alunos (ensinar a fazer o controle)",
        category: "Comercial & Metodologia",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },

    // Equipe & Onboarding
    {
        id: "task_rh_docs",
        title: "Documentos para contratação/transferência equipe RH",
        category: "Equipe & Onboarding",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_reuniao_funcoes",
        title: "Reunião com time da unidade (funções e onboarding)",
        category: "Equipe & Onboarding",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_reuniao_drive",
        title: "Reunião com time da unidade (ensinar KIHAP Drive)",
        category: "Equipe & Onboarding",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_reuniao_numeros",
        title: "Reunião com time da unidade (ensinar controle números)",
        category: "Equipe & Onboarding",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_reuniao_evo",
        title: "Reunião com time da unidade (ensinar lançamentos EVO)",
        category: "Equipe & Onboarding",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },

    // Estrutura, Obra & Materiais
    {
        id: "task_sinalizacao",
        title: "Sinalização interna/externa da Unidade",
        category: "Estrutura, Obra & Reforma",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_reforma",
        title: "Precisa de reforma? Orçamento e planejamento",
        category: "Estrutura, Obra & Reforma",
        completed: false,
        responsible: "",
        link: "",
        notes: ""
    },
    {
        id: "task_materiais",
        title: "Aquisição de materiais",
        category: "Aquisição de Materiais",
        completed: false,
        responsible: "",
        link: "",
        notes: "",
        items: [
            { id: "mat_1", name: "Tatame preto", completed: false },
            { id: "mat_2", name: "Escudos", completed: false },
            { id: "mat_3", name: "Raquetes", completed: false },
            { id: "mat_4", name: "Argolas", completed: false },
            { id: "mat_5", name: "Espaguetes", completed: false },
            { id: "mat_6", name: "Computador", completed: false },
            { id: "mat_7", name: "Celular", completed: false },
            { id: "mat_8", name: "Tablet", completed: false },
            { id: "mat_9", name: "TV", completed: false }
        ]
    }
];

// Ordem e ícones das categorias padrão
const CATEGORY_META = {
    "Documentação & Societário": { icon: "fa-folder-open", color: "text-blue-500", bg: "bg-blue-500/10" },
    "Sistemas EVO & TI": { icon: "fa-desktop", color: "text-cyan-500", bg: "bg-cyan-500/10" },
    "Financeiro & Contas": { icon: "fa-wallet", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    "Marketing & Presença Digital": { icon: "fa-bullhorn", color: "text-pink-500", bg: "bg-pink-500/10" },
    "Comercial & Metodologia": { icon: "fa-award", color: "text-amber-500", bg: "bg-amber-500/10" },
    "Equipe & Onboarding": { icon: "fa-users-cog", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    "Estrutura, Obra & Reforma": { icon: "fa-tools", color: "text-orange-500", bg: "bg-orange-500/10" },
    "Aquisição de Materiais": { icon: "fa-boxes", color: "text-purple-500", bg: "bg-purple-500/10" }
};

// --- ESTADO GLOBAL ---
let currentUser = null;
let allUnits = [];
let currentUnitId = null;
let currentUnitData = null;
let unitListenerUnsubscribe = null;

// Filtros da UI
let filterStatus = "all"; // all, pending, done
let filterCategory = "";
let filterResponsible = "";
let searchQuery = "";

// Categorias abertas/fechadas no acordeão
let collapsedCategories = {};

// --- INICIALIZAÇÃO DA PÁGINA ---
export function setupAberturaUnidadesPage() {
    onAuthReady(async (user) => {
        if (!user) return;
        currentUser = user;

        const isAdmin = await checkAdminStatus(user);
        if (!isAdmin) {
            showAlert('Acesso restrito. Apenas administradores têm permissão para acessar Abertura de Unidades.', 'Acesso Negado');
            window.location.href = 'index.html';
            return;
        }

        console.log("🚀 Administrador autenticado no módulo de Expansão:", user.email);
        initUIEvents();
        await loadUnitsList();
    });
}

// --- CARREGAMENTO DE DADOS ---
async function loadUnitsList() {
    const loadingState = document.getElementById('loading-state');
    const unitContent = document.getElementById('unit-content');
    const emptyState = document.getElementById('empty-state');

    loadingState.classList.remove('hidden');
    unitContent.classList.add('hidden');
    emptyState.classList.add('hidden');

    try {
        const unitsRef = collection(db, "unit_openings");
        const snapshot = await getDocs(unitsRef);

        if (snapshot.empty) {
            // SEED INICIAL: [SC] SANTA MÔNICA
            console.log("🌱 Coleção unit_openings vazia. Inicializando unidade padrão [SC] SANTA MÔNICA...");
            const initialDocId = "santa-monica";
            const initialUnit = {
                id: initialDocId,
                unitName: "[SC] SANTA MÔNICA",
                status: "in_progress",
                responsibles: [
                    "Master Cavenatti",
                    "Master Marques",
                    "Profa Cavenatti",
                    "Mr. Hadad"
                ],
                driveUrl: "",
                targetDate: "",
                notes: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: currentUser.email || currentUser.uid,
                tasks: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_TASKS))
            };

            await setDoc(doc(db, "unit_openings", initialDocId), initialUnit);
            allUnits = [initialUnit];
            currentUnitId = initialDocId;
        } else {
            allUnits = [];
            snapshot.forEach(docSnap => {
                allUnits.push({ id: docSnap.id, ...docSnap.data() });
            });
            // Ordenar: in_progress primeiro, depois por nome
            allUnits.sort((a, b) => (a.unitName || '').localeCompare(b.unitName || ''));
            if (!currentUnitId || !allUnits.some(u => u.id === currentUnitId)) {
                currentUnitId = allUnits[0].id;
            }
        }

        renderUnitSelector();
        subscribeToCurrentUnit();

    } catch (err) {
        console.error("Erro ao carregar unidades de abertura:", err);
        showAlert("Erro ao carregar unidades: " + err.message, "Erro");
        loadingState.classList.add('hidden');
    }
}

// Escutar mudanças em tempo real na unidade ativa
function subscribeToCurrentUnit() {
    if (unitListenerUnsubscribe) {
        unitListenerUnsubscribe();
    }

    if (!currentUnitId) {
        showEmptyState();
        return;
    }

    const unitDocRef = doc(db, "unit_openings", currentUnitId);
    unitListenerUnsubscribe = onSnapshot(unitDocRef, (docSnap) => {
        const loadingState = document.getElementById('loading-state');
        loadingState.classList.add('hidden');

        if (!docSnap.exists()) {
            console.warn("Unidade atual não existe mais:", currentUnitId);
            loadUnitsList();
            return;
        }

        currentUnitData = { id: docSnap.id, ...docSnap.data() };
        
        // Atualizar lista local
        const idx = allUnits.findIndex(u => u.id === currentUnitId);
        if (idx !== -1) {
            allUnits[idx] = currentUnitData;
        }

        renderUnitData();
    }, (error) => {
        console.error("Erro no listener da unidade:", error);
    });
}

// --- RENDERIZAÇÃO DA UI ---

function renderUnitSelector() {
    const selector = document.getElementById('unit-selector');
    if (!selector) return;

    selector.innerHTML = '';
    allUnits.forEach(unit => {
        const opt = document.createElement('option');
        opt.value = unit.id;
        opt.textContent = unit.unitName || 'Sem nome';
        if (unit.id === currentUnitId) {
            opt.selected = true;
        }
        selector.appendChild(opt);
    });
}

function renderUnitData() {
    const unitContent = document.getElementById('unit-content');
    const emptyState = document.getElementById('empty-state');

    if (!currentUnitData) {
        showEmptyState();
        return;
    }

    unitContent.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Header & Metadados
    document.getElementById('unit-display-name').textContent = currentUnitData.unitName || 'Sem nome';
    
    // Status Badge
    const statusBadge = document.getElementById('unit-status-badge');
    const statusConfig = {
        'in_progress': { text: 'Em Andamento', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
        'planning': { text: 'Em Planejamento', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
        'completed': { text: 'Inaugurada / Concluída', class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
        'paused': { text: 'Pausada', class: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
    };
    const currentStatus = statusConfig[currentUnitData.status] || statusConfig['in_progress'];
    statusBadge.textContent = currentStatus.text;
    statusBadge.className = `px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${currentStatus.class}`;

    // Responsáveis
    const respEl = document.getElementById('unit-responsibles');
    const responsiblesArr = Array.isArray(currentUnitData.responsibles) ? currentUnitData.responsibles : [];
    respEl.textContent = responsiblesArr.length > 0 ? responsiblesArr.join(', ') : 'Não definidos';

    // Previsão
    const targetDateWrapper = document.getElementById('unit-target-date-wrapper');
    const targetDateEl = document.getElementById('unit-target-date');
    if (currentUnitData.targetDate) {
        targetDateWrapper.classList.remove('hidden');
        targetDateWrapper.classList.add('flex');
        const [year, month, day] = currentUnitData.targetDate.split('-');
        targetDateEl.textContent = `${day}/${month}/${year}`;
    } else {
        targetDateWrapper.classList.add('hidden');
    }

    // Google Drive Link
    const driveBtn = document.getElementById('unit-drive-btn');
    if (currentUnitData.driveUrl && currentUnitData.driveUrl.trim() !== '') {
        driveBtn.href = currentUnitData.driveUrl;
        driveBtn.classList.remove('hidden');
        driveBtn.classList.add('flex');
    } else {
        driveBtn.classList.add('hidden');
    }

    // Atualizar Filtros de Responsáveis e Categorias
    updateFilterDropdowns();

    // Calcular Métricas e Progresso
    calculateMetrics();

    // Renderizar Categorias e Checklist
    renderChecklist();
}

function showEmptyState() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('unit-content').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
}

function calculateMetrics() {
    const tasks = currentUnitData.tasks || [];
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Barra de Progresso
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('progress-percentage-label').textContent = `${percentage}%`;
    document.getElementById('progress-count-label').textContent = `${completed} de ${total} tarefas concluídas`;

    // Cards
    document.getElementById('metric-total').textContent = total;
    document.getElementById('metric-done').textContent = completed;
    document.getElementById('metric-pending').textContent = pending;

    // Métricas de Materiais
    const materialTask = tasks.find(t => t.id === 'task_materiais' || t.title.toLowerCase().includes('materiais'));
    if (materialTask && Array.isArray(materialTask.items)) {
        const matTotal = materialTask.items.length;
        const matDone = materialTask.items.filter(i => i.completed).length;
        document.getElementById('metric-materials').textContent = `${matDone}/${matTotal}`;
    } else {
        document.getElementById('metric-materials').textContent = '-';
    }
}

function updateFilterDropdowns() {
    const tasks = currentUnitData.tasks || [];

    // Categorias
    const categorySelect = document.getElementById('filter-category');
    const currentSelectedCat = categorySelect.value;
    const categoriesSet = new Set();
    tasks.forEach(t => {
        if (t.category) categoriesSet.add(t.category);
    });

    categorySelect.innerHTML = '<option value="">Todas as Categorias</option>';
    Array.from(categoriesSet).sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === currentSelectedCat) opt.selected = true;
        categorySelect.appendChild(opt);
    });

    // Responsáveis
    const respSelect = document.getElementById('filter-responsible');
    const currentSelectedResp = respSelect.value;
    const respSet = new Set();
    if (Array.isArray(currentUnitData.responsibles)) {
        currentUnitData.responsibles.forEach(r => respSet.add(r.trim()));
    }
    tasks.forEach(t => {
        if (t.responsible) respSet.add(t.responsible.trim());
    });

    respSelect.innerHTML = '<option value="">Todos os Responsáveis</option>';
    Array.from(respSet).sort().forEach(resp => {
        if (!resp) return;
        const opt = document.createElement('option');
        opt.value = resp;
        opt.textContent = resp;
        if (resp === currentSelectedResp) opt.selected = true;
        respSelect.appendChild(opt);
    });
}

function renderChecklist() {
    const container = document.getElementById('checklist-categories-container');
    if (!container) return;

    container.innerHTML = '';
    const tasks = currentUnitData.tasks || [];

    // Agrupar tarefas por categoria
    const grouped = {};
    tasks.forEach(task => {
        const cat = task.category || 'Geral';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(task);
    });

    // Filtrar tarefas
    const searchLower = searchQuery.toLowerCase().trim();

    let renderedAny = false;

    // Ordenar categorias (padrão primeiro, depois alfabético)
    const knownKeys = Object.keys(CATEGORY_META);
    const categoryList = Object.keys(grouped).sort((a, b) => {
        const indexA = knownKeys.indexOf(a);
        const indexB = knownKeys.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    categoryList.forEach(categoryName => {
        // Se filtro de categoria estiver ativo e for diferente, pula
        if (filterCategory && filterCategory !== categoryName) return;

        let catTasks = grouped[categoryName];

        // Filtro de status
        if (filterStatus === 'pending') {
            catTasks = catTasks.filter(t => !t.completed);
        } else if (filterStatus === 'done') {
            catTasks = catTasks.filter(t => t.completed);
        }

        // Filtro de responsável
        if (filterResponsible) {
            catTasks = catTasks.filter(t => (t.responsible || '').trim().toLowerCase() === filterResponsible.trim().toLowerCase());
        }

        // Filtro de busca de texto
        if (searchLower) {
            catTasks = catTasks.filter(t => {
                const titleMatch = (t.title || '').toLowerCase().includes(searchLower);
                const notesMatch = (t.notes || '').toLowerCase().includes(searchLower);
                const subitemsMatch = Array.isArray(t.items) && t.items.some(i => (i.name || '').toLowerCase().includes(searchLower));
                return titleMatch || notesMatch || subitemsMatch;
            });
        }

        if (catTasks.length === 0) return; // Nada a exibir nessa categoria com os filtros atuais

        renderedAny = true;

        // Metadados visuais da categoria
        const meta = CATEGORY_META[categoryName] || { icon: "fa-folder", color: "text-amber-500", bg: "bg-amber-500/10" };
        const totalCat = grouped[categoryName].length;
        const doneCat = grouped[categoryName].filter(t => t.completed).length;
        const isCollapsed = !!collapsedCategories[categoryName];

        // Card da Categoria
        const card = document.createElement('div');
        card.className = "bg-white/90 dark:bg-[#1a1a1a]/80 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-all";

        // Accordion Header
        const header = document.createElement('div');
        header.className = "p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors border-b border-transparent";
        if (!isCollapsed) {
            header.className += " border-gray-100 dark:border-gray-800";
        }

        header.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center text-sm font-bold shadow-sm">
                    <i class="fas ${meta.icon}"></i>
                </div>
                <div>
                    <h3 class="font-bold text-gray-900 dark:text-white text-base">${categoryName}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">${doneCat} de ${totalCat} concluídas</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button class="btn-add-task-to-category p-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-all" data-category="${categoryName}" title="Adicionar tarefa nesta categoria">
                    <i class="fas fa-plus mr-1"></i> Adicionar
                </button>
                <div class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}">
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
        `;

        header.addEventListener('click', (e) => {
            if (e.target.closest('.btn-add-task-to-category')) return;
            collapsedCategories[categoryName] = !collapsedCategories[categoryName];
            renderChecklist();
        });

        // Evento de adicionar tarefa direto na categoria
        header.querySelector('.btn-add-task-to-category').addEventListener('click', (e) => {
            e.stopPropagation();
            openTaskModal(null, categoryName);
        });

        card.appendChild(header);

        // Body com a lista de tarefas
        if (!isCollapsed) {
            const body = document.createElement('div');
            body.className = "divide-y divide-gray-100 dark:divide-gray-800/50 p-2 sm:p-3 space-y-1";

            catTasks.forEach(task => {
                const taskRow = createTaskRowElement(task);
                body.appendChild(taskRow);
            });

            card.appendChild(body);
        }

        container.appendChild(card);
    });

    if (!renderedAny) {
        container.innerHTML = `
            <div class="py-12 text-center bg-white/40 dark:bg-[#1a1a1a]/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6">
                <i class="fas fa-search text-gray-400 text-2xl mb-2"></i>
                <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">Nenhuma tarefa encontrada com os filtros selecionados.</p>
                <button id="btn-clear-filters" class="mt-3 text-xs font-bold text-primary hover:underline">Limpar Filtros</button>
            </div>
        `;
        document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
            filterStatus = "all";
            filterCategory = "";
            filterResponsible = "";
            searchQuery = "";
            document.getElementById('task-search-input').value = "";
            document.getElementById('filter-category').value = "";
            document.getElementById('filter-responsible').value = "";
            updateStatusFilterButtons();
            renderChecklist();
        });
    }
}

function createTaskRowElement(task) {
    const row = document.createElement('div');
    row.className = `p-3 rounded-xl transition-all group flex flex-col gap-2 ${
        task.completed 
            ? 'bg-gray-50/60 dark:bg-gray-800/20 opacity-80' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
    }`;

    // Linha Principal
    const mainRow = document.createElement('div');
    mainRow.className = "flex items-start justify-between gap-3";

    // Lado Esquerdo: Checkbox + Título + Responsável
    const leftCol = document.createElement('div');
    leftCol.className = "flex items-start gap-3 flex-grow min-w-0";

    // Custom Checkbox
    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = "relative flex items-center justify-center cursor-pointer mt-0.5";
    checkboxLabel.innerHTML = `
        <input type="checkbox" class="sr-only custom-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="w-5 h-5 rounded-md border-2 border-gray-300 dark:border-gray-600 transition-all flex items-center justify-center hover:border-primary">
            <svg class="w-3.5 h-3.5 text-black hidden pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
            </svg>
        </div>
    `;

    checkboxLabel.querySelector('input').addEventListener('change', async (e) => {
        await toggleTaskCompleted(task.id, e.target.checked);
    });

    leftCol.appendChild(checkboxLabel);

    // Conteúdo da Tarefa (Título + Badges)
    const contentBox = document.createElement('div');
    contentBox.className = "flex-grow min-w-0";

    const titleEl = document.createElement('p');
    titleEl.className = `text-sm font-semibold text-gray-900 dark:text-white leading-snug break-words ${
        task.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
    }`;
    titleEl.textContent = task.title;
    contentBox.appendChild(titleEl);

    // Chips / Metadados da Tarefa
    const chipsRow = document.createElement('div');
    chipsRow.className = "flex flex-wrap items-center gap-2 mt-1.5 text-xs";

    // Responsável Chip
    if (task.responsible && task.responsible.trim() !== '') {
        const respChip = document.createElement('span');
        respChip.className = "px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-[11px] flex items-center gap-1 border border-gray-200 dark:border-gray-700";
        respChip.innerHTML = `<i class="fas fa-user text-[10px] text-primary"></i> ${task.responsible}`;
        chipsRow.appendChild(respChip);
    }

    // Link Externo
    if (task.link && task.link.trim() !== '') {
        const linkBtn = document.createElement('a');
        linkBtn.href = task.link;
        linkBtn.target = "_blank";
        linkBtn.className = "px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:underline font-medium text-[11px] flex items-center gap-1 border border-blue-100 dark:border-blue-800";
        linkBtn.innerHTML = `<i class="fas fa-external-link-alt text-[9px]"></i> Link`;
        chipsRow.appendChild(linkBtn);
    }

    // Notas / Observações
    if (task.notes && task.notes.trim() !== '') {
        const notesSpan = document.createElement('span');
        notesSpan.className = "text-[11px] text-gray-500 dark:text-gray-400 italic";
        notesSpan.textContent = `"${task.notes}"`;
        chipsRow.appendChild(notesSpan);
    }

    contentBox.appendChild(chipsRow);
    leftCol.appendChild(contentBox);
    mainRow.appendChild(leftCol);

    // Lado Direito: Botões de Ação (Editar, Excluir)
    const actionsCol = document.createElement('div');
    actionsCol.className = "flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity";

    const editBtn = document.createElement('button');
    editBtn.className = "p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";
    editBtn.title = "Editar Tarefa";
    editBtn.innerHTML = `<i class="fas fa-edit text-xs"></i>`;
    editBtn.addEventListener('click', () => openTaskModal(task));
    actionsCol.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = "p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";
    deleteBtn.title = "Excluir Tarefa";
    deleteBtn.innerHTML = `<i class="fas fa-trash-alt text-xs"></i>`;
    deleteBtn.addEventListener('click', () => confirmDeleteTask(task));
    actionsCol.appendChild(deleteBtn);

    mainRow.appendChild(actionsCol);
    row.appendChild(mainRow);

    // Subitens / Checklist Interno (Ex: Materiais)
    if (Array.isArray(task.items) && task.items.length > 0) {
        const subitemsBox = document.createElement('div');
        subitemsBox.className = "mt-2 pl-8 pr-2 pt-2 border-t border-gray-100 dark:border-gray-800/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2";

        task.items.forEach(subItem => {
            const subLabel = document.createElement('label');
            subLabel.className = `flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-gray-100/70 dark:hover:bg-gray-800/50 cursor-pointer select-none transition-colors ${
                subItem.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'
            }`;

            subLabel.innerHTML = `
                <input type="checkbox" class="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary cursor-pointer" ${subItem.completed ? 'checked' : ''}>
                <span class="truncate font-medium">${subItem.name}</span>
            `;

            subLabel.querySelector('input').addEventListener('change', async (e) => {
                await toggleSubItemCompleted(task.id, subItem.id, e.target.checked);
            });

            subitemsBox.appendChild(subLabel);
        });

        row.appendChild(subitemsBox);
    }

    return row;
}

// --- AÇÕES DO FIRESTORE ---

async function toggleTaskCompleted(taskId, completed) {
    if (!currentUnitData) return;
    const tasks = [...(currentUnitData.tasks || [])];
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    tasks[taskIndex].completed = completed;
    tasks[taskIndex].completedAt = completed ? new Date().toISOString() : null;
    tasks[taskIndex].completedBy = completed ? (currentUser.email || currentUser.uid) : null;

    // Se a tarefa possuir subitens, opcionalmente sincronizar
    if (Array.isArray(tasks[taskIndex].items) && completed) {
        tasks[taskIndex].items = tasks[taskIndex].items.map(item => ({ ...item, completed: true }));
    }

    try {
        const docRef = doc(db, "unit_openings", currentUnitId);
        await updateDoc(docRef, {
            tasks: tasks,
            updatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("Erro ao alternar status da tarefa:", err);
        showAlert("Erro ao atualizar tarefa: " + err.message, "Erro");
    }
}

async function toggleSubItemCompleted(taskId, subItemId, completed) {
    if (!currentUnitData) return;
    const tasks = [...(currentUnitData.tasks || [])];
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = tasks[taskIndex];
    if (!Array.isArray(task.items)) return;

    const subItemIndex = task.items.findIndex(i => i.id === subItemId);
    if (subItemIndex === -1) return;

    task.items[subItemIndex].completed = completed;

    // Se todos os subitens foram concluídos, marca a tarefa pai como concluída
    const allSubDone = task.items.every(i => i.completed);
    task.completed = allSubDone;

    try {
        const docRef = doc(db, "unit_openings", currentUnitId);
        await updateDoc(docRef, {
            tasks: tasks,
            updatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("Erro ao atualizar subitem:", err);
        showAlert("Erro ao atualizar subitem: " + err.message, "Erro");
    }
}

async function saveTask(taskData) {
    if (!currentUnitData) return;
    const tasks = [...(currentUnitData.tasks || [])];

    if (taskData.id) {
        // Edição
        const idx = tasks.findIndex(t => t.id === taskData.id);
        if (idx !== -1) {
            tasks[idx] = {
                ...tasks[idx],
                ...taskData
            };
        }
    } else {
        // Nova Tarefa
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: taskData.title,
            category: taskData.category || 'Geral',
            responsible: taskData.responsible || '',
            link: taskData.link || '',
            notes: taskData.notes || '',
            completed: false,
            items: taskData.items || []
        };
        tasks.push(newTask);
    }

    try {
        const docRef = doc(db, "unit_openings", currentUnitId);
        await updateDoc(docRef, {
            tasks: tasks,
            updatedAt: new Date().toISOString()
        });
        closeAllModals();
    } catch (err) {
        console.error("Erro ao salvar tarefa:", err);
        showAlert("Erro ao salvar tarefa: " + err.message, "Erro");
    }
}

function confirmDeleteTask(task) {
    showConfirm(
        `Deseja realmente remover a tarefa "${task.title}" desta unidade?`,
        async () => {
            const tasks = (currentUnitData.tasks || []).filter(t => t.id !== task.id);
            try {
                const docRef = doc(db, "unit_openings", currentUnitId);
                await updateDoc(docRef, {
                    tasks: tasks,
                    updatedAt: new Date().toISOString()
                });
            } catch (err) {
                console.error("Erro ao excluir tarefa:", err);
                showAlert("Erro ao excluir tarefa: " + err.message, "Erro");
            }
        },
        null,
        "Excluir Tarefa"
    );
}

// --- MODAIS E FORMULÁRIOS ---

function initUIEvents() {
    // Seletor de Unidades
    document.getElementById('unit-selector')?.addEventListener('change', (e) => {
        currentUnitId = e.target.value;
        subscribeToCurrentUnit();
    });

    // Botão Nova Unidade
    document.getElementById('btn-new-unit')?.addEventListener('click', () => {
        openModal('modal-new-unit');
    });
    document.getElementById('btn-empty-new-unit')?.addEventListener('click', () => {
        openModal('modal-new-unit');
    });

    // Submissão Nova Unidade
    document.getElementById('form-new-unit')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCreateUnit();
    });

    // Botão Editar Unidade
    document.getElementById('btn-edit-unit')?.addEventListener('click', () => {
        if (!currentUnitData) return;
        populateEditUnitModal();
        openModal('modal-edit-unit');
    });

    // Submissão Editar Unidade
    document.getElementById('form-edit-unit')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveEditUnit();
    });

    // Excluir Unidade
    document.getElementById('btn-delete-unit')?.addEventListener('click', () => {
        handleDeleteUnit();
    });

    // Botão Adicionar Tarefa (Topo)
    document.getElementById('btn-add-task-top')?.addEventListener('click', () => {
        openTaskModal();
    });

    // Submissão Tarefa
    document.getElementById('form-task')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleTaskFormSubmit();
    });

    // Adicionar campo de subitem no modal de tarefa
    document.getElementById('btn-add-subitem-field')?.addEventListener('click', () => {
        addSubItemInputRow("");
    });

    // Fechar modais
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Filtros de Status
    document.querySelectorAll('.filter-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterStatus = e.currentTarget.dataset.status;
            updateStatusFilterButtons();
            renderChecklist();
        });
    });

    // Filtro de Categoria
    document.getElementById('filter-category')?.addEventListener('change', (e) => {
        filterCategory = e.target.value;
        renderChecklist();
    });

    // Filtro de Responsável
    document.getElementById('filter-responsible')?.addEventListener('change', (e) => {
        filterResponsible = e.target.value;
        renderChecklist();
    });

    // Busca de Tarefa
    document.getElementById('task-search-input')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderChecklist();
    });
}

function updateStatusFilterButtons() {
    document.querySelectorAll('.filter-status-btn').forEach(btn => {
        if (btn.dataset.status === filterStatus) {
            btn.className = "filter-status-btn px-3 py-1.5 rounded-lg bg-white dark:bg-[#111] text-gray-900 dark:text-white shadow-sm transition-all";
        } else {
            btn.className = "filter-status-btn px-3 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all";
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAllModals() {
    document.querySelectorAll('#modal-new-unit, #modal-edit-unit, #modal-task').forEach(modal => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
}

// --- CRUD DE UNIDADES ---

async function handleCreateUnit() {
    const nameInput = document.getElementById('new-unit-name').value.trim();
    const respInput = document.getElementById('new-unit-responsibles').value.trim();
    const targetDate = document.getElementById('new-unit-target-date').value;
    const status = document.getElementById('new-unit-status').value;
    const driveUrl = document.getElementById('new-unit-drive').value.trim();
    const useTemplate = document.getElementById('new-unit-use-template').checked;

    if (!nameInput) {
        showAlert("Informe o nome da unidade.", "Aviso");
        return;
    }

    const responsibles = respInput.split(',').map(r => r.trim()).filter(r => r.length > 0);

    // Gerar slug amigável como ID do documento
    const slug = nameInput
        .toLowerCase()
        .replace(/\[|\]/g, '')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || ('unit_' + Date.now());

    const tasks = useTemplate 
        ? JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_TASKS)) 
        : [];

    const newUnitDoc = {
        id: slug,
        unitName: nameInput,
        status: status || 'in_progress',
        responsibles: responsibles,
        driveUrl: driveUrl || '',
        targetDate: targetDate || '',
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.email || currentUser.uid,
        tasks: tasks
    };

    try {
        const btnSave = document.getElementById('btn-save-new-unit');
        btnSave.disabled = true;
        btnSave.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Criando...`;

        await setDoc(doc(db, "unit_openings", slug), newUnitDoc);
        
        allUnits.push(newUnitDoc);
        currentUnitId = slug;

        closeAllModals();
        document.getElementById('form-new-unit').reset();
        showAlert(`Unidade "${nameInput}" criada com sucesso!`, "Sucesso");

        renderUnitSelector();
        subscribeToCurrentUnit();
    } catch (err) {
        console.error("Erro ao criar unidade:", err);
        showAlert("Erro ao criar unidade: " + err.message, "Erro");
    } finally {
        const btnSave = document.getElementById('btn-save-new-unit');
        btnSave.disabled = false;
        btnSave.innerHTML = `<i class="fas fa-check mr-2"></i> Criar Unidade`;
    }
}

function populateEditUnitModal() {
    if (!currentUnitData) return;
    document.getElementById('edit-unit-name').value = currentUnitData.unitName || '';
    document.getElementById('edit-unit-responsibles').value = (currentUnitData.responsibles || []).join(', ');
    document.getElementById('edit-unit-target-date').value = currentUnitData.targetDate || '';
    document.getElementById('edit-unit-status').value = currentUnitData.status || 'in_progress';
    document.getElementById('edit-unit-drive').value = currentUnitData.driveUrl || '';
}

async function handleSaveEditUnit() {
    if (!currentUnitData) return;

    const unitName = document.getElementById('edit-unit-name').value.trim();
    const respInput = document.getElementById('edit-unit-responsibles').value.trim();
    const targetDate = document.getElementById('edit-unit-target-date').value;
    const status = document.getElementById('edit-unit-status').value;
    const driveUrl = document.getElementById('edit-unit-drive').value.trim();

    const responsibles = respInput.split(',').map(r => r.trim()).filter(r => r.length > 0);

    try {
        const docRef = doc(db, "unit_openings", currentUnitId);
        await updateDoc(docRef, {
            unitName,
            responsibles,
            targetDate,
            status,
            driveUrl,
            updatedAt: new Date().toISOString()
        });

        closeAllModals();
        showAlert("Dados da unidade atualizados!", "Sucesso");
    } catch (err) {
        console.error("Erro ao salvar alterações da unidade:", err);
        showAlert("Erro ao salvar unidade: " + err.message, "Erro");
    }
}

function handleDeleteUnit() {
    if (!currentUnitData) return;

    showConfirm(
        `Tem certeza de que deseja excluir o planejamento da unidade "${currentUnitData.unitName}"? Todo o checklist desta unidade será perdido.`,
        async () => {
            try {
                await deleteDoc(doc(db, "unit_openings", currentUnitId));
                closeAllModals();
                showAlert("Unidade excluída com sucesso.", "Sucesso");

                // Recarregar lista e ir para a próxima disponível
                currentUnitId = null;
                await loadUnitsList();
            } catch (err) {
                console.error("Erro ao excluir unidade:", err);
                showAlert("Erro ao excluir unidade: " + err.message, "Erro");
            }
        },
        null,
        "Excluir Unidade"
    );
}

// --- MODAL DE TAREFA ---

function openTaskModal(task = null, defaultCategory = "") {
    const modalTitle = document.getElementById('modal-task-title');
    const inputId = document.getElementById('task-edit-id');
    const inputTitle = document.getElementById('task-input-title');
    const inputCategory = document.getElementById('task-input-category');
    const selectResponsible = document.getElementById('task-input-responsible');
    const inputLink = document.getElementById('task-input-link');
    const inputNotes = document.getElementById('task-input-notes');
    const btnDeleteTask = document.getElementById('btn-delete-task');
    const subitemsContainer = document.getElementById('subitems-container');

    subitemsContainer.innerHTML = '';

    // Preencher opções de responsáveis
    selectResponsible.innerHTML = '<option value="">Não atribuído</option>';
    if (currentUnitData && Array.isArray(currentUnitData.responsibles)) {
        currentUnitData.responsibles.forEach(resp => {
            const opt = document.createElement('option');
            opt.value = resp;
            opt.textContent = resp;
            selectResponsible.appendChild(opt);
        });
    }

    if (task) {
        // Modo Edição
        modalTitle.textContent = "Editar Tarefa";
        inputId.value = task.id;
        inputTitle.value = task.title || "";
        inputCategory.value = task.category || "";
        selectResponsible.value = task.responsible || "";
        inputLink.value = task.link || "";
        inputNotes.value = task.notes || "";

        // Carregar subitens
        if (Array.isArray(task.items)) {
            task.items.forEach(item => {
                addSubItemInputRow(item.name, item.completed, item.id);
            });
        }

        btnDeleteTask.classList.remove('hidden');
        btnDeleteTask.classList.add('flex');
        btnDeleteTask.onclick = () => {
            closeAllModals();
            confirmDeleteTask(task);
        };
    } else {
        // Modo Nova Tarefa
        modalTitle.textContent = "Nova Tarefa";
        inputId.value = "";
        inputTitle.value = "";
        inputCategory.value = defaultCategory || "Geral";
        selectResponsible.value = "";
        inputLink.value = "";
        inputNotes.value = "";

        btnDeleteTask.classList.add('hidden');
        btnDeleteTask.classList.remove('flex');
    }

    openModal('modal-task');
}

function addSubItemInputRow(name = "", completed = false, id = null) {
    const container = document.getElementById('subitems-container');
    const row = document.createElement('div');
    row.className = "flex items-center gap-2 subitem-row";

    const subId = id || ('sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));

    row.innerHTML = `
        <input type="hidden" class="subitem-id" value="${subId}">
        <input type="hidden" class="subitem-completed" value="${completed ? 'true' : 'false'}">
        <input type="text" value="${name.replace(/"/g, '&quot;')}" placeholder="Nome do item (ex: Tatame preto)" class="subitem-name flex-grow bg-gray-50 dark:bg-[#111] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none">
        <button type="button" class="btn-remove-subitem p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
            <i class="fas fa-times text-xs"></i>
        </button>
    `;

    row.querySelector('.btn-remove-subitem').addEventListener('click', () => {
        row.remove();
    });

    container.appendChild(row);
}

function handleTaskFormSubmit() {
    const id = document.getElementById('task-edit-id').value;
    const title = document.getElementById('task-input-title').value.trim();
    const category = document.getElementById('task-input-category').value.trim() || 'Geral';
    const responsible = document.getElementById('task-input-responsible').value;
    const link = document.getElementById('task-input-link').value.trim();
    const notes = document.getElementById('task-input-notes').value.trim();

    if (!title) {
        showAlert("O título da tarefa é obrigatório.", "Aviso");
        return;
    }

    // Coletar subitens
    const subitems = [];
    document.querySelectorAll('#subitems-container .subitem-row').forEach(row => {
        const name = row.querySelector('.subitem-name').value.trim();
        const subId = row.querySelector('.subitem-id').value;
        const completed = row.querySelector('.subitem-completed').value === 'true';

        if (name) {
            subitems.push({
                id: subId,
                name: name,
                completed: completed
            });
        }
    });

    saveTask({
        id: id || null,
        title,
        category,
        responsible,
        link,
        notes,
        items: subitems
    });
}
