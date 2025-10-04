import { onAuthReady, checkAdminStatus, getUserData } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions, db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const listAllMembers = httpsCallable(functions, 'listAllMembers');
const inviteStudent = httpsCallable(functions, 'inviteStudent');
const updateStudentPermissions = httpsCallable(functions, 'updateStudentPermissions');
const getDailyEntries = httpsCallable(functions, 'getDailyEntries');

let allStudents = []; // Cache para guardar a lista de alunos e facilitar a busca
let allCourses = [];
let allTatameContents = [];

export function setupAlunosPage() {
    onAuthReady(async (user) => {
        if (user) {
            const isAdmin = await checkAdminStatus(user);
            if (!isAdmin) {
                alert("Você não tem permissão para acessar esta página.");
                window.location.href = 'perfil.html';
                return;
            }

            const unitFilter = document.getElementById('unit-filter');
            const searchInput = document.getElementById('search-input');
            const statusFilter = document.getElementById('status-filter');
            const modal = document.getElementById('student-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');
            const tabDetails = document.getElementById('tab-details');
            const tabPermissions = document.getElementById('tab-permissions');
            const contentDetails = document.getElementById('tab-content-details');
            const contentPermissions = document.getElementById('tab-content-permissions');
            const savePermissionsBtn = document.getElementById('modal-save-permissions-btn');
            const inviteBtn = document.getElementById('modal-invite-btn');
            const checkEntriesBtn = document.getElementById('check-entries-btn');
            const dailyEntriesDate = document.getElementById('daily-entries-date');

            // Set default date to today
            dailyEntriesDate.value = new Date().toISOString().split('T')[0];

            unitFilter.addEventListener('change', () => loadStudents());
            checkEntriesBtn.addEventListener('click', handleCheckEntriesClick);
            searchInput.addEventListener('input', () => renderStudents(allStudents));
            statusFilter.addEventListener('change', () => loadStudents());
            
            // Controle do Modal
            closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });

            // Controle das Abas
            tabDetails.addEventListener('click', () => {
                contentDetails.classList.remove('hidden');
                contentPermissions.classList.add('hidden');
                tabDetails.classList.add('text-yellow-500', 'border-yellow-500');
                tabPermissions.classList.remove('text-yellow-500', 'border-yellow-500');
                savePermissionsBtn.classList.add('hidden');
                inviteBtn.classList.remove('hidden');
            });

            tabPermissions.addEventListener('click', () => {
                contentDetails.classList.add('hidden');
                contentPermissions.classList.remove('hidden');
                tabPermissions.classList.add('text-yellow-500', 'border-yellow-500');
                tabDetails.classList.remove('text-yellow-500', 'border-yellow-500');
                savePermissionsBtn.classList.remove('hidden');
                inviteBtn.classList.add('hidden');
            });

            // Carrega todos os conteúdos uma vez para popular os modais
            Promise.all([loadStudents(), loadAllSelectableContent()]);
        }
    });
}

async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    const unitFilter = document.getElementById('unit-filter');
    const statusFilter = document.getElementById('status-filter');
    const selectedUnit = unitFilter.value;
    const selectedStatus = parseInt(statusFilter.value, 10);

    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-8">Carregando alunos...</td></tr>';

    try {
        let studentList = [];
        if (selectedUnit === 'all') {
            // Pega todos os IDs de unidade do HTML para fazer as chamadas
            const unitOptions = Array.from(unitFilter.options)
                .filter(opt => opt.value !== 'all')
                .map(opt => opt.value);

            const promises = unitOptions.map(unitId => listAllMembers({ unitId: unitId, status: selectedStatus }));
            
            const results = await Promise.all(promises);
            studentList = results.flatMap(result => result.data || []);
        } else {
            const result = await listAllMembers({ unitId: selectedUnit, status: selectedStatus });
            studentList = result.data || [];
        }
        
        allStudents = studentList; // Armazena no cache
        renderStudents(allStudents);

    } catch (error) {
        console.error("Erro ao carregar lista de alunos:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao carregar alunos: ${error.message}</td></tr>`;
        allStudents = []; // Limpa o cache em caso de erro
    }
}

function renderStudents(students) {
    const tableBody = document.getElementById('students-table-body');
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.toLowerCase();

    const filteredStudents = students.filter(student => {
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase();
        return fullName.includes(searchTerm);
    });

    if (filteredStudents.length > 0) {
        tableBody.innerHTML = '';
        filteredStudents.forEach(member => {
            const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
            const emailContact = member.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4);
            const email = emailContact?.description || 'N/A';

            const row = `
                <tr data-id="${member.idMember}" class="border-b border-gray-800 hover:bg-gray-700 cursor-pointer student-row">
                    <td class="p-4">${fullName}</td>
                    <td class="p-4">${email}</td>
                    <td class="p-4">${member.branchName || 'Centro'}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        // Adiciona os event listeners para as linhas da tabela
        document.querySelectorAll('.student-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const memberId = parseInt(e.currentTarget.dataset.id, 10);
                const studentData = allStudents.find(s => s.idMember === memberId);
                if (studentData) {
                    openStudentModal(studentData);
                }
            });
        });

    } else {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Nenhum aluno encontrado com os filtros aplicados.</td></tr>';
    }
}

async function openStudentModal(student) {
    const modal = document.getElementById('student-modal');
    const photoEl = document.getElementById('modal-student-photo');
    const mainContentEl = document.getElementById('modal-content-main');
    const extraContentEl = document.getElementById('modal-content-extra');
    const inviteBtn = document.getElementById('modal-invite-btn');
    const savePermissionsBtn = document.getElementById('modal-save-permissions-btn');
    
    // Reseta para a aba de detalhes ao abrir
    document.getElementById('tab-content-details').classList.remove('hidden');
    document.getElementById('tab-content-permissions').classList.add('hidden');
    document.getElementById('tab-details').classList.add('text-yellow-500', 'border-yellow-500');
    document.getElementById('tab-permissions').classList.remove('text-yellow-500', 'border-yellow-500');
    savePermissionsBtn.classList.add('hidden');
    inviteBtn.classList.remove('hidden');

    // Atualiza a foto
    photoEl.src = student.photoUrl || 'default-profile.svg';

    const translations = {
        idMember: "ID do Aluno",
        firstName: "Nome",
        lastName: "Sobrenome",
        registerDate: "Data de Cadastro",
        idBranch: "ID da Unidade",
        branchName: "Nome da Unidade",
        accessBlocked: "Acesso Bloqueado",
        document: "Documento (CPF/RG)",
        gender: "Gênero",
        birthDate: "Data de Nascimento",
        updateDate: "Última Atualização",
        address: "Endereço",
        state: "Estado",
        city: "Cidade",
        zipCode: "CEP",
        neighborhood: "Bairro",
        accessCardNumber: "Nº Cartão de Acesso",
        totalFitCoins: "FitCoins",
        membershipStatus: "Status da Matrícula",
        photoUrl: "URL da Foto",
        email: "E-mail",
        cellphones: "Celulares"
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
            case 'photoUrl':
                return `<a href="${value}" target="_blank" class="text-blue-400 hover:underline">Ver Foto</a>`;
            case 'contacts': // Este caso não será mais usado diretamente, mas mantido por segurança
                return value.map(c => `${c.contactType}: ${c.description}`).join('<br>');
            case 'memberships':
                 return value.map(m => `<b>${m.name}</b> (Status: ${m.membershipStatus})`).join('<br>');
            case 'cellphones':
                return value.join('<br>');
            default:
                if (typeof value === 'object') {
                    return `<pre class="bg-gray-800 p-2 rounded text-xs">${JSON.stringify(value, null, 2)}</pre>`;
                }
                return value;
        }
    };

    let mainHtml = '<dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">';
    let extraHtml = '<dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">';

    // Extrai e formata contatos antes de renderizar
    const studentData = { ...student };
    if (studentData.contacts) {
        const emailContact = studentData.contacts.find(c => c.contactType === 'E-mail' || c.idContactType === 4);
        studentData.email = emailContact ? emailContact.description : null;
        
        studentData.cellphones = studentData.contacts
            .filter(c => c.contactType === 'Cellphone')
            .map(c => c.description);
    }
    
    // Campos principais (ao lado da foto)
    const mainKeys = ['firstName', 'lastName', 'birthDate', 'membershipStatus', 'email', 'cellphones'];
    mainKeys.forEach(key => {
        if (studentData.hasOwnProperty(key) && studentData[key]) {
            mainHtml += `
                <div>
                    <dt class="font-semibold text-gray-400">${translations[key] || key}</dt>
                    <dd class="text-gray-200">${formatValue(key, studentData[key])}</dd>
                </div>
            `;
        }
    });
    mainHtml += '</dl>';

    // Campos extras (abaixo)
    extraHtml += '<div class="md:col-span-2 mt-4 border-t border-gray-700 pt-4"><h3 class="text-lg font-semibold mb-2">Outras Informações</h3></div>';
    for (const key in studentData) {
        // Não exibe os campos já mostrados ou o array original de contatos
        if (!mainKeys.includes(key) && key !== 'contacts' && translations.hasOwnProperty(key)) {
             extraHtml += `
                <div>
                    <dt class="font-semibold text-gray-400">${translations[key]}</dt>
                    <dd class="text-gray-200">${formatValue(key, studentData[key])}</dd>
                </div>
            `;
        }
    }
    extraHtml += '</dl>';
    
    mainContentEl.innerHTML = mainHtml;
    extraContentEl.innerHTML = extraHtml;

    // Lógica do botão de convite
    const email = student.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description;
    if (!email) {
        inviteBtn.disabled = true;
        inviteBtn.title = "Aluno sem e-mail cadastrado.";
        inviteBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        inviteBtn.disabled = false;
        inviteBtn.title = "";
        inviteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        inviteBtn.replaceWith(inviteBtn.cloneNode(true));
        document.getElementById('modal-invite-btn').addEventListener('click', () => handleInviteClick(student));
    }

    // Carrega e preenche as permissões
    await populatePermissionsChecklists(student);
    
    // Lógica do botão de salvar permissões
    savePermissionsBtn.replaceWith(savePermissionsBtn.cloneNode(true));
    document.getElementById('modal-save-permissions-btn').addEventListener('click', () => handleSavePermissions(student));
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function handleInviteClick(student) {
    const button = document.getElementById('modal-invite-btn');

    const email = student.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description;
    if (!email) {
        alert("Este aluno não possui um e-mail cadastrado para ser convidado.");
        return;
    }

    if (!confirm(`Tem certeza que deseja enviar um convite para ${student.firstName} (${email})?`)) {
        return;
    }

    button.disabled = true;
    button.textContent = 'Enviando...';

    try {
        const result = await inviteStudent({
            evoMemberId: student.idMember,
            email: email,
            firstName: student.firstName,
            lastName: student.lastName
        });

        // Exibe o link para o admin copiar
        prompt(
            "Convite gerado com sucesso! Copie o link abaixo e envie para o aluno:",
            result.data.link
        );

        button.textContent = 'Convite Enviado';
        button.classList.remove('bg-green-600', 'hover:bg-green-700');
        button.classList.add('bg-gray-500');

    } catch (error) {
        console.error("Erro ao enviar convite:", error);
        alert(`Erro ao enviar convite: ${error.message}`);
        button.disabled = false;
        button.textContent = 'Convidar';
    }
}

async function loadAllSelectableContent() {
    try {
        const coursesQuery = query(collection(db, "courses"), orderBy("title"));
        const tatameQuery = query(collection(db, "tatame_conteudos"), orderBy("title"));
        
        const [coursesSnapshot, tatameSnapshot] = await Promise.all([
            getDocs(coursesQuery),
            getDocs(tatameQuery)
        ]);

        allCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTatameContents = tatameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (error) {
        console.error("Erro ao carregar conteúdos para seleção:", error);
    }
}

async function populatePermissionsChecklists(student) {
    const coursesChecklist = document.getElementById('courses-checklist');
    const tatameChecklist = document.getElementById('tatame-checklist');
    coursesChecklist.innerHTML = '';
    tatameChecklist.innerHTML = '';

    // Precisamos encontrar o UID do usuário do Firebase correspondente ao aluno
    const studentUser = await findUserByEvoId(student.idMember);
    const studentUid = studentUser?.id;
    const studentPermissions = studentUser?.accessibleContent || [];

    allCourses.forEach(course => {
        const isChecked = studentPermissions.includes(course.id);
        coursesChecklist.innerHTML += `
            <label class="flex items-center space-x-2 text-gray-300 cursor-pointer">
                <input type="checkbox" value="${course.id}" class="form-checkbox bg-gray-700 border-gray-600 rounded" ${isChecked ? 'checked' : ''}>
                <span>${course.title}</span>
            </label>
        `;
    });

    allTatameContents.forEach(content => {
        const isChecked = studentPermissions.includes(content.id);
        tatameChecklist.innerHTML += `
            <label class="flex items-center space-x-2 text-gray-300 cursor-pointer">
                <input type="checkbox" value="${content.id}" class="form-checkbox bg-gray-700 border-gray-600 rounded" ${isChecked ? 'checked' : ''}>
                <span>${content.title}</span>
            </label>
        `;
    });
}

async function handleSavePermissions(student) {
    const button = document.getElementById('modal-save-permissions-btn');
    const studentUser = await findUserByEvoId(student.idMember);
    
    if (!studentUser) {
        alert("Este aluno ainda não tem uma conta no sistema (use o botão 'Convidar' primeiro). Não é possível salvar permissões.");
        return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';

    const selectedCourses = Array.from(document.querySelectorAll('#courses-checklist input:checked')).map(input => input.value);
    const selectedTatame = Array.from(document.querySelectorAll('#tatame-checklist input:checked')).map(input => input.value);
    const accessibleContent = [...selectedCourses, ...selectedTatame];

    try {
        await updateStudentPermissions({ studentUid: studentUser.id, accessibleContent });
        alert("Permissões salvas com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar permissões:", error);
        alert(`Erro ao salvar permissões: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Permissões';
    }
}

// Função auxiliar para encontrar um usuário do Firestore pelo seu evoMemberId
async function findUserByEvoId(evoId) {
    // Esta é uma busca ineficiente. O ideal seria ter uma coleção separada para mapear evoId -> uid.
    // Por enquanto, vamos buscar em todos os usuários.
    const allUsersSnapshot = await getDocs(collection(db, "users"));
    for (const doc of allUsersSnapshot.docs) {
        if (doc.data().evoMemberId === evoId) {
            return { id: doc.id, ...doc.data() };
        }
    }
    return null;
}

async function handleCheckEntriesClick() {
    const unitFilter = document.getElementById('unit-filter');
    const selectedUnit = unitFilter.value;
    const dateInput = document.getElementById('daily-entries-date');
    const selectedDate = dateInput.value;
    const resultDiv = document.getElementById('entries-result');
    const button = document.getElementById('check-entries-btn');

    if (!selectedDate) {
        resultDiv.innerHTML = '<span class="text-red-500">Por favor, selecione uma data.</span>';
        return;
    }

    if (selectedUnit === 'all') {
        resultDiv.innerHTML = '<span class="text-red-500">Por favor, selecione uma unidade específica para verificar as entradas.</span>';
        return;
    }

    button.disabled = true;
    button.textContent = 'Verificando...';
    resultDiv.innerHTML = 'Carregando...';

    try {
        const result = await getDailyEntries({ unitId: selectedUnit, date: selectedDate });
        const { totalEntries, uniqueMembersCount } = result.data;
        
        resultDiv.innerHTML = `
            <span class="font-semibold">Resultados para ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}:</span> 
            <span class="text-yellow-500">${uniqueMembersCount}</span> alunos únicos de um total de 
            <span class="text-yellow-500">${totalEntries}</span> entradas.
        `;

    } catch (error) {
        console.error("Erro ao verificar entradas diárias:", error);
        resultDiv.innerHTML = `<span class="text-red-500">Erro ao buscar dados: ${error.message}</span>`;
    } finally {
        button.disabled = false;
        button.textContent = 'Verificar Entradas';
    }
}
