import { onAuthReady, checkAdminStatus } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { app } from './firebase-config.js';
import { loadComponents, showConfirm, showAlert } from './common-ui.js';

function showNotification(msg, type) { showAlert(msg, type === 'error' ? 'Erro' : 'Sucesso'); }

const functions = getFunctions(app);
const getUnitMPAccounts = httpsCallable(functions, 'getUnitMPAccounts');
const getTuitionPlans = httpsCallable(functions, 'getTuitionPlans');
const createTuitionPlan = httpsCallable(functions, 'createTuitionPlan');
const updateTuitionPlan = httpsCallable(functions, 'updateTuitionPlan');
const deleteTuitionPlan = httpsCallable(functions, 'deleteTuitionPlan');

let currentUnits = [];
let currentPlans = [];

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
    const addPlanBtn = document.getElementById('add-plan-btn');
    const filterUnit = document.getElementById('plan-unit-filter');
    const modal = document.getElementById('plan-modal');
    const closeBtn = document.getElementById('close-plan-modal');
    const cancelBtn = document.getElementById('cancel-plan-btn');
    const planForm = document.getElementById('plan-form');

    filterUnit.addEventListener('change', () => renderPlans(currentPlans, filterUnit.value));

    addPlanBtn.addEventListener('click', () => openPlanModal());
    closeBtn.addEventListener('click', closePlanModal);
    cancelBtn.addEventListener('click', closePlanModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePlanModal();
    });

    planForm.addEventListener('submit', handlePlanSubmit);
}

async function loadData() {
    try {
        const [unitsRes, plansRes] = await Promise.all([
            getUnitMPAccounts(),
            getTuitionPlans({ unitId: 'all' })
        ]);

        currentUnits = unitsRes.data || [];
        currentPlans = plansRes.data || [];

        renderUnits(currentUnits);
        populateUnitDropdowns(currentUnits);
        
        const filterUnit = document.getElementById('plan-unit-filter');
        renderPlans(currentPlans, filterUnit.value);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        showAlert("Erro ao carregar os dados. Tente novamente.", "error");
    }
}

function populateUnitDropdowns(units) {
    const filterSelect = document.getElementById('plan-unit-filter');
    const formSelect = document.getElementById('plan-unit');
    
    // Clear existing except first option
    filterSelect.innerHTML = '<option value="all">Todas as Unidades</option>';
    formSelect.innerHTML = '<option value="">Selecione a Unidade</option>';

    // Provide default mappings if none
    const allOptions = new Set();
    units.forEach(u => allOptions.add(u.label));
    const defaults = [
        "centro", "coqueiros", "asa-sul", "sudoeste", "lago-sul", 
        "pontos-de-ensino", "jardim-botanico", "dourados", 
        "santa-monica", "noroeste", "atadf"
    ];
    defaults.forEach(d => allOptions.add(d));

    [...allOptions].sort().forEach(unitSlug => {
        const option1 = document.createElement('option');
        option1.value = unitSlug;
        option1.textContent = `Unidade: ${unitSlug}`;
        filterSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = unitSlug;
        option2.textContent = `Unidade: ${unitSlug}`;
        formSelect.appendChild(option2);
    });
}

function renderUnits(units) {
    const tbody = document.getElementById('units-table-body');
    if (units.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-8 text-gray-400">Nenhuma conta conectada. Conecte no botão acima.</td></tr>';
        return;
    }

    const html = units.map(u => `
        <tr class="border-b border-gray-800 hover:bg-gray-700 transition-colors">
            <td class="p-4 font-medium text-white">${u.label}</td>
            <td class="p-4 text-gray-400 font-mono text-sm">${u.id}</td>
            <td class="p-4">
                ${u.hasToken 
                    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300"><i class="fas fa-check-circle mr-1"></i> Conectado</span>'
                    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300"><i class="fas fa-times-circle mr-1"></i> Inválido</span>'}
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
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

    // Ordenar por Unidade e Preço
    filtered.sort((a, b) => {
        if (a.unitId !== b.unitId) return a.unitId.localeCompare(b.unitId);
        return a.amountCentavos - b.amountCentavos;
    });

    const html = filtered.map(p => {
        const valorReal = (p.amountCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const frequencia = p.frequency === 1 && p.frequencyType === 'months' ? 'Mensal' : `A cada ${p.frequency} meses`;
        const activeBadge = p.active
            ? '<span class="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded border border-green-800">Ativo</span>'
            : '<span class="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded border border-gray-700">Inativo</span>';

        return `
            <tr class="border-b border-gray-800 hover:bg-gray-700/50 transition-colors group">
                <td class="p-4 font-medium text-white">${p.name}</td>
                <td class="p-4"><span class="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">${p.unitId}</span></td>
                <td class="p-4 font-bold text-yellow-500">${valorReal}</td>
                <td class="p-4 text-gray-400 text-sm">${frequencia}</td>
                <td class="p-4 text-center">${activeBadge}</td>
                <td class="p-4 text-right opacity-50 group-hover:opacity-100 transition-opacity">
                    <button class="edit-plan-btn text-blue-400 hover:text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 p-2 rounded mr-2 transition-colors" data-id="${p.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-plan-btn text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-900/50 p-2 rounded transition-colors" data-id="${p.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;

    // Attach listeners
    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const plan = currentPlans.find(p => p.id === id);
            if (plan) openPlanModal(plan);
        });
    });

    document.querySelectorAll('.delete-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            confirmDeletePlan(id);
        });
    });
}

function openPlanModal(plan = null) {
    const modal = document.getElementById('plan-modal');
    const title = document.getElementById('plan-modal-title');
    const idInput = document.getElementById('plan-id');
    const nameInput = document.getElementById('plan-name');
    const unitInput = document.getElementById('plan-unit');
    const amountInput = document.getElementById('plan-amount');
    const freqInput = document.getElementById('plan-frequency');
    const freqTypeInput = document.getElementById('plan-frequency-type');

    if (plan) {
        title.textContent = 'Editar Plano';
        idInput.value = plan.id;
        nameInput.value = plan.name;
        unitInput.value = plan.unitId;
        amountInput.value = (plan.amountCentavos / 100).toFixed(2);
        freqInput.value = plan.frequency;
        freqTypeInput.value = plan.frequencyType;
    } else {
        title.textContent = 'Criar Novo Plano';
        idInput.value = '';
        nameInput.value = '';
        unitInput.value = '';
        amountInput.value = '';
        freqInput.value = '1';
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
    
    const id = document.getElementById('plan-id').value;
    const data = {
        name: document.getElementById('plan-name').value.trim(),
        unitId: document.getElementById('plan-unit').value,
        amountCentavos: Math.round(parseFloat(document.getElementById('plan-amount').value) * 100),
        frequency: parseInt(document.getElementById('plan-frequency').value, 10),
        frequencyType: document.getElementById('plan-frequency-type').value
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
        await loadData(); // reload
    } catch (error) {
        console.error("Erro ao salvar plano:", error);
        showNotification(error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Plano';
    }
}

async function confirmDeletePlan(id) {
    showConfirm('Excluir Plano', 'Tem certeza que deseja excluir este plano? Alunos já assinantes não serão cancelados, mas o plano não aparecerá para novas assinaturas.', async () => {
        try {
            await deleteTuitionPlan({ id });
            showNotification('Plano excluído com sucesso!', 'success');
            await loadData();
        } catch (error) {
            console.error("Erro ao excluir plano:", error);
            showNotification(error.message, 'error');
        }
    });
}
