import { db, functions } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

let allResponses = [];

export async function initNPSDashboard() {
    setupFilterListeners();
    await loadInitialData();
}

async function loadInitialData() {
    // 1. Fetch all responses
    await fetchResponses();

    // 2. Populate Filters
    populateFilters();

    // 3. Initial Render
    updateDashboard();
}

async function fetchResponses() {
    const tableBody = document.getElementById('feedback-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-gray-600 italic"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando avaliações...</td></tr>';

    try {
        const q = query(collection(db, "nps_responses"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        allResponses = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`✅ ${allResponses.length} respostas carregadas.`);
    } catch (error) {
        console.error("Erro ao buscar NPS:", error);
        tableBody.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-red-500 italic">Erro ao carregar dados do Firestore.</td></tr>';
    }
}

function populateFilters() {
    const unitFilter = document.getElementById('filter-unit');
    const profFilter = document.getElementById('filter-professor');

    const units = [...new Set(allResponses.map(r => r.unitId).filter(Boolean))];
    const unitNames = {};
    allResponses.forEach(r => { if(r.unitId) unitNames[r.unitId] = r.unitName; });

    const profs = [...new Set(allResponses.map(r => r.professorId).filter(Boolean))];
    const profNames = {};
    allResponses.forEach(r => { if(r.professorId) profNames[r.professorId] = r.professorName; });

    // Populate Units
    units.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = unitNames[id] || id;
        unitFilter.appendChild(opt);
    });

    // Populate Professors
    profs.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = profNames[id] || id;
        profFilter.appendChild(opt);
    });
}

function updateDashboard() {
    const unit = document.getElementById('filter-unit').value;
    const prof = document.getElementById('filter-professor').value;
    const start = document.getElementById('date-start').value;
    const end = document.getElementById('date-end').value;

    let filtered = allResponses.filter(r => {
        if (unit !== 'all' && r.unitId !== unit) return false;
        if (prof !== 'all' && r.professorId !== prof) return false;
        
        if (start || end) {
            const date = r.timestamp.toDate();
            if (start && date < new Date(start)) return false;
            if (end && date > new Date(end + 'T23:59:59')) return false;
        }
        return true;
    });

    renderStats(filtered);
    renderRankings(filtered);
    renderFeedbackTable(filtered);
}

function renderStats(responses) {
    const total = responses.length;
    const promoters = responses.filter(r => r.score >= 9).length;
    const passives = responses.filter(r => r.score >= 7 && r.score <= 8).length;
    const detractors = responses.filter(r => r.score <= 6).length;

    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : '--';
    
    // Total Card
    const scoreEl = document.getElementById('nps-total-score');
    const labelEl = document.getElementById('nps-status-label');
    scoreEl.textContent = npsScore;
    
    // Status Label
    if (npsScore !== '--') {
        if (npsScore >= 75) {
            labelEl.textContent = 'Zona de Excelência';
            labelEl.className = 'px-4 py-1.5 bg-green-500 text-black text-xs font-black uppercase rounded-full tracking-widest';
        } else if (npsScore >= 50) {
            labelEl.textContent = 'Zona de Qualidade';
            labelEl.className = 'px-4 py-1.5 bg-yellow-500 text-black text-xs font-black uppercase rounded-full tracking-widest';
        } else if (npsScore >= 0) {
            labelEl.textContent = 'Zona de Aperfeiçoamento';
            labelEl.className = 'px-4 py-1.5 bg-orange-500 text-white text-xs font-black uppercase rounded-full tracking-widest';
        } else {
            labelEl.textContent = 'Zona Crítica';
            labelEl.className = 'px-4 py-1.5 bg-red-600 text-white text-xs font-black uppercase rounded-full tracking-widest';
        }
    } else {
        labelEl.textContent = 'Sem dados';
    }

    // Progress Bars
    const pPercent = total > 0 ? Math.round((promoters / total) * 100) : 0;
    const passPercent = total > 0 ? Math.round((passives / total) * 100) : 0;
    const dPercent = total > 0 ? Math.round((detractors / total) * 100) : 0;

    document.getElementById('promoter-percent').textContent = `${pPercent}%`;
    document.getElementById('promoter-bar').style.width = `${pPercent}%`;
    document.getElementById('passive-percent').textContent = `${passPercent}%`;
    document.getElementById('passive-bar').style.width = `${passPercent}%`;
    document.getElementById('detractor-percent').textContent = `${dPercent}%`;
    document.getElementById('detractor-bar').style.width = `${dPercent}%`;
    
    document.getElementById('total-responses-count').textContent = total;
}

function renderRankings(responses) {
    const unitRankingEl = document.getElementById('unit-ranking-list');
    const profRankingEl = document.getElementById('professor-ranking-list');

    // Group by Unit
    const unitMap = {};
    responses.forEach(r => {
        if (!r.unitId) return;
        if (!unitMap[r.unitId]) unitMap[r.unitId] = { name: r.unitName, p: 0, d: 0, t: 0 };
        unitMap[r.unitId].t++;
        if (r.score >= 9) unitMap[r.unitId].p++;
        if (r.score <= 6) unitMap[r.unitId].d++;
    });

    const unitRanking = Object.values(unitMap)
        .map(u => ({ ...u, score: Math.round(((u.p - u.d) / u.t) * 100) }))
        .sort((a, b) => b.score - a.score);

    unitRankingEl.innerHTML = unitRanking.length > 0 ? unitRanking.map(u => `
        <div class="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl">
            <div class="flex flex-col">
                <span class="text-sm font-bold text-white">${u.name}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-tight">${u.t} avaliações</span>
            </div>
            <div class="text-lg font-black ${u.score >= 70 ? 'text-green-500' : u.score >= 50 ? 'text-yellow-500' : 'text-red-500'}">
                ${u.score}
            </div>
        </div>
    `).join('') : '<div class="text-center py-4 text-gray-600 text-xs italic">Nenhum dado por unidade</div>';

    // Group by Professor
    const profMap = {};
    responses.forEach(r => {
        if (!r.professorId) return;
        if (!profMap[r.professorId]) profMap[r.professorId] = { name: r.professorName, p: 0, d: 0, t: 0 };
        profMap[r.professorId].t++;
        if (r.score >= 9) profMap[r.professorId].p++;
        if (r.score <= 6) profMap[r.professorId].d++;
    });

    const profRanking = Object.values(profMap)
        .map(p => ({ ...p, score: Math.round(((p.p - p.d) / p.t) * 100) }))
        .sort((a, b) => b.score - a.score);

    profRankingEl.innerHTML = profRanking.length > 0 ? profRanking.map(p => `
        <div class="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl">
            <div class="flex flex-col">
                <span class="text-sm font-bold text-white">${p.name}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-tight">${p.t} avaliações</span>
            </div>
            <div class="text-lg font-black ${p.score >= 70 ? 'text-green-500' : p.score >= 50 ? 'text-yellow-500' : 'text-red-500'}">
                ${p.score}
            </div>
        </div>
    `).join('') : '<div class="text-center py-4 text-gray-600 text-xs italic">Nenhum dado por professor</div>';
}

function renderFeedbackTable(responses) {
    const body = document.getElementById('feedback-table-body');
    if (responses.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-gray-600 italic">Nenhum resultado para os filtros selecionados.</td></tr>';
        return;
    }

    body.innerHTML = responses.map(r => {
        const date = r.timestamp.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        const promoterClass = r.score >= 9 ? 'bg-green-500/10 text-green-500' : r.score >= 7 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500';
        
        return `
            <tr class="hover:bg-gray-800/30 transition-colors border-b border-gray-800/50">
                <td class="p-4 text-gray-500 text-[11px] font-mono">${date}</td>
                <td class="p-4 text-white font-medium">${r.studentName}</td>
                <td class="p-4">
                    <span class="w-8 h-8 flex items-center justify-center rounded-lg font-bold ${promoterClass}">
                        ${r.score}
                    </span>
                </td>
                <td class="p-4">
                    <div class="text-xs font-bold text-gray-300">${r.unitName}</div>
                    <div class="text-[10px] text-gray-500">${r.professorName}</div>
                </td>
                <td class="p-4 text-gray-400 text-xs italic max-w-xs truncate" title="${r.comment || ''}">
                    ${r.comment ? `"${r.comment}"` : '<span class="text-gray-700">Sem comentário</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

function setupFilterListeners() {
    ['filter-unit', 'filter-professor', 'date-start', 'date-end'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateDashboard);
    });

    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('filter-unit').value = 'all';
        document.getElementById('filter-professor').value = 'all';
        document.getElementById('date-start').value = '';
        document.getElementById('date-end').value = '';
        updateDashboard();
    });

    document.getElementById('export-csv').addEventListener('click', () => {
        exportToCSV();
    });
}

function exportToCSV() {
    if (allResponses.length === 0) return;
    
    const headers = ["Data", "Aluno", "Score", "Unidade", "Professor", "Comentario"];
    const rows = allResponses.map(r => [
        r.timestamp.toDate().toISOString(),
        r.studentName,
        r.score,
        r.unitName,
        r.professorName,
        `"${(r.comment || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nps_feedback_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
