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
        list.innerHTML = `<div class="p-4 bg-gray-800/30 rounded-lg text-sm text-gray-500 text-center italic">Filtrado por unidade específica</div>`;
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
            <div>
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-300 font-medium">${unit}</span>
                    <span class="text-gray-400">${count} alunos (${percentage}%)</span>
                </div>
                <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-yellow-500 h-full rounded-full transition-all duration-1000" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentOverdue(overdueList) {
    const tbody = document.getElementById('recent-overdue-body');
    if (!tbody) return;

    if (overdueList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-10 text-center text-gray-600">Nenhum aluno inadimplente encontrado.</td></tr>`;
        return;
    }

    // Show first 10 for performance/ui
    const recent = overdueList.slice(0, 10);

    tbody.innerHTML = recent.map(s => `
        <tr class="hover:bg-gray-800/30 transition-colors">
            <td class="py-3 px-2">
                <div class="flex flex-col">
                    <span class="text-sm font-medium text-white">${s.firstName} ${s.lastName || ''}</span>
                    <span class="text-xs text-gray-500">${s.email || 'Sem email'}</span>
                </div>
            </td>
            <td class="py-3 px-2">
                <span class="text-xs px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">${s.branchName || s.unitId}</span>
            </td>
            <td class="py-3 px-2">
                <button onclick="window.location.href='alunos.html?search=${encodeURIComponent(s.firstName)}'" class="text-blue-400 hover:text-blue-300 text-sm">
                    <i class="fas fa-search"></i>
                </button>
            </td>
        </tr>
    `).join('');
}
