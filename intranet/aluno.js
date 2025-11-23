import { onAuthReady } from './auth.js';
import { showConfirm, showInviteLinkModal } from './common-ui.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions, db, auth } from './firebase-config.js'; // Import auth
import { collection, getDocs, query, orderBy, addDoc, Timestamp, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cloud Functions
const inviteStudent = httpsCallable(functions, 'inviteStudent');
const updateStudentPermissions = httpsCallable(functions, 'updateStudentPermissions');
const updateStudentBadges = httpsCallable(functions, 'updateStudentBadges');

// Cache
let currentStudent = null;
let currentUnitId = null; // Armazenar o ID da unidade
let allCourses = [];
let allTatameContents = [];
let allBadges = [];

export function setupAlunoPage() {
    // Initialize certificate handlers
    setupCertificateHandlers();

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
        mainContent.innerHTML = `<div class="text-red-500 text-center p-8">Erro ao carregar dados do aluno: ${error.message}</div>`;
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
    const detailsContainer = document.getElementById('tab-content-details');

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
        nameEmployeeInstructor: "Professor"
    };

    const formatValue = (key, value) => {
        if (value === null || value === '') return '<i class="text-gray-500">Não informado</i>';
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
        if (currentStudent.hasOwnProperty(key)) {
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
}

function setupEventListeners() {
    // Tab switching
    const tabs = ['details', 'permissions', 'physical-test', 'badges'];
    tabs.forEach(tabId => {
        document.getElementById(`tab-${tabId}`).addEventListener('click', () => switchTab(tabId));
    });

    // Action buttons
    document.getElementById('invite-btn').addEventListener('click', handleInviteClick);
    document.getElementById('save-permissions-btn').addEventListener('click', handleSavePermissions);
    document.getElementById('save-badges-btn').addEventListener('click', handleSaveBadges);
    document.getElementById('save-physical-test-btn').addEventListener('click', handleSavePhysicalTest);

}

function switchTab(activeTabId) {
    const tabs = ['details', 'permissions', 'physical-test', 'badges'];
    tabs.forEach(tabId => {
        const tabButton = document.getElementById(`tab-${tabId}`);
        const tabContent = document.getElementById(`tab-content-${tabId}`);

        const isActive = tabId === activeTabId;

        tabContent.classList.toggle('hidden', !isActive);
        tabButton.classList.toggle('text-yellow-500', isActive);
        tabButton.classList.toggle('border-yellow-500', isActive);
        tabButton.classList.toggle('text-gray-400', !isActive);
        tabButton.classList.toggle('hover:text-white', !isActive);
    });
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
// Certificate Modal Logic
function setupCertificateHandlers() {
    const certModal = document.getElementById('certificate-modal');
    const closeCertModalBtn = document.getElementById('close-cert-modal');
    const cancelCertBtn = document.getElementById('cancel-cert-btn');
    const confirmGenerateCertBtn = document.getElementById('confirm-generate-cert-btn');
    const certDateInput = document.getElementById('cert-date');
    const certInstructorInput = document.getElementById('cert-instructor');
    const generateCertBtn = document.getElementById('generate-certificate-btn');

    if (!certModal || !generateCertBtn) {
        console.warn("Certificate modal elements not found. Skipping setup.");
        return;
    }

    function openCertModal() {
        if (!currentStudent) {
            alert("Dados do aluno não carregados.");
            return;
        }
        // Set default date to today
        certDateInput.valueAsDate = new Date();
        certModal.classList.remove('hidden');
        certModal.classList.add('flex');
    }

    function closeCertModal() {
        certModal.classList.add('hidden');
        certModal.classList.remove('flex');
    }

    // Event Listeners
    generateCertBtn.addEventListener('click', openCertModal);
    closeCertModalBtn.addEventListener('click', closeCertModal);
    cancelCertBtn.addEventListener('click', closeCertModal);

    confirmGenerateCertBtn.addEventListener('click', async () => {
        const belt = document.getElementById('cert-belt').value;
        const dateVal = certDateInput.value;
        const instructor = certInstructorInput.value || "Mestre Kim"; // Default if empty

        if (!dateVal) {
            alert("Por favor, selecione uma data.");
            return;
        }

        const button = confirmGenerateCertBtn;
        const originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        try {
            // 1. Create Certificate Record in Firestore
            const certificateData = {
                studentName: `${currentStudent.firstName} ${currentStudent.lastName}`,
                studentId: currentStudent.idMember,
                unitId: currentUnitId || 'unknown',
                date: Timestamp.fromDate(new Date(dateVal + 'T12:00:00')), // Noon to avoid timezone issues
                type: `Faixa ${belt}`,
                issuer: instructor, // Use instructor name as issuer for display
                createdBy: auth.currentUser.email // Keep track of who generated it
            };

            const docRef = await addDoc(collection(db, "certificates"), certificateData);
            const certId = docRef.id;

            // 2. Generate QR Code using QRious
            const validationUrl = `https://intranet-kihap.web.app/validar-certificado.html?id=${certId}`;

            const qr = new QRious({
                value: validationUrl,
                size: 150
            });
            const qrCodeDataUrl = qr.toDataURL();

            // 3. Generate PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Background (Optional - simple border for now)
            doc.setLineWidth(2);
            doc.setDrawColor(212, 175, 55); // Gold color
            doc.rect(10, 10, 277, 190);

            // Header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(40);
            doc.setTextColor(30, 30, 30);
            doc.text("CERTIFICADO", 148.5, 40, { align: "center" });

            doc.setFontSize(16);
            doc.setFont("helvetica", "normal");
            doc.text("DE GRADUAÇÃO", 148.5, 50, { align: "center" });

            // Body
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
            doc.setTextColor(212, 175, 55); // Gold
            doc.text(`FAIXA ${belt.toUpperCase()}`, 148.5, 115, { align: "center" });

            // Date and Instructor
            const dateObj = new Date(dateVal + 'T12:00:00');
            const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.text(`Florianópolis, ${formattedDate}`, 148.5, 140, { align: "center" });

            // Signatures line
            doc.setLineWidth(0.5);
            doc.setDrawColor(0, 0, 0);
            doc.line(100, 170, 197, 170); // Center line

            doc.setFontSize(12);
            doc.text(instructor, 148.5, 175, { align: "center" });
            doc.setFontSize(10);
            doc.text("Instrutor Responsável", 148.5, 180, { align: "center" });

            // QR Code
            doc.addImage(qrCodeDataUrl, 'PNG', 240, 150, 30, 30);
            doc.setFontSize(8);
            doc.text("Validar Autenticidade", 255, 185, { align: "center" });

            // Save PDF
            doc.save(`Certificado_${currentStudent.firstName}_${belt}.pdf`);

            closeCertModal();
            alert("Certificado gerado com sucesso!");

        } catch (error) {
            console.error("Erro ao gerar certificado:", error);
            alert("Erro ao gerar certificado. Tente novamente.");
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}

// Função auxiliar para encontrar usuário (deve ser otimizada no backend no futuro)
async function findUserByEvoId(evoId) {
    try {
        const q = query(collection(db, "users"), where("evoMemberId", "==", evoId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
    } catch (e) {
        console.warn("Permissão negada para buscar usuário. Funcionalidades podem ser limitadas.");
    }
    return null;
}
