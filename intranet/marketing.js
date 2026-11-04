import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { db, functions, auth } from "./firebase-config.js";
import { getUnidades, loadComponents } from "./common-ui.js";

// Cloud Functions
const sendPushNotification = httpsCallable(functions, 'sendPushNotification');
const getPushStats = httpsCallable(functions, 'getPushStats');

// State
let currentTargetType = 'all'; // 'all' | 'unit' | 'student'
let selectedStudent = null;
let allStudentsCache = [];

// Elements - Navigation
const tabBtnSend = document.getElementById('tabBtnSend');
const tabBtnHistory = document.getElementById('tabBtnHistory');
const tabBtnTriggers = document.getElementById('tabBtnTriggers');
const tabContentSend = document.getElementById('tabContentSend');
const tabContentHistory = document.getElementById('tabContentHistory');
const tabContentTriggers = document.getElementById('tabContentTriggers');

// Elements - Form
const targetTypeBtns = document.querySelectorAll('.target-type-btn');
const unitSelectorContainer = document.getElementById('unitSelectorContainer');
const unitSelect = document.getElementById('unitSelect');
const studentSelectorContainer = document.getElementById('studentSelectorContainer');
const studentSearchInput = document.getElementById('studentSearchInput');
const studentSearchResults = document.getElementById('studentSearchResults');
const selectedStudentBadge = document.getElementById('selectedStudentBadge');
const selectedStudentName = document.getElementById('selectedStudentName');
const clearSelectedStudent = document.getElementById('clearSelectedStudent');

const pushTitleInput = document.getElementById('pushTitleInput');
const pushBodyInput = document.getElementById('pushBodyInput');
const pushRouteSelect = document.getElementById('pushRouteSelect');
const titleCharCount = document.getElementById('titleCharCount');
const bodyCharCount = document.getElementById('bodyCharCount');

const previewTitle = document.getElementById('previewTitle');
const previewBody = document.getElementById('previewBody');

const testModeToggle = document.getElementById('testModeToggle');
const sendPushBtn = document.getElementById('sendPushBtn');

// Elements - Modal
const confirmModal = document.getElementById('confirmModal');
const confirmTargetSummary = document.getElementById('confirmTargetSummary');
const confirmTitleSummary = document.getElementById('confirmTitleSummary');
const testNotice = document.getElementById('testNotice');
const realNotice = document.getElementById('realNotice');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const executeSendBtn = document.getElementById('executeSendBtn');

// Elements - History & Triggers
const historyTableBody = document.getElementById('historyTableBody');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const saveTriggersBtn = document.getElementById('saveTriggersBtn');

// Elements - KPIs
const kpiDevices = document.getElementById('kpiDevices');
const kpiUsers = document.getElementById('kpiUsers');
const kpiDispatches = document.getElementById('kpiDispatches');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadComponents();
    initTabs();
    initLivePreview();
    initTargetSelection();
    setupStudentSearch();

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadUnits();
            loadKPIs();
            loadHistory();
            loadTriggers();
        } else {
            console.log('[Push Center] Aguardando autenticação...');
        }
    });
});

// --- TABS LOGIC ---
function initTabs() {
    function switchTab(activeTab) {
        // Reset buttons
        [tabBtnSend, tabBtnHistory, tabBtnTriggers].forEach(btn => {
            btn.classList.remove('border-amber-500', 'text-amber-500', 'font-bold');
            btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        });
        // Reset contents
        [tabContentSend, tabContentHistory, tabContentTriggers].forEach(c => c.classList.add('hidden'));

        if (activeTab === 'send') {
            tabBtnSend.classList.add('border-amber-500', 'text-amber-500', 'font-bold');
            tabBtnSend.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabContentSend.classList.remove('hidden');
        } else if (activeTab === 'history') {
            tabBtnHistory.classList.add('border-amber-500', 'text-amber-500', 'font-bold');
            tabBtnHistory.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabContentHistory.classList.remove('hidden');
            loadHistory();
        } else if (activeTab === 'triggers') {
            tabBtnTriggers.classList.add('border-amber-500', 'text-amber-500', 'font-bold');
            tabBtnTriggers.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabContentTriggers.classList.remove('hidden');
        }
    }

    tabBtnSend?.addEventListener('click', () => switchTab('send'));
    tabBtnHistory?.addEventListener('click', () => switchTab('history'));
    tabBtnTriggers?.addEventListener('click', () => switchTab('triggers'));
}

// --- LIVE PREVIEW & INPUTS ---
function initLivePreview() {
    pushTitleInput?.addEventListener('input', () => {
        const val = pushTitleInput.value.trim();
        titleCharCount.textContent = `${pushTitleInput.value.length}/60`;
        previewTitle.textContent = val || 'Título da Notificação';
    });

    pushBodyInput?.addEventListener('input', () => {
        const val = pushBodyInput.value.trim();
        bodyCharCount.textContent = `${pushBodyInput.value.length}/180`;
        previewBody.textContent = val || 'A mensagem digitada aparecerá aqui exatamente como o aluno verá na tela de bloqueio do celular.';
    });

    testModeToggle?.addEventListener('change', () => {
        if (testModeToggle.checked) {
            sendPushBtn.innerHTML = '<i class="fas fa-flask"></i> <span>Simular Envio</span>';
            sendPushBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            sendPushBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
        } else {
            sendPushBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Disparar Push REAL</span>';
            sendPushBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
            sendPushBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        }
    });
}

// --- TARGET SELECTION ---
function initTargetSelection() {
    targetTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            targetTypeBtns.forEach(b => {
                b.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-900', 'dark:text-white', 'shadow-sm');
                b.classList.add('text-gray-500', 'dark:text-gray-400');
            });
            btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            btn.classList.remove('text-gray-500', 'dark:text-gray-400');

            currentTargetType = btn.dataset.target;

            if (currentTargetType === 'unit') {
                unitSelectorContainer.classList.remove('hidden');
                studentSelectorContainer.classList.add('hidden');
            } else if (currentTargetType === 'student') {
                studentSelectorContainer.classList.remove('hidden');
                unitSelectorContainer.classList.add('hidden');
            } else {
                unitSelectorContainer.classList.add('hidden');
                studentSelectorContainer.classList.add('hidden');
            }
        });
    });

    clearSelectedStudent?.addEventListener('click', () => {
        selectedStudent = null;
        selectedStudentBadge.classList.add('hidden');
        selectedStudentBadge.classList.remove('flex');
        studentSearchInput.value = '';
        studentSearchInput.focus();
    });
}

// --- STUDENT SEARCH AUTOCOMPLETE ---
function setupStudentSearch() {
    let debounceTimer = null;

    studentSearchInput?.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const term = studentSearchInput.value.trim().toLowerCase();
        if (term.length < 2) {
            studentSearchResults.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            await searchStudents(term);
        }, 250);
    });
}

async function searchStudents(term) {
    studentSearchResults.classList.remove('hidden');
    studentSearchResults.innerHTML = '<div class="p-3 text-xs text-gray-400 text-center"><i class="fas fa-spinner fa-spin mr-1"></i> Buscando...</div>';

    try {
        if (allStudentsCache.length === 0) {
            const snap = await getDocs(collection(db, 'users'));
            allStudentsCache = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
        }

        const filtered = allStudentsCache.filter(u => {
            const name = (u.name || u.nome || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const cpf = (u.cpf || '').replace(/\D/g, '');
            return name.includes(term) || email.includes(term) || cpf.includes(term);
        }).slice(0, 8);

        if (filtered.length === 0) {
            studentSearchResults.innerHTML = '<div class="p-3 text-xs text-gray-400 text-center">Nenhum aluno encontrado.</div>';
            return;
        }

        studentSearchResults.innerHTML = filtered.map(s => {
            const name = s.name || s.nome || 'Sem Nome';
            const unit = s.unidade || s.unit || 'Sem Unidade';
            const hasPush = Boolean(
                (Array.isArray(s.pushTokens) && s.pushTokens.length > 0) ||
                (Array.isArray(s.fcmTokens) && s.fcmTokens.length > 0) ||
                s.pushToken || s.fcmToken
            );

            return `
                <div class="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer flex items-center justify-between text-xs select-student-item" data-id="${s.id}" data-name="${escapeHtml(name)}">
                    <div>
                        <div class="font-bold text-gray-900 dark:text-white">${escapeHtml(name)}</div>
                        <div class="text-[10px] text-gray-400">📍 ${escapeHtml(unit)} • ${s.email || ''}</div>
                    </div>
                    <div>
                        ${hasPush 
                            ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">📱 App Ativo</span>'
                            : '<span class="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-400">Sem Token</span>'}
                    </div>
                </div>
            `;
        }).join('');

        studentSearchResults.querySelectorAll('.select-student-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedStudent = {
                    id: item.dataset.id,
                    name: item.dataset.name
                };
                selectedStudentName.textContent = `👤 ${selectedStudent.name}`;
                selectedStudentBadge.classList.remove('hidden');
                selectedStudentBadge.classList.add('flex');
                studentSearchResults.classList.add('hidden');
                studentSearchInput.value = '';
            });
        });

    } catch (e) {
        console.error("Erro na busca de alunos:", e);
        studentSearchResults.innerHTML = `<div class="p-3 text-xs text-red-500 text-center">Erro: ${e.message}</div>`;
    }
}

// --- LOAD UNITS ---
async function loadUnits() {
    try {
        const units = await getUnidades();
        unitSelect.innerHTML = '<option value="all">🏢 Todas as Unidades</option>';
        units.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.name;
            opt.textContent = `📍 ${u.name}`;
            unitSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("Erro ao carregar unidades:", e);
    }
}

// --- LOAD KPIS ---
async function loadKPIs() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        let totalDevices = 0;
        let totalUsers = 0;
        snap.forEach(d => {
            const u = d.data();
            const p = (Array.isArray(u.pushTokens) ? u.pushTokens.length : 0) + (Array.isArray(u.fcmTokens) ? u.fcmTokens.length : 0);
            if (p > 0 || u.pushToken) {
                totalUsers++;
                totalDevices += Math.max(1, p);
            }
        });
        if (kpiDevices) kpiDevices.textContent = String(totalDevices);
        if (kpiUsers) kpiUsers.textContent = `${totalUsers} alunos conectados`;
    } catch (e) {
        if (kpiDevices) kpiDevices.textContent = '0';
        if (kpiUsers) kpiUsers.textContent = '0 alunos conectados';
    }
}

// --- SEND PUSH FLOW ---
sendPushBtn?.addEventListener('click', () => {
    const title = pushTitleInput.value.trim();
    const body = pushBodyInput.value.trim();
    const isTest = testModeToggle.checked;

    if (!title) {
        alert("Por favor, digite o título da notificação.");
        pushTitleInput.focus();
        return;
    }
    if (!body) {
        alert("Por favor, digite o corpo da mensagem.");
        pushBodyInput.focus();
        return;
    }

    if (currentTargetType === 'student' && !selectedStudent) {
        alert("Selecione um aluno para enviar a notificação.");
        studentSearchInput.focus();
        return;
    }

    let targetSummary = 'Todos os Alunos do App';
    if (currentTargetType === 'unit') {
        const unitVal = unitSelect.value;
        targetSummary = unitVal === 'all' ? 'Todas as Unidades' : `Unidade ${unitVal}`;
    } else if (currentTargetType === 'student') {
        targetSummary = `Aluno: ${selectedStudent.name}`;
    }

    confirmTargetSummary.textContent = targetSummary;
    confirmTitleSummary.textContent = title;

    if (isTest) {
        testNotice.classList.remove('hidden');
        realNotice.classList.add('hidden');
    } else {
        testNotice.classList.add('hidden');
        realNotice.classList.remove('hidden');
    }

    confirmModal.classList.remove('hidden');
});

cancelConfirmBtn?.addEventListener('click', () => confirmModal.classList.add('hidden'));

executeSendBtn?.addEventListener('click', async () => {
    confirmModal.classList.add('hidden');

    const title = pushTitleInput.value.trim();
    const body = pushBodyInput.value.trim();
    const isTest = testModeToggle.checked;
    const route = pushRouteSelect.value;

    executeSendBtn.disabled = true;
    sendPushBtn.disabled = true;
    const origBtnHtml = sendPushBtn.innerHTML;
    sendPushBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Enviando...</span>';

    try {
        const payload = {
            title,
            body,
            targetType: currentTargetType,
            unitName: currentTargetType === 'unit' ? unitSelect.value : '',
            studentId: currentTargetType === 'student' ? selectedStudent?.id : '',
            url: route,
            testMode: isTest
        };

        const result = await sendPushNotification(payload);
        const resData = result.data || {};

        if (resData.success) {
            alert(`✓ ${resData.message || 'Disparo concluído com sucesso!'}`);
            pushTitleInput.value = '';
            pushBodyInput.value = '';
            titleCharCount.textContent = '0/60';
            bodyCharCount.textContent = '0/180';
            previewTitle.textContent = 'Título da Notificação';
            previewBody.textContent = 'A mensagem digitada aparecerá aqui exatamente como o aluno verá na tela de bloqueio do celular.';
            loadHistory();
            loadKPIs();
        } else {
            alert('Aviso: ' + (resData.message || 'O servidor retornou falha no envio.'));
        }
    } catch (e) {
        console.error("Erro ao enviar push:", e);
        alert('Erro no envio da notificação: ' + (e.message || e));
    } finally {
        executeSendBtn.disabled = false;
        sendPushBtn.disabled = false;
        sendPushBtn.innerHTML = origBtnHtml;
    }
});

// --- HISTORY LOGIC ---
async function loadHistory() {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando histórico...</td></tr>';

    try {
        const q = query(collection(db, 'push_dispatches'), orderBy('createdAt', 'desc'), limit(25));
        const snap = await getDocs(q);

        if (kpiDispatches) {
            kpiDispatches.textContent = String(snap.size);
        }

        if (snap.empty) {
            historyTableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-400">Nenhum disparo realizado ainda.</td></tr>';
            return;
        }

        historyTableBody.innerHTML = snap.docs.map(d => {
            const data = d.data();
            const dateStr = data.createdAt?.toDate 
                ? data.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : 'Hoje';

            let targetBadge = '<span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-[10px]">🌐 Todos</span>';
            if (data.targetType === 'unit') {
                targetBadge = `<span class="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-semibold text-[10px]">📍 ${escapeHtml(data.unitName || 'Unidade')}</span>`;
            } else if (data.targetType === 'student') {
                targetBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[10px]">👤 Aluno Específico</span>';
            }

            const statusBadge = data.testMode
                ? '<span class="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md"><i class="fas fa-flask"></i> Simulação</span>'
                : `<span class="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md"><i class="fas fa-check"></i> ${data.successCount || 0} entregues</span>`;

            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                    <td class="py-3 px-4 whitespace-nowrap text-gray-500 font-medium">${dateStr}</td>
                    <td class="py-3 px-4 max-w-xs">
                        <div class="font-bold text-gray-900 dark:text-white truncate">${escapeHtml(data.title || '')}</div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">${escapeHtml(data.body || '')}</div>
                    </td>
                    <td class="py-3 px-4 whitespace-nowrap">${targetBadge}</td>
                    <td class="py-3 px-4 text-center whitespace-nowrap">${statusBadge}</td>
                    <td class="py-3 px-4 text-right text-gray-400 text-[11px] whitespace-nowrap">${escapeHtml((data.sentBy || 'Admin').split('@')[0])}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        historyTableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-red-500">Erro ao carregar histórico: ${e.message}</td></tr>`;
    }
}

refreshHistoryBtn?.addEventListener('click', loadHistory);

// --- TRIGGERS LOGIC ---
async function loadTriggers() {
    try {
        const docSnap = await getDoc(doc(db, 'system_settings', 'push_triggers'));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.querySelectorAll('.trigger-toggle').forEach(input => {
                const triggerId = input.dataset.trigger;
                if (data[triggerId] !== undefined) {
                    input.checked = Boolean(data[triggerId]);
                }
            });
        }
    } catch (e) {
        console.warn("Não foi possível carregar gatilhos do Firestore:", e);
    }
}

saveTriggersBtn?.addEventListener('click', async () => {
    saveTriggersBtn.disabled = true;
    const origHtml = saveTriggersBtn.innerHTML;
    saveTriggersBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Salvando...</span>';

    try {
        const triggersState = {};
        document.querySelectorAll('.trigger-toggle').forEach(input => {
            triggersState[input.dataset.trigger] = input.checked;
        });

        await setDoc(doc(db, 'system_settings', 'push_triggers'), {
            ...triggersState,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        alert('✓ Preferências de gatilhos automáticos salvas com sucesso!');
    } catch (e) {
        console.error("Erro ao salvar gatilhos:", e);
        alert('Erro ao salvar gatilhos: ' + e.message);
    } finally {
        saveTriggersBtn.disabled = false;
        saveTriggersBtn.innerHTML = origHtml;
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
