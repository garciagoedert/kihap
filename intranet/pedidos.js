import { db } from './firebase-config.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser, checkAdminStatus } from './auth.js';

// Classes CSS de status com suporte claro/escuro
function getStatusClasses(status) {
    switch (status) {
        case 'Enviado':
            return 'bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30';
        case 'Entregue':
            return 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30';
        case 'Cancelado':
            return 'bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30';
        case 'Em produção':
            return 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30';
        case 'Pendente':
            return 'bg-orange-100/80 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30';
        default:
            return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
    }
}

// Cor visual de cada faixa para badges na tabela e modais
function getBeltBadgeStyle(faixaName = '') {
    const f = faixaName.toLowerCase();
    if (f.includes('branca')) return { dot: 'bg-white border border-gray-400', pill: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700' };
    if (f.includes('laranja')) return { dot: 'bg-orange-500', pill: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200/70 dark:border-orange-800/50' };
    if (f.includes('amarela')) return { dot: 'bg-yellow-400', pill: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-yellow-200/70 dark:border-yellow-800/50' };
    if (f.includes('camuflada')) return { dot: 'bg-lime-700', pill: 'bg-lime-50 dark:bg-lime-950/40 text-lime-800 dark:text-lime-300 border-lime-200/70 dark:border-lime-800/50' };
    if (f.includes('verde')) return { dot: 'bg-emerald-600', pill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/50' };
    if (f.includes('roxa')) return { dot: 'bg-purple-600', pill: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/50' };
    if (f.includes('azul')) return { dot: 'bg-blue-600', pill: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200/70 dark:border-blue-800/50' };
    if (f.includes('marrom')) return { dot: 'bg-amber-800', pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50' };
    if (f.includes('vermelha e preta')) return { dot: 'bg-gradient-to-r from-red-600 to-black', pill: 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200/70 dark:border-red-800/50' };
    if (f.includes('vermelha')) return { dot: 'bg-red-600', pill: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200/70 dark:border-red-800/50' };
    if (f.includes('preta')) return { dot: 'bg-black dark:bg-white', pill: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-800' };
    // Littles
    return { dot: 'bg-indigo-500', pill: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50' };
}

function formatUnitDisplayName(unit = '') {
    if (!unit) return 'N/A';
    return String(unit)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

const faixas = [
    // Kids / Completa (Recomendada & Decidida)
    "Branca Recomendada", "Branca Decidida",
    "Laranja Recomendada", "Laranja Decidida",
    "Amarela Recomendada", "Amarela Decidida",
    "Camuflada Recomendada", "Camuflada Decidida",
    "Verde Recomendada", "Verde Decidida",
    "Roxa Recomendada", "Roxa Decidida",
    "Azul Recomendada", "Azul Decidida",
    "Marrom Recomendada", "Marrom Decidida",
    "Vermelha Recomendada", "Vermelha Decidida",
    "Vermelha e Preta",
    // Teens / Adultos (Cores Inteiras)
    "Branca", "Laranja", "Amarela", "Camuflada", "Verde", "Roxa", "Azul", "Marrom", "Vermelha",
    // Littles
    "Panda", "Leão", "Girafa", "Borboleta", "Jacaré", "Coruja", "Arara", "Macaco", "Fênix"
];

const BELT_SORT_ORDER = new Map(faixas.map((f, i) => [f.toLowerCase(), i]));

const tamanhos = ["PP", "P", "M", "G", "GG"];
const tamanhosDobok = ["Baby", "2 ANOS", "4 ANOS", "6 ANOS", "8 ANOS", "10 ANOS", "12 ANOS", "14 ANOS", "P", "M", "G", "GG", "XGG"];

// ============================================================================
// MOTOR DE PROGRESSÃO DE FAIXAS (EVO -> PRÓXIMA FAIXA DA STORE)
// ============================================================================

const LITTLES_PROGRESSION = [
    "Branca", "Panda", "Leão", "Girafa", "Borboleta", "Jacaré", "Coruja", "Arara", "Macaco", "Fênix"
];

const KIDS_PROGRESSION = [
    "Branca Recomendada", "Branca Decidida",
    "Laranja Recomendada", "Laranja Decidida",
    "Amarela Recomendada", "Amarela Decidida",
    "Camuflada Recomendada", "Camuflada Decidida",
    "Verde Recomendada", "Verde Decidida",
    "Roxa Recomendada", "Roxa Decidida",
    "Azul Recomendada", "Azul Decidida",
    "Marrom Recomendada", "Marrom Decidida",
    "Vermelha Recomendada", "Vermelha Decidida",
    "Vermelha e Preta"
];

const TEENS_ADULTOS_PROGRESSION = [
    "Branca", "Laranja", "Amarela", "Camuflada", "Verde", "Roxa", "Azul", "Marrom", "Vermelha", "Vermelha e Preta"
];

function parseEvoMemberLevel(memberLevel) {
    if (!Array.isArray(memberLevel) || memberLevel.length === 0) return null;
    let belt = null;
    let rankType = null;

    for (const item of memberLevel) {
        const group = (item.levelGroupName || '').trim();
        const level = (item.currentLevelName || '').trim();
        if (/colarinho/i.test(group) || /colarinho/i.test(level)) continue;
        if (group) rankType = group.replace(/^Kihap\s*-\s*/i, '').trim();
        if (level) {
            let cleanBelt = level.replace(/^Faixa\s+/i, '').trim();
            cleanBelt = cleanBelt.replace(/\bdecidida\b/gi, 'Decidida');
            cleanBelt = cleanBelt.replace(/\brecomendada\b/gi, 'Recomendada');
            cleanBelt = cleanBelt.replace(/(\d+)\s*[º°]?\s*DAN/i, '$1º Dan');
            belt = cleanBelt;
        }
    }
    if (!belt && !rankType) return null;
    return { belt, rankType };
}

/**
 * Calcula a próxima faixa de um aluno ativo com base na sua faixa e categoria (Kids, Teens/Adultos, Littles)
 */
function calculateNextBelt(rawBelt, rawRankType) {
    if (!rawBelt) return null;
    const beltClean = String(rawBelt).replace(/^Faixa\s+/i, '').trim();
    const beltLower = beltClean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const rankLower = String(rawRankType || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Ignorar faixas pretas na geração automática de faixas coloridas (ou sinalizar transição para 1º Dan)
    if (beltLower.includes('preta') && !beltLower.includes('vermelha')) {
        return null;
    }
    if (/^\d+\s*bd$/i.test(beltLower) || beltLower.includes('dan')) {
        return null;
    }

    // 1. Verificar se é Kihap Littles
    const littlesMap = [
        { match: 'branca', canonical: 'Branca', next: 'Panda' },
        { match: 'panda', canonical: 'Panda', next: 'Leão' },
        { match: 'leao', canonical: 'Leão', next: 'Girafa' },
        { match: 'girafa', canonical: 'Girafa', next: 'Borboleta' },
        { match: 'borboleta', canonical: 'Borboleta', next: 'Jacaré' },
        { match: 'jacare', canonical: 'Jacaré', next: 'Coruja' },
        { match: 'coruja', canonical: 'Coruja', next: 'Arara' },
        { match: 'arara', canonical: 'Arara', next: 'Macaco' },
        { match: 'macaco', canonical: 'Macaco', next: 'Fênix' },
        { match: 'fenix', canonical: 'Fênix', next: 'Laranja Recomendada' }
    ];

    const isLittleCategory = rankLower.includes('little') || beltLower.includes('little');
    const isLittleAnimal = littlesMap.slice(1).some(l => beltLower.includes(l.match));

    if (isLittleCategory || isLittleAnimal) {
        for (const item of littlesMap) {
            if (beltLower.includes(item.match)) {
                return {
                    category: 'Littles',
                    currentBelt: item.canonical === 'Branca' ? 'Littles - Branca' : item.canonical,
                    nextBelt: item.next
                };
            }
        }
    }

    // 2. Verificar se é Vermelha e Preta (próxima seria Preta 1º Dan, não entra em faixas coloridas comuns)
    if (beltLower.includes('vermelha e preta')) {
        return null;
    }

    // 3. Verificar se é Kids (ou possui Recomendada / Decidida explícito)
    const hasSubRank = beltLower.includes('recomendada') || beltLower.includes('decidida');
    const isKidsCategory = rankLower.includes('kids');

    if (hasSubRank || isKidsCategory) {
        // Normalizar caso seja Kids com cor simples (ex: "Branca" em Kids -> assume Branca Decidida ou Branca Recomendada)
        for (let i = 0; i < KIDS_PROGRESSION.length; i++) {
            const candidate = KIDS_PROGRESSION[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (beltLower === candidate) {
                const next = KIDS_PROGRESSION[i + 1] || null;
                if (!next) return null;
                return {
                    category: 'Kids',
                    currentBelt: KIDS_PROGRESSION[i],
                    nextBelt: next
                };
            }
        }
        // Se é da categoria Kids mas está só com o nome da cor (ex: "Branca", "Laranja")
        const colorToKidsNext = {
            'branca': { current: 'Branca (Kids)', next: 'Branca Decidida' },
            'laranja': { current: 'Laranja (Kids)', next: 'Laranja Decidida' },
            'amarela': { current: 'Amarela (Kids)', next: 'Amarela Decidida' },
            'camuflada': { current: 'Camuflada (Kids)', next: 'Camuflada Decidida' },
            'verde': { current: 'Verde (Kids)', next: 'Verde Decidida' },
            'roxa': { current: 'Roxa (Kids)', next: 'Roxa Decidida' },
            'azul': { current: 'Azul (Kids)', next: 'Azul Decidida' },
            'marrom': { current: 'Marrom (Kids)', next: 'Marrom Decidida' },
            'vermelha': { current: 'Vermelha (Kids)', next: 'Vermelha Decidida' }
        };
        for (const [colorKey, info] of Object.entries(colorToKidsNext)) {
            if (beltLower.includes(colorKey)) {
                return {
                    category: 'Kids',
                    currentBelt: info.current,
                    nextBelt: info.next
                };
            }
        }
    }

    // 4. Teens / Adultos / Tradicional (Cor inteira: Branca -> Laranja -> Amarela...)
    for (let i = 0; i < TEENS_ADULTOS_PROGRESSION.length - 1; i++) {
        const candidate = TEENS_ADULTOS_PROGRESSION[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (beltLower === candidate || beltLower.includes(candidate)) {
            return {
                category: 'Teens/Adultos',
                currentBelt: TEENS_ADULTOS_PROGRESSION[i],
                nextBelt: TEENS_ADULTOS_PROGRESSION[i + 1]
            };
        }
    }

    return null;
}

// ============================================================================
// ESTADO GLOBAL DA PÁGINA
// ============================================================================

let itensPedido = [];
let currentEditingPedidoId = null;
let currentEditingPretaPedidoId = null;
let currentEditingDobokPedidoId = null;
let activeTabIndex = 0; // 0 = Coloridas, 1 = Pretas, 2 = Doboks

let cachedPedidosColoridas = [];
let cachedPedidosPretas = [];
let cachedPedidosDoboks = [];

// Estado da previsão automática por alunos ativos
let autoCalculatedGroups = []; // Array<{ nextBelt, totalQty, sources: Array<string>, sizes: { PP, P, M, G, GG } }>

// ============================================================================
// ATUALIZAÇÃO DE KPIS
// ============================================================================

function updateKpiCards(pedidosList, isColoridasTab = true) {
    const totalEl = document.getElementById('kpi-pedidos-total');
    const pendentesEl = document.getElementById('kpi-pedidos-pendentes');
    const itensPendentesEl = document.getElementById('kpi-itens-pendentes');
    const andamentoEl = document.getElementById('kpi-pedidos-andamento');
    const entreguesEl = document.getElementById('kpi-pedidos-entregues');

    const total = pedidosList.length;
    const pendentes = pedidosList.filter(p => p.status === 'Pendente');
    const andamento = pedidosList.filter(p => p.status === 'Em produção' || p.status === 'Enviado');
    const entregues = pedidosList.filter(p => p.status === 'Entregue');

    let totalFaixasPendentes = 0;
    if (isColoridasTab) {
        pendentes.forEach(p => {
            if (Array.isArray(p.itens)) {
                totalFaixasPendentes += p.itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
            }
        });
    } else {
        totalFaixasPendentes = pendentes.length;
    }

    if (totalEl) totalEl.textContent = total;
    if (pendentesEl) pendentesEl.textContent = pendentes.length;
    if (itensPendentesEl) {
        itensPendentesEl.textContent = totalFaixasPendentes > 0
            ? `(${totalFaixasPendentes} ${isColoridasTab ? 'faixas' : 'itens'})`
            : '';
    }
    if (andamentoEl) andamentoEl.textContent = andamento.length;
    if (entreguesEl) entreguesEl.textContent = entregues.length;
}

// ============================================================================
// MODAL DE NOVO / EDITAR PEDIDO MANUAL
// ============================================================================

function openModal() {
    const modal = document.getElementById('pedido-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModal() {
    const modal = document.getElementById('pedido-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentEditingPedidoId = null;
    itensPedido = [];
    renderItensPedido();
    document.getElementById('unidade-select').value = '';
    document.getElementById('status-select').value = 'Pendente';
    document.getElementById('justificativa-input').value = '';
    document.getElementById('justificativa-container').classList.add('hidden');
}

function handleStatusChange(event) {
    const status = event.target.value;
    const containerId = event.target.id === 'status-select' ? 'justificativa-container' :
        event.target.id === 'status-preta-select' ? 'justificativa-preta-container' :
            'justificativa-dobok-container';

    const container = document.getElementById(containerId);
    if (container) {
        if (status === 'Cancelado') {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }
}

async function fetchEvoUnits() {
    try {
        const functions = getFunctions();
        const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
        const result = await getEvoUnits();
        return result.data;
    } catch (error) {
        console.error("Erro ao buscar unidades do EVO:", error);
        return ['centro', 'coqueiros', 'asa-sul', 'sudoeste', 'lago-sul', 'pontos-de-ensino', 'jardim-botanico', 'dourados', 'santa-monica', 'noroeste'];
    }
}

async function loadUnidades() {
    const unidadeSelects = [
        document.getElementById('unidade-select'),
        document.getElementById('unidade-preta-select'),
        document.getElementById('unidade-dobok-select'),
        document.getElementById('filter-unidade-dobok'),
        document.getElementById('filter-unidade-global'),
        document.getElementById('auto-unidade-select')
    ];

    try {
        const unidades = await fetchEvoUnits();
        unidades.sort();

        unidadeSelects.forEach(select => {
            if (select) {
                const isGlobalFilter = select.id === 'filter-unidade-global';
                const isDobokFilter = select.id === 'filter-unidade-dobok';
                const isAutoSelect = select.id === 'auto-unidade-select';

                let firstOptionText = 'Selecione uma unidade';
                if (isGlobalFilter) firstOptionText = 'Todas as Unidades';
                else if (isDobokFilter) firstOptionText = 'Todas';
                else if (isAutoSelect) firstOptionText = 'Selecione uma unidade...';

                select.innerHTML = `<option value="">${firstOptionText}</option>`;
                if (isAutoSelect) {
                    const allOpt = document.createElement('option');
                    allOpt.value = 'todas';
                    allOpt.textContent = 'Todas as Unidades (Consolidado)';
                    select.appendChild(allOpt);
                }

                unidades.forEach(unidade => {
                    const option = document.createElement('option');
                    option.value = unidade;
                    option.textContent = formatUnitDisplayName(unidade);
                    select.appendChild(option);
                });
            }
        });
    } catch (error) {
        console.error("Erro ao carregar unidades:", error);
    }
}

function populateSelects() {
    const faixaSelect = document.getElementById('faixa-select');
    const tamanhoSelect = document.getElementById('tamanho-select');
    const tamanhoDobokSelect = document.getElementById('tamanho-dobok-select');

    if (faixaSelect) {
        faixaSelect.innerHTML = '';
        faixas.forEach(faixa => {
            const option = document.createElement('option');
            option.value = faixa;
            option.textContent = faixa;
            faixaSelect.appendChild(option);
        });
    }

    if (tamanhoSelect) {
        tamanhoSelect.innerHTML = '';
        tamanhos.forEach(tamanho => {
            const option = document.createElement('option');
            option.value = tamanho;
            option.textContent = tamanho;
            tamanhoSelect.appendChild(option);
        });
    }

    if (tamanhoDobokSelect) {
        tamanhoDobokSelect.innerHTML = '';
        tamanhosDobok.forEach(tamanho => {
            const option = document.createElement('option');
            option.value = tamanho;
            option.textContent = tamanho;
            tamanhoDobokSelect.appendChild(option);
        });
    }
}

function renderItensPedido() {
    const container = document.getElementById('itens-pedido-container');
    const submitBtn = document.getElementById('submit-pedido-btn');
    if (!container || !submitBtn) return;

    if (itensPedido.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 italic py-2">Nenhum item adicionado ainda.</p>';
        submitBtn.disabled = true;
    } else {
        container.innerHTML = itensPedido.map((item, index) => {
            const style = getBeltBadgeStyle(item.faixa);
            return `
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
                    <div class="flex items-center gap-2.5">
                        <span class="w-3 h-3 rounded-full shrink-0 ${style.dot}"></span>
                        <span class="text-sm font-bold text-gray-900 dark:text-white">${item.quantidade}x</span>
                        <span class="text-sm font-medium text-gray-800 dark:text-gray-200">${item.faixa}</span>
                        <span class="px-2 py-0.5 text-[11px] font-bold rounded-md bg-gray-200/70 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Tam: ${item.tamanho}</span>
                    </div>
                    <button data-index="${index}" type="button" class="remove-item-btn w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">&times;</button>
                </div>
            `;
        }).join('');
        submitBtn.disabled = false;
    }
}

function handleAddItem(event) {
    event.preventDefault();
    const faixa = document.getElementById('faixa-select').value;
    const tamanho = document.getElementById('tamanho-select').value;
    const quantidade = parseInt(document.getElementById('quantidade-input').value, 10);

    if (faixa && tamanho && quantidade > 0) {
        const existingItem = itensPedido.find(item => item.faixa === faixa && item.tamanho === tamanho);
        if (existingItem) {
            existingItem.quantidade += quantidade;
        } else {
            itensPedido.push({ faixa, tamanho, quantidade });
        }
        renderItensPedido();
        document.getElementById('quantidade-input').value = 1;
    }
}

function handleRemoveItem(event) {
    const btn = event.target.closest('.remove-item-btn');
    if (btn) {
        const index = parseInt(btn.dataset.index, 10);
        itensPedido.splice(index, 1);
        renderItensPedido();
    }
}

async function handleSubmitPedido() {
    const user = await getCurrentUser();
    if (!user) {
        alert("Você precisa estar logado para fazer um pedido.");
        return;
    }

    const unidadeSelecionada = document.getElementById('unidade-select').value;
    if (!unidadeSelecionada) {
        alert("Por favor, selecione a unidade que está fazendo o pedido.");
        return;
    }

    if (itensPedido.length === 0) {
        alert("Nenhum item foi adicionado ao pedido.");
        return;
    }

    const statusSelecionado = document.getElementById('status-select').value;
    const justificativa = document.getElementById('justificativa-input').value.trim();

    if (statusSelecionado === 'Cancelado' && !justificativa) {
        alert("Para cancelar o pedido, é obrigatório informar a justificativa.");
        return;
    }

    try {
        if (currentEditingPedidoId) {
            const pedidoRef = doc(db, "pedidosFaixas", currentEditingPedidoId);
            await updateDoc(pedidoRef, {
                unidade: unidadeSelecionada,
                itens: itensPedido,
                status: statusSelecionado,
                justificativa: statusSelecionado === 'Cancelado' ? justificativa : null,
                lastUpdatedBy: { uid: user.id, nome: user.name || user.email },
                lastUpdatedAt: serverTimestamp()
            });
            alert("Pedido atualizado com sucesso!");
        } else {
            await addDoc(collection(db, "pedidosFaixas"), {
                unidade: unidadeSelecionada,
                itens: itensPedido,
                data: serverTimestamp(),
                status: "Pendente",
                justificativa: null,
                solicitante: { uid: user.id, nome: user.name || user.email }
            });
            alert("Pedido enviado com sucesso!");
        }

        closeModal();
        loadPedidos();
    } catch (error) {
        console.error("Erro ao salvar pedido: ", error);
        alert("Ocorreu um erro ao salvar o pedido. Tente novamente.");
    }
}

// ============================================================================
// TABELA DE FAIXAS COLORIDAS E FILTROS
// ============================================================================

function renderColoridasRows(pedidos) {
    const tableBody = document.getElementById('pedidos-table-body');
    if (!tableBody) return;

    const searchVal = (document.getElementById('filter-search-global')?.value || '').toLowerCase().trim();
    const unitVal = document.getElementById('filter-unidade-global')?.value || '';
    const statusVal = document.getElementById('filter-status-global')?.value || '';

    const filtered = pedidos.filter(pedido => {
        if (unitVal && (pedido.unidade || '').toLowerCase() !== unitVal.toLowerCase()) return false;
        if (statusVal && pedido.status !== statusVal) return false;
        if (searchVal) {
            const unitMatch = (pedido.unidade || '').toLowerCase().includes(searchVal);
            const itemMatch = Array.isArray(pedido.itens) && pedido.itens.some(it =>
                (it.faixa || '').toLowerCase().includes(searchVal) ||
                (it.tamanho || '').toLowerCase().includes(searchVal)
            );
            const solicitanteMatch = (pedido.solicitante?.nome || '').toLowerCase().includes(searchVal);
            if (!unitMatch && !itemMatch && !solicitanteMatch) return false;
        }
        return true;
    });

    updateKpiCards(filtered, true);

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center p-10 text-gray-400 dark:text-gray-500 text-sm">
                    <i class="fas fa-inbox text-2xl mb-2 block opacity-50"></i>
                    Nenhum pedido encontrado com os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map(pedido => {
        const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
        const items = Array.isArray(pedido.itens) ? pedido.itens : [];
        const totalFaixas = items.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);

        const visibleItems = items.slice(0, 4).map(item => {
            const style = getBeltBadgeStyle(item.faixa);
            return `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.pill}">
                    <span class="w-2 h-2 rounded-full shrink-0 ${style.dot}"></span>
                    <strong class="font-extrabold">${item.quantidade}x</strong>
                    <span>${item.faixa}</span>
                    <span class="opacity-70 text-[10px] font-bold">(${item.tamanho || '-'})</span>
                </span>
            `;
        }).join('');

        const extraCount = items.length > 4 ? `<span class="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">+${items.length - 4} faixas</span>` : '';

        return `
            <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group" data-id="${pedido.id}">
                <td class="p-4 text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">${data}</td>
                <td class="p-4 text-xs md:text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
                        ${formatUnitDisplayName(pedido.unidade)}
                    </div>
                </td>
                <td class="p-4">
                    <div class="flex flex-wrap items-center gap-1.5">
                        ${visibleItems}
                        ${extraCount}
                    </div>
                </td>
                <td class="p-4 text-center whitespace-nowrap">
                    <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-extrabold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                        ${totalFaixas} un.
                    </span>
                </td>
                <td class="p-4 whitespace-nowrap">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusClasses(pedido.status)}">${pedido.status}</span>
                </td>
                <td class="p-4 text-right whitespace-nowrap">
                    <button type="button" class="text-xs font-bold text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors px-2 py-1 rounded-lg">
                        Detalhes <i class="fas fa-chevron-right ml-1 text-[10px]"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadPedidos() {
    const tableBody = document.getElementById('pedidos-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando histórico de pedidos...</td></tr>';

    try {
        const q = query(collection(db, "pedidosFaixas"), orderBy("data", "desc"));
        const querySnapshot = await getDocs(q);

        cachedPedidosColoridas = [];
        querySnapshot.forEach(docSnap => {
            cachedPedidosColoridas.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderColoridasRows(cachedPedidosColoridas);
    } catch (error) {
        console.error("Erro ao carregar pedidos: ", error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-6 text-red-500 text-sm">Erro ao carregar o histórico.</td></tr>';
    }
}

async function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.id) {
        openDetailsModal(row.dataset.id);
    }
}

async function openDetailsModal(pedidoId) {
    const modal = document.getElementById('details-modal');
    if (!modal) return;

    try {
        const pedidoRef = doc(db, "pedidosFaixas", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);

        if (!pedidoSnap.exists()) {
            alert("Pedido não encontrado.");
            return;
        }

        const pedido = pedidoSnap.data();
        const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleString('pt-BR') : 'N/A';

        document.getElementById('details-unidade').textContent = formatUnitDisplayName(pedido.unidade);
        document.getElementById('details-data').textContent = data;
        document.getElementById('details-status').textContent = pedido.status;
        document.getElementById('details-status').className = `inline-block font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider ${getStatusClasses(pedido.status)}`;
        document.getElementById('details-solicitante').textContent = pedido.solicitante?.nome || 'Não informado';
        document.getElementById('details-itens').innerHTML = (pedido.itens || []).map(item => {
            const style = getBeltBadgeStyle(item.faixa);
            return `
                <li class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50 rounded-xl">
                    <div class="flex items-center gap-2.5">
                        <span class="w-3 h-3 rounded-full shrink-0 ${style.dot}"></span>
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">${item.faixa}</span>
                        <span class="text-xs font-bold text-gray-500 dark:text-gray-400">(${item.tamanho || '-'})</span>
                    </div>
                    <span class="text-xs font-extrabold text-gray-800 dark:text-gray-200 bg-gray-200/70 dark:bg-gray-700 px-2.5 py-1 rounded-lg">x${item.quantidade}</span>
                </li>
            `;
        }).join('');

        const justificativaContainer = document.getElementById('details-justificativa-container');
        if (pedido.status === 'Cancelado' && pedido.justificativa) {
            document.getElementById('details-justificativa').textContent = pedido.justificativa;
            justificativaContainer.classList.remove('hidden');
        } else {
            justificativaContainer.classList.add('hidden');
        }

        const user = await getCurrentUser();
        const adminActions = document.getElementById('details-admin-actions');
        const editBtn = document.getElementById('edit-pedido-btn');
        const deleteBtn = document.getElementById('delete-pedido-btn');

        if (user) {
            const isAdmin = await checkAdminStatus(user);
            adminActions.classList.remove('hidden');
            editBtn.classList.remove('hidden');
            editBtn.dataset.id = pedidoId;

            if (isAdmin) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.dataset.id = pedidoId;
            } else {
                deleteBtn.classList.add('hidden');
            }
        } else {
            adminActions.classList.add('hidden');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (error) {
        console.error("Erro ao abrir detalhes do pedido:", error);
        alert("Não foi possível carregar os detalhes do pedido.");
    }
}

function closeDetailsModal() {
    const modal = document.getElementById('details-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleEditPedido(event) {
    const pedidoId = event.target.dataset.id;
    if (!pedidoId) return;

    closeDetailsModal();

    const pedidoRef = doc(db, "pedidosFaixas", pedidoId);
    const pedidoSnap = await getDoc(pedidoRef);
    if (pedidoSnap.exists()) {
        const pedido = pedidoSnap.data();
        currentEditingPedidoId = pedidoId;

        document.getElementById('pedido-modal-title').textContent = 'Editar Pedido';
        document.getElementById('unidade-select').value = pedido.unidade;

        const statusSelect = document.getElementById('status-select');
        if (statusSelect) {
            statusSelect.value = pedido.status;
        }

        const justificativaContainer = document.getElementById('justificativa-container');
        if (pedido.status === 'Cancelado') {
            justificativaContainer.classList.remove('hidden');
            document.getElementById('justificativa-input').value = pedido.justificativa || '';
        } else {
            justificativaContainer.classList.add('hidden');
            document.getElementById('justificativa-input').value = '';
        }

        itensPedido = [...(pedido.itens || [])];
        renderItensPedido();
        openModal();
    }
}

async function handleDeletePedido(event) {
    const pedidoId = event.target.dataset.id;
    if (!pedidoId) return;

    if (confirm("Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.")) {
        try {
            await deleteDoc(doc(db, "pedidosFaixas", pedidoId));
            alert("Pedido excluído com sucesso.");
            closeDetailsModal();
            loadPedidos();
        } catch (error) {
            console.error("Erro ao excluir pedido:", error);
            alert("Não foi possível excluir o pedido.");
        }
    }
}

// ============================================================================
// MODAL: GERAR PEDIDO POR ALUNOS ATIVOS (PRÓXIMA FAIXA)
// ============================================================================

function openAutoPedidoModal() {
    const modal = document.getElementById('auto-pedido-modal');
    if (modal) {
        // Se já houver filtro global de unidade selecionado, pré-selecionar
        const globalUnit = document.getElementById('filter-unidade-global')?.value;
        const autoUnitSelect = document.getElementById('auto-unidade-select');
        if (globalUnit && autoUnitSelect) {
            autoUnitSelect.value = globalUnit;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAutoPedidoModal() {
    const modal = document.getElementById('auto-pedido-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function normalizeUnitSlug(u) {
    if (!u) return '';
    const clean = String(u).toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^kihap\s*-\s*/, '')
        .replace(/\s+/g, '-');
    if (clean.includes('florianopolis')) return 'centro';
    return clean;
}

function isStudentActive(studentData) {
    const st = String(studentData.status ?? '').toLowerCase();
    const mst = String(studentData.membershipStatus ?? studentData.statusMember ?? '').toLowerCase();
    return st === '1' || st === 'ativo' || st === 'active' || mst === 'ativo' || mst === 'active';
}

async function handleCalculateAutoPedido() {
    const unitSelect = document.getElementById('auto-unidade-select');
    const defaultSizeSelect = document.getElementById('auto-default-size-select');
    const resultsContainer = document.getElementById('auto-pedido-results-container');
    const summaryBanner = document.getElementById('auto-pedido-summary');
    const confirmBtn = document.getElementById('confirm-auto-pedido-btn');
    const openInManualBtn = document.getElementById('open-in-manual-modal-btn');

    const selectedUnit = unitSelect?.value || '';
    const defaultSize = defaultSizeSelect?.value || 'M';

    if (!selectedUnit) {
        alert("Por favor, selecione uma unidade para calcular as próximas faixas dos alunos ativos.");
        return;
    }

    resultsContainer.innerHTML = `
        <div class="text-center py-10 text-gray-500 text-sm">
            <i class="fas fa-spinner fa-spin text-2xl text-indigo-500 mb-3 block"></i>
            Analisando alunos ativos da unidade <strong>${formatUnitDisplayName(selectedUnit)}</strong> e calculando próximas faixas...
        </div>
    `;
    confirmBtn.disabled = true;
    openInManualBtn.disabled = true;

    try {
        const targetUnitNorm = normalizeUnitSlug(selectedUnit);

        // 1. Buscar alunos de evo_students e users em paralelo para ter 100% de cobertura
        const [evoSnap, usersSnap] = await Promise.all([
            getDocs(collection(db, 'evo_students')),
            getDocs(collection(db, 'users'))
        ]);

        // Mapa de enriquecimento a partir da coleção users (por evoMemberId)
        const usersByEvoId = new Map();
        usersSnap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.evoMemberId !== undefined && d.evoMemberId !== null && d.evoMemberId !== '') {
                usersByEvoId.set(Number(d.evoMemberId), d);
            }
        });

        let totalActiveInUnit = 0;
        let totalWithNextBelt = 0;
        let totalWithoutBelt = 0;
        const missingStudentsNames = [];

        // Agrupador por próxima faixa
        const groupsMap = new Map(); // nextBelt -> { nextBelt, totalQty, breakdownMap: Map<currentBelt, count> }

        evoSnap.forEach(docSnap => {
            const evoData = docSnap.data();
            const docUnitNorm = normalizeUnitSlug(evoData.unitId || evoData.branchName || '');

            if (selectedUnit !== 'todas' && docUnitNorm !== targetUnitNorm && !docUnitNorm.includes(targetUnitNorm)) {
                return;
            }

            if (!isStudentActive(evoData)) {
                return;
            }

            totalActiveInUnit++;

            const idMember = Number(evoData.idMember || docSnap.id);
            const linkedUser = usersByEvoId.get(idMember);

            // Extrair faixa e categoria do aluno (priorizando dados sincronizados da EVO)
            const parsedFromEvo = parseEvoMemberLevel(evoData.memberLevel);
            const parsedFromUser = parseEvoMemberLevel(linkedUser?.memberLevel);

            const currentBelt = evoData.belt || evoData.graduacao || parsedFromEvo?.belt ||
                linkedUser?.belt || linkedUser?.graduacao || parsedFromUser?.belt || null;

            const currentRankType = evoData.rankType || parsedFromEvo?.rankType ||
                linkedUser?.rankType || parsedFromUser?.rankType || null;

            const progression = calculateNextBelt(currentBelt, currentRankType);

            if (!progression || !progression.nextBelt) {
                totalWithoutBelt++;
                const fullName = `${evoData.firstName || ''} ${evoData.lastName || ''}`.trim() || linkedUser?.name || `ID #${idMember}`;
                missingStudentsNames.push({ name: fullName, currentBelt: currentBelt || 'Sem faixa cadastrada' });
                return;
            }

            totalWithNextBelt++;
            const { nextBelt, currentBelt: normalizedCurrent, category } = progression;

            if (!groupsMap.has(nextBelt)) {
                groupsMap.set(nextBelt, {
                    nextBelt,
                    category,
                    totalQty: 0,
                    breakdownMap: new Map()
                });
            }

            const grp = groupsMap.get(nextBelt);
            grp.totalQty += 1;
            const sourceLabel = `${normalizedCurrent}`;
            grp.breakdownMap.set(sourceLabel, (grp.breakdownMap.get(sourceLabel) || 0) + 1);
        });

        // Atualizar contadores no banner
        summaryBanner.classList.remove('hidden');
        document.getElementById('auto-stat-ativos').textContent = totalActiveInUnit;
        document.getElementById('auto-stat-com-faixa').textContent = totalWithNextBelt;
        document.getElementById('auto-stat-sem-faixa').textContent = totalWithoutBelt;

        // Converter e ordenar os grupos na ordem oficial de faixas
        autoCalculatedGroups = Array.from(groupsMap.values())
            .sort((a, b) => {
                const idxA = BELT_SORT_ORDER.has(a.nextBelt.toLowerCase()) ? BELT_SORT_ORDER.get(a.nextBelt.toLowerCase()) : 999;
                const idxB = BELT_SORT_ORDER.has(b.nextBelt.toLowerCase()) ? BELT_SORT_ORDER.get(b.nextBelt.toLowerCase()) : 999;
                return idxA - idxB;
            })
            .map(grp => {
                const sizes = { PP: 0, P: 0, M: 0, G: 0, GG: 0 };
                sizes[defaultSize] = grp.totalQty;
                const sources = Array.from(grp.breakdownMap.entries()).map(([k, v]) => `${v}x atual ${k}`);
                return {
                    nextBelt: grp.nextBelt,
                    category: grp.category,
                    totalQty: grp.totalQty,
                    sources,
                    sizes
                };
            });

        renderAutoCalculatedGroups(missingStudentsNames);
    } catch (error) {
        console.error("Erro ao calcular pedido por alunos ativos:", error);
        resultsContainer.innerHTML = `<div class="p-6 text-center text-red-500 text-sm">Erro ao processar alunos ativos: ${error.message}</div>`;
    }
}

function renderAutoCalculatedGroups(missingStudents = []) {
    const resultsContainer = document.getElementById('auto-pedido-results-container');
    const confirmBtn = document.getElementById('confirm-auto-pedido-btn');
    const openInManualBtn = document.getElementById('open-in-manual-modal-btn');

    if (autoCalculatedGroups.length === 0) {
        resultsContainer.innerHTML = `
            <div class="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 text-gray-500 text-sm">
                Nenhuma faixa seguinte encontrada para os alunos ativos desta unidade.
            </div>
        `;
        confirmBtn.disabled = true;
        openInManualBtn.disabled = true;
        return;
    }

    confirmBtn.disabled = false;
    openInManualBtn.disabled = false;

    const rowsHtml = autoCalculatedGroups.map((group, groupIdx) => {
        const style = getBeltBadgeStyle(group.nextBelt);
        const allocated = Object.values(group.sizes).reduce((sum, v) => sum + (Number(v) || 0), 0);
        const isMatched = allocated === group.totalQty;
        const badgeColor = isMatched
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';

        const sizeInputsHtml = tamanhos.map(tam => `
            <div class="flex flex-col items-center">
                <label class="text-[10px] font-extrabold text-gray-400 uppercase mb-1">${tam}</label>
                <input type="number" min="0" value="${group.sizes[tam] || 0}"
                    data-group-idx="${groupIdx}" data-size="${tam}"
                    class="auto-size-input w-14 text-center py-1.5 px-1 text-xs font-bold rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
        `).join('');

        return `
            <div class="p-4 rounded-2xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2.5">
                        <span class="w-3.5 h-3.5 rounded-full shrink-0 ${style.dot}"></span>
                        <span class="text-sm md:text-base font-extrabold text-gray-900 dark:text-white">${group.nextBelt}</span>
                        <span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                            Meta: ${group.totalQty} ${group.totalQty === 1 ? 'faixa' : 'faixas'}
                        </span>
                        <span id="auto-alloc-badge-${groupIdx}" class="px-2 py-0.5 text-[10px] font-bold rounded-md ${badgeColor}">
                            Alocado: ${allocated}/${group.totalQty}
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 pl-6">
                        Origem: ${group.sources.join(' • ')}
                    </p>
                </div>

                <div class="flex items-center gap-2 self-end md:self-center">
                    ${sizeInputsHtml}
                </div>
            </div>
        `;
    }).join('');

    const missingHtml = missingStudents.length > 0 ? `
        <details class="mt-4 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs">
            <summary class="font-bold text-amber-700 dark:text-amber-400 cursor-pointer">
                Ver ${missingStudents.length} alunos ativos que não entraram no cálculo de faixas coloridas (sem faixa na EVO ou já Faixa Preta)
            </summary>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2">
                ${missingStudents.map(s => `
                    <div class="px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-gray-900/60 border border-amber-100 dark:border-amber-900/40 flex justify-between items-center gap-2">
                        <span class="truncate font-medium text-gray-800 dark:text-gray-200">${s.name}</span>
                        <span class="text-[10px] font-bold text-gray-400 shrink-0">${s.currentBelt}</span>
                    </div>
                `).join('')}
            </div>
        </details>
    ` : '';

    resultsContainer.innerHTML = rowsHtml + missingHtml;
}

function handleAutoSizeInputChange(event) {
    const input = event.target.closest('.auto-size-input');
    if (!input) return;

    const groupIdx = parseInt(input.dataset.groupIdx, 10);
    const size = input.dataset.size;
    const val = Math.max(0, parseInt(input.value, 10) || 0);

    if (autoCalculatedGroups[groupIdx]) {
        autoCalculatedGroups[groupIdx].sizes[size] = val;
        const grp = autoCalculatedGroups[groupIdx];
        const allocated = Object.values(grp.sizes).reduce((sum, v) => sum + (Number(v) || 0), 0);
        const badge = document.getElementById(`auto-alloc-badge-${groupIdx}`);
        if (badge) {
            badge.textContent = `Alocado: ${allocated}/${grp.totalQty}`;
            badge.className = `px-2 py-0.5 text-[10px] font-bold rounded-md ${
                allocated === grp.totalQty
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`;
        }
    }
}

function buildItemsFromAutoGroups() {
    const items = [];
    for (const grp of autoCalculatedGroups) {
        for (const tam of tamanhos) {
            const qty = parseInt(grp.sizes[tam], 10) || 0;
            if (qty > 0) {
                items.push({
                    faixa: grp.nextBelt,
                    tamanho: tam,
                    quantidade: qty
                });
            }
        }
    }
    return items;
}

function handleOpenAutoInManualModal() {
    const selectedUnit = document.getElementById('auto-unidade-select')?.value || '';
    const generatedItems = buildItemsFromAutoGroups();
    if (generatedItems.length === 0) {
        alert("Defina a quantidade em pelo menos um tamanho antes de prosseguir.");
        return;
    }

    closeAutoPedidoModal();
    currentEditingPedidoId = null;
    itensPedido = generatedItems;
    document.getElementById('pedido-modal-title').textContent = 'Novo Pedido (Baseado nos Alunos Ativos)';
    document.getElementById('unidade-select').value = selectedUnit;
    document.getElementById('status-select').value = 'Pendente';
    renderItensPedido();
    openModal();
}

async function handleConfirmAutoPedido() {
    const user = await getCurrentUser();
    if (!user) {
        alert("Você precisa estar logado para criar um pedido.");
        return;
    }

    const selectedUnit = document.getElementById('auto-unidade-select')?.value || '';
    if (!selectedUnit) {
        alert("Selecione uma unidade.");
        return;
    }

    const generatedItems = buildItemsFromAutoGroups();
    if (generatedItems.length === 0) {
        alert("Nenhuma faixa com quantidade maior que zero foi definida.");
        return;
    }

    const totalBelts = generatedItems.reduce((acc, it) => acc + it.quantidade, 0);
    if (!confirm(`Confirmar a criação do pedido para a unidade ${formatUnitDisplayName(selectedUnit)} com ${totalBelts} faixas seguintes?`)) {
        return;
    }

    try {
        await addDoc(collection(db, "pedidosFaixas"), {
            unidade: selectedUnit,
            itens: generatedItems,
            data: serverTimestamp(),
            status: "Pendente",
            origem: "alunos_ativos",
            justificativa: null,
            solicitante: { uid: user.id, nome: user.name || user.email }
        });
        alert("Pedido gerado com sucesso com base nos alunos ativos!");
        closeAutoPedidoModal();
        loadPedidos();
    } catch (error) {
        console.error("Erro ao criar pedido automático:", error);
        alert("Ocorreu um erro ao salvar o pedido.");
    }
}

// ============================================================================
// EXPORTAÇÃO DE PEDIDOS PENDENTES
// ============================================================================

async function exportPedidosPendentes() {
    try {
        let dataParaPlanilha = [];
        let nomeArquivo = '';

        if (activeTabIndex === 0) {
            const q = query(collection(db, "pedidosFaixas"), where("status", "==", "Pendente"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("Nenhum pedido pendente de faixas coloridas para exportar.");
                return;
            }

            const faixasAgregadas = {};
            querySnapshot.forEach(docSnap => {
                const pedido = docSnap.data();
                if (pedido.itens && Array.isArray(pedido.itens)) {
                    pedido.itens.forEach(item => {
                        const chave = `${item.faixa} | ${item.tamanho}`;
                        faixasAgregadas[chave] = (faixasAgregadas[chave] || 0) + item.quantidade;
                    });
                }
            });

            dataParaPlanilha = [["Faixa", "Tamanho", "Quantidade Total"]];
            const sortedItems = Object.keys(faixasAgregadas).map(chave => {
                const [faixa, tamanho] = chave.split(' | ');
                return [faixa, tamanho, faixasAgregadas[chave]];
            }).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

            sortedItems.forEach(item => dataParaPlanilha.push(item));
            nomeArquivo = `Pedidos_Faixas_Coloridas_Pendentes`;

        } else if (activeTabIndex === 1) {
            const q = query(collection(db, "pedidosFaixasPretas"), where("status", "==", "Pendente"), orderBy("data", "desc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("Nenhum pedido pendente de faixas pretas para exportar.");
                return;
            }

            dataParaPlanilha = [["Data", "Unidade", "Aluno", "Faixa", "Tamanho"]];
            querySnapshot.forEach(docSnap => {
                const pedido = docSnap.data();
                const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
                dataParaPlanilha.push([
                    data,
                    pedido.unidade || '',
                    pedido.aluno || '',
                    pedido.faixa || '',
                    pedido.tamanho || ''
                ]);
            });
            nomeArquivo = `Pedidos_Faixas_Pretas_Pendentes`;

        } else if (activeTabIndex === 2) {
            const q = query(collection(db, "pedidosDoboks"), where("status", "==", "Pendente"), orderBy("data", "desc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("Nenhum pedido pendente de doboks para exportar.");
                return;
            }

            dataParaPlanilha = [["Data", "Unidade", "Aluno", "Tipo", "Tamanho", "Colarinho"]];
            querySnapshot.forEach(docSnap => {
                const pedido = docSnap.data();
                const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
                const tipo = pedido.isFaixaPreta ? 'Faixa Preta' : 'Comum';
                dataParaPlanilha.push([
                    data,
                    pedido.unidade || '',
                    pedido.aluno || '',
                    tipo,
                    pedido.tamanho || '',
                    pedido.colarinho || ''
                ]);
            });
            nomeArquivo = `Pedidos_Doboks_Pendentes`;
        }

        const ws = XLSX.utils.aoa_to_sheet(dataParaPlanilha);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pedidos Pendentes");

        const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        XLSX.writeFile(wb, `${nomeArquivo}_${today}.xlsx`);
    } catch (error) {
        console.error("Erro ao exportar pedidos: ", error);
        alert("Ocorreu um erro ao exportar os pedidos.");
    }
}

// ============================================================================
// SETUP DA PÁGINA E ABAS (COLORIDAS, PRETAS, DOBOKS)
// ============================================================================

function openNewPedidoModal() {
    currentEditingPedidoId = null;
    itensPedido = [];
    document.getElementById('pedido-modal-title').textContent = 'Novo Pedido de Faixas';
    document.getElementById('unidade-select').value = '';
    document.getElementById('status-select').value = 'Pendente';
    renderItensPedido();
    document.getElementById('justificativa-input').value = '';
    document.getElementById('justificativa-container').classList.add('hidden');
    openModal();
}

export function setupPedidosPage() {
    loadPedidos();
    populateSelects();
    loadUnidades();

    // Listeners do Modal de Novo/Edição de Pedido Manual
    document.getElementById('open-pedido-modal-btn')?.addEventListener('click', openNewPedidoModal);
    document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('cancel-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('add-item-form')?.addEventListener('submit', handleAddItem);
    document.getElementById('itens-pedido-container')?.addEventListener('click', handleRemoveItem);
    document.getElementById('submit-pedido-btn')?.addEventListener('click', handleSubmitPedido);

    // Listeners do Modal de Pedido por Alunos Ativos
    document.getElementById('open-auto-pedido-modal-btn')?.addEventListener('click', openAutoPedidoModal);
    document.getElementById('close-auto-pedido-modal-btn')?.addEventListener('click', closeAutoPedidoModal);
    document.getElementById('cancel-auto-pedido-btn')?.addEventListener('click', closeAutoPedidoModal);
    document.getElementById('calculate-auto-pedido-btn')?.addEventListener('click', handleCalculateAutoPedido);
    document.getElementById('auto-pedido-results-container')?.addEventListener('input', handleAutoSizeInputChange);
    document.getElementById('open-in-manual-modal-btn')?.addEventListener('click', handleOpenAutoInManualModal);
    document.getElementById('confirm-auto-pedido-btn')?.addEventListener('click', handleConfirmAutoPedido);

    // Listeners de Busca e Filtros Globais
    const triggerCurrentTabFilter = () => {
        if (activeTabIndex === 0) renderColoridasRows(cachedPedidosColoridas);
        else if (activeTabIndex === 1) renderPretasRows(cachedPedidosPretas);
        else if (activeTabIndex === 2) renderDoboksRows(cachedPedidosDoboks);
    };
    document.getElementById('filter-search-global')?.addEventListener('input', triggerCurrentTabFilter);
    document.getElementById('filter-unidade-global')?.addEventListener('change', triggerCurrentTabFilter);
    document.getElementById('filter-status-global')?.addEventListener('change', triggerCurrentTabFilter);

    // Listeners da Tabela Principal e Modal de Detalhes
    document.getElementById('refresh-pedidos')?.addEventListener('click', () => {
        if (activeTabIndex === 0) loadPedidos();
        else if (activeTabIndex === 1) loadPedidosPretas();
        else if (activeTabIndex === 2) loadPedidosDoboks();
    });
    document.getElementById('pedidos-table-body')?.addEventListener('click', handleTableClick);
    document.getElementById('close-details-modal-btn')?.addEventListener('click', closeDetailsModal);
    document.getElementById('edit-pedido-btn')?.addEventListener('click', handleEditPedido);
    document.getElementById('delete-pedido-btn')?.addEventListener('click', handleDeletePedido);
    document.getElementById('export-pedidos-btn')?.addEventListener('click', exportPedidosPendentes);

    document.getElementById('status-select')?.addEventListener('change', handleStatusChange);
    document.getElementById('status-preta-select')?.addEventListener('change', handleStatusChange);
    document.getElementById('status-dobok-select')?.addEventListener('change', handleStatusChange);

    // --- Aba de Faixas Pretas ---
    function openFaixaPretaModal() {
        const modal = document.getElementById('faixa-preta-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeFaixaPretaModal() {
        const modal = document.getElementById('faixa-preta-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.getElementById('aluno-preta-input').value = '';
            document.getElementById('unidade-preta-select').value = '';
            document.getElementById('faixa-preta-select').value = 'Preta 1º Dan';
            document.getElementById('tamanho-preta-input').value = '';
            document.getElementById('justificativa-preta-input').value = '';
            document.getElementById('justificativa-preta-container').classList.add('hidden');
        }
    }

    async function handleSubmitFaixaPretaPedido() {
        const user = await getCurrentUser();
        if (!user) {
            alert("Você precisa estar logado para fazer um pedido.");
            return;
        }

        const unidade = document.getElementById('unidade-preta-select').value;
        const status = document.getElementById('status-preta-select').value;
        const aluno = document.getElementById('aluno-preta-input').value.trim();
        const faixa = document.getElementById('faixa-preta-select').value;
        const tamanho = document.getElementById('tamanho-preta-input').value;
        const justificativa = document.getElementById('justificativa-preta-input').value.trim();

        if (status === 'Cancelado' && !justificativa) {
            alert("Para cancelar o pedido, é obrigatório informar a justificativa.");
            return;
        }

        if (!unidade || !aluno || !tamanho) {
            alert("Por favor, preencha todos os campos, incluindo o tamanho da faixa.");
            return;
        }

        try {
            if (currentEditingPretaPedidoId) {
                const pedidoRef = doc(db, "pedidosFaixasPretas", currentEditingPretaPedidoId);
                await updateDoc(pedidoRef, {
                    unidade,
                    aluno,
                    faixa,
                    tamanho,
                    status,
                    justificativa: status === 'Cancelado' ? justificativa : null,
                    lastUpdatedBy: { uid: user.id, nome: user.name || user.email },
                    lastUpdatedAt: serverTimestamp()
                });
                alert("Pedido de faixa preta atualizado com sucesso!");
                currentEditingPretaPedidoId = null;
            } else {
                await addDoc(collection(db, "pedidosFaixasPretas"), {
                    unidade,
                    aluno,
                    faixa,
                    tamanho,
                    status,
                    justificativa: status === 'Cancelado' ? justificativa : null,
                    data: serverTimestamp(),
                    solicitante: { uid: user.id, nome: user.name || user.email }
                });
                alert("Pedido de faixa preta enviado com sucesso!");
            }
            closeFaixaPretaModal();
            loadPedidosPretas();
        } catch (error) {
            console.error("Erro ao salvar pedido de faixa preta: ", error);
            alert("Ocorreu um erro ao salvar o pedido. Tente novamente.");
        }
    }

    function renderPretasRows(pedidos) {
        const tableBody = document.getElementById('pedidos-pretas-table-body');
        if (!tableBody) return;

        const searchVal = (document.getElementById('filter-search-global')?.value || '').toLowerCase().trim();
        const unitVal = document.getElementById('filter-unidade-global')?.value || '';
        const statusVal = document.getElementById('filter-status-global')?.value || '';

        const filtered = pedidos.filter(pedido => {
            if (unitVal && (pedido.unidade || '').toLowerCase() !== unitVal.toLowerCase()) return false;
            if (statusVal && pedido.status !== statusVal) return false;
            if (searchVal) {
                const m = (pedido.aluno || '').toLowerCase().includes(searchVal) ||
                    (pedido.faixa || '').toLowerCase().includes(searchVal) ||
                    (pedido.unidade || '').toLowerCase().includes(searchVal);
                if (!m) return false;
            }
            return true;
        });

        if (activeTabIndex === 1) updateKpiCards(filtered, false);

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-10 text-gray-400 text-sm">Nenhum pedido de faixa preta encontrado.</td></tr>';
            return;
        }

        tableBody.innerHTML = filtered.map(pedido => {
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group" data-id="${pedido.id}">
                    <td class="p-4 text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">${data}</td>
                    <td class="p-4 text-xs md:text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">${formatUnitDisplayName(pedido.unidade)}</td>
                    <td class="p-4 text-xs md:text-sm font-bold text-blue-600 dark:text-blue-400">${pedido.aluno || 'N/A'}</td>
                    <td class="p-4 text-xs md:text-sm text-gray-700 dark:text-gray-300">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
                            ${pedido.faixa} ${pedido.tamanho ? `(${pedido.tamanho} cm)` : ''}
                        </span>
                    </td>
                    <td class="p-4 whitespace-nowrap">
                        <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusClasses(pedido.status)}">${pedido.status}</span>
                    </td>
                    <td class="p-4 text-right whitespace-nowrap">
                        <button type="button" class="text-xs font-bold text-gray-400 group-hover:text-blue-600 transition-colors px-2 py-1">
                            Detalhes <i class="fas fa-chevron-right ml-1 text-[10px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function loadPedidosPretas() {
        const tableBody = document.getElementById('pedidos-pretas-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando...</td></tr>';

        try {
            const q = query(collection(db, "pedidosFaixasPretas"), orderBy("data", "desc"));
            const querySnapshot = await getDocs(q);

            cachedPedidosPretas = [];
            querySnapshot.forEach(docSnap => {
                cachedPedidosPretas.push({ id: docSnap.id, ...docSnap.data() });
            });

            renderPretasRows(cachedPedidosPretas);
        } catch (error) {
            console.error("Erro ao carregar pedidos de faixas pretas: ", error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-6 text-red-500 text-sm">Erro ao carregar pedidos.</td></tr>';
        }
    }

    function setupTabs() {
        const tabColoridas = document.getElementById('tab-coloridas');
        const tabPretas = document.getElementById('tab-pretas');
        const tabDoboks = document.getElementById('tab-doboks');
        const contentColoridas = document.getElementById('tab-content-coloridas');
        const contentPretas = document.getElementById('tab-content-pretas');
        const contentDoboks = document.getElementById('tab-content-doboks');
        const btnNovoColorida = document.getElementById('open-pedido-modal-btn');
        const btnAutoColorida = document.getElementById('open-auto-pedido-modal-btn');
        const btnNovoPreta = document.getElementById('open-faixa-preta-modal-btn');
        const btnNovoDobok = document.getElementById('open-dobok-modal-btn');

        const tabs = [tabColoridas, tabPretas, tabDoboks];
        const contents = [contentColoridas, contentPretas, contentDoboks];

        const activeClasses = ['bg-white', 'dark:bg-[#1a1a1a]', 'text-gray-900', 'dark:text-white', 'shadow-sm', 'font-bold'];
        const inactiveClasses = ['text-gray-500', 'dark:text-gray-400', 'font-semibold'];

        tabs.forEach((tab, index) => {
            if (tab) {
                tab.addEventListener('click', () => {
                    activeTabIndex = index;
                    tabs.forEach(t => {
                        t.classList.remove(...activeClasses);
                        t.classList.add(...inactiveClasses);
                    });
                    contents.forEach(c => c.classList.add('hidden'));

                    tab.classList.remove(...inactiveClasses);
                    tab.classList.add(...activeClasses);
                    if (contents[index]) contents[index].classList.remove('hidden');

                    btnNovoColorida?.classList.add('hidden');
                    btnAutoColorida?.classList.add('hidden');
                    btnNovoPreta?.classList.add('hidden');
                    btnNovoDobok?.classList.add('hidden');

                    if (index === 0) {
                        btnNovoColorida?.classList.remove('hidden');
                        btnAutoColorida?.classList.remove('hidden');
                        loadPedidos();
                    } else if (index === 1) {
                        btnNovoPreta?.classList.remove('hidden');
                        loadPedidosPretas();
                    } else if (index === 2) {
                        btnNovoDobok?.classList.remove('hidden');
                        loadPedidosDoboks();
                    }
                });
            }
        });
    }

    setupTabs();
    loadPedidosPretas();
    document.getElementById('open-faixa-preta-modal-btn')?.addEventListener('click', openFaixaPretaModal);
    document.getElementById('close-faixa-preta-modal-btn')?.addEventListener('click', closeFaixaPretaModal);
    document.getElementById('cancel-faixa-preta-btn')?.addEventListener('click', closeFaixaPretaModal);
    document.getElementById('submit-faixa-preta-btn')?.addEventListener('click', handleSubmitFaixaPretaPedido);
    document.getElementById('pedidos-pretas-table-body')?.addEventListener('click', handlePretasTableClick);
    document.getElementById('close-details-preta-modal-btn')?.addEventListener('click', closeDetailsPretaModal);
    document.getElementById('edit-preta-pedido-btn')?.addEventListener('click', handleEditPretaPedido);
    document.getElementById('delete-preta-pedido-btn')?.addEventListener('click', handleDeletePretaPedido);

    function handlePretasTableClick(event) {
        const row = event.target.closest('tr');
        if (row && row.dataset.id) {
            openDetailsPretaModal(row.dataset.id);
        }
    }

    async function openDetailsPretaModal(pedidoId) {
        const modal = document.getElementById('details-preta-modal');
        if (!modal) return;

        try {
            const pedidoRef = doc(db, "pedidosFaixasPretas", pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);

            if (!pedidoSnap.exists()) {
                alert("Pedido não encontrado.");
                return;
            }

            const pedido = pedidoSnap.data();
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleString('pt-BR') : 'N/A';

            document.getElementById('details-preta-unidade').textContent = formatUnitDisplayName(pedido.unidade);
            document.getElementById('details-preta-data').textContent = data;
            document.getElementById('details-preta-status').textContent = pedido.status;
            document.getElementById('details-preta-status').className = `inline-block font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider ${getStatusClasses(pedido.status)}`;
            document.getElementById('details-preta-solicitante').textContent = pedido.solicitante?.nome || 'Não informado';
            document.getElementById('details-preta-aluno').textContent = pedido.aluno;
            document.getElementById('details-preta-faixa').textContent = pedido.faixa;
            document.getElementById('details-preta-tamanho').textContent = pedido.tamanho ? `${pedido.tamanho} cm` : 'N/A';

            const justificativaContainer = document.getElementById('details-preta-justificativa-container');
            if (pedido.status === 'Cancelado' && pedido.justificativa) {
                document.getElementById('details-preta-justificativa').textContent = pedido.justificativa;
                justificativaContainer.classList.remove('hidden');
            } else {
                justificativaContainer.classList.add('hidden');
            }

            const user = await getCurrentUser();
            const adminActions = document.getElementById('details-preta-admin-actions');
            const editBtn = document.getElementById('edit-preta-pedido-btn');
            const deleteBtn = document.getElementById('delete-preta-pedido-btn');

            if (user) {
                const isAdmin = await checkAdminStatus(user);
                adminActions.classList.remove('hidden');
                editBtn.classList.remove('hidden');
                editBtn.dataset.id = pedidoId;

                if (isAdmin) {
                    deleteBtn.classList.remove('hidden');
                    deleteBtn.dataset.id = pedidoId;
                } else {
                    deleteBtn.classList.add('hidden');
                }
            } else {
                adminActions.classList.add('hidden');
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } catch (error) {
            console.error("Erro ao abrir detalhes do pedido:", error);
            alert("Não foi possível carregar os detalhes do pedido.");
        }
    }

    function closeDetailsPretaModal() {
        const modal = document.getElementById('details-preta-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async function handleEditPretaPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        closeDetailsPretaModal();

        const pedidoRef = doc(db, "pedidosFaixasPretas", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);
        if (pedidoSnap.exists()) {
            const pedido = pedidoSnap.data();
            currentEditingPretaPedidoId = pedidoId;

            document.getElementById('unidade-preta-select').value = pedido.unidade;
            document.getElementById('status-preta-select').value = pedido.status;
            document.getElementById('aluno-preta-input').value = pedido.aluno;
            document.getElementById('faixa-preta-select').value = pedido.faixa;
            document.getElementById('tamanho-preta-input').value = pedido.tamanho || '';

            const justificativaContainer = document.getElementById('justificativa-preta-container');
            if (pedido.status === 'Cancelado') {
                justificativaContainer.classList.remove('hidden');
                document.getElementById('justificativa-preta-input').value = pedido.justificativa || '';
            } else {
                justificativaContainer.classList.add('hidden');
                document.getElementById('justificativa-preta-input').value = '';
            }

            openFaixaPretaModal();
        }
    }

    async function handleDeletePretaPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        if (confirm("Tem certeza que deseja excluir este pedido de faixa preta?")) {
            try {
                await deleteDoc(doc(db, "pedidosFaixasPretas", pedidoId));
                alert("Pedido excluído com sucesso.");
                closeDetailsPretaModal();
                loadPedidosPretas();
            } catch (error) {
                console.error("Erro ao excluir pedido:", error);
                alert("Não foi possível excluir o pedido.");
            }
        }
    }

    // --- Aba de Doboks ---
    function openDobokModal(isEditing = false) {
        const modal = document.getElementById('dobok-modal');
        if (modal) {
            if (!isEditing) {
                document.getElementById('dobok-modal-title').textContent = 'Novo Pedido de Dobok';
                currentEditingDobokPedidoId = null;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeDobokModal() {
        const modal = document.getElementById('dobok-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.getElementById('aluno-dobok-input').value = '';
            document.getElementById('unidade-dobok-select').value = '';
            document.getElementById('tamanho-dobok-select').value = '';
            document.getElementById('colarinho-dobok-select').value = '';
            document.getElementById('faixa-preta-dobok-checkbox').checked = false;
            document.getElementById('justificativa-dobok-input').value = '';
            document.getElementById('justificativa-dobok-container').classList.add('hidden');
        }
    }

    async function handleSubmitDobokPedido() {
        const user = await getCurrentUser();
        if (!user) {
            alert("Você precisa estar logado para fazer um pedido.");
            return;
        }

        const unidade = document.getElementById('unidade-dobok-select').value;
        const status = document.getElementById('status-dobok-select').value;
        const aluno = document.getElementById('aluno-dobok-input').value.trim();
        const tamanho = document.getElementById('tamanho-dobok-select').value;
        const isFaixaPreta = document.getElementById('faixa-preta-dobok-checkbox').checked;
        const colarinho = document.getElementById('colarinho-dobok-select').value;
        const justificativa = document.getElementById('justificativa-dobok-input').value.trim();

        if (status === 'Cancelado' && !justificativa) {
            alert("Para cancelar o pedido, é obrigatório informar a justificativa.");
            return;
        }

        if (!unidade || !tamanho) {
            alert("Por favor, preencha a unidade e o tamanho.");
            return;
        }

        try {
            if (currentEditingDobokPedidoId) {
                const pedidoRef = doc(db, "pedidosDoboks", currentEditingDobokPedidoId);
                await updateDoc(pedidoRef, {
                    unidade,
                    aluno: aluno || null,
                    tamanho,
                    status,
                    justificativa: status === 'Cancelado' ? justificativa : null,
                    isFaixaPreta,
                    colarinho: colarinho || null,
                    lastUpdatedBy: { uid: user.id, nome: user.name || user.email },
                    lastUpdatedAt: serverTimestamp()
                });
                alert("Pedido de dobok atualizado com sucesso!");
                currentEditingDobokPedidoId = null;
            } else {
                await addDoc(collection(db, "pedidosDoboks"), {
                    unidade,
                    aluno: aluno || null,
                    tamanho,
                    status,
                    justificativa: status === 'Cancelado' ? justificativa : null,
                    isFaixaPreta,
                    colarinho: colarinho || null,
                    data: serverTimestamp(),
                    solicitante: { uid: user.id, nome: user.name || user.email }
                });
                alert("Pedido de dobok enviado com sucesso!");
            }
            closeDobokModal();
            loadPedidosDoboks();
        } catch (error) {
            console.error("Erro ao salvar pedido de dobok: ", error);
            alert("Ocorreu um erro ao salvar o pedido. Tente novamente.");
        }
    }

    function renderDoboksRows(pedidos) {
        const tableBody = document.getElementById('pedidos-doboks-table-body');
        if (!tableBody) return;

        const searchVal = (document.getElementById('filter-search-global')?.value || '').toLowerCase().trim();
        const globalUnitVal = document.getElementById('filter-unidade-global')?.value || '';
        const dobokUnitVal = document.getElementById('filter-unidade-dobok')?.value || '';
        const unitVal = dobokUnitVal || globalUnitVal;
        const statusVal = document.getElementById('filter-status-global')?.value || '';
        const filterFaixaPreta = document.getElementById('filter-faixa-preta-dobok')?.checked;
        const filterTradicional = document.getElementById('filter-tradicional-dobok')?.checked;

        const filtered = pedidos.filter(p => {
            if (unitVal && (p.unidade || '').toLowerCase() !== unitVal.toLowerCase()) return false;
            if (statusVal && p.status !== statusVal) return false;
            if (filterFaixaPreta && p.isFaixaPreta !== true) return false;
            if (filterTradicional && p.isFaixaPreta !== false) return false;
            if (searchVal) {
                const m = (p.aluno || '').toLowerCase().includes(searchVal) ||
                    (p.tamanho || '').toLowerCase().includes(searchVal) ||
                    (p.unidade || '').toLowerCase().includes(searchVal);
                if (!m) return false;
            }
            return true;
        });

        if (activeTabIndex === 2) updateKpiCards(filtered, false);

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-10 text-gray-400 text-sm">Nenhum pedido de dobok encontrado.</td></tr>';
            return;
        }

        tableBody.innerHTML = filtered.map(pedido => {
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
            const faixaPretaIndicator = pedido.isFaixaPreta ? '<span class="px-2 py-0.5 text-[10px] font-bold text-white bg-black dark:bg-white dark:text-black rounded-full uppercase">Preta</span>' : '';
            const colarinhoInfo = pedido.colarinho ? ` • Colarinho ${pedido.colarinho}` : '';
            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group" data-id="${pedido.id}">
                    <td class="p-4 text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">${data}</td>
                    <td class="p-4 text-xs md:text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">${formatUnitDisplayName(pedido.unidade)}</td>
                    <td class="p-4 text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        <div class="flex items-center gap-2">
                            ${pedido.aluno || 'Estoque da Unidade'}
                            ${faixaPretaIndicator}
                        </div>
                    </td>
                    <td class="p-4 text-xs md:text-sm text-gray-700 dark:text-gray-300 font-semibold">${pedido.tamanho}${colarinhoInfo}</td>
                    <td class="p-4 whitespace-nowrap">
                        <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusClasses(pedido.status)}">${pedido.status}</span>
                    </td>
                    <td class="p-4 text-right whitespace-nowrap">
                        <button type="button" class="text-xs font-bold text-gray-400 group-hover:text-blue-600 transition-colors px-2 py-1">
                            Detalhes <i class="fas fa-chevron-right ml-1 text-[10px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function loadPedidosDoboks() {
        const tableBody = document.getElementById('pedidos-doboks-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando...</td></tr>';

        try {
            const q = query(collection(db, "pedidosDoboks"), orderBy("data", "desc"));
            const querySnapshot = await getDocs(q);

            cachedPedidosDoboks = [];
            querySnapshot.forEach(docSnap => {
                cachedPedidosDoboks.push({ id: docSnap.id, ...docSnap.data() });
            });

            renderDoboksRows(cachedPedidosDoboks);
        } catch (error) {
            console.error("Erro ao carregar pedidos de doboks: ", error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-6 text-red-500 text-sm">Erro ao carregar pedidos.</td></tr>';
        }
    }

    document.getElementById('open-dobok-modal-btn')?.addEventListener('click', () => openDobokModal(false));
    document.getElementById('close-dobok-modal-btn')?.addEventListener('click', closeDobokModal);
    document.getElementById('cancel-dobok-btn')?.addEventListener('click', closeDobokModal);
    document.getElementById('submit-dobok-btn')?.addEventListener('click', handleSubmitDobokPedido);
    document.getElementById('pedidos-doboks-table-body')?.addEventListener('click', handleDoboksTableClick);
    document.getElementById('close-details-dobok-modal-btn')?.addEventListener('click', closeDetailsDobokModal);
    document.getElementById('filter-unidade-dobok')?.addEventListener('change', () => renderDoboksRows(cachedPedidosDoboks));

    const faixaPretaCheckbox = document.getElementById('filter-faixa-preta-dobok');
    const tradicionalCheckbox = document.getElementById('filter-tradicional-dobok');

    faixaPretaCheckbox?.addEventListener('change', () => {
        if (faixaPretaCheckbox.checked) tradicionalCheckbox.checked = false;
        renderDoboksRows(cachedPedidosDoboks);
    });

    tradicionalCheckbox?.addEventListener('change', () => {
        if (tradicionalCheckbox.checked) faixaPretaCheckbox.checked = false;
        renderDoboksRows(cachedPedidosDoboks);
    });

    document.getElementById('edit-dobok-pedido-btn')?.addEventListener('click', handleEditDobokPedido);
    document.getElementById('delete-dobok-pedido-btn')?.addEventListener('click', handleDeleteDobokPedido);

    function handleDoboksTableClick(event) {
        const row = event.target.closest('tr');
        if (row && row.dataset.id) {
            openDetailsDobokModal(row.dataset.id);
        }
    }

    async function openDetailsDobokModal(pedidoId) {
        const modal = document.getElementById('details-dobok-modal');
        if (!modal) return;

        try {
            const pedidoRef = doc(db, "pedidosDoboks", pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);

            if (!pedidoSnap.exists()) {
                alert("Pedido de Dobok não encontrado.");
                return;
            }

            const pedido = pedidoSnap.data();
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleString('pt-BR') : 'N/A';

            document.getElementById('details-dobok-unidade').textContent = formatUnitDisplayName(pedido.unidade);
            document.getElementById('details-dobok-data').textContent = data;
            document.getElementById('details-dobok-status').textContent = pedido.status;
            document.getElementById('details-dobok-status').className = `inline-block font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider ${getStatusClasses(pedido.status)}`;
            document.getElementById('details-dobok-solicitante').textContent = pedido.solicitante?.nome || 'Não informado';
            document.getElementById('details-dobok-aluno').textContent = pedido.aluno || 'N/A';
            document.getElementById('details-dobok-tamanho').textContent = pedido.tamanho;
            document.getElementById('details-dobok-colarinho').textContent = pedido.colarinho || 'Padrão';
            document.getElementById('details-dobok-tipo').textContent = pedido.isFaixaPreta ? 'Faixa Preta' : 'Comum';

            const justificativaContainer = document.getElementById('details-dobok-justificativa-container');
            if (pedido.status === 'Cancelado' && pedido.justificativa) {
                document.getElementById('details-dobok-justificativa').textContent = pedido.justificativa;
                justificativaContainer.classList.remove('hidden');
            } else {
                justificativaContainer.classList.add('hidden');
            }

            const user = await getCurrentUser();
            const adminActions = document.getElementById('details-dobok-admin-actions');
            const editBtn = document.getElementById('edit-dobok-pedido-btn');
            const deleteBtn = document.getElementById('delete-dobok-pedido-btn');

            if (user) {
                const isAdmin = await checkAdminStatus(user);
                adminActions.classList.remove('hidden');
                editBtn.classList.remove('hidden');
                editBtn.dataset.id = pedidoId;

                if (isAdmin) {
                    deleteBtn.classList.remove('hidden');
                    deleteBtn.dataset.id = pedidoId;
                } else {
                    deleteBtn.classList.add('hidden');
                }
            } else {
                adminActions.classList.add('hidden');
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } catch (error) {
            console.error("Erro ao abrir detalhes do pedido de dobok:", error);
            alert("Não foi possível carregar os detalhes do pedido.");
        }
    }

    function closeDetailsDobokModal() {
        const modal = document.getElementById('details-dobok-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async function handleEditDobokPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        closeDetailsDobokModal();

        const pedidoRef = doc(db, "pedidosDoboks", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);
        if (pedidoSnap.exists()) {
            const pedido = pedidoSnap.data();
            currentEditingDobokPedidoId = pedidoId;

            document.getElementById('dobok-modal-title').textContent = 'Editar Pedido de Dobok';
            document.getElementById('unidade-dobok-select').value = pedido.unidade;
            document.getElementById('status-dobok-select').value = pedido.status;
            document.getElementById('aluno-dobok-input').value = pedido.aluno || '';
            document.getElementById('tamanho-dobok-select').value = pedido.tamanho;
            document.getElementById('colarinho-dobok-select').value = pedido.colarinho || '';
            document.getElementById('faixa-preta-dobok-checkbox').checked = pedido.isFaixaPreta || false;

            const justificativaContainer = document.getElementById('justificativa-dobok-container');
            if (pedido.status === 'Cancelado') {
                justificativaContainer.classList.remove('hidden');
                document.getElementById('justificativa-dobok-input').value = pedido.justificativa || '';
            } else {
                justificativaContainer.classList.add('hidden');
                document.getElementById('justificativa-dobok-input').value = '';
            }

            openDobokModal(true);
        }
    }

    async function handleDeleteDobokPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        if (confirm("Tem certeza que deseja excluir este pedido de dobok?")) {
            try {
                await deleteDoc(doc(db, "pedidosDoboks", pedidoId));
                alert("Pedido de dobok excluído com sucesso.");
                closeDetailsDobokModal();
                loadPedidosDoboks();
            } catch (error) {
                console.error("Erro ao excluir pedido de dobok:", error);
                alert("Não foi possível excluir o pedido.");
            }
        }
    }
}
