import { onAuthReady, checkAdminStatus } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { app } from './firebase-config.js';
import { showAlert } from './common-ui.js';

const functions = getFunctions(app);
const listAlunosLocais = httpsCallable(functions, 'listAlunosLocais');

let allStudentsData = [];

export function setupAnalisePage() {
    onAuthReady(async (user) => {
        if (!user) return;
        const isAdmin = await checkAdminStatus(user);
        if (!isAdmin) {
            alert('Acesso negado. Apenas administradores podem ver análises.');
            window.location.href = 'index.html';
            return;
        }

        initEvents();
        await loadFullData();
    });
}

function initEvents() {
    const unitFilter = document.getElementById('global-unit-filter');
    if (unitFilter) {
        unitFilter.addEventListener('change', () => {
            renderDashboard(unitFilter.value);
        });
    }
}

async function loadFullData() {
    try {
        console.log("📊 Carregando dados para o Dashboard de Análise...");
        const result = await listAlunosLocais({ unitId: 'all' });
        allStudentsData = result.data || [];
        
        renderDashboard('all');
    } catch (error) {
        console.error("Erro ao carregar dados analíticos:", error);
        showAlert("Não foi possível carregar os dados de análise.", "error");
    }
}

function renderDashboard(selectedUnit) {
    const filtered = (selectedUnit === 'all') 
        ? allStudentsData 
        : allStudentsData.filter(s => s.unitId === selectedUnit || s.branchName === selectedUnit);

    // KPI 1: Total
    document.getElementById('kpi-total-students').textContent = filtered.length;

    // KPI 2: Ativos (Adimplentes)
    const active = filtered.filter(s => s.tuitionStatus === 'active' || s.tuitionStatus === 'authorized');
    document.getElementById('kpi-active-students').textContent = active.length;

    // KPI 3: Inadimplentes (Pendentes, Past Due, Cancelados mas com plano)
    const overdue = filtered.filter(s => 
        (s.tuitionStatus === 'pending' || s.tuitionStatus === 'past_due' || s.tuitionStatus === 'cancelled') && s.tuitionPlanId
    );
    document.getElementById('kpi-overdue-students').textContent = overdue.length;

    // KPI 4: Sem Plano
    const noPlan = filtered.filter(s => !s.tuitionPlanId);
    document.getElementById('kpi-no-plan-students').textContent = noPlan.length;

    renderUnitDistribution(filtered, selectedUnit);
    renderRecentOverdue(overdue);
}

function renderUnitDistribution(data, currentFilter) {
    const list = document.getElementById('unit-distribution-list');
    if (!list) return;

    if (currentFilter !== 'all') {
        list.innerHTML = `<div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-sm text-gray-500 dark:text-gray-400 text-center italic border border-gray-150 dark:border-gray-800">Filtrado por unidade específica</div>`;
        return;
    }

    const dist = {};
    data.forEach(s => {
        const unit = s.branchName || s.unitId || 'Indefinida';
        dist[unit] = (dist[unit] || 0) + 1;
    });

    const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);

    list.innerHTML = sorted.map(([unit, count]) => {
        const percentage = Math.round((count / data.length) * 100);
        return `
            <div class="space-y-2">
                <div class="flex justify-between text-sm items-center">
                    <span class="text-gray-900 dark:text-white font-semibold text-sm tracking-tight">${unit}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-gray-800/80 px-2.5 py-0.5 rounded-lg border border-gray-100 dark:border-gray-700/50 shadow-sm">${count} alunos (${percentage}%)</span>
                </div>
                <div class="w-full bg-gray-100 dark:bg-gray-800/40 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div class="bg-gradient-to-r from-amber-400 to-yellow-500 h-full rounded-full transition-all duration-1000" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentOverdue(overdueList) {
    const tbody = document.getElementById('recent-overdue-body');
    if (!tbody) return;

    if (overdueList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-gray-500 dark:text-gray-400">Nenhum aluno inadimplente encontrado.</td></tr>`;
        return;
    }

    // Show first 10 for performance/ui
    const recent = overdueList.slice(0, 10);

    tbody.innerHTML = recent.map(s => {
        const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || 'Sem nome';
        const email = s.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description || s.email || 'Sem email';
        const unitName = s.branchName || s.unitId || 'N/A';
        
        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all duration-200 border-b border-gray-100 dark:border-gray-850 last:border-0 group">
                <td class="py-3 px-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-gray-900 dark:text-white group-hover:text-yellow-500 transition-colors duration-150">${fullName}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">${email}</span>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="text-xs font-semibold px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200/50 dark:border-gray-750 uppercase tracking-wider">${unitName}</span>
                </td>
                <td class="py-3 px-4 text-center">
                    <a href="aluno.html?id=${s.idMember}&unit=${s.unitId || ''}" class="inline-flex text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition duration-150 justify-center items-center w-8 h-8 mx-auto" title="Abrir Ficha">
                        <i class="fas fa-external-link-alt text-xs"></i>
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}
