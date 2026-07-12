import { onAuthReady, checkAdminStatus } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { app } from './firebase-config.js';
import { loadComponents, showConfirm, showAlert, getUnidades, invalidateUnidadesCache } from './common-ui.js';

function showNotification(msg, type) { showAlert(msg, type === 'error' ? 'Erro' : 'Sucesso'); }

const functions = getFunctions(app);
const getUnitMPAccounts  = httpsCallable(functions, 'getUnitMPAccounts');
const getTuitionPlans    = httpsCallable(functions, 'getTuitionPlans');
const createTuitionPlan  = httpsCallable(functions, 'createTuitionPlan');
const updateTuitionPlan  = httpsCallable(functions, 'updateTuitionPlan');
const deleteTuitionPlan  = httpsCallable(functions, 'deleteTuitionPlan');
const createUnitFn       = httpsCallable(functions, 'createUnit');
const updateUnitFn       = httpsCallable(functions, 'updateUnit');

let currentUnits = [];
let currentPlans = [];
let currentMpAccounts = [];

export function setupUnidadesPlanosPage() {
    onAuthReady(async (user) => {
        if (!user) return;
        const isAdmin = await checkAdminStatus(user);
        if (!isAdmin) {
            alert('Acesso negado. Apenas administradores podem gerenciar planos.');
            window.location.href = 'index.html';
            return;
        }

        console.log("👤 Administrador autenticado em Unidades e Planos:", user.email);
        initEvents();
        await loadData();
    });
}

function initEvents() {
    // --- Unidades ---
    const addUnitBtn      = document.getElementById('add-unit-btn');
    const closeUnitModal  = document.getElementById('close-unit-modal');
    const cancelUnitBtn   = document.getElementById('cancel-unit-btn');
    const unitModal       = document.getElementById('unit-modal');
    const unitForm        = document.getElementById('unit-form');

    addUnitBtn.addEventListener('click', () => openUnitModal());
    closeUnitModal.addEventListener('click', closeUnitModalFn);
    cancelUnitBtn.addEventListener('click', closeUnitModalFn);
    unitModal.addEventListener('click', (e) => { if (e.target === unitModal) closeUnitModalFn(); });
    unitForm.addEventListener('submit', handleUnitSubmit);

    // --- Planos ---
    const addPlanBtn   = document.getElementById('add-plan-btn');
    const filterUnit   = document.getElementById('plan-unit-filter');
    const planModal    = document.getElementById('plan-modal');
    const closeBtn     = document.getElementById('close-plan-modal');
    const cancelBtn    = document.getElementById('cancel-plan-btn');
    const planForm     = document.getElementById('plan-form');

    filterUnit.addEventListener('change', () => renderPlans(currentPlans, filterUnit.value));
    addPlanBtn.addEventListener('click', () => openPlanModal());
    closeBtn.addEventListener('click', closePlanModal);
    cancelBtn.addEventListener('click', closePlanModal);
    planModal.addEventListener('click', (e) => { if (e.target === planModal) closePlanModal(); });
    planForm.addEventListener('submit', handlePlanSubmit);
}

async function loadData() {
    try {
        const [unitsRes, mpAccountsRes, plansRes] = await Promise.all([
            getUnidades(true), // includeInactive = true na tela de gerenciamento
            getUnitMPAccounts(),
            getTuitionPlans({ unitId: 'all' })
        ]);

        currentUnits     = unitsRes || [];
        currentMpAccounts = mpAccountsRes.data || [];
        currentPlans     = plansRes.data || [];

        renderUnitsManagement(currentUnits);
        renderMpAccounts(currentMpAccounts);
        populatePlanUnitDropdowns(currentUnits);

        const filterUnit = document.getElementById('plan-unit-filter');
        renderPlans(currentPlans, filterUnit.value);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        showAlert("Erro ao carregar os dados. Tente novamente.", "Erro");
    }
}

// ==============================================================
// UNIDADES — Renderização e CRUD
// ==============================================================

function renderUnitsManagement(units) {
    const tbody = document.getElementById('units-management-body');
    if (!units || units.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-400">
            Nenhuma unidade cadastrada. Clique em "Nova Unidade" para começar.
        </td></tr>`;
        return;
    }

    const html = units.map(u => {
        const activeBadge = u.active !== false
            ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"><i class="fas fa-check-circle mr-1"></i> Ativa</span>`
            : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"><i class="fas fa-ban mr-1"></i> Inativa</span>`;

        const toggleLabel  = u.active !== false ? 'Desativar' : 'Ativar';
        const toggleIcon   = u.active !== false ? 'fa-ban' : 'fa-check';
        const toggleClass  = u.active !== false
            ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30'
            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30';

        return `
        <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group">
            <td class="p-4 text-gray-500 dark:text-gray-400 text-sm font-mono">${u.order ?? 99}</td>
            <td class="p-4 font-semibold text-gray-900 dark:text-white">${u.name}</td>
            <td class="p-4"><code class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-700 dark:text-gray-300">${u.id}</code></td>
            <td class="p-4 text-gray-500 dark:text-gray-400 text-sm">${u.city || '—'}</td>
            <td class="p-4 text-center">${activeBadge}</td>
            <td class="p-4 text-right opacity-0 group-hover:opacity-100 transition-all flex justify-end gap-1">
                <button class="edit-unit-btn ${toggleClass} p-2 rounded-lg transition-colors text-sm"
                    data-id="${u.id}" data-active="${u.active !== false}" title="${toggleLabel}">
                    <i class="fas ${toggleIcon}"></i>
                </button>
                <button class="edit-unit-details-btn text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-lg transition-colors text-sm"
                    data-id="${u.id}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>`;
    }).join('');

    tbody.innerHTML = html;

    // Listeners — toggle ativo/inativo
    tbody.querySelectorAll('.edit-unit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const isActive = btn.dataset.active === 'true';
            const action = isActive ? 'desativar' : 'ativar';
            showConfirm(
                `Deseja ${action} a unidade "${id}"? Isso afeta a exibição em toda a intranet.`,
                async () => { await toggleUnitActive(id, !isActive); },
                `${action.charAt(0).toUpperCase() + action.slice(1)} Unidade`
            );
        });
    });

    // Listeners — editar detalhes
    tbody.querySelectorAll('.edit-unit-details-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const unit = currentUnits.find(u => u.id === btn.dataset.id);
            if (unit) openUnitModal(unit);
        });
    });
}

function openUnitModal(unit = null) {
    const modal      = document.getElementById('unit-modal');
    const title      = document.getElementById('unit-modal-title');
    const editIdInput = document.getElementById('unit-edit-id');
    const slugInput  = document.getElementById('unit-slug');
    const nameInput  = document.getElementById('unit-name');
    const cityInput  = document.getElementById('unit-city');
    const orderInput = document.getElementById('unit-order');

    if (unit) {
        title.textContent   = 'Editar Unidade';
        editIdInput.value   = unit.id;
        slugInput.value     = unit.id;
        slugInput.disabled  = true; // slug é imutável
        nameInput.value     = unit.name;
        cityInput.value     = unit.city || '';
        orderInput.value    = unit.order ?? 99;
    } else {
        title.textContent   = 'Nova Unidade';
        editIdInput.value   = '';
        slugInput.value     = '';
        slugInput.disabled  = false;
        nameInput.value     = '';
        cityInput.value     = '';
        orderInput.value    = 99;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeUnitModalFn() {
    const modal = document.getElementById('unit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleUnitSubmit(e) {
    e.preventDefault();
    const saveBtn   = document.getElementById('save-unit-btn');
    const editId    = document.getElementById('unit-edit-id').value;
    const slug      = document.getElementById('unit-slug').value.trim().toLowerCase();
    const name      = document.getElementById('unit-name').value.trim();
    const city      = document.getElementById('unit-city').value.trim();
    const order     = parseInt(document.getElementById('unit-order').value, 10);

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';

    try {
        if (editId) {
            await updateUnitFn({ id: editId, name, city, order });
            showNotification('Unidade atualizada com sucesso!', 'success');
        } else {
            await createUnitFn({ slug, name, city, order });
            showNotification('Unidade criada com sucesso!', 'success');
        }
        closeUnitModalFn();
        invalidateUnidadesCache(); // Invalida cache para forçar reload em outras páginas
        await loadData();
    } catch (error) {
        console.error("Erro ao salvar unidade:", error);
        showNotification(error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Unidade';
    }
}

async function toggleUnitActive(id, active) {
    try {
        await updateUnitFn({ id, active });
        showNotification(`Unidade ${active ? 'ativada' : 'desativada'} com sucesso!`, 'success');
        invalidateUnidadesCache();
        await loadData();
    } catch (error) {
        console.error("Erro ao atualizar unidade:", error);
        showNotification(error.message, 'error');
    }
}

// ==============================================================
// CONTAS MP — Renderização (somente leitura)
// ==============================================================

function renderMpAccounts(accounts) {
    const tbody = document.getElementById('units-table-body');
    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-8 text-gray-400">Nenhuma conta conectada. Conecte no botão acima.</td></tr>';
        return;
    }

    const html = accounts.map(u => `
        <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors">
            <td class="p-4 font-semibold text-gray-900 dark:text-white">${u.label}</td>
            <td class="p-4 text-gray-500 dark:text-gray-400 font-mono text-sm">${u.id}</td>
            <td class="p-4">
                ${u.hasToken
                    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"><i class="fas fa-check-circle mr-1"></i> Conectado</span>'
                    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"><i class="fas fa-times-circle mr-1"></i> Inválido</span>'}
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = html;
}

// ==============================================================
// PLANOS — Dropdowns e Renderização
// ==============================================================

function populatePlanUnitDropdowns(units) {
    const filterSelect = document.getElementById('plan-unit-filter');
    const formSelect   = document.getElementById('plan-unit');

    filterSelect.innerHTML = '<option value="all">Todas as Unidades</option>';
    formSelect.innerHTML   = '<option value="">Selecione a Unidade</option>';

    const activeUnits = units.filter(u => u.active !== false);
    activeUnits.forEach(u => {
        const opt1 = document.createElement('option');
        opt1.value = u.id;
        opt1.textContent = u.name;
        filterSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = u.id;
        opt2.textContent = u.name;
        formSelect.appendChild(opt2);
    });
}

function renderPlans(plans, unitFilter) {
    const tbody = document.getElementById('plans-table-body');

    const filtered = (unitFilter === 'all')
        ? plans
        : plans.filter(p => p.unitId === unitFilter);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-400">Nenhum plano encontrado para esta unidade.</td></tr>';
        return;
    }

    filtered.sort((a, b) => {
        if (a.unitId !== b.unitId) return a.unitId.localeCompare(b.unitId);
        return a.amountCentavos - b.amountCentavos;
    });

    const html = filtered.map(p => {
        const valorReal  = (p.amountCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const frequencia = p.frequency === 1 && p.frequencyType === 'months' ? 'Mensal' : `A cada ${p.frequency} meses`;
        const unitName   = currentUnits.find(u => u.id === p.unitId)?.name || p.unitId;
        const activeBadge = p.active
            ? '<span class="px-2 py-1 text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800/50">Ativo</span>'
            : '<span class="px-2 py-1 text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 rounded-md border border-gray-200 dark:border-gray-700">Inativo</span>';

        return `
            <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group">
                <td class="p-4 font-semibold text-gray-900 dark:text-white">${p.name}</td>
                <td class="p-4"><span class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-[10px] font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 uppercase tracking-wider">${unitName}</span></td>
                <td class="p-4 font-bold text-emerald-600 dark:text-emerald-400">${valorReal}</td>
                <td class="p-4 text-gray-600 dark:text-gray-400 text-sm">${frequencia}</td>
                <td class="p-4 text-center">${activeBadge}</td>
                <td class="p-4 text-right opacity-0 group-hover:opacity-100 transition-all">
                    <button class="edit-plan-btn text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-lg transition-colors" data-id="${p.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-plan-btn text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors" data-id="${p.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;

    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const plan = currentPlans.find(p => p.id === e.currentTarget.dataset.id);
            if (plan) openPlanModal(plan);
        });
    });

    document.querySelectorAll('.delete-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => confirmDeletePlan(e.currentTarget.dataset.id));
    });
}

function openPlanModal(plan = null) {
    const modal      = document.getElementById('plan-modal');
    const title      = document.getElementById('plan-modal-title');
    const idInput    = document.getElementById('plan-id');
    const nameInput  = document.getElementById('plan-name');
    const unitInput  = document.getElementById('plan-unit');
    const amountInput = document.getElementById('plan-amount');
    const freqInput  = document.getElementById('plan-frequency');
    const freqTypeInput = document.getElementById('plan-frequency-type');

    if (plan) {
        title.textContent   = 'Editar Plano';
        idInput.value       = plan.id;
        nameInput.value     = plan.name;
        unitInput.value     = plan.unitId;
        amountInput.value   = (plan.amountCentavos / 100).toFixed(2);
        freqInput.value     = plan.frequency;
        freqTypeInput.value = plan.frequencyType;
    } else {
        title.textContent   = 'Criar Novo Plano';
        idInput.value       = '';
        nameInput.value     = '';
        unitInput.value     = '';
        amountInput.value   = '';
        freqInput.value     = '1';
        freqTypeInput.value = 'months';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePlanModal() {
    const modal = document.getElementById('plan-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handlePlanSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-plan-btn');

    const id   = document.getElementById('plan-id').value;
    const data = {
        name:           document.getElementById('plan-name').value.trim(),
        unitId:         document.getElementById('plan-unit').value,
        amountCentavos: Math.round(parseFloat(document.getElementById('plan-amount').value) * 100),
        frequency:      parseInt(document.getElementById('plan-frequency').value, 10),
        frequencyType:  document.getElementById('plan-frequency-type').value
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';

    try {
        if (id) {
            await updateTuitionPlan({ id, ...data });
            showNotification('Plano atualizado com sucesso!', 'success');
        } else {
            await createTuitionPlan(data);
            showNotification('Plano criado com sucesso!', 'success');
        }
        closePlanModal();
        await loadData();
    } catch (error) {
        console.error("Erro ao salvar plano:", error);
        showNotification(error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Plano';
    }
}

async function confirmDeletePlan(id) {
    showConfirm('Tem certeza que deseja excluir este plano? Alunos já assinantes não serão cancelados, mas o plano não aparecerá para novas assinaturas.', async () => {
        try {
            await deleteTuitionPlan({ id });
            showNotification('Plano excluído com sucesso!', 'success');
            await loadData();
        } catch (error) {
            console.error("Erro ao excluir plano:", error);
            showNotification(error.message, 'error');
        }
    }, 'Excluir Plano');
}
