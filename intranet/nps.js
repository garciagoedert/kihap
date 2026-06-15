import { db, functions } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where, Timestamp, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

let allResponses = [];
let allCampaigns = [];
let currentEditingCampaign = null;
let localQuestionsList = [];

export async function initNPSDashboard() {
    await initializeDefaultCampaigns();
    setupFilterListeners();
    setupTabListeners();
    setupCampaignManagementListeners();
    await loadInitialData();
}

async function initializeDefaultCampaigns() {
    try {
        const q = query(collection(db, "public_config"));
        const snapshot = await getDocs(q);
        const exists = snapshot.docs.some(d => d.id.startsWith("nps_campaign_"));
        if (!exists) {
            console.log("Initializing default campaigns in Firestore (public_config)...");
            
            const regularCampaign = {
                id: "regular",
                title: "Pesquisa Regular (Alunos)",
                description: "Net Promoter Score para satisfação regular dos alunos das unidades.",
                isActive: true,
                isSystem: true,
                questions: [
                    { id: "studentName", label: "Nome Completo", type: "text", required: true, step: 1, placeholder: "Digite seu nome" },
                    { id: "contact", label: "WhatsApp ou E-mail", type: "text", required: true, step: 1, placeholder: "(00) 00000-0000 ou email@exemplo.com" },
                    { id: "unitId", label: "Sua Unidade", type: "select-unit", required: true, step: 1 },
                    { id: "professorId", label: "Professor(a)", type: "select-professor", required: true, step: 1 },
                    { id: "score", label: "Em uma escala de 0 a 10, o quanto você recomendaria a Kihap para um amigo ou familiar?", type: "rating-11", required: true, step: 2 },
                    { id: "score_estrutura", label: "Estrutura da Unidade", type: "rating-11", required: true, step: 3 },
                    { id: "score_limpeza", label: "Limpeza e Higiene", type: "rating-11", required: true, step: 3 },
                    { id: "score_materiais", label: "Qualidade dos Materiais", type: "rating-11", required: true, step: 3 },
                    { id: "score_atendimento", label: "Atendimento na Recepção", type: "rating-11", required: true, step: 3 },
                    { id: "score_instructor", label: "Performance do Instrutor / Aula", type: "rating-11", required: true, step: 3 },
                    { id: "comment", label: "Comentários Adicionais (Opcional)", type: "text-area", required: false, step: 3, placeholder: "Conte-nos um pouco mais sobre sua nota..." }
                ]
            };

            const experienceCampaign = {
                id: "experience",
                title: "KIHAP Experience",
                description: "Avaliação dos eventos de Graduação, Competições e Seminários.",
                isActive: true,
                isSystem: true,
                questions: [
                    { id: "studentName", label: "Qual o seu nome?", type: "text", required: true, step: 1, placeholder: "Escreva seu nome aqui..." },
                    { id: "unitName", label: "Em qual unidade você frequentou o último ciclo de desenvolvimento?", type: "radio", required: true, step: 2, options: ["Asa Sul", "Sudoeste", "Lago Sul", "Online", "Eleva", "Outra"] },
                    { id: "score_pontualidade", label: "Qual nota você atribui a pontualidade do evento?", type: "rating-5", required: true, step: 3 },
                    { id: "score_inscricao", label: "Dê uma nota ao método de inscrições do Experience.", type: "rating-10", required: true, step: 4 },
                    { id: "score_ambiente", label: "De 0 a 10, como você avalia a sua experiência no ambiente físico (Royal Tulip)?", type: "rating-11", required: true, step: 5 },
                    { id: "comment", label: "Quer deixar algum comentário ou sugestão adicional?", type: "text-area", required: false, step: 6, placeholder: "Escreva sua mensagem aqui..." }
                ]
            };

            await setDoc(doc(db, "public_config", "nps_campaign_regular"), regularCampaign);
            await setDoc(doc(db, "public_config", "nps_campaign_experience"), experienceCampaign);
            console.log("Default campaigns successfully initialized in public_config!");
        }
    } catch (err) {
        console.error("Error initializing default campaigns:", err);
    }
}

async function loadInitialData() {
    await fetchCampaigns();
    await fetchResponses();
    populateFilters();
    updateDashboard();
    renderCampaignsTable();
}

async function fetchCampaigns() {
    try {
        const q = query(collection(db, "public_config"));
        const snapshot = await getDocs(q);
        allCampaigns = snapshot.docs
            .filter(doc => doc.id.startsWith("nps_campaign_"))
            .map(doc => ({
                id: doc.id.replace(/^nps_campaign_/, ""),
                ...doc.data()
            }));
        console.log(`✅ ${allCampaigns.length} campanhas de NPS carregadas.`);
    } catch (error) {
        console.error("Erro ao buscar campanhas:", error);
    }
}

async function fetchResponses() {
    const tableBody = document.getElementById('feedback-table-body');
    tableBody.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-gray-600 italic"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando avaliações...</td></tr>';

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
        tableBody.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-red-500 italic">Erro ao carregar dados do Firestore.</td></tr>';
    }
}

function populateFilters() {
    const typeFilter = document.getElementById('filter-type');
    const unitFilter = document.getElementById('filter-unit');
    const profFilter = document.getElementById('filter-professor');

    const previousTypeVal = typeFilter.value;

    typeFilter.innerHTML = '';
    allCampaigns.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        typeFilter.appendChild(opt);
    });

    if (previousTypeVal && allCampaigns.some(c => c.id === previousTypeVal)) {
        typeFilter.value = previousTypeVal;
    } else {
        typeFilter.value = 'regular';
    }

    const units = [...new Set(allResponses.map(r => r.unitId || r.unitName).filter(Boolean))];
    const unitNames = {};
    allResponses.forEach(r => { 
        if (r.unitId) unitNames[r.unitId] = r.unitName;
        else if (r.unitName) unitNames[r.unitName] = r.unitName;
    });

    const profs = [...new Set(allResponses.map(r => r.professorId).filter(Boolean))];
    const profNames = {};
    allResponses.forEach(r => { if(r.professorId) profNames[r.professorId] = r.professorName; });

    unitFilter.innerHTML = '<option value="all">Todas as Unidades</option>';
    units.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = unitNames[id] || id;
        unitFilter.appendChild(opt);
    });

    profFilter.innerHTML = '<option value="all">Todos os Professores</option>';
    profs.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = profNames[id] || id;
        profFilter.appendChild(opt);
    });
}

function updateDashboard() {
    const type = document.getElementById('filter-type').value || 'regular';
    const unit = document.getElementById('filter-unit').value;
    const prof = document.getElementById('filter-professor').value;
    const start = document.getElementById('date-start').value;
    const end = document.getElementById('date-end').value;

    const campaign = allCampaigns.find(c => c.id === type) || allCampaigns.find(c => c.id === 'regular');

    const hasProfessor = campaign && campaign.questions.some(q => q.type === 'select-professor');
    const profFilterContainer = document.getElementById('filter-professor').parentElement;
    if (!hasProfessor) {
        profFilterContainer.classList.add('opacity-40', 'pointer-events-none');
    } else {
        profFilterContainer.classList.remove('opacity-40', 'pointer-events-none');
    }

    let filtered = allResponses.filter(r => {
        if (type === 'regular') {
            if (r.isExperienceEvent || (r.campaignId && r.campaignId !== 'regular')) return false;
        } else if (type === 'experience') {
            if (!r.isExperienceEvent && r.campaignId !== 'experience') return false;
        } else {
            if (r.campaignId !== type) return false;
        }

        if (unit !== 'all') {
            if (r.unitId !== unit && r.unitName !== unit) return false;
        }

        if (hasProfessor && prof !== 'all' && r.professorId !== prof) return false;
        
        if (start || end) {
            if (r.timestamp) {
                const date = r.timestamp.toDate();
                if (start && date < new Date(start)) return false;
                if (end && date > new Date(end + 'T23:59:59')) return false;
            } else {
                return false;
            }
        }
        return true;
    });

    renderStats(filtered, campaign);
    renderRankings(filtered, campaign);
    renderFeedbackTable(filtered, campaign);
}

function renderStats(responses, campaign) {
    const mainQ = campaign?.questions.find(q => q.id === 'score') || campaign?.questions.find(q => q.type.startsWith('rating-'));
    const mainField = mainQ ? mainQ.id : 'score';
    const mainType = mainQ ? mainQ.type : 'rating-11';
    
    const validScores = responses.map(r => r[mainField]).filter(v => v !== undefined && v !== null && !isNaN(v));
    const total = validScores.length;

    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    if (mainType === 'rating-5') {
        promoters = validScores.filter(s => s === 5).length;
        passives = validScores.filter(s => s === 4).length;
        detractors = validScores.filter(s => s <= 3).length;
    } else {
        promoters = validScores.filter(s => s >= 9).length;
        passives = validScores.filter(s => s >= 7 && s <= 8).length;
        detractors = validScores.filter(s => s <= 6).length;
    }

    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : '--';
    
    const scoreEl = document.getElementById('nps-total-score');
    const labelEl = document.getElementById('nps-status-label');
    scoreEl.textContent = npsScore;
    
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

    const ratingQuestions = campaign?.questions.filter(q => q.type.startsWith('rating-')) || [];
    const categoriesContainer = document.getElementById('categories-container');
    if (categoriesContainer) {
        categoriesContainer.innerHTML = '';
        ratingQuestions.forEach(cat => {
            const maxVal = cat.type === 'rating-5' ? 5 : 10;
            const scores = responses.map(r => r[cat.id]).filter(v => v !== undefined && v !== null && !isNaN(v));
            const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '--';
            const percentage = avg !== '--' ? (parseFloat(avg) / maxVal) * 100 : 0;

            const itemHtml = `
                <div class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-[#111] rounded-xl border border-gray-100 dark:border-gray-800/50">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 flex-1 pr-3 line-clamp-2" title="${cat.label}">${cat.label}</span>
                    <div class="flex items-center gap-3">
                        <div class="w-24 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                            <div class="h-full bg-yellow-500/50" style="width: ${percentage}%"></div>
                        </div>
                        <span class="text-sm font-black text-gray-900 dark:text-white">${avg !== '--' ? `${avg}/${maxVal}` : '--'}</span>
                    </div>
                </div>
            `;
            categoriesContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
    }
}

function renderRankings(responses, campaign) {
    const unitRankingEl = document.getElementById('unit-ranking-list');
    const profRankingEl = document.getElementById('professor-ranking-list');

    const unitMap = {};
    responses.forEach(r => {
        const unitName = r.unitName;
        const unitId = r.unitId || unitName;
        if (!unitName) return;
        if (!unitMap[unitId]) unitMap[unitId] = { name: unitName, p: 0, d: 0, t: 0 };
        unitMap[unitId].t++;
        
        const mainQ = campaign?.questions.find(q => q.id === 'score') || campaign?.questions.find(q => q.type.startsWith('rating-'));
        const mainField = mainQ ? mainQ.id : 'score';
        const mainType = mainQ ? mainQ.type : 'rating-11';
        const scoreVal = r[mainField];

        if (scoreVal !== undefined && scoreVal !== null) {
            if (mainType === 'rating-5') {
                if (scoreVal === 5) unitMap[unitId].p++;
                if (scoreVal <= 3) unitMap[unitId].d++;
            } else {
                if (scoreVal >= 9) unitMap[unitId].p++;
                if (scoreVal <= 6) unitMap[unitId].d++;
            }
        }
    });

    const unitRanking = Object.values(unitMap)
        .map(u => ({ ...u, score: u.t > 0 ? Math.round(((u.p - u.d) / u.t) * 100) : 0 }))
        .sort((a, b) => b.score - a.score);

    unitRankingEl.innerHTML = unitRanking.length > 0 ? unitRanking.map(u => `
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl">
            <div class="flex flex-col">
                <span class="text-sm font-bold text-gray-900 dark:text-white">${u.name}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-tight">${u.t} avaliações</span>
            </div>
            <div class="text-lg font-black ${u.score >= 70 ? 'text-green-500' : u.score >= 50 ? 'text-yellow-500' : 'text-red-500'}">
                ${u.score}
            </div>
        </div>
    `).join('') : '<div class="text-center py-4 text-gray-500 text-xs italic">Nenhum dado por unidade</div>';

    const hasProfessor = campaign && campaign.questions.some(q => q.type === 'select-professor');
    const profRankingContainer = profRankingEl.parentElement;
    
    if (!hasProfessor) {
        profRankingContainer.style.display = 'none';
        unitRankingEl.parentElement.classList.remove('md:col-span-1');
        unitRankingEl.parentElement.classList.add('md:col-span-2');
    } else {
        profRankingContainer.style.display = 'block';
        unitRankingEl.parentElement.classList.remove('md:col-span-2');
        unitRankingEl.parentElement.classList.add('md:col-span-1');

        const profMap = {};
        responses.forEach(r => {
            if (!r.professorId) return;
            if (!profMap[r.professorId]) profMap[r.professorId] = { name: r.professorName, p: 0, d: 0, t: 0 };
            profMap[r.professorId].t++;

            const mainQ = campaign?.questions.find(q => q.id === 'score') || campaign?.questions.find(q => q.type.startsWith('rating-'));
            const mainField = mainQ ? mainQ.id : 'score';
            const mainType = mainQ ? mainQ.type : 'rating-11';
            const scoreVal = r[mainField];

            if (scoreVal !== undefined && scoreVal !== null) {
                if (mainType === 'rating-5') {
                    if (scoreVal === 5) profMap[r.professorId].p++;
                    if (scoreVal <= 3) profMap[r.professorId].d++;
                } else {
                    if (scoreVal >= 9) profMap[r.professorId].p++;
                    if (scoreVal <= 6) profMap[r.professorId].d++;
                }
            }
        });

        const profRanking = Object.values(profMap)
            .map(p => ({ ...p, score: p.t > 0 ? Math.round(((p.p - p.d) / p.t) * 100) : 0 }))
            .sort((a, b) => b.score - a.score);

        profRankingEl.innerHTML = profRanking.length > 0 ? profRanking.map(p => `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl">
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-gray-900 dark:text-white">${p.name}</span>
                    <span class="text-[10px] text-gray-500 uppercase tracking-tight">${p.t} avaliações</span>
                </div>
                <div class="text-lg font-black ${p.score >= 70 ? 'text-green-500' : p.score >= 50 ? 'text-yellow-500' : 'text-red-500'}">
                    ${p.score}
                </div>
            </div>
        `).join('') : '<div class="text-center py-4 text-gray-500 text-xs italic">Nenhum dado por professor</div>';
    }
}

function getQuestionIcon(id) {
    const key = id.toLowerCase();
    if (key.includes('estrutura') || key.includes('ambiente') || key.includes('local')) return 'fa-building';
    if (key.includes('limpeza') || key.includes('higiene') || key.includes('organizacao')) return 'fa-broom';
    if (key.includes('material') || key.includes('equipamento') || key.includes('box')) return 'fa-box';
    if (key.includes('atendimento') || key.includes('recepcao') || key.includes('suporte')) return 'fa-user-tie';
    if (key.includes('professor') || key.includes('instructor') || key.includes('aula') || key.includes('ensino')) return 'fa-graduation-cap';
    if (key.includes('pontualidade') || key.includes('tempo') || key.includes('horario') || key.includes('clock')) return 'fa-clock';
    if (key.includes('inscricao') || key.includes('cadastro') || key.includes('site')) return 'fa-file-signature';
    return 'fa-star';
}

function renderFeedbackTable(responses, campaign) {
    const body = document.getElementById('feedback-table-body');
    if (responses.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-gray-600 italic">Nenhum resultado para os filtros selecionados.</td></tr>';
        return;
    }

    const mainQ = campaign?.questions.find(q => q.id === 'score') || campaign?.questions.find(q => q.type.startsWith('rating-'));
    const mainField = mainQ ? mainQ.id : 'score';
    const mainType = mainQ ? mainQ.type : 'rating-11';

    const ratingQuestions = campaign?.questions.filter(q => q.type.startsWith('rating-') && q.id !== mainField) || [];

    body.innerHTML = responses.map(r => {
        const date = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--/--';
        
        const scoreVal = r[mainField] ?? r.score;
        let promoterClass = 'bg-gray-500/10 text-gray-500';
        if (scoreVal !== undefined && scoreVal !== null) {
            if (mainType === 'rating-5') {
                promoterClass = scoreVal === 5 ? 'bg-green-500/10 text-green-500' : scoreVal === 4 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500';
            } else {
                promoterClass = scoreVal >= 9 ? 'bg-green-500/10 text-green-500' : scoreVal >= 7 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500';
            }
        }
        
        const metrics = ratingQuestions.map(q => ({
            label: q.label,
            val: r[q.id],
            icon: getQuestionIcon(q.id)
        }));

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                <td class="p-4 text-gray-400 dark:text-gray-500 text-[11px] font-mono">${date}</td>
                <td class="p-4">
                    <div class="text-gray-900 dark:text-white font-medium">${r.studentName || ''}</div>
                    ${r.contact ? `<div class="text-[10px] text-gray-500">${r.contact}</div>` : ''}
                </td>
                <td class="p-4">
                    <span class="w-8 h-8 flex items-center justify-center rounded-lg font-bold ${promoterClass}">
                        ${scoreVal !== undefined ? scoreVal : '--'}
                    </span>
                </td>
                <td class="p-4">
                    <div class="flex gap-2">
                        ${metrics.map(m => `
                            <div class="flex flex-col items-center gap-0.5" title="${m.label}: ${m.val ?? '--'}">
                                <i class="fas ${m.icon} text-[10px] ${m.val !== undefined ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-700'}"></i>
                                <span class="text-[9px] font-bold ${m.val !== undefined ? 'text-gray-950 dark:text-white' : 'text-gray-300 dark:text-gray-700'}">${m.val ?? '-'}</span>
                            </div>
                        `).join('')}
                    </div>
                </td>
                <td class="p-4">
                    <div class="text-xs font-bold text-gray-700 dark:text-gray-300">${r.unitName || ''}</div>
                    ${r.professorName ? `<div class="text-[10px] text-gray-400 dark:text-gray-500">${r.professorName}</div>` : ''}
                </td>
                <td class="p-4 text-gray-600 dark:text-gray-400 text-xs italic max-w-xs truncate" title="${r.comment || ''}">
                    ${r.comment ? `"${r.comment}"` : '<span class="text-gray-300 dark:text-gray-700">Sem comentário</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

function setupFilterListeners() {
    ['filter-type', 'filter-unit', 'filter-professor', 'date-start', 'date-end'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateDashboard);
    });

    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('filter-type').value = 'regular';
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

function setupTabListeners() {
    const tabDashboard = document.getElementById('tab-dashboard');
    const tabCampaigns = document.getElementById('tab-campaigns');
    const dashboardView = document.getElementById('dashboard-view');
    const campaignsView = document.getElementById('campaigns-view');

    tabDashboard.addEventListener('click', () => {
        tabDashboard.className = "pb-4 text-sm font-black uppercase tracking-wider text-yellow-500 border-b-2 border-yellow-500 outline-none transition-all";
        tabCampaigns.className = "pb-4 text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-white border-b-2 border-transparent hover:border-gray-700 outline-none transition-all";
        dashboardView.classList.remove('hidden');
        campaignsView.classList.add('hidden');
    });

    tabCampaigns.addEventListener('click', () => {
        tabCampaigns.className = "pb-4 text-sm font-black uppercase tracking-wider text-yellow-500 border-b-2 border-yellow-500 outline-none transition-all";
        tabDashboard.className = "pb-4 text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-white border-b-2 border-transparent hover:border-gray-700 outline-none transition-all";
        dashboardView.classList.add('hidden');
        campaignsView.classList.remove('hidden');
        renderCampaignsTable();
    });
}

function renderCampaignsTable() {
    const tableBody = document.getElementById('campaigns-table-body');
    if (allCampaigns.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-gray-600 italic">Nenhuma campanha encontrada.</td></tr>';
        return;
    }

    tableBody.innerHTML = allCampaigns.map(c => {
        let responseCount = 0;
        if (c.id === 'regular') {
            responseCount = allResponses.filter(r => !r.isExperienceEvent && (!r.campaignId || r.campaignId === 'regular')).length;
        } else if (c.id === 'experience') {
            responseCount = allResponses.filter(r => r.isExperienceEvent || r.campaignId === 'experience').length;
        } else {
            responseCount = allResponses.filter(r => r.campaignId === c.id).length;
        }

        const publicLink = `${window.location.origin}/avaliar?id=${c.id}`;
        
        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                <td class="p-4">
                    <div class="text-gray-900 dark:text-white font-bold text-sm">${c.title}</div>
                    <div class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">${c.id}</div>
                </td>
                <td class="p-4 text-gray-600 dark:text-gray-400 text-xs">${c.description || 'Sem descrição'}</td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded text-[10px] font-black uppercase ${c.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}" style="cursor: pointer;" onclick="toggleCampaignActive('${c.id}')">
                        ${c.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                </td>
                <td class="p-4 text-center text-gray-900 dark:text-white font-bold">${responseCount}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="copyToClipboard('${publicLink}')" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-yellow-600 dark:text-yellow-500 rounded-xl transition-all text-xs flex items-center gap-1" title="Copiar Link">
                            <i class="fas fa-copy"></i> Copiar Link
                        </button>
                    </div>
                </td>
                <td class="p-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="openCampaignEditor('${c.id}')" class="p-2 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-500 hover:text-black rounded-xl transition-all text-xs" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${c.isSystem ? '' : `
                            <button onclick="deleteCampaignConfirm('${c.id}')" class="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all text-xs" title="Excluir">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert("Link copiado com sucesso!");
    }).catch(err => {
        console.error("Erro ao copiar link:", err);
    });
};

window.toggleCampaignActive = async (id) => {
    const campaign = allCampaigns.find(c => c.id === id);
    if (!campaign) return;
    try {
        campaign.isActive = !campaign.isActive;
        await setDoc(doc(db, "public_config", "nps_campaign_" + id), campaign);
        await loadInitialData();
    } catch (err) {
        console.error("Erro ao alternar status da campanha:", err);
    }
};

function setupCampaignManagementListeners() {
    const modal = document.getElementById('campaign-modal');
    const btnNew = document.getElementById('btn-new-campaign');
    const btnClose = document.getElementById('btn-close-modal');
    const btnCancel = document.getElementById('btn-cancel-modal');
    const btnSave = document.getElementById('btn-save-campaign');
    const btnAddQ = document.getElementById('btn-add-question');

    btnNew.addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Nova Pesquisa (NPS)';
        document.getElementById('campaign-id').value = '';
        document.getElementById('campaign-id').readOnly = false;
        document.getElementById('campaign-id').classList.remove('bg-gray-800', 'text-gray-500');
        document.getElementById('campaign-title').value = '';
        document.getElementById('campaign-desc').value = '';
        document.getElementById('campaign-active').checked = true;
        
        currentEditingCampaign = null;
        localQuestionsList = [];
        renderQuestionsList(localQuestionsList);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    });

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    btnAddQ.addEventListener('click', () => {
        localQuestionsList.push({
            id: `question_${Date.now()}`,
            label: '',
            type: 'rating-11',
            required: true,
            step: localQuestionsList.length > 0 ? Math.max(...localQuestionsList.map(q => q.step || 1)) : 1,
            options: []
        });
        renderQuestionsList(localQuestionsList);
        
        const questionsListDiv = document.getElementById('questions-list');
        setTimeout(() => {
            questionsListDiv.scrollTop = questionsListDiv.scrollHeight;
        }, 100);
    });

    btnSave.addEventListener('click', async () => {
        const idInput = document.getElementById('campaign-id');
        const titleInput = document.getElementById('campaign-title');
        const descInput = document.getElementById('campaign-desc');
        const activeInput = document.getElementById('campaign-active');

        const slug = idInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!slug) {
            alert('Por favor, defina um identificador único (Slug).');
            return;
        }

        const title = titleInput.value.trim();
        if (!title) {
            alert('Por favor, defina o título da pesquisa.');
            return;
        }

        const questionRows = document.querySelectorAll('#questions-list > div');
        const updatedQuestions = [];

        for (let i = 0; i < questionRows.length; i++) {
            const row = questionRows[i];
            const qId = row.querySelector('.q-id').value.trim();
            const qLabel = row.querySelector('.q-label').value.trim();
            const qType = row.querySelector('.q-type').value;
            const qStep = parseInt(row.querySelector('.q-step').value) || 1;
            const qRequired = row.querySelector('.q-required').checked;
            const qOptionsVal = row.querySelector('.q-options').value;
            
            if (!qId) {
                alert(`Pergunta ${i + 1}: Defina uma chave/ID.`);
                return;
            }
            if (!qLabel) {
                alert(`Pergunta ${i + 1}: Defina o texto da pergunta.`);
                return;
            }

            const optionsArray = qOptionsVal ? qOptionsVal.split(',').map(o => o.trim()).filter(Boolean) : [];

            updatedQuestions.push({
                id: qId,
                label: qLabel,
                type: qType,
                step: qStep,
                required: qRequired,
                options: optionsArray
            });
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Gravando...';

        try {
            const campaignData = {
                title,
                description: descInput.value.trim(),
                isActive: activeInput.checked,
                questions: updatedQuestions
            };

            if (!currentEditingCampaign) {
                campaignData.id = slug;
                campaignData.isSystem = false;
            } else {
                campaignData.id = currentEditingCampaign.id;
                campaignData.isSystem = currentEditingCampaign.isSystem || false;
            }

            await setDoc(doc(db, "public_config", "nps_campaign_" + campaignData.id), campaignData);
            closeModal();
            await loadInitialData();
        } catch (err) {
            console.error("Erro ao gravar campanha:", err);
            alert("Erro ao gravar campanha. Verifique se possui permissões de administrador.");
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Salvar Alterações';
        }
    });

    window.openCampaignEditor = (id) => {
        const campaign = allCampaigns.find(c => c.id === id);
        if (!campaign) return;

        currentEditingCampaign = campaign;
        localQuestionsList = JSON.parse(JSON.stringify(campaign.questions || []));

        document.getElementById('modal-title').textContent = 'Editar Pesquisa (NPS)';
        
        document.getElementById('campaign-id').value = campaign.id;
        document.getElementById('campaign-id').readOnly = true;
        document.getElementById('campaign-id').classList.add('bg-gray-800', 'text-gray-500');
        
        document.getElementById('campaign-title').value = campaign.title;
        document.getElementById('campaign-desc').value = campaign.description || '';
        document.getElementById('campaign-active').checked = campaign.isActive !== false;

        renderQuestionsList(localQuestionsList);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    window.deleteCampaignConfirm = async (id) => {
        const campaign = allCampaigns.find(c => c.id === id);
        if (!campaign) return;

        if (campaign.isSystem) {
            alert('Não é possível excluir campanhas padrão do sistema.');
            return;
        }

        if (confirm(`Tem certeza de que deseja excluir permanentemente a campanha "${campaign.title}"?`)) {
            try {
                await deleteDoc(doc(db, "public_config", "nps_campaign_" + id));
                await loadInitialData();
            } catch (err) {
                console.error("Erro ao deletar campanha:", err);
                alert("Erro ao deletar campanha.");
            }
        }
    };
}

function renderQuestionsList(questions) {
    const listContainer = document.getElementById('questions-list');
    listContainer.innerHTML = '';

    if (questions.length === 0) {
        listContainer.innerHTML = '<div class="text-center py-8 text-gray-500 italic text-sm">Nenhuma pergunta cadastrada. Adicione uma pergunta acima.</div>';
        return;
    }

    questions.forEach((q, idx) => {
        const row = document.createElement('div');
        row.className = 'p-4 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl space-y-3 relative group';
        row.dataset.index = idx;

        row.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800/50 pb-2">
                <div class="flex items-center gap-2">
                    <span class="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400">${idx + 1}</span>
                    <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Configuração da Pergunta</span>
                </div>
                <div class="flex items-center gap-1">
                    <button type="button" class="btn-move-up p-1 text-gray-450 hover:text-gray-900 dark:hover:text-white transition-colors" ${idx === 0 ? 'disabled style="opacity: 0.3;"' : ''} title="Subir">
                        <i class="fas fa-arrow-up text-xs"></i>
                    </button>
                    <button type="button" class="btn-move-down p-1 text-gray-450 hover:text-gray-900 dark:hover:text-white transition-colors" ${idx === questions.length - 1 ? 'disabled style="opacity: 0.3;"' : ''} title="Descer">
                        <i class="fas fa-arrow-down text-xs"></i>
                    </button>
                    <button type="button" class="btn-remove-question p-1 text-red-500 hover:text-red-400 transition-colors ml-2" title="Remover Pergunta">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">ID / Chave no Banco *</label>
                    <input type="text" class="q-id w-full bg-white dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 transition-all" value="${q.id || ''}" placeholder="ex: score_pontualidade">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Texto da Pergunta *</label>
                    <input type="text" class="q-label w-full bg-white dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 transition-all" value="${q.label || ''}" placeholder="ex: Como você avalia a pontualidade do evento?">
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Tipo da Pergunta</label>
                    <select class="q-type w-full bg-white dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 transition-all">
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>Texto (Linha única)</option>
                        <option value="text-area" ${q.type === 'text-area' ? 'selected' : ''}>Texto (Área multi-linha)</option>
                        <option value="select-unit" ${q.type === 'select-unit' ? 'selected' : ''}>Seletor Unidades (Dinâmico)</option>
                        <option value="select-professor" ${q.type === 'select-professor' ? 'selected' : ''}>Seletor Professores (Dinâmico)</option>
                        <option value="rating-5" ${q.type === 'rating-5' ? 'selected' : ''}>Rating 1 a 5 estrelas</option>
                        <option value="rating-10" ${q.type === 'rating-10' ? 'selected' : ''}>Rating 1 a 10 estrelas</option>
                        <option value="rating-11" ${q.type === 'rating-11' ? 'selected' : ''}>NPS (0 a 10 botões)</option>
                        <option value="radio" ${q.type === 'radio' ? 'selected' : ''}>Opções de Seleção Única</option>
                    </select>
                </div>
                <div class="q-options-container ${q.type === 'radio' ? '' : 'hidden'}">
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Opções (Separadas por vírgula)</label>
                    <input type="text" class="q-options w-full bg-white dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 transition-all" value="${(q.options || []).join(', ')}" placeholder="ex: Asa Sul, Sudoeste, Online, Outra">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Etapa (Wizard)</label>
                        <input type="number" class="q-step w-full bg-white dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 transition-all" value="${q.step || 1}" min="1">
                    </div>
                    <div class="flex items-center justify-center pt-5">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="q-required form-checkbox rounded text-yellow-500 bg-white dark:bg-[#181818] border-gray-300 dark:border-gray-700 focus:ring-0 focus:ring-offset-0" ${q.required ? 'checked' : ''}>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Obrigatória</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        const typeSelect = row.querySelector('.q-type');
        const optionsContainer = row.querySelector('.q-options-container');
        typeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'radio') {
                optionsContainer.classList.remove('hidden');
            } else {
                optionsContainer.classList.add('hidden');
            }
        });

        row.querySelector('.btn-move-up').addEventListener('click', () => {
            if (idx > 0) {
                const temp = questions[idx];
                questions[idx] = questions[idx - 1];
                questions[idx - 1] = temp;
                renderQuestionsList(questions);
            }
        });

        row.querySelector('.btn-move-down').addEventListener('click', () => {
            if (idx < questions.length - 1) {
                const temp = questions[idx];
                questions[idx] = questions[idx + 1];
                questions[idx + 1] = temp;
                renderQuestionsList(questions);
            }
        });

        row.querySelector('.btn-remove-question').addEventListener('click', () => {
            questions.splice(idx, 1);
            renderQuestionsList(questions);
        });

        listContainer.appendChild(row);
    });
}

function exportToCSV() {
    if (allResponses.length === 0) return;
    
    const type = document.getElementById('filter-type').value || 'regular';
    const campaign = allCampaigns.find(c => c.id === type) || allCampaigns.find(c => c.id === 'regular');
    if (!campaign) return;

    let filtered = allResponses.filter(r => {
        if (type === 'regular') {
            if (r.isExperienceEvent || (r.campaignId && r.campaignId !== 'regular')) return false;
        } else if (type === 'experience') {
            if (!r.isExperienceEvent && r.campaignId !== 'experience') return false;
        } else {
            if (r.campaignId !== type) return false;
        }
        return true;
    });

    const mainQ = campaign.questions.find(q => q.id === 'score') || campaign.questions.find(q => q.type.startsWith('rating-'));
    const mainField = mainQ ? mainQ.id : 'score';

    const ratingQuestions = campaign.questions.filter(q => q.type.startsWith('rating-') && q.id !== mainField);
    
    const headers = [
        "Data", 
        "Aluno", 
        "Contato", 
        "Score Geral", 
        ...ratingQuestions.map(q => q.label),
        "Unidade", 
        "Professor", 
        "Comentario"
    ];

    const rows = filtered.map(r => {
        const date = r.timestamp?.toDate ? r.timestamp.toDate().toISOString() : "";
        const student = r.studentName || "";
        const contact = r.contact || "";
        const score = r[mainField] ?? r.score ?? "";
        const ratings = ratingQuestions.map(q => r[q.id] ?? "");
        const unit = r.unitName || "";
        const prof = r.professorName || "";
        const comment = `"${(r.comment || '').replace(/"/g, '""')}"`;

        return [
            date,
            student,
            contact,
            score,
            ...ratings,
            unit,
            prof,
            comment
        ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nps_${type}_feedback_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
