import { onAuthReady } from './auth.js';
import { showConfirm, showInviteLinkModal } from './common-ui.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions, db, auth } from './firebase-config.js'; // Import auth
import { collection, getDocs, query, orderBy, addDoc, Timestamp, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cloud Functions
const inviteStudent = httpsCallable(functions, 'inviteStudent');
const updateStudentPermissions = httpsCallable(functions, 'updateStudentPermissions');
const updateStudentBadges = httpsCallable(functions, 'updateStudentBadges');
const updateLocalStudent = httpsCallable(functions, 'updateLocalStudent');
const getStudentFinancialHub = httpsCallable(functions, 'getStudentFinancialHub');
const cancelTuitionSubscription = httpsCallable(functions, 'cancelTuitionSubscription');
const getTuitionPlans = httpsCallable(functions, 'getTuitionPlans');
const createTuitionSubscription = httpsCallable(functions, 'createTuitionSubscription');

// Cache
let currentStudent = null;
let currentUnitId = null; // Armazenar o ID da unidade
let allCourses = [];
let allTatameContents = [];
let allBadges = [];

export function setupAlunoPage() {
    // Initialize certificate handlers
    setupCertificateHandlers();
    setupGeneratePaymentLinkHandlers();

    onAuthReady(async (user) => {
        if (user) {
            const urlParams = new URLSearchParams(window.location.search);
            const studentId = urlParams.get('id');
            currentUnitId = urlParams.get('unit'); // Armazenar o ID da unidade

            if (!studentId) {
                document.body.innerHTML = '<div class="text-red-500 text-center p-8">ID do aluno não fornecido.</div>';
                return;
            }

            await loadAllSelectableContent();
            await loadStudentData(studentId, currentUnitId); // Passar o ID da unidade
        }
    });

    // Edit Modal Listeners (Static)
    document.getElementById('closeEditModalBtn').onclick = closeEditModal;
    document.getElementById('cancelEditBtn').onclick = closeEditModal;
    document.getElementById('editStudentForm').onsubmit = handleEditSubmit;
}

async function loadStudentData(studentId, unitId) { // Receber o ID da unidade
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Usuário não autenticado.");
        }
        const token = await user.getIdToken();

        const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/getMemberDetails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data: { memberId: studentId, unitId: unitId } }) // Enviar o ID da unidade
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na requisição: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        currentStudent = result.data;

        if (!currentStudent) {
            throw new Error("Aluno não encontrado.");
        }

        renderStudentProfile();
        renderDetailsTab();
        populatePermissionsChecklists();
        populateBadgesChecklist();
        populatePhysicalTestTab();
        setupEventListeners(); // Mover para cá

    } catch (error) {
        console.error("Erro ao carregar dados do aluno:", error);
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.innerHTML = `<div class="text-red-500 text-center p-8">Erro ao carregar dados do aluno: ${error.message}</div>`;
    }
}

async function renderStudentProfile() {
    const fullName = `${currentStudent.firstName || ''} ${currentStudent.lastName || ''}`;
    const email = currentStudent.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description || 'N/A';

    document.getElementById('student-name-header').textContent = fullName;
    document.getElementById('student-name-sidebar').textContent = fullName;
    const emailEl = document.getElementById('student-email');
    if (emailEl) emailEl.textContent = email;

    const studentPhoto = document.getElementById('student-photo');
    studentPhoto.src = currentStudent.photoUrl || 'default-profile.svg';

    // Try to fetch Firestore user data to get the uploaded photo
    try {
        const studentUser = await findUserByEvoId(currentStudent.idMember);
        if (studentUser && studentUser.photoURL) {
            studentPhoto.src = studentUser.photoURL;
        }
    } catch (e) {
        console.warn("Could not fetch Firestore user data for photo:", e);
    }

    const statusBadge = document.getElementById('student-status-badge');
    if (currentStudent.membershipStatus === 'Active') {
        statusBadge.textContent = 'Ativo';
        statusBadge.className = 'mt-2 inline-block px-3 py-1 text-sm font-semibold rounded-full bg-green-500 text-white';
    } else {
        statusBadge.textContent = 'Inativo';
        statusBadge.className = 'mt-2 inline-block px-3 py-1 text-sm font-semibold rounded-full bg-red-500 text-white';
    }
}

function renderDetailsTab() {
    const detailsContainer = document.getElementById('details-grid-container');

    const translations = {
        idMember: "ID do Aluno",
        registerDate: "Data de Cadastro",
        branchName: "Unidade",
        accessBlocked: "Acesso Bloqueado",
        document: "Documento (CPF/RG)",
        gender: "Gênero",
        birthDate: "Data de Nascimento",
        updateDate: "Última Atualização",
        address: "Endereço",
        nameEmployeeInstructor: "Professor",
        responsible: "Responsável",
        origin: "Origem / Como conheceu",
        rankType: "Categoria",
        belt: "Faixa"
    };

    const formatValue = (key, value) => {
        if (value === null || value === '' || value === undefined) return '<i class="text-gray-500">Não informado</i>';
        switch (key) {
            case 'accessBlocked':
                return value ? '<span class="text-red-500">Sim</span>' : '<span class="text-green-500">Não</span>';
            case 'birthDate':
            case 'registerDate':
            case 'updateDate':
                return new Date(value).toLocaleDateString('pt-BR');
            default:
                return value;
        }
    };

    let html = '<dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">';
    for (const key in translations) {
        if (currentStudent.hasOwnProperty(key) || ['responsible', 'origin', 'rankType', 'belt'].includes(key)) {
            html += `
                <div>
                    <dt class="font-semibold text-gray-400">${translations[key]}</dt>
                    <dd class="text-gray-200">${formatValue(key, currentStudent[key])}</dd>
                </div>
            `;
        }
    }
    html += '</dl>';
    detailsContainer.innerHTML = html;

    // Attach edit button listener
    document.getElementById('edit-details-btn').onclick = openEditModal;
}

function setupEventListeners() {
    // Tab switching
    const tabs = ['details', 'permissions', 'physical-test', 'badges', 'financial'];
    tabs.forEach(tabId => {
        const el = document.getElementById(`tab-${tabId}`);
        if (el) el.addEventListener('click', () => switchTab(tabId));
    });

    // Action buttons
    document.getElementById('invite-btn').addEventListener('click', handleInviteClick);
    document.getElementById('save-permissions-btn').addEventListener('click', handleSavePermissions);
    document.getElementById('save-badges-btn').addEventListener('click', handleSaveBadges);
    document.getElementById('save-physical-test-btn').addEventListener('click', handleSavePhysicalTest);
}

function switchTab(activeTabId) {
    const tabs = ['details', 'permissions', 'physical-test', 'badges', 'financial'];
    tabs.forEach(tabId => {
        const tabButton = document.getElementById(`tab-${tabId}`);
        const tabContent = document.getElementById(`tab-content-${tabId}`);

        if (!tabButton || !tabContent) return;

        const isActive = tabId === activeTabId;

        tabContent.classList.toggle('hidden', !isActive);
        tabButton.classList.toggle('text-yellow-500', isActive);
        tabButton.classList.toggle('border-yellow-500', isActive);
        tabButton.classList.toggle('text-gray-400', !isActive);
        tabButton.classList.toggle('hover:text-white', !isActive);
    });

    if (activeTabId === 'financial') {
        renderFinancialTab();
    }
}

async function renderFinancialTab() {
    const statusEl = document.getElementById('fin-status');
    const countEl = document.getElementById('fin-count');
    const startEl = document.getElementById('fin-start-date');
    const mpContainer = document.getElementById('mp-details-container');
    const cancelContainer = document.getElementById('cancel-subscription-container');

    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    mpContainer.innerHTML = '<p class="text-gray-500 italic">Buscando dados no Mercado Pago...</p>';

    try {
        const result = await getStudentFinancialHub({
            idMember: currentStudent.idMember,
            unitId: currentUnitId || currentStudent.unitId
        });
        const data = result.data;

        // Status Map
        const statusMap = {
            'active': '<span class="text-green-500">Ativo</span>',
            'pending': '<span class="text-yellow-500">Pendente</span>',
            'overdue': '<span class="text-red-500">Atrasado</span>',
            'cancelled': '<span class="text-gray-500">Cancelado</span>',
            'none': '<span class="text-gray-600">Sem Assinatura</span>'
        };

        statusEl.innerHTML = statusMap[data.tuitionStatus] || data.tuitionStatus;
        startEl.textContent = data.registeredAt ? new Date(data.registeredAt).toLocaleDateString('pt-BR') : 'N/A';
        
        if (data.mpDetails) {
            const mp = data.mpDetails;
            countEl.textContent = `${mp.summarized?.charged_quantity || 0} parcelas`;
            
            let mpHtml = `
                <div class="grid grid-cols-2 gap-2">
                    <span class="text-gray-500">ID da Assinatura:</span>
                    <span class="text-gray-300">${mp.id}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <span class="text-gray-500">Plano:</span>
                    <span class="text-gray-300">${mp.reason}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <span class="text-gray-500">Status no MP:</span>
                    <span class="text-gray-300 capitalize">${mp.status}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <span class="text-gray-500">Próxima Cobrança:</span>
                    <span class="text-gray-300">${mp.next_payment_date ? new Date(mp.next_payment_date).toLocaleDateString('pt-BR') : 'Finalizada'}</span>
                </div>
            `;
            mpContainer.innerHTML = mpHtml;

            if (mp.status === 'authorized' || mp.status === 'pending') {
                cancelContainer.classList.remove('hidden');
                document.getElementById('cancel-sub-btn').onclick = () => handleCancelSubscription(mp.id);
            } else {
                cancelContainer.classList.add('hidden');
            }
        } else {
            countEl.textContent = '0 parcelas';
            mpContainer.innerHTML = '<p class="text-gray-500 italic">Nenhuma assinatura vinculada no Mercado Pago.</p>';
            cancelContainer.classList.add('hidden');
        }

    } catch (error) {
        console.error("Erro ao carregar hub financeiro:", error);
        mpContainer.innerHTML = `<p class="text-red-500">Erro ao carregar dados: ${error.message}</p>`;
    }
}

async function handleCancelSubscription(preapprovalId) {
    showConfirm(
        "Tem certeza que deseja cancelar esta assinatura? As cobranças futuras serão interrompidas.",
        async () => {
            const btn = document.getElementById('cancel-sub-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Cancelando...';

            try {
                await cancelTuitionSubscription({
                    studentId: currentStudent.idMember,
                    preapprovalId: preapprovalId,
                    unitId: currentUnitId || currentStudent.unitId
                });
                alert("Assinatura cancelada com sucesso.");
                renderFinancialTab();
            } catch (error) {
                console.error("Erro ao cancelar:", error);
                alert("Erro ao cancelar assinatura: " + error.message);
                btn.disabled = false;
                btn.textContent = 'Cancelar Assinatura';
            }
        }
    );
}

function setupGeneratePaymentLinkHandlers() {
    const openBtn = document.getElementById('open-generate-link-modal-btn');
    const modal = document.getElementById('generate-payment-link-modal');
    const closeBtn = document.getElementById('close-generate-link-modal');
    const cancelBtn = document.getElementById('cancel-generate-link-btn');
    const confirmBtn = document.getElementById('confirm-generate-link-btn');
    const selectPlan = document.getElementById('payment-plan-select');
    const linkContainer = document.getElementById('generated-link-container');
    const inputLink = document.getElementById('generated-payment-link');
    const copyBtn = document.getElementById('copy-payment-link-btn');
    const actionsContainer = document.getElementById('generate-link-actions');

    if (!openBtn || !modal) return;

    async function openModal() {
        if (!currentStudent) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Reset state
        linkContainer.classList.add('hidden');
        actionsContainer.classList.remove('hidden');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Gerar Link';
        selectPlan.innerHTML = '<option value="">Carregando planos...</option>';
        
        try {
            const targetUnitId = currentUnitId || currentStudent.unitId;
            const result = await getTuitionPlans({ unitId: targetUnitId });
            const plans = result.data;
            
            if (plans && plans.length > 0) {
                selectPlan.innerHTML = plans.map(p => `<option value="${p.id}">${p.name} - R$ ${(p.amountCentavos / 100).toFixed(2)}</option>`).join('');
            } else {
                selectPlan.innerHTML = '<option value="">Nenhum plano encontrado.</option>';
                confirmBtn.disabled = true;
            }
        } catch (error) {
            console.error("Erro ao buscar planos:", error);
            selectPlan.innerHTML = '<option value="">Erro ao carregar planos.</option>';
            confirmBtn.disabled = true;
        }
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', async () => {
        const planId = selectPlan.value;
        if (!planId) {
            alert("Selecione um plano.");
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        try {
            const result = await createTuitionSubscription({
                planId: planId,
                studentId: currentStudent.idMember
            });

            if (result.data && result.data.initPoint) {
                inputLink.value = result.data.initPoint;
                linkContainer.classList.remove('hidden');
                actionsContainer.classList.add('hidden'); // Hide buttons after success
                
                // Refresh financial tab in background
                renderFinancialTab();
            } else {
                throw new Error("Link não retornado pela API.");
            }
        } catch (error) {
            console.error("Erro ao gerar link:", error);
            alert("Erro ao gerar link de pagamento: " + error.message);
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Gerar Link';
        }
    });

    copyBtn.addEventListener('click', () => {
        inputLink.select();
        document.execCommand('copy');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        copyBtn.classList.replace('bg-blue-600', 'bg-green-600');
        copyBtn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.classList.replace('bg-green-600', 'bg-blue-600');
            copyBtn.classList.replace('hover:bg-green-700', 'hover:bg-blue-700');
        }, 2000);
    });
}

// Modal Logic
function openEditModal() {
    const modal = document.getElementById('editStudentModal');
    const form = document.getElementById('editStudentForm');
    
    // Fill form
    form.idMember.value = currentStudent.idMember;
    form.firstName.value = currentStudent.firstName || '';
    form.lastName.value = currentStudent.lastName || '';
    form.email.value = currentStudent.contacts?.find(c => c.idContactType === 4)?.description || '';
    form.phone.value = currentStudent.phone || currentStudent.contacts?.find(c => c.idContactType === 1)?.description || '';
    form.cpf.value = currentStudent.cpf || currentStudent.document || '';
    form.address.value = currentStudent.address || '';
    form.responsible.value = currentStudent.responsible || '';
    form.origin.value = currentStudent.origin || '';
    form.rankType.value = currentStudent.rankType || 'Tradicional';
    form.belt.value = currentStudent.belt || 'Branca Recomendada';
    
    if (currentStudent.birthDate) {
        form.birthDate.value = new Date(currentStudent.birthDate).toISOString().split('T')[0];
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeEditModal() {
    const modal = document.getElementById('editStudentModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleEditSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submitEditBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...';

    const formData = new FormData(e.target);
    const updates = Object.fromEntries(formData.entries());

    try {
        await updateLocalStudent(updates);
        alert("Dados atualizados com sucesso!");
        location.reload(); // Refresh to show new data
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar: " + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleInviteClick() {
    const button = document.getElementById('invite-btn');
    const email = currentStudent.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description;

    if (!email) {
        alert("Este aluno não possui um e-mail cadastrado.");
        return;
    }

    showConfirm(
        `Enviar convite para ${currentStudent.firstName} (${email})?`,
        async () => {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...';

            try {
                const result = await inviteStudent({
                    evoMemberId: currentStudent.idMember,
                    email: email,
                    firstName: currentStudent.firstName,
                    lastName: currentStudent.lastName,
                    unitId: currentUnitId // Usar o ID da unidade armazenado
                });
                showInviteLinkModal(result.data.link);
                button.textContent = 'Convite Enviado';
                button.classList.remove('bg-green-600', 'hover:bg-green-700');
                button.classList.add('bg-gray-500');
            } catch (error) {
                console.error("Erro ao enviar convite:", error);
                alert(`Erro: ${error.message}`);
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-envelope mr-2"></i>Convidar Aluno';
            }
        }
    );
}

async function loadAllSelectableContent() {
    try {
        const queries = [
            getDocs(query(collection(db, "courses"), orderBy("title"))),
            getDocs(query(collection(db, "tatame_conteudos"), orderBy("title"))),
            getDocs(query(collection(db, "badges"), orderBy("name")))
        ];
        const [coursesSnap, tatameSnap, badgesSnap] = await Promise.all(queries);

        allCourses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTatameContents = tatameSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allBadges = badgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar conteúdos selecionáveis:", error);
    }
}

async function populatePermissionsChecklists() {
    const coursesChecklist = document.getElementById('courses-checklist');
    const tatameChecklist = document.getElementById('tatame-checklist');

    const studentUser = await findUserByEvoId(currentStudent.idMember);
    const studentPermissions = studentUser?.accessibleContent || [];

    coursesChecklist.innerHTML = allCourses.map(course => `
        <label class="flex items-center space-x-2 text-gray-300 cursor-pointer">
            <input type="checkbox" value="${course.id}" class="form-checkbox bg-gray-700 border-gray-600 rounded" ${studentPermissions.includes(course.id) ? 'checked' : ''}>
            <span>${course.title}</span>
        </label>
    `).join('');

    tatameChecklist.innerHTML = allTatameContents.map(content => `
        <label class="flex items-center space-x-2 text-gray-300 cursor-pointer">
            <input type="checkbox" value="${content.id}" class="form-checkbox bg-gray-700 border-gray-600 rounded" ${studentPermissions.includes(content.id) ? 'checked' : ''}>
            <span>${content.title}</span>
        </label>
    `).join('');
}

async function handleSavePermissions() {
    const button = document.getElementById('save-permissions-btn');
    const studentUser = await findUserByEvoId(currentStudent.idMember);

    if (!studentUser) {
        alert("Aluno não possui conta no sistema. Use o botão 'Convidar'.");
        return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';

    const selectedCourses = Array.from(document.querySelectorAll('#courses-checklist input:checked')).map(input => input.value);
    const selectedTatame = Array.from(document.querySelectorAll('#tatame-checklist input:checked')).map(input => input.value);

    try {
        await updateStudentPermissions({ studentUid: studentUser.id, accessibleContent: [...selectedCourses, ...selectedTatame] });
        alert("Permissões salvas!");
    } catch (error) {
        console.error("Erro ao salvar permissões:", error);
        alert(`Erro: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Permissões';
    }
}

async function populateBadgesChecklist() {
    const badgesChecklist = document.getElementById('badges-checklist');
    const studentUser = await findUserByEvoId(currentStudent.idMember);
    const studentBadges = studentUser?.earnedBadges || [];

    if (allBadges.length === 0) {
        badgesChecklist.innerHTML = '<p class="text-gray-500 col-span-full">Nenhum emblema cadastrado.</p>';
        return;
    }

    badgesChecklist.innerHTML = allBadges.map(badge => {
        const isChecked = studentBadges.includes(badge.id);
        return `
            <label class="flex flex-col items-center space-y-2 text-gray-300 cursor-pointer p-2 rounded-lg hover:bg-gray-700">
                <img src="${badge.imageUrl}" alt="${badge.name}" class="w-16 h-16 rounded-full object-cover border-2 ${isChecked ? 'border-yellow-500' : 'border-gray-600'}">
                <input type="checkbox" value="${badge.id}" class="form-checkbox bg-gray-700 border-gray-600 rounded" ${isChecked ? 'checked' : ''}>
                <span class="text-xs text-center">${badge.name}</span>
            </label>
        `;
    }).join('');
}

async function handleSaveBadges() {
    const button = document.getElementById('save-badges-btn');
    const studentUser = await findUserByEvoId(currentStudent.idMember);

    if (!studentUser) {
        alert("Aluno não possui conta no sistema. Use o botão 'Convidar'.");
        return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';

    const selectedBadges = Array.from(document.querySelectorAll('#badges-checklist input:checked')).map(input => input.value);

    try {
        await updateStudentBadges({ studentUid: studentUser.id, earnedBadges: selectedBadges });
        alert("Emblemas salvos!");
    } catch (error) {
        console.error("Erro ao salvar emblemas:", error);
        alert(`Erro: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Emblemas';
    }
}

async function populatePhysicalTestTab() {
    const historyContainer = document.getElementById('physical-test-history');
    if (!historyContainer) return;
    historyContainer.innerHTML = '<p class="text-gray-500">Carregando histórico...</p>';

    const testsQuery = query(
        collection(db, "physicalTests"),
        where("evoMemberId", "==", currentStudent.idMember),
        orderBy("date", "desc")
    );
    const testsSnapshot = await getDocs(testsQuery);

    if (testsSnapshot.empty) {
        historyContainer.innerHTML = '<p class="text-gray-500">Nenhum teste físico registrado.</p>';
        return;
    }

    historyContainer.innerHTML = '<ul class="space-y-2">' + testsSnapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.date.toDate().toLocaleDateString('pt-BR');
        return `
            <li class="flex justify-between items-center bg-gray-900 p-2 rounded">
                <span>Data: <span class="font-semibold">${date}</span></span>
                <span>Pontuação: <span class="font-semibold text-yellow-500">${data.score}</span></span>
            </li>
        `;
    }).join('') + '</ul>';
}

async function handleSavePhysicalTest() {
    const button = document.getElementById('save-physical-test-btn');
    const dateInput = document.getElementById('physical-test-date');
    const scoreInput = document.getElementById('physical-test-score');

    if (!dateInput.value || !scoreInput.value) {
        alert("Preencha a data e a pontuação.");
        return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';

    try {
        await addDoc(collection(db, "physicalTests"), {
            date: Timestamp.fromDate(new Date(dateInput.value + 'T00:00:00')),
            score: Number(scoreInput.value),
            evoMemberId: currentStudent.idMember,
            studentName: `${currentStudent.firstName} ${currentStudent.lastName}`
        });

        dateInput.value = '';
        scoreInput.value = '';
        await populatePhysicalTestTab();
    } catch (error) {
        console.error("Erro ao salvar teste físico:", error);
        alert(`Erro: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Adicionar Log';
    }
}

function setupCertificateHandlers() {
    const certModal = document.getElementById('certificate-modal');
    const closeCertModalBtn = document.getElementById('close-cert-modal');
    const cancelCertBtn = document.getElementById('cancel-cert-btn');
    const confirmGenerateCertBtn = document.getElementById('confirm-generate-cert-btn');
    const certDateInput = document.getElementById('cert-date');
    const certInstructorInput = document.getElementById('cert-instructor');
    const generateCertBtn = document.getElementById('generate-certificate-btn');

    if (!certModal || !generateCertBtn) return;

    function openCertModal() {
        if (!currentStudent) return;
        certDateInput.valueAsDate = new Date();
        certModal.classList.remove('hidden');
        certModal.classList.add('flex');
    }

    function closeCertModal() {
        certModal.classList.add('hidden');
        certModal.classList.remove('flex');
    }

    generateCertBtn.addEventListener('click', openCertModal);
    closeCertModalBtn.addEventListener('click', closeCertModal);
    cancelCertBtn.addEventListener('click', closeCertModal);

    confirmGenerateCertBtn.addEventListener('click', async () => {
        const belt = document.getElementById('cert-belt').value;
        const dateVal = certDateInput.value;
        const instructor = certInstructorInput.value || "Mestre Kim";

        if (!dateVal) {
            alert("Por favor, selecione uma data.");
            return;
        }

        const button = confirmGenerateCertBtn;
        const originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        try {
            const certificateData = {
                studentName: `${currentStudent.firstName} ${currentStudent.lastName}`,
                studentId: currentStudent.idMember,
                unitId: currentUnitId || 'unknown',
                date: Timestamp.fromDate(new Date(dateVal + 'T12:00:00')),
                type: `Faixa ${belt}`,
                issuer: instructor,
                createdBy: auth.currentUser.email
            };

            const docRef = await addDoc(collection(db, "certificates"), certificateData);
            const certId = docRef.id;

            const validationUrl = `https://intranet-kihap.web.app/validar-certificado.html?id=${certId}`;
            const qr = new QRious({ value: validationUrl, size: 150 });
            const qrCodeDataUrl = qr.toDataURL();

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            doc.setLineWidth(2);
            doc.setDrawColor(212, 175, 55);
            doc.rect(10, 10, 277, 190);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(40);
            doc.setTextColor(30, 30, 30);
            doc.text("CERTIFICADO", 148.5, 40, { align: "center" });

            doc.setFontSize(16);
            doc.setFont("helvetica", "normal");
            doc.text("DE GRADUAÇÃO", 148.5, 50, { align: "center" });

            doc.setFontSize(14);
            doc.text("Certificamos que", 148.5, 70, { align: "center" });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(30);
            doc.setTextColor(0, 0, 0);
            doc.text(`${currentStudent.firstName} ${currentStudent.lastName}`.toUpperCase(), 148.5, 85, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(14);
            doc.setTextColor(30, 30, 30);
            doc.text("concluiu com êxito os requisitos para a graduação de", 148.5, 100, { align: "center" });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(24);
            doc.setTextColor(212, 175, 55);
            doc.text(`FAIXA ${belt.toUpperCase()}`, 148.5, 115, { align: "center" });

            const dateObj = new Date(dateVal + 'T12:00:00');
            const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.text(`Florianópolis, ${formattedDate}`, 148.5, 140, { align: "center" });

            doc.setLineWidth(0.5);
            doc.setDrawColor(0, 0, 0);
            doc.line(100, 170, 197, 170);
            doc.setFontSize(12);
            doc.text(instructor, 148.5, 175, { align: "center" });
            doc.setFontSize(10);
            doc.text("Instrutor Responsável", 148.5, 180, { align: "center" });

            doc.addImage(qrCodeDataUrl, 'PNG', 240, 150, 30, 30);
            doc.setFontSize(8);
            doc.text("Validar Autenticidade", 255, 185, { align: "center" });

            doc.save(`Certificado_${currentStudent.firstName}_${belt}.pdf`);
            closeCertModal();
            alert("Certificado gerado com sucesso!");
        } catch (error) {
            console.error("Erro ao gerar:", error);
            alert("Erro ao gerar certificado.");
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}

async function findUserByEvoId(evoId) {
    try {
        const q = query(collection(db, "users"), where("evoMemberId", "==", evoId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
    } catch (e) {
        console.warn("Permissão negada para buscar usuário.");
    }
    return null;
}
