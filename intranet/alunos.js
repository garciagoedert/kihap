import { onAuthReady, checkAdminStatus } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from './firebase-config.js';

const listAllMembers = httpsCallable(functions, 'listAllMembers');
const inviteStudent = httpsCallable(functions, 'inviteStudent');

let allStudents = []; // Cache para guardar a lista de alunos e facilitar a busca

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
            const modal = document.getElementById('student-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');

            unitFilter.addEventListener('change', () => loadStudents());
            searchInput.addEventListener('input', () => renderStudents(allStudents));
            
            // Fecha o modal ao clicar no botão 'x' ou fora da área de conteúdo
            closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });

            loadStudents(); // Carga inicial
        }
    });
}

async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    const unitFilter = document.getElementById('unit-filter');
    const selectedUnit = unitFilter.value;

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Carregando alunos...</td></tr>';

    try {
        // Se a unidade for 'all', precisaremos chamar a função para cada unidade no futuro.
        // Por enquanto, só temos 'centro', então tratamos 'all' e 'centro' da mesma forma.
        const unitToFetch = selectedUnit === 'all' ? 'centro' : selectedUnit;
        
        const result = await listAllMembers({ unitId: unitToFetch });
        
        // A resposta da callable function tem a lista dentro de result.data
        const studentList = result.data || [];
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
            const graduation = member.memberships?.[0]?.name || 'N/A';

            const row = `
                <tr data-id="${member.idMember}" class="border-b border-gray-800 hover:bg-gray-700 cursor-pointer student-row">
                    <td class="p-4">${fullName}</td>
                    <td class="p-4">${email}</td>
                    <td class="p-4">${graduation}</td>
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

function openStudentModal(student) {
    const modal = document.getElementById('student-modal');
    const photoEl = document.getElementById('modal-student-photo');
    const mainContentEl = document.getElementById('modal-content-main');
    const extraContentEl = document.getElementById('modal-content-extra');
    const inviteBtn = document.getElementById('modal-invite-btn');

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
        // Remove listener antigo para evitar múltiplos cliques
        inviteBtn.replaceWith(inviteBtn.cloneNode(true));
        document.getElementById('modal-invite-btn').addEventListener('click', () => handleInviteClick(student));
    }
    
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
