import { app, db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady, checkAdminStatus } from './auth.js';

const triggerSnapshot = httpsCallable(functions, 'triggerSnapshot');
const deleteEvoSnapshot = httpsCallable(functions, 'deleteEvoSnapshot');
const listAlunosLocais = httpsCallable(functions, 'listAlunosLocais');
const syncEvoStudentsToCache = httpsCallable(functions, 'syncEvoStudentsToCache');
const refreshLiveEvoEntries = httpsCallable(functions, 'refreshLiveEvoEntries');

const EXCLUDED_CONTRACT_REGEX = /experimental|di[aá]ria|aula\s*avulsa|visitante|cortesia|free\s*pass/i;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

let snapshots = [];
let syncStatusByUnit = {};
let allStoreSales = [];
let storeSalesPromise = null;
let allClassTemplates = [];
let weeklyClassInstances = [];
let hasLoadedGrades = false;
let isAdmin = false;
let allEvoStudents = [];
let hasLoadedEvoStudents = false;
let isSyncingContracts = false;
let hasAttemptedBackgroundEvoRefresh = false;

let activeChurnTab = 'returns';
let showAllChurnRows = false;

let contractsChartInstance = null;
let studentsChartInstance = null;
let storeChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(async (user) => {
        if (user) {
            isAdmin = await checkAdminStatus(user);
        }
        loadComponents(initializeDashboard);
    });
});

function getLocalDateStr(daysAgo = 0) {
    const dt = new Date();
    if (daysAgo !== 0) {
        dt.setDate(dt.getDate() - daysAgo);
    }
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeAnalysisText(str) {
    return (str || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function normalizeUnitSlug(raw) {
    return normalizeAnalysisText(raw)
        .replace(/^kihap\s*-\s*/i, '')
        .replace(/^unidade\s+/i, '')
        .trim()
        .replace(/\s+/g, '-');
}

function formatUnitDisplayLabel(unitId) {
    if (!unitId || unitId === 'geral' || unitId === 'all') {
        return 'Visão Geral (Todas as Unidades)';
    }
    const known = {
        'lago-sul': 'Lago Sul',
        'centro': 'Centro',
        'santa-monica': 'Santa Mônica',
        'coqueiros': 'Coqueiros',
        'asa-sul': 'Asa Sul',
        'sudoeste': 'Sudoeste',
        'pontos-de-ensino': 'Pontos de Ensino',
        'jardim-botanico': 'Jardim Botânico',
        'dourados': 'Dourados',
        'noroeste': 'Noroeste'
    };
    return known[unitId] || unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function parseEvoDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal.toDate === 'function') {
        return dateVal.toDate();
    }
    const parsed = new Date(dateVal);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateBr(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString('pt-BR');
}

function formatGapDuration(days) {
    const safeDays = Math.max(0, Math.round(days || 0));
    if (safeDays < 30) {
        return `${safeDays} ${safeDays === 1 ? 'dia' : 'dias'}`;
    }
    if (safeDays < 365) {
        const months = Math.max(1, Math.round(safeDays / 30));
        return `${months} ${months === 1 ? 'mês' : 'meses'} (${safeDays}d)`;
    }
    const years = (safeDays / 365).toFixed(1).replace('.', ',');
    return `${years} anos (${safeDays}d)`;
}

function formatUnitDisplayName(student) {
    const raw = student?.branchName || student?.unitId || 'N/A';
    return raw
        .toString()
        .replace(/^KIHAP\s*-\s*/i, '')
        .trim() || 'N/A';
}

function matchesSelectedUnit(student, selectedUnit) {
    if (!selectedUnit || selectedUnit === 'geral' || selectedUnit === 'all') {
        return true;
    }
    const target = selectedUnit.toLowerCase().trim();
    const studentUnit = String(student?.unitId || '').toLowerCase().trim();
    if (studentUnit === target) return true;
    return normalizeUnitSlug(student?.branchName) === target;
}

function isStudentCurrentlyActive(student) {
    const s = String(student?.status ?? '').toLowerCase().trim();
    const ms = String(student?.membershipStatus ?? '').toLowerCase().trim();
    if (s === 'active' || s === 'ativo' || s === '1' || ms === 'active' || ms === 'ativo') {
        return true;
    }
    if (Array.isArray(student?.memberships)) {
        return student.memberships.some(m => String(m?.membershipStatus || '').toLowerCase() === 'active');
    }
    return false;
}

function getChurnPeriodBounds(periodKey) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (periodKey === '30d') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
        return { start, end };
    }
    if (periodKey === '90d') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90, 0, 0, 0, 0);
        return { start, end };
    }
    if (periodKey === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start, end };
    }
    if (periodKey === 'this_year') {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        return { start, end };
    }
    return { start: null, end: null };
}

function getPeriodShortLabel(periodKey) {
    const map = {
        '30d': '30 dias',
        '90d': '90 dias',
        'this_month': 'Este Mês',
        'this_year': 'Este Ano',
        'all': 'Histórico'
    };
    return map[periodKey] || 'Período';
}

function isDateWithinBounds(dateObj, bounds) {
    if (!bounds || (!bounds.start && !bounds.end)) return true;
    if (!dateObj || isNaN(dateObj.getTime())) return false;
    const ts = dateObj.getTime();
    if (bounds.start && ts < bounds.start.getTime()) return false;
    if (bounds.end && ts > bounds.end.getTime()) return false;
    return true;
}

function analyzeStudentContracts(student) {
    const rawMemberships = Array.isArray(student?.memberships) ? student.memberships : [];
    const realContracts = rawMemberships
        .filter(ms => ms && ms.startDate && !EXCLUDED_CONTRACT_REGEX.test(ms.name || ''))
        .map(ms => {
            const startDt = parseEvoDate(ms.startDate);
            const endDt = parseEvoDate(ms.cancelDate || ms.endDate || ms.startDate);
            const msStatus = String(ms.membershipStatus || '').toLowerCase();
            const wasCanceled = Boolean(ms.cancelDate || msStatus === 'canceled' || msStatus === 'cancelled');
            const isMembershipActive = msStatus === 'active' || msStatus === 'ativo';
            return {
                raw: ms,
                startDt,
                endDt,
                wasCanceled,
                isMembershipActive
            };
        })
        .filter(c => c.startDt !== null)
        .sort((a, b) => {
            const diff = a.startDt.getTime() - b.startDt.getTime();
            if (diff !== 0) return diff;
            return (Number(a.raw.idMemberMembership) || 0) - (Number(b.raw.idMemberMembership) || 0);
        });

    const isActive = isStudentCurrentlyActive(student);

    if (realContracts.length === 0) {
        return {
            hasContracts: false,
            isActive,
            activeContractsCount: isActive ? 1 : 0,
            firstContractStart: null,
            firstContractName: null,
            returnEvents: [],
            baixa: null
        };
    }

    const explicitActiveContracts = realContracts.filter(c => c.isMembershipActive).length;
    const activeContractsCount = isActive ? Math.max(1, explicitActiveContracts) : explicitActiveContracts;
    const firstContractStart = realContracts[0].startDt;
    const firstContractName = realContracts[0].raw.name || 'Contrato inicial';

    const returnEvents = [];
    let maxCoverageEnd = realContracts[0].endDt;
    let lastCoveringContract = realContracts[0];

    for (let i = 1; i < realContracts.length; i++) {
        const curr = realContracts[i];
        if (maxCoverageEnd && curr.startDt) {
            const gapDays = Math.round((curr.startDt.getTime() - maxCoverageEnd.getTime()) / MS_PER_DAY);
            const isReturnTransition =
                gapDays > 30 ||
                (lastCoveringContract.wasCanceled && gapDays > 7 && !curr.raw.idMemberMembershipRenewed);

            if (isReturnTransition) {
                returnEvents.push({
                    baixaDate: maxCoverageEnd,
                    returnDate: curr.startDt,
                    gapDays: Math.max(0, gapDays),
                    prevPlan: lastCoveringContract.raw.name || 'Contrato anterior',
                    currentPlan: curr.raw.name || 'Novo contrato',
                    wasCanceled: lastCoveringContract.wasCanceled
                });
            }
        }

        if (curr.endDt && (!maxCoverageEnd || curr.endDt.getTime() > maxCoverageEnd.getTime())) {
            maxCoverageEnd = curr.endDt;
            lastCoveringContract = curr;
        }
    }

    let baixa = null;
    if (!isActive) {
        const orderedByEnd = [...realContracts].sort((a, b) => {
            const aTime = a.endDt ? a.endDt.getTime() : 0;
            const bTime = b.endDt ? b.endDt.getTime() : 0;
            return aTime - bTime;
        });
        const lastContract = orderedByEnd[orderedByEnd.length - 1];
        if (lastContract && lastContract.endDt) {
            baixa = {
                baixaDate: lastContract.endDt,
                lastPlan: lastContract.raw.name || 'N/A',
                wasCanceled: lastContract.wasCanceled
            };
        }
    }

    return {
        hasContracts: true,
        isActive,
        activeContractsCount,
        firstContractStart,
        firstContractName,
        returnEvents,
        baixa
    };
}

function getInstructorKey(tpl) {
    if (tpl?.teacherId) return `id:${String(tpl.teacherId)}`;
    const normName = normalizeAnalysisText(tpl?.teacherName || '');
    return normName ? `name:${normName}` : 'unknown';
}

function buildInstructorDirectory(selectedUnit) {
    const map = new Map();

    allClassTemplates.forEach(tpl => {
        const tplUnit = normalizeUnitSlug(tpl.unitId);
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all' && tplUnit !== selectedUnit) {
            return;
        }
        const key = getInstructorKey(tpl);
        const teacherName = (tpl.teacherName || 'Sem Instrutor').trim();
        if (!map.has(key)) {
            map.set(key, {
                key,
                teacherId: tpl.teacherId || '',
                teacherName,
                unitIds: new Set(),
                templateIds: new Set(),
                classCount: 0,
                studentIds: new Set(),
                directWeeklyAttendIds: new Set(),
                directTodayAttendIds: new Set(),
            });
        }
        const entry = map.get(key);
        if (tplUnit) entry.unitIds.add(tplUnit);
        if (tpl.id) entry.templateIds.add(tpl.id);
        entry.classCount += 1;
        if (Array.isArray(tpl.students)) {
            tpl.students.forEach(sid => {
                if (sid !== undefined && sid !== null && String(sid).trim() !== '') {
                    entry.studentIds.add(String(sid).trim());
                }
            });
        }
    });

    const todayStr = getLocalDateStr(0);
    weeklyClassInstances.forEach(inst => {
        const instUnit = normalizeUnitSlug(inst.unitId);
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all' && instUnit !== selectedUnit) {
            return;
        }
        map.forEach(entry => {
            if (inst.templateId && entry.templateIds.has(inst.templateId)) {
                (inst.presentStudents || []).forEach(id => {
                    const strId = String(id).trim();
                    entry.directWeeklyAttendIds.add(strId);
                    if (inst.date === todayStr) entry.directTodayAttendIds.add(strId);
                });
            }
        });
    });

    return Array.from(map.values()).sort((a, b) => b.studentIds.size - a.studentIds.size || a.teacherName.localeCompare(b.teacherName));
}

function populateInstructorFilter(selectedUnit) {
    const select = document.getElementById('instructor-filter');
    if (!select) return;

    const prevValue = select.value || 'all';
    const instructors = buildInstructorDirectory(selectedUnit);

    select.innerHTML = '<option value="all">Todos os Instrutores</option>';
    let hasPrev = false;

    instructors.forEach(inst => {
        const opt = document.createElement('option');
        opt.value = inst.key;
        opt.textContent = `${inst.teacherName} (${inst.studentIds.size} na grade)`;
        if (inst.key === prevValue) hasPrev = true;
        select.appendChild(opt);
    });

    select.value = hasPrev ? prevValue : 'all';
}

function computeAttendanceMetrics(selectedUnit, selectedInstructorKey) {
    const todayStr = getLocalDateStr(0);
    const weeklyUniqueIds = new Set();
    const todayUniqueIds = new Set();

    const instructors = buildInstructorDirectory(selectedUnit);
    const selectedInstructor = selectedInstructorKey !== 'all'
        ? instructors.find(i => i.key === selectedInstructorKey)
        : null;

    // 1. Check-ins da Grade Interna nos últimos 7 dias
    weeklyClassInstances.forEach(inst => {
        const instUnit = normalizeUnitSlug(inst.unitId);
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all' && instUnit !== selectedUnit) {
            return;
        }
        if (selectedInstructor && (!inst.templateId || !selectedInstructor.templateIds.has(inst.templateId))) {
            return;
        }

        (inst.presentStudents || []).forEach(id => {
            const key = String(id).trim();
            weeklyUniqueIds.add(key);
            if (inst.date === todayStr) todayUniqueIds.add(key);
        });

        (inst.trialStudents || []).forEach(trial => {
            if (trial?.compareceu === true) {
                const trialId = `trial-${trial.email || trial.phone || trial.name || 'anon'}`;
                weeklyUniqueIds.add(trialId);
                if (inst.date === todayStr) todayUniqueIds.add(trialId);
            }
        });
    });

    // 2. Check-ins do EVO (evo_sync_status: weeklyMemberIds e todayEntries)
    let evoTodayAdd = 0;
    let evoWeeklyFallback = 0;
    let hasTodayEvoWeeklyArray = false;

    Object.entries(syncStatusByUnit).forEach(([uId, data]) => {
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all' && uId !== selectedUnit) {
            return;
        }

        if (Array.isArray(data.weeklyMemberIds)) {
            if (data.todayDate === todayStr) hasTodayEvoWeeklyArray = true;
            data.weeklyMemberIds.forEach(id => {
                const sid = String(id).trim();
                if (!selectedInstructor || selectedInstructor.studentIds.has(sid)) {
                    weeklyUniqueIds.add(sid);
                }
            });
        } else if (!selectedInstructor && Number(data.weeklyEntries) > 0) {
            evoWeeklyFallback += Number(data.weeklyEntries);
        }

        if (!selectedInstructor && data.todayDate === todayStr) {
            evoTodayAdd += Number(data.todayEntries) || 0;
        }
    });

    return {
        weeklyUniqueIds,
        weeklyCount: weeklyUniqueIds.size + evoWeeklyFallback,
        todayCount: todayUniqueIds.size + evoTodayAdd,
        hasTodayEvoWeeklyArray
    };
}

function getSelectedFilters() {
    const locationFilter = document.getElementById('location-filter');
    const instructorFilter = document.getElementById('instructor-filter');
    const periodFilter = document.getElementById('churn-period-filter');
    return {
        selectedUnit: locationFilter ? locationFilter.value : 'geral',
        selectedInstructor: instructorFilter ? instructorFilter.value : 'all',
        selectedPeriod: periodFilter ? periodFilter.value : 'this_year',
    };
}

function getEvoSyncContractsTotal(selectedUnit) {
    const VERIFIED_UNITS = {
        'lago-sul': 162,
        'centro': 32,
        'santa-monica': 128,
        'coqueiros': 35,
        'asa-sul': 155,
        'sudoeste': 149,
        'pontos-de-ensino': 46,
        'jardim-botanico': 81,
        'dourados': 53,
        'noroeste': 113
    };

    let total = 0;
    const found = new Set();

    Object.entries(syncStatusByUnit).forEach(([uId, data]) => {
        if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all') {
            if (uId === selectedUnit) {
                found.add(uId);
                total += Number(data.activeStudents) || VERIFIED_UNITS[uId] || 0;
            }
        } else if (VERIFIED_UNITS[uId] !== undefined || Number(data.activeStudents) > 0) {
            found.add(uId);
            total += Number(data.activeStudents) || VERIFIED_UNITS[uId] || 0;
        }
    });

    if (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all') {
        if (!found.has(selectedUnit) && VERIFIED_UNITS[selectedUnit] !== undefined) {
            total = VERIFIED_UNITS[selectedUnit];
        }
    } else {
        Object.entries(VERIFIED_UNITS).forEach(([uId, fallbackVal]) => {
            if (!found.has(uId)) total += fallbackVal;
        });
    }

    return total;
}

function getSnapshotMetricsForUnit(snapshot, selectedUnit) {
    const dateObj = snapshot.timestamp?.toDate ? snapshot.timestamp.toDate() : null;
    const dateStrBr = dateObj ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

    if (!selectedUnit || selectedUnit === 'geral' || selectedUnit === 'all') {
        const weekly = snapshot.totalWeeklyActives !== undefined ? snapshot.totalWeeklyActives : null;
        const daily = snapshot.totalDailyActives || 0;
        return {
            contracts: snapshot.totalContracts || 0,
            dailyActives: daily,
            weeklyActives: weekly,
            chartActives: weekly !== null ? weekly : daily,
            storeSales: snapshot.storeTotalSales || 0,
            storeRevenue: (snapshot.storeTotalRevenue || 0) / 100
        };
    }

    const unitData = snapshot.units?.[selectedUnit] || {};
    const weekly = unitData.weeklyActives !== undefined ? unitData.weeklyActives : null;
    const daily = unitData.dailyActives || 0;

    let storeSales = typeof unitData.storeSales === 'number' ? unitData.storeSales : null;
    if (storeSales === null && dateStrBr && allStoreSales.length > 0) {
        storeSales = allStoreSales.filter(sale => {
            if (!sale.created || sale.paymentStatus !== 'paid') return false;
            if (normalizeUnitSlug(sale.userUnit) !== selectedUnit) return false;
            const sDate = sale.created.toDate ? sale.created.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            return sDate === dateStrBr;
        }).length;
    }

    return {
        contracts: unitData.contracts || 0,
        dailyActives: daily,
        weeklyActives: weekly,
        chartActives: weekly !== null ? weekly : daily,
        storeSales: storeSales || 0,
        storeRevenue: (unitData.storeRevenue || 0) / 100
    };
}

async function initializeDashboard() {
    const addProspectBtn = document.getElementById('addProspectBtnHeader');
    if (addProspectBtn) {
        addProspectBtn.remove();
    }

    await populateFilters();

    const locationFilter = document.getElementById('location-filter');
    const instructorFilter = document.getElementById('instructor-filter');
    const snapshotSearch = document.getElementById('snapshot-search');

    const updateAllViews = () => {
        showAllChurnRows = false;
        const { selectedUnit } = getSelectedFilters();
        updateHeaderSubtitle();
        renderTopKpis();
        displayStoreSalesKpi(selectedUnit);
        renderEvolutionCharts();
        renderStoreSalesChart();
        renderChurnAndReturnsPanel();
        renderInstructorPortfolioSection();
        renderSnapshotLog(snapshotSearch ? snapshotSearch.value : '');
    };

    if (locationFilter) {
        locationFilter.addEventListener('change', () => {
            populateInstructorFilter(locationFilter.value);
            updateAllViews();
        });
    }

    if (instructorFilter) {
        instructorFilter.addEventListener('change', () => {
            showAllChurnRows = false;
            updateHeaderSubtitle();
            renderTopKpis();
            renderChurnAndReturnsPanel();
            renderInstructorPortfolioSection();
        });
    }

    setupChurnAndReturnsPanel();
    setupModal();
    setupWeeklySummaryModal();

    if (snapshotSearch) {
        snapshotSearch.addEventListener('input', (e) => {
            renderSnapshotLog(e.target.value);
        });
    }
    const exportBtn = document.getElementById('export-snapshots-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSnapshotsToCsv);
    }

    const manualSnapshotBtn = document.getElementById('manual-snapshot-btn');
    const weeklySummaryBtn = document.getElementById('weekly-summary-btn');
    const syncChurnBtn = document.getElementById('sync-churn-contracts-btn');

    if (isAdmin) {
        manualSnapshotBtn?.addEventListener('click', handleManualSnapshot);
        if (weeklySummaryBtn) {
            weeklySummaryBtn.classList.remove('hidden');
            weeklySummaryBtn.addEventListener('click', showWeeklySummary);
        }
        if (syncChurnBtn) {
            syncChurnBtn.classList.remove('hidden');
            syncChurnBtn.addEventListener('click', handleSyncChurnContracts);
        }
    } else {
        if (manualSnapshotBtn) manualSnapshotBtn.style.display = 'none';
        if (weeklySummaryBtn) weeklySummaryBtn.style.display = 'none';
    }

    // Carrega em paralelo dados leves iniciais (Snapshots, Status EVO, Vendas da Store, Turmas & Presenças 7d)
    storeSalesPromise = fetchStoreSales();
    await Promise.all([
        fetchSnapshots(),
        fetchSyncStatus(),
        storeSalesPromise,
        fetchGradeAndWeeklyAttendance(),
    ]);

    populateInstructorFilter(locationFilter ? locationFilter.value : 'geral');
    updateAllViews();

    // Carrega histórico completo de alunos/contratos EVO (sem travar render inicial)
    await loadEvoStudentsForAnalysis();

    // Atualiza entradas da semana ao vivo do EVO em background se necessário
    triggerBackgroundEvoEntriesRefreshIfNeeded();
}

function updateHeaderSubtitle() {
    const subtitleEl = document.getElementById('dashboard-subtitle');
    if (!subtitleEl) return;
    const { selectedUnit, selectedInstructor } = getSelectedFilters();
    let text = formatUnitDisplayLabel(selectedUnit);
    if (selectedUnit && selectedUnit !== 'geral' && !text.startsWith('Unidade')) {
        text = `Unidade ${text}`;
    }
    if (selectedInstructor && selectedInstructor !== 'all') {
        const inst = buildInstructorDirectory(selectedUnit).find(i => i.key === selectedInstructor);
        if (inst) {
            text += ` • Instrutor: ${inst.teacherName}`;
        }
    }
    subtitleEl.textContent = text;
}

async function fetchSyncStatus() {
    try {
        const snap = await getDocs(collection(db, 'evo_sync_status'));
        const map = {};
        snap.forEach(docSnap => {
            map[docSnap.id.toLowerCase().trim()] = docSnap.data();
        });
        syncStatusByUnit = map;
    } catch (e) {
        console.warn('[analysis] Erro ao buscar evo_sync_status:', e);
    }
}

async function fetchStoreSales() {
    try {
        const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'asc'));
        const snap = await getDocs(q);
        allStoreSales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('[analysis] Erro ao carregar vendas da loja:', error);
        allStoreSales = [];
    }
}

async function fetchGradeAndWeeklyAttendance() {
    const weekStartStr = getLocalDateStr(6);
    const todayStr = getLocalDateStr(0);

    try {
        const [templatesSnap, instancesSnap] = await Promise.all([
            getDocs(collection(db, 'classTemplates')),
            getDocs(query(
                collection(db, 'classInstances'),
                where('date', '>=', weekStartStr),
                where('date', '<=', todayStr)
            ))
        ]);
        allClassTemplates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        weeklyClassInstances = instancesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.warn('[analysis] Erro ao carregar turmas/frequência da Grade:', error);
        allClassTemplates = [];
        weeklyClassInstances = [];
    } finally {
        hasLoadedGrades = true;
    }
}

async function triggerBackgroundEvoEntriesRefreshIfNeeded() {
    if (hasAttemptedBackgroundEvoRefresh) return;
    const { selectedUnit, selectedInstructor } = getSelectedFilters();
    const { hasTodayEvoWeeklyArray } = computeAttendanceMetrics(selectedUnit, selectedInstructor);
    if (hasTodayEvoWeeklyArray) return;

    hasAttemptedBackgroundEvoRefresh = true;
    try {
        await refreshLiveEvoEntries();
        await fetchSyncStatus();
        renderTopKpis();
        renderInstructorPortfolioSection();
    } catch (err) {
        console.warn('[analysis] Atualização ao vivo de entradas semanais indisponível:', err.message);
    }
}

async function handleManualSnapshot() {
    try {
        alert('Gerando snapshot... Isso pode levar até um minuto.');
        await triggerSnapshot();
        alert('Snapshot gerado com sucesso! A página será atualizada.');
        await fetchSnapshots();
        const snapshotSearch = document.getElementById('snapshot-search');
        renderSnapshotLog(snapshotSearch ? snapshotSearch.value : '');
        renderEvolutionCharts();
    } catch (error) {
        console.error("Erro ao gerar snapshot manual:", error);
        alert(`Erro ao gerar snapshot: ${error.message}`);
    }
}

async function populateFilters() {
    const locationFilter = document.getElementById('location-filter');
    if (!locationFilter) return;

    const units = [
        { id: 'lago-sul', name: 'Lago Sul' },
        { id: 'centro', name: 'Centro' },
        { id: 'santa-monica', name: 'Santa Mônica' },
        { id: 'coqueiros', name: 'Coqueiros' },
        { id: 'asa-sul', name: 'Asa Sul' },
        { id: 'sudoeste', name: 'Sudoeste' },
        { id: 'pontos-de-ensino', name: 'Pontos de Ensino' },
        { id: 'jardim-botanico', name: 'Jardim Botânico' },
        { id: 'dourados', name: 'Dourados' },
        { id: 'noroeste', name: 'Noroeste' }
    ];

    locationFilter.innerHTML = '<option value="geral">Visão Geral (Todas as Unidades)</option>';

    units.forEach(u => {
        const option = document.createElement('option');
        option.value = u.id;
        option.textContent = `Unidade ${u.name}`;
        locationFilter.appendChild(option);
    });
}

async function fetchSnapshots() {
    const snapshotsRef = collection(db, 'evo_daily_snapshots');
    const q = query(snapshotsRef, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    snapshots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function renderSnapshotLog(searchTerm = '') {
    const logBody = document.getElementById('snapshot-log-body');
    const logTitle = document.getElementById('snapshot-log-title');
    if (!logBody) return;

    const { selectedUnit } = getSelectedFilters();
    if (logTitle) {
        const unitLabel = selectedUnit === 'geral' ? 'Visão Geral' : `Unidade ${formatUnitDisplayLabel(selectedUnit)}`;
        logTitle.textContent = `Histórico de Snapshots (Últimos 7 dias) • ${unitLabel}`;
    }

    let filteredSnapshots = snapshots.filter(item => {
        if (!item.timestamp) return false;
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return displayDate.includes(searchTerm);
    });

    if (!searchTerm) {
        filteredSnapshots = filteredSnapshots.slice(0, 7);
    }

    if (filteredSnapshots.length === 0) {
        logBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum snapshot encontrado para "${escapeHtml(searchTerm)}".</td></tr>`;
        return;
    }

    logBody.innerHTML = filteredSnapshots.map(item => {
        const date = item.timestamp.toDate();
        const displayDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const metrics = getSnapshotMetricsForUnit(item, selectedUnit);
        const activesText = metrics.weeklyActives !== null
            ? `${metrics.weeklyActives.toLocaleString('pt-BR')} sem. <span class="text-xs text-gray-400 font-normal">(Dia: ${metrics.dailyActives.toLocaleString('pt-BR')})</span>`
            : `${metrics.dailyActives.toLocaleString('pt-BR')} <span class="text-xs text-gray-400 font-normal">(Dia)</span>`;

        return `
            <tr class="log-item cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition duration-150 border-b border-gray-100 dark:border-gray-800/50 last:border-0" data-id="${item.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">${displayDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${metrics.contracts.toLocaleString('pt-BR')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${activesText}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${metrics.storeSales.toLocaleString('pt-BR')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${metrics.storeRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', handleViewSnapshot);
    });
}

function setupWeeklySummaryModal() {
    const modal = document.getElementById('weekly-summary-modal');
    const closeBtn = document.getElementById('close-weekly-summary-modal-btn');
    if (!modal || !closeBtn) return;

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-active');
        }, 250);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function showWeeklySummary() {
    if (snapshots.length < 7) {
        alert("Não há dados suficientes para gerar um resumo semanal. São necessários pelo menos 7 dias de snapshots.");
        return;
    }

    const { selectedUnit } = getSelectedFilters();
    const unitTitle = selectedUnit === 'geral' ? 'Visão Geral' : `Unidade ${formatUnitDisplayLabel(selectedUnit)}`;

    const latestSnapshot = snapshots[0];
    const seventhDaySnapshot = snapshots[6];
    const latestMetrics = getSnapshotMetricsForUnit(latestSnapshot, selectedUnit);
    const prevMetrics = getSnapshotMetricsForUnit(seventhDaySnapshot, selectedUnit);

    const calculateDifference = (current, previous) => {
        const diff = current - previous;
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';
        return `<span class="${color}">(${sign}${diff})</span>`;
    };

    const summaryBody = document.getElementById('weekly-summary-modal-body');
    summaryBody.innerHTML = `
        <p class="text-xs font-bold uppercase tracking-wider text-amber-500">${escapeHtml(unitTitle)}</p>
        <div class="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Contratos Ativos</p>
            <p class="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                ${latestMetrics.contracts.toLocaleString('pt-BR')}
                ${calculateDifference(latestMetrics.contracts, prevMetrics.contracts)}
            </p>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Presenças Registradas (Semana / Dia)</p>
            <p class="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                ${latestMetrics.chartActives.toLocaleString('pt-BR')}
                ${calculateDifference(latestMetrics.chartActives, prevMetrics.chartActives)}
            </p>
        </div>
        <p class="text-xs text-center text-gray-500 dark:text-gray-400 pt-2">
            Comparativo entre ${seventhDaySnapshot.timestamp.toDate().toLocaleDateString('pt-BR')} e ${latestSnapshot.timestamp.toDate().toLocaleDateString('pt-BR')}.
        </p>
    `;

    const modal = document.getElementById('weekly-summary-modal');
    modal.classList.remove('hidden');
    document.body.classList.add('modal-active');
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

function setupModal() {
    const modal = document.getElementById('snapshot-modal');
    const closeBtn = document.getElementById('close-snapshot-modal-btn');
    if (!modal || !closeBtn) return;

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-active');
        }, 250);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function handleViewSnapshot(event) {
    const docId = event.currentTarget.getAttribute('data-id');
    const snapshot = snapshots.find(item => item.id === docId);
    if (!snapshot) return;

    const modal = document.getElementById('snapshot-modal');
    const modalTitle = document.getElementById('snapshot-modal-title');
    const modalBody = document.getElementById('snapshot-modal-body');

    const date = snapshot.timestamp.toDate();
    modalTitle.textContent = `Detalhes do Snapshot - ${date.toLocaleDateString('pt-BR')}`;

    const deleteBtn = document.getElementById('delete-snapshot-btn');
    if (isAdmin) {
        deleteBtn.classList.remove('hidden');
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newDeleteBtn.addEventListener('click', () => handleDeleteSnapshot(docId));
    } else {
        deleteBtn.classList.add('hidden');
    }

    let tableHtml = `
        <div class="overflow-hidden rounded-xl border border-gray-150 dark:border-gray-800 shadow-inner">
            <table class="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                <thead class="text-xs text-gray-700 dark:text-gray-200 uppercase bg-gray-100 dark:bg-gray-800/80 border-b border-gray-150 dark:border-gray-850">
                    <tr>
                        <th scope="col" class="px-6 py-3">Unidade</th>
                        <th scope="col" class="px-6 py-3">Contratos Ativos</th>
                        <th scope="col" class="px-6 py-3">Semana / Dia</th>
                        <th scope="col" class="px-6 py-3">Receita (Loja)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50 bg-white dark:bg-transparent">
    `;

    const sortedUnitIds = Object.keys(snapshot.units || {}).sort();

    for (const unitId of sortedUnitIds) {
        const unitData = snapshot.units[unitId] || {};
        const displayName = formatUnitDisplayLabel(unitId);
        const storeRevenue = (unitData.storeRevenue || 0) / 100;
        const activesLabel = unitData.weeklyActives !== undefined
            ? `${unitData.weeklyActives} sem. / ${unitData.dailyActives || 0} dia`
            : `${unitData.dailyActives || 0}`;

        tableHtml += `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition duration-150">
                <th scope="row" class="px-6 py-3.5 font-bold text-gray-900 dark:text-white whitespace-nowrap">${escapeHtml(displayName)}</th>
                <td class="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">${unitData.contracts || 0}${unitData.contractsFromFallback ? ' <span class="text-[10px] text-amber-500">(fallback)</span>' : ''}</td>
                <td class="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">${activesLabel}</td>
                <td class="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">${storeRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
        `;
    }

    const totalRevenue = (snapshot.storeTotalRevenue || 0) / 100;
    const totalActivesLabel = snapshot.totalWeeklyActives !== undefined
        ? `${snapshot.totalWeeklyActives} sem. / ${snapshot.totalDailyActives || 0} dia`
        : `${snapshot.totalDailyActives || 0}`;

    tableHtml += `
                </tbody>
                <tfoot class="bg-gray-50 dark:bg-gray-800/40 border-t border-gray-250 dark:border-gray-750">
                    <tr class="font-bold text-gray-900 dark:text-white">
                        <th scope="row" class="px-6 py-4 text-sm font-extrabold">Total</th>
                        <td class="px-6 py-4 text-sm font-extrabold">${snapshot.totalContracts || 0}</td>
                        <td class="px-6 py-4 text-sm font-extrabold">${totalActivesLabel}</td>
                        <td class="px-6 py-4 text-sm font-extrabold">${totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    modalBody.innerHTML = tableHtml;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-active');
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

async function handleDeleteSnapshot(snapshotId) {
    if (!confirm('Tem certeza que deseja apagar este snapshot? Esta ação não pode ser desfeita.')) {
        return;
    }

    const deleteBtn = document.getElementById('delete-snapshot-btn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Apagando...';

    try {
        await deleteEvoSnapshot({ snapshotId });
        alert('Snapshot apagado com sucesso!');
        document.getElementById('snapshot-modal').classList.add('hidden');
        document.body.classList.remove('modal-active');
        snapshots = snapshots.filter(s => s.id !== snapshotId);
        renderSnapshotLog();
        renderEvolutionCharts();
    } catch (error) {
        console.error("Erro ao apagar snapshot:", error);
        alert(`Erro ao apagar snapshot: ${error.message}`);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Apagar Snapshot';
    }
}

function computeDatasetSummary(selectedUnit, selectedInstructorKey, selectedPeriod) {
    const bounds = getChurnPeriodBounds(selectedPeriod);
    const instructors = buildInstructorDirectory(selectedUnit);
    const instructorObj = selectedInstructorKey !== 'all'
        ? instructors.find(i => i.key === selectedInstructorKey)
        : null;

    let filteredStudents = allEvoStudents.filter(s => matchesSelectedUnit(s, selectedUnit));
    if (instructorObj) {
        filteredStudents = filteredStudents.filter(s => instructorObj.studentIds.has(String(s.idMember)));
    }

    let activeStudentsCount = 0;
    let activeContractsFromStudents = 0;
    let inactiveWithContractsCount = 0;
    let activeReturnedCount = 0;
    let totalInactiveBaixasAllTime = 0;
    let returnedEverCount = 0;
    let studentsWithMembershipsCount = 0;

    const baixasInPeriod = [];
    const returnsInPeriod = [];
    const newInPeriod = [];

    for (const student of filteredStudents) {
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || `Aluno #${student.idMember}`;
        if (fullName.startsWith('***Dados')) continue;

        if (Array.isArray(student.memberships) && student.memberships.length > 0) {
            studentsWithMembershipsCount++;
        }

        const analysis = analyzeStudentContracts(student);
        if (analysis.isActive) {
            activeStudentsCount++;
            activeContractsFromStudents += analysis.activeContractsCount;
        } else if (analysis.hasContracts) {
            inactiveWithContractsCount++;
        }

        if (!analysis.hasContracts) continue;

        if (analysis.firstContractStart && isDateWithinBounds(analysis.firstContractStart, bounds)) {
            newInPeriod.push({
                idMember: student.idMember,
                unitId: student.unitId || '',
                unitName: formatUnitDisplayName(student),
                name: fullName,
                isActive: analysis.isActive,
                enrollmentDate: analysis.firstContractStart,
                firstPlan: analysis.firstContractName || 'Contrato inicial',
            });
        }

        if (analysis.returnEvents.length > 0) {
            returnedEverCount++;
            if (analysis.isActive) {
                activeReturnedCount++;
            }

            const matchingReturns = analysis.returnEvents.filter(ev => isDateWithinBounds(ev.returnDate, bounds));
            if (matchingReturns.length > 0) {
                const latestReturn = matchingReturns[matchingReturns.length - 1];
                returnsInPeriod.push({
                    idMember: student.idMember,
                    unitId: student.unitId || '',
                    unitName: formatUnitDisplayName(student),
                    name: fullName,
                    isActive: analysis.isActive,
                    baixaDate: latestReturn.baixaDate,
                    returnDate: latestReturn.returnDate,
                    gapDays: latestReturn.gapDays,
                    prevPlan: latestReturn.prevPlan,
                    currentPlan: latestReturn.currentPlan
                });
            }
        }

        if (!analysis.isActive && analysis.baixa) {
            totalInactiveBaixasAllTime++;
            if (isDateWithinBounds(analysis.baixa.baixaDate, bounds)) {
                baixasInPeriod.push({
                    idMember: student.idMember,
                    unitId: student.unitId || '',
                    unitName: formatUnitDisplayName(student),
                    name: fullName,
                    lastPlan: analysis.baixa.lastPlan,
                    baixaDate: analysis.baixa.baixaDate,
                    wasCanceled: analysis.baixa.wasCanceled
                });
            }
        }
    }

    baixasInPeriod.sort((a, b) => b.baixaDate.getTime() - a.baixaDate.getTime());
    returnsInPeriod.sort((a, b) => b.returnDate.getTime() - a.returnDate.getTime());
    newInPeriod.sort((a, b) => b.enrollmentDate.getTime() - a.enrollmentDate.getTime());

    return {
        filteredStudents,
        studentsWithMembershipsCount,
        activeStudentsCount,
        activeContractsFromStudents,
        inactiveWithContractsCount,
        activeReturnedCount,
        totalInactiveBaixasAllTime,
        returnedEverCount,
        baixasInPeriod,
        returnsInPeriod,
        newInPeriod,
    };
}

function renderTopKpis() {
    const kpiContainer = document.getElementById('kpi-container');
    if (!kpiContainer) return;

    const { selectedUnit, selectedInstructor, selectedPeriod } = getSelectedFilters();
    const attendance = computeAttendanceMetrics(selectedUnit, selectedInstructor);
    const evoSyncContracts = selectedInstructor === 'all' ? getEvoSyncContractsTotal(selectedUnit) : 0;

    if (!hasLoadedEvoStudents) {
        kpiContainer.innerHTML = `
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">📝</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Contratos Ativos (EVO)</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">${evoSyncContracts.toLocaleString('pt-BR')}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">Calculando Contratos ÷ Alunos...</p>
                </div>
            </div>
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
                <div class="text-3xl mr-4">🥋</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Total de Alunos Ativos</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">Carregando base ativa...</p>
                </div>
            </div>
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">🏃</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Frequência na Semana (7d)</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">${attendance.weeklyCount.toLocaleString('pt-BR')}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">Hoje: ${attendance.todayCount.toLocaleString('pt-BR')} presentes</p>
                </div>
            </div>
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
                <div class="text-3xl mr-4">✨</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Novos Alunos (${getPeriodShortLabel(selectedPeriod)})</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">Lendo matrículas...</p>
                </div>
            </div>
        `;
        return;
    }

    const summary = computeDatasetSummary(selectedUnit, selectedInstructor, selectedPeriod);
    const totalStudentsActive = summary.activeStudentsCount;
    const totalContracts = selectedInstructor === 'all' && evoSyncContracts > 0
        ? Math.max(evoSyncContracts, summary.activeContractsFromStudents)
        : summary.activeContractsFromStudents;

    const contractsPerStudent = totalStudentsActive > 0
        ? (totalContracts / totalStudentsActive).toFixed(2).replace('.', ',')
        : '0,00';

    const weeklyPresent = attendance.weeklyCount;
    const weeklyFreqPct = totalStudentsActive > 0
        ? ((weeklyPresent / totalStudentsActive) * 100).toFixed(1).replace('.', ',')
        : '0,0';

    const newCount = summary.newInPeriod.length;
    const returnsCount = summary.returnsInPeriod.length;
    const baixasCount = summary.baixasInPeriod.length;
    const netBalance = newCount + returnsCount - baixasCount;
    const netSign = netBalance > 0 ? '+' : '';
    const netColor = netBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : netBalance < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400';

    const unitScopeText = selectedInstructor !== 'all'
        ? 'Carteira do instrutor'
        : (selectedUnit === 'geral' ? 'Toda a rede' : formatUnitDisplayLabel(selectedUnit));

    kpiContainer.innerHTML = `
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
            <div class="text-3xl mr-4">📝</div>
            <div class="min-w-0">
                <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Contratos Ativos</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${totalContracts.toLocaleString('pt-BR')}</p>
                <p class="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">${contractsPerStudent} contratos ÷ aluno (${escapeHtml(unitScopeText)})</p>
            </div>
        </div>
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
            <div class="text-3xl mr-4">🥋</div>
            <div class="min-w-0">
                <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Total de Alunos Ativos</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${totalStudentsActive.toLocaleString('pt-BR')}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Base ativa (ex-alunos inativos: ${summary.inactiveWithContractsCount.toLocaleString('pt-BR')})</p>
            </div>
        </div>
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
            <div class="text-3xl mr-4">🏃</div>
            <div class="min-w-0">
                <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Frequência na Semana (7d)</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${weeklyPresent.toLocaleString('pt-BR')} <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400">(${weeklyFreqPct}%)</span></p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">De ${totalStudentsActive.toLocaleString('pt-BR')} ativos • Hoje: ${attendance.todayCount.toLocaleString('pt-BR')}</p>
            </div>
        </div>
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
            <div class="text-3xl mr-4">✨</div>
            <div class="min-w-0">
                <p class="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Novos Alunos (${escapeHtml(getPeriodShortLabel(selectedPeriod))})</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${newCount.toLocaleString('pt-BR')}</p>
                <p class="text-[11px] font-semibold mt-0.5 ${netColor}">Saldo líquido: ${netSign}${netBalance} (+${newCount} novos +${returnsCount} ret. -${baixasCount} bx.)</p>
            </div>
        </div>
    `;
}

function renderEvolutionCharts() {
    if (snapshots.length === 0) return;

    const { selectedUnit } = getSelectedFilters();
    const sortedSnapshots = [...snapshots].reverse();

    const labels = sortedSnapshots.map(snap =>
        snap.timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    );
    const contractsData = sortedSnapshots.map(snap => getSnapshotMetricsForUnit(snap, selectedUnit).contracts);
    const studentsData = sortedSnapshots.map(snap => getSnapshotMetricsForUnit(snap, selectedUnit).chartActives);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#a0aec0' : '#4b5563';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    const sharedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#2d3748',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#4a5568',
                borderWidth: 1
            }
        },
        scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { beginAtZero: false, ticks: { color: textColor }, grid: { color: gridColor } }
        }
    };

    const contractsCtx = document.getElementById('contracts-evolution-chart')?.getContext('2d');
    if (contractsCtx) {
        if (contractsChartInstance) contractsChartInstance.destroy();
        contractsChartInstance = new Chart(contractsCtx, {
            type: 'line',
            options: sharedOptions,
            data: {
                labels,
                datasets: [{
                    label: 'Contratos Ativos',
                    data: contractsData,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    tension: 0.3,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
                }]
            }
        });
    }

    const studentsCtx = document.getElementById('students-evolution-chart')?.getContext('2d');
    if (studentsCtx) {
        if (studentsChartInstance) studentsChartInstance.destroy();
        studentsChartInstance = new Chart(studentsCtx, {
            type: 'line',
            options: sharedOptions,
            data: {
                labels,
                datasets: [{
                    label: 'Alunos Presentes',
                    data: studentsData,
                    fill: true,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    tension: 0.3,
                    pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(16, 185, 129, 1)'
                }]
            }
        });
    }
}

async function renderStoreSalesChart() {
    const salesCtx = document.getElementById('store-sales-evolution-chart')?.getContext('2d');
    if (!salesCtx) return;

    try {
        if (storeSalesPromise) await storeSalesPromise;
        const { selectedUnit } = getSelectedFilters();

        const filteredSales = (selectedUnit && selectedUnit !== 'geral' && selectedUnit !== 'all')
            ? allStoreSales.filter(s => normalizeUnitSlug(s.userUnit) === selectedUnit)
            : allStoreSales;

        const salesByDay = filteredSales.reduce((acc, sale) => {
            if (sale.created) {
                const dateObj = sale.created.toDate ? sale.created.toDate() : new Date(sale.created);
                const dateStr = dateObj.toLocaleDateString('pt-BR');
                acc[dateStr] = (acc[dateStr] || 0) + (sale.amountTotal || 0);
            }
            return acc;
        }, {});

        const labels = Object.keys(salesByDay);
        const data = Object.values(salesByDay).map(total => total / 100);

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#a0aec0' : '#4b5563';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

        if (storeChartInstance) storeChartInstance.destroy();
        storeChartInstance = new Chart(salesCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Store',
                    data,
                    backgroundColor: 'rgba(255, 193, 7, 0.5)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#2d3748',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#4a5568',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            callback: value => 'R$ ' + value
                        },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Erro ao renderizar gráfico de vendas da loja:", error);
    }
}

async function displayStoreSalesKpi(unitId = 'geral') {
    const kpiContainer = document.getElementById('store-sales-kpi-container');
    if (!kpiContainer) return;

    kpiContainer.innerHTML = `
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Total de Vendas</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Receita Total</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>
        <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Ticket Médio</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">...</p>
            </div>
        </div>
    `;

    try {
        if (storeSalesPromise) await storeSalesPromise;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const sales = allStoreSales.filter(sale => {
            if (!sale.created) return false;
            const dt = sale.created.toDate ? sale.created.toDate() : new Date(sale.created);
            if (dt < todayStart || dt >= tomorrow) return false;
            if (unitId && unitId !== 'geral' && unitId !== 'all') {
                return normalizeUnitSlug(sale.userUnit) === unitId;
            }
            return true;
        });

        const totalSales = sales.length;
        const totalRevenue = sales.reduce((acc, sale) => acc + (sale.amountTotal || 0), 0);
        const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

        let kpiHtml = `
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">🛒</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Total de Vendas (Hoje)</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">${totalSales.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;

        if (isAdmin) {
            kpiHtml += `
                <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                    <div class="text-3xl mr-4">💰</div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Receita Total (Hoje)</p>
                        <p class="text-2xl font-bold text-gray-900 dark:text-white">${(totalRevenue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
                <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                    <div class="text-3xl mr-4">📊</div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Ticket Médio</p>
                        <p class="text-2xl font-bold text-gray-900 dark:text-white">${(averageTicket / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
            `;
        }

        kpiContainer.innerHTML = kpiHtml;
    } catch (error) {
        console.error("Erro ao carregar KPIs de vendas da loja:", error);
        kpiContainer.innerHTML = `
            <div class="kpi-card bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl border border-gray-100 dark:border-gray-800/50 p-6 rounded-2xl shadow-sm flex items-center">
                <div class="text-3xl mr-4">⚠️</div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Store</p>
                    <p class="text-xl font-bold text-red-500">Erro ao carregar</p>
                </div>
            </div>
        `;
    }
}

function exportSnapshotsToCsv() {
    if (snapshots.length === 0) {
        alert('Nenhum snapshot disponível para exportar.');
        return;
    }

    const allUnitIds = new Set();
    snapshots.forEach(snap => {
        if (snap.units) {
            Object.keys(snap.units).forEach(uid => allUnitIds.add(uid));
        }
    });
    const sortedUnitIds = [...allUnitIds].sort();

    const headers = ['Data', 'Total Contratos', 'Total Presenças Semana', 'Total Presenças Dia', 'Vendas (Loja)', 'Receita (Loja)'];
    sortedUnitIds.forEach(uid => {
        const displayName = formatUnitDisplayLabel(uid);
        headers.push(`${displayName} - Contratos`);
        headers.push(`${displayName} - Presenças Semana`);
        headers.push(`${displayName} - Presenças Dia`);
        headers.push(`${displayName} - Receita Loja`);
    });

    const sortedSnapshots = [...snapshots].reverse();
    const rows = sortedSnapshots.map(snap => {
        const date = snap.timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const storeRevenue = ((snap.storeTotalRevenue || 0) / 100).toFixed(2).replace('.', ',');

        const row = [
            date,
            snap.totalContracts || 0,
            snap.totalWeeklyActives ?? '',
            snap.totalDailyActives || 0,
            snap.storeTotalSales || 0,
            storeRevenue
        ];

        sortedUnitIds.forEach(uid => {
            const unitData = snap.units?.[uid];
            row.push(unitData?.contracts || 0);
            row.push(unitData?.weeklyActives ?? '');
            row.push(unitData?.dailyActives || 0);
            row.push(((unitData?.storeRevenue || 0) / 100).toFixed(2).replace('.', ','));
        });

        return row;
    });

    const csvContent = '\uFEFF' + [
        headers.map(h => `"${h}"`).join(';'),
        ...rows.map(r => r.map(v => `"${v}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.href = url;
    link.download = `kihap_snapshots_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ─── BAIXAS, RETORNOS E MATRÍCULAS + CARTEIRA DE INSTRUTORES ────────────────────

function setupChurnAndReturnsPanel() {
    const periodFilter = document.getElementById('churn-period-filter');
    const searchInput = document.getElementById('churn-student-search');
    const tabReturns = document.getElementById('tab-returns-list');
    const tabChurn = document.getElementById('tab-churn-list');
    const tabNew = document.getElementById('tab-new-list');

    if (periodFilter) {
        periodFilter.addEventListener('change', () => {
            showAllChurnRows = false;
            renderTopKpis();
            renderChurnAndReturnsPanel();
            renderInstructorPortfolioSection();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            showAllChurnRows = false;
            renderChurnAndReturnsPanel();
        });
    }

    const updateTabStyles = () => {
        const tabs = [
            { el: tabReturns, key: 'returns' },
            { el: tabChurn, key: 'churn' },
            { el: tabNew, key: 'new' }
        ];
        const activeClasses = ['bg-amber-400', 'text-black', 'shadow-sm'];
        const inactiveClasses = ['text-gray-600', 'dark:text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white'];

        tabs.forEach(({ el, key }) => {
            if (!el) return;
            if (activeChurnTab === key) {
                el.classList.add(...activeClasses);
                el.classList.remove(...inactiveClasses);
            } else {
                el.classList.remove(...activeClasses);
                el.classList.add(...inactiveClasses);
            }
        });
    };

    [
        { el: tabReturns, key: 'returns' },
        { el: tabChurn, key: 'churn' },
        { el: tabNew, key: 'new' }
    ].forEach(({ el, key }) => {
        if (!el) return;
        el.addEventListener('click', () => {
            activeChurnTab = key;
            showAllChurnRows = false;
            updateTabStyles();
            renderChurnAndReturnsPanel();
        });
    });

    updateTabStyles();
}

async function loadEvoStudentsForAnalysis() {
    try {
        let studentList = [];
        try {
            const res = await listAlunosLocais({ unitId: 'all' });
            studentList = res.data || [];
        } catch (cfErr) {
            console.warn('[analysis] Fallback para leitura direta de evo_students:', cfErr);
            const snap = await getDocs(collection(db, 'evo_students'));
            studentList = snap.docs.map(d => {
                const data = d.data();
                data.idMember = data.idMember || d.id;
                return data;
            });
        }
        allEvoStudents = studentList;
        hasLoadedEvoStudents = true;
        renderTopKpis();
        renderChurnAndReturnsPanel();
        renderInstructorPortfolioSection();
    } catch (err) {
        console.error('[analysis] Erro ao carregar alunos para análise de baixas e retornos:', err);
        hasLoadedEvoStudents = true;
        renderTopKpis();
        const bodyEl = document.getElementById('churn-returns-table-body');
        if (bodyEl) {
            bodyEl.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Erro ao carregar contratos dos alunos: ${escapeHtml(err.message)}</td></tr>`;
        }
    }
}

async function handleSyncChurnContracts() {
    if (isSyncingContracts) return;

    const { selectedUnit } = getSelectedFilters();
    const targetUnit = (!selectedUnit || selectedUnit === 'geral') ? 'all' : selectedUnit;
    const unitLabel = targetUnit === 'all' ? 'todas as unidades' : `a unidade ${formatUnitDisplayLabel(selectedUnit)}`;

    if (!confirm(`Deseja sincronizar os contratos (memberships) do EVO para ${unitLabel}? Isso pode levar até 1 minuto.`)) {
        return;
    }

    const syncBtn = document.getElementById('sync-churn-contracts-btn');
    const syncIcon = document.getElementById('sync-churn-contracts-icon');
    const syncText = document.getElementById('sync-churn-contracts-text');

    isSyncingContracts = true;
    if (syncBtn) syncBtn.disabled = true;
    if (syncIcon) syncIcon.classList.add('fa-spin');
    if (syncText) syncText.textContent = 'Sincronizando...';

    try {
        const result = await syncEvoStudentsToCache({ unitId: targetUnit });
        const summary = result.data || {};
        alert(`Sincronização concluída! Unidades atualizadas: ${(summary.success || []).length}. Alunos processados: ${summary.totalStudents || 0}.`);
        await fetchSyncStatus();
        await loadEvoStudentsForAnalysis();
    } catch (error) {
        console.error('[analysis] Erro ao sincronizar contratos EVO:', error);
        alert(`Erro ao sincronizar contratos: ${error.message}`);
    } finally {
        isSyncingContracts = false;
        if (syncBtn) syncBtn.disabled = false;
        if (syncIcon) syncIcon.classList.remove('fa-spin');
        if (syncText) syncText.textContent = 'Atualizar Contratos EVO';
    }
}

function renderChurnAndReturnsPanel() {
    const kpiContainer = document.getElementById('churn-returns-kpi-container');
    const tableHead = document.getElementById('churn-returns-table-head');
    const tableBody = document.getElementById('churn-returns-table-body');
    const tableFooter = document.getElementById('churn-returns-table-footer');
    const noticeEl = document.getElementById('churn-sync-notice');
    const noticeTextEl = document.getElementById('churn-sync-notice-text');
    const returnsCountBadge = document.getElementById('tab-returns-count');
    const churnCountBadge = document.getElementById('tab-churn-count');
    const newCountBadge = document.getElementById('tab-new-count');

    if (!kpiContainer || !tableHead || !tableBody) return;

    if (!hasLoadedEvoStudents) {
        kpiContainer.innerHTML = Array.from({ length: 6 }).map(() => `
            <div class="kpi-card bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                <div class="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-800"></div>
                <div class="space-y-2 flex-1">
                    <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-20"></div>
                    <div class="h-6 bg-gray-200 dark:bg-gray-800 rounded w-14"></div>
                </div>
            </div>
        `).join('');
        return;
    }

    const { selectedUnit, selectedInstructor, selectedPeriod } = getSelectedFilters();
    const searchInput = document.getElementById('churn-student-search');
    const searchTerm = normalizeAnalysisText(searchInput ? searchInput.value : '');

    const summary = computeDatasetSummary(selectedUnit, selectedInstructor, selectedPeriod);

    if (noticeEl && noticeTextEl) {
        if (summary.filteredStudents.length === 0 || summary.studentsWithMembershipsCount === 0) {
            noticeTextEl.textContent = selectedInstructor !== 'all'
                ? 'Nenhum aluno com histórico de contratos encontrado na carteira deste instrutor para o filtro atual.'
                : 'Os registros carregados para este filtro ainda não possuem o histórico completo de contratos (memberships) sincronizado do EVO.';
            noticeEl.classList.remove('hidden');
        } else if (summary.studentsWithMembershipsCount < summary.filteredStudents.length * 0.4) {
            noticeTextEl.textContent = `Apenas ${summary.studentsWithMembershipsCount} de ${summary.filteredStudents.length} cadastros desta visão possuem contratos carregados em cache. Clique em "Atualizar Contratos EVO" para sincronizar.`;
            noticeEl.classList.remove('hidden');
        } else {
            noticeEl.classList.add('hidden');
        }
    }

    const { baixasInPeriod, returnsInPeriod, newInPeriod } = summary;
    const canceledCount = baixasInPeriod.filter(b => b.wasCanceled).length;
    const expiredCount = baixasInPeriod.length - canceledCount;
    const avgGapDays = returnsInPeriod.length > 0
        ? Math.round(returnsInPeriod.reduce((sum, r) => sum + r.gapDays, 0) / returnsInPeriod.length)
        : 0;
    const totalEverBaixas = summary.totalInactiveBaixasAllTime + summary.returnedEverCount;
    const recoveryRate = totalEverBaixas > 0
        ? ((summary.returnedEverCount / totalEverBaixas) * 100).toFixed(1).replace('.', ',')
        : '0,0';
    const activeReturnedPct = summary.activeStudentsCount > 0
        ? ((summary.activeReturnedCount / summary.activeStudentsCount) * 100).toFixed(1).replace('.', ',')
        : '0,0';

    const netBalance = newInPeriod.length + returnsInPeriod.length - baixasInPeriod.length;
    const netSign = netBalance > 0 ? '+' : '';
    const netColorClass = netBalance > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : netBalance < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-white';

    kpiContainer.innerHTML = `
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <i class="fas fa-user-minus text-base"></i>
            </div>
            <div class="min-w-0">
                <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Baixas no Período</p>
                <p class="text-xl font-bold text-gray-900 dark:text-white">${baixasInPeriod.length.toLocaleString('pt-BR')}</p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">${canceledCount} cancel. | ${expiredCount} exp.</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <i class="fas fa-undo-alt text-base"></i>
            </div>
            <div class="min-w-0">
                <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Retornos no Período</p>
                <p class="text-xl font-bold text-gray-900 dark:text-white">${returnsInPeriod.length.toLocaleString('pt-BR')}</p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">Reativados após baixa</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <i class="fas fa-user-plus text-base"></i>
            </div>
            <div class="min-w-0">
                <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Novas Matrículas</p>
                <p class="text-xl font-bold text-gray-900 dark:text-white">${newInPeriod.length.toLocaleString('pt-BR')}</p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">1º contrato no período</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <i class="fas fa-balance-scale text-base"></i>
            </div>
            <div class="min-w-0">
                <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Saldo Líquido</p>
                <p class="text-xl font-bold ${netColorClass}">${netSign}${netBalance.toLocaleString('pt-BR')}</p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">Novos + Ret. - Baixas</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <i class="fas fa-user-check text-base"></i>
            </div>
            <div class="min-w-0">
                <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Ativos que Retornaram</p>
                <p class="text-xl font-bold text-gray-900 dark:text-white">${summary.activeReturnedCount.toLocaleString('pt-BR')}</p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">${activeReturnedPct}% de ${summary.activeStudentsCount.toLocaleString('pt-BR')} ativos</p>
            </div>
        </div>
        <div class="kpi-card bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <i class="fas fa-hourglass-half text-base"></i>
            </div>
            <div class="min-w-0">
                <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Tempo Médio Retorno</p>
                <p class="text-xl font-bold text-gray-900 dark:text-white">${returnsInPeriod.length > 0 ? formatGapDuration(avgGapDays) : '-'}</p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">Recup. histórica: ${recoveryRate}%</p>
            </div>
        </div>
    `;

    const matchesSearch = (text, idMember) => !searchTerm ||
        normalizeAnalysisText(text).includes(searchTerm) ||
        String(idMember) === searchTerm;

    const filteredReturns = returnsInPeriod.filter(r => matchesSearch(`${r.name} ${r.currentPlan} ${r.unitName}`, r.idMember));
    const filteredBaixas = baixasInPeriod.filter(b => matchesSearch(`${b.name} ${b.lastPlan} ${b.unitName}`, b.idMember));
    const filteredNew = newInPeriod.filter(n => matchesSearch(`${n.name} ${n.firstPlan} ${n.unitName}`, n.idMember));

    if (returnsCountBadge) returnsCountBadge.textContent = filteredReturns.length.toLocaleString('pt-BR');
    if (churnCountBadge) churnCountBadge.textContent = filteredBaixas.length.toLocaleString('pt-BR');
    if (newCountBadge) newCountBadge.textContent = filteredNew.length.toLocaleString('pt-BR');

    const activeRows = activeChurnTab === 'returns'
        ? filteredReturns
        : activeChurnTab === 'churn'
            ? filteredBaixas
            : filteredNew;

    const maxVisible = showAllChurnRows ? activeRows.length : 100;
    const rowsToRender = activeRows.slice(0, maxVisible);

    if (activeChurnTab === 'returns') {
        tableHead.innerHTML = `
            <tr>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Aluno</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Unidade</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Baixa Anterior</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Data do Retorno</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Tempo Afastado</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Contrato Atual / Retorno</th>
                <th scope="col" class="px-4 py-3 text-center text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Ficha</th>
            </tr>
        `;

        if (rowsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhum aluno com retorno encontrado para os filtros selecionados.</td></tr>`;
        } else {
            tableBody.innerHTML = rowsToRender.map(item => `
                <tr class="hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition">
                    <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        <div>${escapeHtml(item.name)}</div>
                        <div class="text-[10px] font-medium text-gray-400">ID: ${escapeHtml(item.idMember)} • ${item.isActive ? '<span class="text-emerald-600 dark:text-emerald-400">Ativo hoje</span>' : '<span class="text-gray-400">Inativo hoje</span>'}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">${escapeHtml(item.unitName)}</td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${formatDateBr(item.baixaDate)}</td>
                    <td class="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">${formatDateBr(item.returnDate)}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-bold text-[11px]">${formatGapDuration(item.gapDays)}</span>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <div class="font-medium">${escapeHtml(item.currentPlan)}</div>
                        <div class="text-[10px] text-gray-400">Anterior: ${escapeHtml(item.prevPlan)}</div>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <a href="aluno.html?id=${encodeURIComponent(item.idMember)}&unit=${encodeURIComponent(item.unitId)}" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition" title="Abrir Ficha do Aluno">
                            <i class="fas fa-external-link-alt text-xs"></i>
                        </a>
                    </td>
                </tr>
            `).join('');
        }
    } else if (activeChurnTab === 'churn') {
        tableHead.innerHTML = `
            <tr>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Aluno</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Unidade</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Último Contrato</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Data da Baixa</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Motivo / Tipo</th>
                <th scope="col" class="px-4 py-3 text-center text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Ficha</th>
            </tr>
        `;

        if (rowsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhuma baixa encontrada para os filtros selecionados.</td></tr>`;
        } else {
            tableBody.innerHTML = rowsToRender.map(item => `
                <tr class="hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition">
                    <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        <div>${escapeHtml(item.name)}</div>
                        <div class="text-[10px] font-medium text-gray-400">ID: ${escapeHtml(item.idMember)}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">${escapeHtml(item.unitName)}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(item.lastPlan)}</td>
                    <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">${formatDateBr(item.baixaDate)}</td>
                    <td class="px-4 py-3">
                        ${item.wasCanceled
                            ? '<span class="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold text-[11px]">Cancelamento</span>'
                            : '<span class="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[11px]">Término de Contrato</span>'
                        }
                    </td>
                    <td class="px-4 py-3 text-center">
                        <a href="aluno.html?id=${encodeURIComponent(item.idMember)}&unit=${encodeURIComponent(item.unitId)}" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition" title="Abrir Ficha do Aluno">
                            <i class="fas fa-external-link-alt text-xs"></i>
                        </a>
                    </td>
                </tr>
            `).join('');
        }
    } else {
        tableHead.innerHTML = `
            <tr>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Aluno</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Unidade</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Data da Matrícula</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Primeiro Contrato</th>
                <th scope="col" class="px-4 py-3 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Status Atual</th>
                <th scope="col" class="px-4 py-3 text-center text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Ficha</th>
            </tr>
        `;

        if (rowsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhuma matrícula nova encontrada para os filtros selecionados.</td></tr>`;
        } else {
            tableBody.innerHTML = rowsToRender.map(item => `
                <tr class="hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition">
                    <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        <div>${escapeHtml(item.name)}</div>
                        <div class="text-[10px] font-medium text-gray-400">ID: ${escapeHtml(item.idMember)}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">${escapeHtml(item.unitName)}</td>
                    <td class="px-4 py-3 font-bold text-violet-600 dark:text-violet-400">${formatDateBr(item.enrollmentDate)}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(item.firstPlan)}</td>
                    <td class="px-4 py-3">
                        ${item.isActive
                            ? '<span class="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">Ativo</span>'
                            : '<span class="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold text-[11px]">Inativo / Baixa</span>'
                        }
                    </td>
                    <td class="px-4 py-3 text-center">
                        <a href="aluno.html?id=${encodeURIComponent(item.idMember)}&unit=${encodeURIComponent(item.unitId)}" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition" title="Abrir Ficha do Aluno">
                            <i class="fas fa-external-link-alt text-xs"></i>
                        </a>
                    </td>
                </tr>
            `).join('');
        }
    }

    if (tableFooter) {
        const hasMore = activeRows.length > rowsToRender.length;
        tableFooter.innerHTML = `
            <span>Exibindo ${rowsToRender.length.toLocaleString('pt-BR')} de ${activeRows.length.toLocaleString('pt-BR')} registros • Base ativa: ${summary.activeStudentsCount.toLocaleString('pt-BR')} alunos ativos + ${summary.inactiveWithContractsCount.toLocaleString('pt-BR')} inativos com histórico (${summary.studentsWithMembershipsCount.toLocaleString('pt-BR')} com contratos em cache)</span>
            ${hasMore ? '<button id="churn-show-all-btn" type="button" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Mostrar todos os registros</button>' : ''}
        `;
        const showAllBtn = document.getElementById('churn-show-all-btn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                showAllChurnRows = true;
                renderChurnAndReturnsPanel();
            });
        }
    }
}

function renderInstructorPortfolioSection() {
    const tbody = document.getElementById('instructor-portfolio-body');
    const subtitleEl = document.getElementById('instructor-portfolio-subtitle');
    if (!tbody) return;

    if (!hasLoadedGrades || !hasLoadedEvoStudents) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Carregando turmas e carteiras de instrutores...</td></tr>`;
        return;
    }

    const { selectedUnit, selectedInstructor, selectedPeriod } = getSelectedFilters();
    const bounds = getChurnPeriodBounds(selectedPeriod);
    const instructors = buildInstructorDirectory(selectedUnit);

    if (subtitleEl) {
        const unitLabel = selectedUnit === 'geral' ? 'Todas as Unidades' : `Unidade ${formatUnitDisplayLabel(selectedUnit)}`;
        subtitleEl.textContent = `Carteira vinculada às turmas da Grade (${unitLabel}) • Período: ${getPeriodShortLabel(selectedPeriod)}`;
    }

    if (instructors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhuma turma cadastrada na Grade para a unidade selecionada.</td></tr>`;
        return;
    }

    // Pré-processa lookup de aluno por ID na unidade
    const unitStudentsById = new Map();
    allEvoStudents.forEach(s => {
        if (!matchesSelectedUnit(s, selectedUnit)) return;
        const sid = String(s.idMember);
        unitStudentsById.set(sid, analyzeStudentContracts(s));
    });

    // Todos os IDs presentes nos últimos 7 dias (EVO + Grade)
    const { weeklyUniqueIds } = computeAttendanceMetrics(selectedUnit, 'all');

    const rows = instructors.map(inst => {
        let activeCount = 0;
        let weeklyPresentCount = 0;
        let newCount = 0;
        let returnsCount = 0;
        let baixasCount = 0;

        inst.studentIds.forEach(sid => {
            const stAnalysis = unitStudentsById.get(sid);
            if (!stAnalysis) return;

            if (stAnalysis.isActive) {
                activeCount++;
                if (weeklyUniqueIds.has(sid) || inst.directWeeklyAttendIds.has(sid)) {
                    weeklyPresentCount++;
                }
            }
            if (stAnalysis.hasContracts) {
                if (stAnalysis.firstContractStart && isDateWithinBounds(stAnalysis.firstContractStart, bounds)) {
                    newCount++;
                }
                if (stAnalysis.returnEvents.some(ev => isDateWithinBounds(ev.returnDate, bounds))) {
                    returnsCount++;
                }
                if (!stAnalysis.isActive && stAnalysis.baixa && isDateWithinBounds(stAnalysis.baixa.baixaDate, bounds)) {
                    baixasCount++;
                }
            }
        });

        const freqPct = activeCount > 0 ? ((weeklyPresentCount / activeCount) * 100).toFixed(1).replace('.', ',') : '0,0';
        const isSelected = selectedInstructor === inst.key;
        const unitBadges = Array.from(inst.unitIds).map(formatUnitDisplayLabel).join(', ');

        return {
            inst,
            activeCount,
            weeklyPresentCount,
            freqPct,
            newCount,
            returnsCount,
            baixasCount,
            isSelected,
            unitBadges
        };
    }).sort((a, b) => b.activeCount - a.activeCount || b.inst.studentIds.size - a.inst.studentIds.size);

    tbody.innerHTML = rows.map(row => `
        <tr class="${row.isSelected ? 'bg-amber-50/70 dark:bg-amber-900/15' : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/30'} transition">
            <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                <div>${escapeHtml(row.inst.teacherName)}</div>
                <div class="text-[10px] font-medium text-gray-400">${escapeHtml(row.unitBadges || 'Geral')} • ${row.inst.studentIds.size} vínculos na grade</div>
            </td>
            <td class="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">${row.inst.classCount}</td>
            <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">${row.activeCount.toLocaleString('pt-BR')}</td>
            <td class="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">${row.weeklyPresentCount.toLocaleString('pt-BR')} <span class="text-[11px] text-gray-500 dark:text-gray-400">(${row.freqPct}%)</span></td>
            <td class="px-4 py-3 font-semibold text-violet-600 dark:text-violet-400">+${row.newCount}</td>
            <td class="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">+${row.returnsCount}</td>
            <td class="px-4 py-3 font-semibold text-red-500">-${row.baixasCount}</td>
            <td class="px-4 py-3 text-center">
                <button
                    type="button"
                    data-instructor-key="${escapeHtml(row.inst.key)}"
                    class="toggle-instructor-filter-btn px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${row.isSelected ? 'bg-amber-400 text-black' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-amber-400 hover:text-black'}"
                >
                    ${row.isSelected ? 'Limpar Filtro' : 'Ver Carteira'}
                </button>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.toggle-instructor-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-instructor-key');
            const select = document.getElementById('instructor-filter');
            if (!select) return;
            select.value = select.value === key ? 'all' : key;
            select.dispatchEvent(new Event('change'));
        });
    });
}
