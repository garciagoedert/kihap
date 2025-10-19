import { onAuthReady, checkAdminStatus, getUserData } from './auth.js';
import { showConfirm } from './common-ui.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions, db, storage } from './firebase-config.js'; // Added storage import
import { collection, getDocs, query, orderBy, addDoc, Timestamp, where, deleteDoc, doc, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js"; // Added storage imports

// Import functions for badge management from gerenciar-emblemas.js
import { setupGerenciarEmblemasPage as setupBadgeManagement } from './gerenciar-emblemas.js'; 

// Debounce function to limit the rate of function execution
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

const listAllMembers = httpsCallable(functions, 'listAllMembers');
const inviteStudent = httpsCallable(functions, 'inviteStudent');
const updateStudentPermissions = httpsCallable(functions, 'updateStudentPermissions');
const triggerEvoSync = httpsCallable(functions, 'triggerEvoSync');
const getDailyEntries = httpsCallable(functions, 'getDailyEntries');
const getRegisteredUsersByEvoId = httpsCallable(functions, 'getRegisteredUsersByEvoId');

let allStudents = []; // Cache para guardar a lista de alunos e facilitar a busca
let allCourses = [];
let allTatameContents = [];
let allBadges = []; // This will be populated by loadAllSelectableContent and used by the modal

export function setupAlunosPage() {
    onAuthReady(async (user) => {
        if (user) {
            // Oculta o botão de adicionar prospect no header
            const addProspectBtn = document.getElementById('addProspectBtnHeader');
            if (addProspectBtn) {
                addProspectBtn.style.display = 'none';
            }

            // --- DOM Elements ---
            const unitFilter = document.getElementById('unit-filter');
            const searchInput = document.getElementById('search-input');
            const modal = document.getElementById('student-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');
            const savePermissionsBtn = document.getElementById('modal-save-permissions-btn');
            const saveBadgesBtn = document.getElementById('modal-save-badges-btn');
            const inviteBtn = document.getElementById('modal-invite-btn');
            const checkEntriesBtn = document.getElementById('check-entries-btn');
            const dailyEntriesDate = document.getElementById('daily-entries-date');

            // --- Tab Elements ---
            const tabManageStudents = document.getElementById('tab-manage-students');
            const tabCheckEntries = document.getElementById('tab-check-entries');
            const tabManageBadges = document.getElementById('tab-manage-badges');
            const tabRanking = document.getElementById('tab-ranking');
            const contentManageStudents = document.getElementById('tab-content-manage-students');
            const contentCheckEntries = document.getElementById('tab-content-check-entries');
            const contentManageBadges = document.getElementById('tab-content-manage-badges');
            const contentRanking = document.getElementById('tab-content-ranking');

            // --- Modal Tab Elements ---
            const tabDetails = document.getElementById('tab-details');
            const tabPermissions = document.getElementById('tab-permissions');
            const tabPhysicalTest = document.getElementById('tab-physical-test');
            const tabBadgesModal = document.getElementById('tab-badges'); // Renamed to avoid conflict
            const contentDetails = document.getElementById('tab-content-details');
            const contentPermissions = document.getElementById('tab-content-permissions');
            const contentPhysicalTest = document.getElementById('tab-content-physical-test');
            const contentBadgesModal = document.getElementById('tab-content-badges'); // Renamed to avoid conflict

            // Set default date to today, only if the element exists
            if (dailyEntriesDate) {
                dailyEntriesDate.value = new Date().toISOString().split('T')[0];
            }

            // --- Event Listeners ---
            unitFilter.addEventListener('change', () => loadStudents());
            if (checkEntriesBtn) {
                checkEntriesBtn.addEventListener('click', handleCheckEntriesClick);
            }
            searchInput.addEventListener('input', debounce(() => loadStudents(), 500)); // Restaurado para chamar a função de busca

            // Event listener delegated for the students table
            const tableBody = document.getElementById('students-table-body');
            tableBody.addEventListener('click', (e) => {
                const row = e.target.closest('.student-row');
                if (row) {
                    const memberId = parseInt(row.dataset.id, 10);
                    const studentData = allStudents.find(s => s.idMember === memberId);
                    if (studentData) {
                        openStudentModal(studentData);
                    }
                }
            });
            
            // Modal Controls
            closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });

            // --- Main Page Tab Switching Logic ---
            function switchMainTab(activeTabName) {
                const tabConfigs = {
                    'manage-students': { content: contentManageStudents, button: tabManageStudents },
                    'check-entries': { content: contentCheckEntries, button: tabCheckEntries },
                    'manage-badges': { content: contentManageBadges, button: tabManageBadges },
                    'ranking': { content: contentRanking, button: tabRanking }
                };

                // Hide all content and reset button styles
                for (const name in tabConfigs) {
                    tabConfigs[name].content.classList.add('hidden');
                    tabConfigs[name].button.classList.remove('text-yellow-500', 'border-yellow-500');
                    tabConfigs[name].button.classList.add('text-gray-400', 'hover:text-white');
                }

                // Show the active tab's content and style its button
                const activeConfig = tabConfigs[activeTabName];
                activeConfig.content.classList.remove('hidden');
                activeConfig.button.classList.add('text-yellow-500', 'border-yellow-500');
                activeConfig.button.classList.remove('text-gray-400', 'hover:text-white');

                // Special handling for badge management tab activation
                if (activeTabName === 'manage-badges') {
                    // Ensure badge management setup is called only once or when needed
                    // We can check if the content is already loaded or if the setup function has been called
                    // For simplicity, we'll call it here, assuming it handles re-initialization gracefully or we add a flag.
                    // A more robust solution might involve checking if the content is visible and then calling setup.
                    setupBadgeManagement(); 
                } else if (activeTabName === 'ranking') {
                    loadRankingData();
                }
            }
            
            tabManageStudents.addEventListener('click', () => switchMainTab('manage-students'));
            tabCheckEntries.addEventListener('click', () => switchMainTab('check-entries'));
            tabManageBadges.addEventListener('click', () => switchMainTab('manage-badges'));
            tabRanking.addEventListener('click', () => switchMainTab('ranking'));

            // --- Modal Tab Switching Logic (Existing) ---
            function switchModalTab(activeTabName) {
                const tabConfig = {
                    details: {
                        content: contentDetails,
                        button: document.getElementById('modal-invite-btn'), // This button is for details tab
                        tab: tabDetails
                    },
                    permissions: {
                        content: contentPermissions,
                        button: savePermissionsBtn,
                        tab: tabPermissions
                    },
                    'physical-test': {
                        content: contentPhysicalTest,
                        button: null, // No specific button for this tab in the footer
                        tab: tabPhysicalTest
                    },
                    badges: { // This refers to the modal's badge tab
                        content: contentBadgesModal,
                        button: saveBadgesBtn,
                        tab: tabBadgesModal
                    }
                };

                // Loop through all configurations to set the correct state
                for (const tabName in tabConfig) {
                    const config = tabConfig[tabName];
                    const isActive = tabName === activeTabName;

                    // Toggle content visibility
                    config.content.classList.toggle('hidden', !isActive);

                    // Toggle button visibility (for footer buttons)
                    if (config.button) {
                        config.button.classList.toggle('hidden', !isActive);
                    }

                    // Toggle tab style
                    config.tab.classList.toggle('text-yellow-500', isActive);
                    config.tab.classList.toggle('border-yellow-500', isActive);
                    // Ensure other tabs are styled as inactive
                    if (!isActive) {
                        config.tab.classList.add('text-gray-400', 'hover:text-white');
                        config.tab.classList.remove('border-yellow-500');
                    } else {
                        config.tab.classList.remove('text-gray-400', 'hover:text-white');
                    }
                }
            }
            
            tabDetails.addEventListener('click', () => switchModalTab('details'));
            tabPermissions.addEventListener('click', () => switchModalTab('permissions'));
            tabPhysicalTest.addEventListener('click', () => switchModalTab('physical-test'));
            tabBadgesModal.addEventListener('click', () => switchModalTab('badges')); // Use renamed variable

            // --- Initial Load ---
            // Load students and other necessary data for the page
            Promise.all([loadStudents(), loadAllSelectableContent()]);
            // Set the default active tab to "Gerenciamento de Alunos"
            switchMainTab('manage-students');

            // --- Admin-only Features ---
            const syncEvoBtn = document.getElementById('sync-evo-btn');
            if (syncEvoBtn) {
                syncEvoBtn.style.display = 'none';
            }
            const syncEvoRankingBtn = document.getElementById('sync-evo-ranking-btn');
            if (syncEvoRankingBtn) {
                syncEvoRankingBtn.style.display = 'none';
            }
        }
    });
}

async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    const unitFilter = document.getElementById('unit-filter');
    const searchInput = document.getElementById('search-input');
    const selectedUnit = unitFilter.value;
    const searchTerm = searchInput.value.trim();

    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-8">Carregando alunos...</td></tr>';

    try {
        // A lógica de filtro de status foi removida. O backend agora sempre busca todos.
        const result = await listAllMembers({
            unitId: selectedUnit,
            name: searchTerm
        });

        const studentList = result.data || [];
        
        // Atualiza o cache local para o modal e outras interações da página.
        allStudents = studentList;
        renderStudents(studentList);

    } catch (error) {
        console.error("Erro ao carregar lista de alunos:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao carregar alunos: ${error.message}</td></tr>`;
        allStudents = []; // Limpa o cache em caso de erro
    }
}

function renderStudents(students) {
    const tableBody = document.getElementById('students-table-body');

    // Filtra alunos com dados removidos
    const validStudents = students.filter(student => student.firstName !== '***Dados Removidos***');

    if (validStudents.length > 0) {
        const rowsHtml = validStudents.map(member => {
            const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
            const emailContact = member.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4);
            const email = emailContact?.description || 'N/A';

            return `
                <tr data-id="${member.idMember}" class="border-b border-gray-800 hover:bg-gray-700 cursor-pointer student-row">
                    <td class="p-4">${fullName}</td>
                    <td class="p-4">${email}</td>
                    <td class="p-4">${member.branchName || 'Centro'}</td>
                </tr>
            `;
        }).join('');
        tableBody.innerHTML = rowsHtml;

        // Agora, chame a Cloud Function para obter os status e aplicar os destaques
        highlightRegisteredStudents(validStudents.map(s => s.idMember));

    } else {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Nenhum aluno encontrado com os filtros aplicados.</td></tr>';
    }
}

async function highlightRegisteredStudents(evoIds) {
    if (evoIds.length === 0) return;

    try {
        const result = await getRegisteredUsersByEvoId({ evoIds });
        const registeredEvoIds = new Set(result.data.registeredEvoIds);

        const rows = document.querySelectorAll('.student-row');
        rows.forEach(row => {
            const memberId = parseInt(row.dataset.id, 10);
            if (registeredEvoIds.has(memberId)) {
                row.classList.add('bg-blue-900');
            }
        });
    } catch (error) {
        if (error.code === 'permission-denied' || error.message.includes('Apenas administradores')) {
            console.warn("Permissão negada para destacar alunos registrados. Apenas administradores podem ver esta informação.");
        } else {
            console.error("Erro ao destacar alunos registrados:", error);
        }
        // A funcionalidade de destaque é opcional, então a página continua funcionando.
    }
}

async function openStudentModal(student) {
    const modal = document.getElementById('student-modal');
    const photoEl = document.getElementById('modal-student-photo');
    const mainContentEl = document.getElementById('modal-content-main');
    const extraContentEl = document.getElementById('modal-content-extra');
    const inviteBtn = document.getElementById('modal-invite-btn');
    const savePermissionsBtn = document.getElementById('modal-save-permissions-btn');
    const saveBadgesBtn = document.getElementById('modal-save-badges-btn');
    
    // Reseta para a aba de detalhes ao abrir
    document.getElementById('tab-content-details').classList.remove('hidden');
    document.getElementById('tab-content-permissions').classList.add('hidden');
    document.getElementById('tab-content-physical-test').classList.add('hidden');
    document.getElementById('tab-content-badges').classList.add('hidden'); // Use renamed variable
    document.getElementById('tab-details').classList.add('text-yellow-500', 'border-yellow-500');
    document.getElementById('tab-permissions').classList.remove('text-yellow-500', 'border-yellow-500');
    document.getElementById('tab-physical-test').classList.remove('text-yellow-500', 'border-yellow-500');
    document.getElementById('tab-badges').classList.remove('text-yellow-500', 'border-yellow-500'); // Use renamed variable
    savePermissionsBtn.classList.add('hidden');
    saveBadgesBtn.classList.add('hidden');
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
        cellphones: "Celulares",
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
    const mainKeys = ['firstName', 'lastName', 'birthDate', 'membershipStatus', 'email', 'cellphones', 'nameEmployeeInstructor'];
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

    try {
        // Carrega e preenche as permissões e outros dados
        await populatePermissionsChecklists(student);
        await populateBadgesChecklist(student);
        await populatePhysicalTestTab(student);
    } catch (error) {
        console.error("Erro ao popular dados do modal para o aluno:", student.idMember, error);
        // Opcional: Exibir uma mensagem de erro em alguma parte do modal
    } finally {
        // Garante que o modal sempre seja exibido
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    // Lógica do botão de salvar permissões
    savePermissionsBtn.replaceWith(savePermissionsBtn.cloneNode(true));
    document.getElementById('modal-save-permissions-btn').addEventListener('click', () => handleSavePermissions(student));

    // Lógica do botão de salvar emblemas
    saveBadgesBtn.replaceWith(saveBadgesBtn.cloneNode(true));
    document.getElementById('modal-save-badges-btn').addEventListener('click', () => handleSaveBadges(student));
}

async function handleInviteClick(student) {
    const button = document.getElementById('modal-invite-btn');
    const unitFilter = document.getElementById('unit-filter');

    const email = student.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description;
    if (!email) {
        alert("Este aluno não possui um e-mail cadastrado para ser convidado.");
        return;
    }

    let unitId;
    const selectedUnit = unitFilter.value;

    // Função de normalização final para garantir a correspondência
    const normalize = (str) => {
        if (!str) return '';
        return str.normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                  .toLowerCase()
                  .replace(/kihap|unidade/g, '') // Remove palavras-chave
                  .replace(/[^a-z0-9]/g, ''); // Remove caracteres não alfanuméricos
    };

    if (selectedUnit !== 'all') {
        unitId = selectedUnit;
    } else {
        const normalizedBranchName = normalize(student.branchName); // Ex: "kihap-centro" -> "centro"
        if (normalizedBranchName) {
            const unitOption = Array.from(unitFilter.options).find(opt => {
                if (opt.value === 'all') return false;
                // Compara o nome normalizado da API com o valor da opção (que já é um slug)
                // Ex: "centro" (da API) vs "centro" (do value do option)
                return normalize(opt.value) === normalizedBranchName;
            });

            if (unitOption) {
                unitId = unitOption.value;
            }
        }
    }

    if (!unitId) {
        alert("Não foi possível determinar a unidade do aluno. Por favor, selecione uma unidade específica no filtro e tente novamente.");
        return;
    }

    showConfirm(
        `Tem certeza que deseja enviar um convite para ${student.firstName} (${email}) da unidade ${student.branchName}?`,
        async () => {
            button.disabled = true;
            button.textContent = 'Enviando...';

            try {
                const result = await inviteStudent({
                    evoMemberId: student.idMember,
                    email: email,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    unitId: unitId // Adiciona a unitId na chamada
                });

                showInviteLinkModal(result.data.link);

                button.textContent = 'Convite Enviado';
                button.classList.remove('bg-green-600', 'hover:bg-green-700');
                button.classList.add('bg-gray-500');

            } catch (error) {
                console.error("Erro ao enviar convite:", error);
                alert(`Erro ao enviar convite: ${error.message}`);
                button.disabled = false;
                button.textContent = 'Convidar';
            }
        },
        "Confirmar Envio de Convite"
    );
}

function showInviteLinkModal(link) {
    const modal = document.getElementById('inviteLinkModal');
    const linkInput = document.getElementById('inviteLinkInput');
    const copyBtn = document.getElementById('copyInviteLinkBtn');
    const closeBtn = document.getElementById('closeInviteLinkModalBtn');

    if (!modal || !linkInput || !copyBtn || !closeBtn) return;

    linkInput.value = link;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const close = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    copyBtn.onclick = () => {
        linkInput.select();
        document.execCommand('copy');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
    };

    closeBtn.onclick = close;
}

async function loadAllSelectableContent() {
    try {
        const coursesQuery = query(collection(db, "courses"), orderBy("title"));
        const tatameQuery = query(collection(db, "tatame_conteudos"), orderBy("title"));
        const badgesQuery = query(collection(db, "badges"), orderBy("name"));
        
        const [coursesSnapshot, tatameSnapshot, badgesSnapshot] = await Promise.all([
            getDocs(coursesQuery),
            getDocs(tatameQuery),
            getDocs(badgesQuery)
        ]);

        allCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTatameContents = tatameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allBadges = badgesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

async function populateBadgesChecklist(student) {
    const badgesChecklist = document.getElementById('badges-checklist');
    badgesChecklist.innerHTML = '';

    const studentUser = await findUserByEvoId(student.idMember);
    const studentBadges = studentUser?.earnedBadges || [];

    if (allBadges.length === 0) {
        badgesChecklist.innerHTML = '<p class="text-gray-500 col-span-full">Nenhum emblema cadastrado no sistema.</p>';
        return;
    }

    allBadges.forEach(badge => {
        const isChecked = studentBadges.includes(badge.id);
        badgesChecklist.innerHTML += `
            <label class="flex flex-col items-center space-y-2 text-gray-300 cursor-pointer p-2 rounded-lg hover:bg-gray-700">
                <img src="${badge.imageUrl}" alt="${badge.name}" class="w-16 h-16 rounded-full object-cover border-2 ${isChecked ? 'border-yellow-500' : 'border-gray-600'}">
                <input type="checkbox" value="${badge.id}" class="form-checkbox bg-gray-700 border-gray-600 rounded" ${isChecked ? 'checked' : ''}>
                <span class="text-xs text-center">${badge.name}</span>
            </label>
        `;
    });
}

async function handleSaveBadges(student) {
    const button = document.getElementById('modal-save-badges-btn');
    const studentUser = await findUserByEvoId(student.idMember);

    if (!studentUser) {
        alert("Este aluno ainda não tem uma conta no sistema (use o botão 'Convidar' primeiro). Não é possível salvar emblemas.");
        return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';

    const selectedBadges = Array.from(document.querySelectorAll('#badges-checklist input:checked')).map(input => input.value);

    try {
        // Precisamos de uma nova Cloud Function para atualizar apenas os emblemas
        // Por enquanto, vamos usar uma função hipotética 'updateStudentBadges'
        // Esta será criada no backend (Firebase Functions)
        const updateStudentBadges = httpsCallable(functions, 'updateStudentBadges');
        await updateStudentBadges({ studentUid: studentUser.id, earnedBadges: selectedBadges });
        alert("Emblemas salvos com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar emblemas:", error);
        alert(`Erro ao salvar emblemas: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Emblemas';
    }
}

async function populatePhysicalTestTab(student) {
    const historyContainer = document.getElementById('physical-test-history');
    const saveBtn = document.getElementById('save-physical-test-btn');
    historyContainer.innerHTML = '<p class="text-gray-500">Carregando histórico...</p>';
    saveBtn.disabled = false; // Habilita o botão por padrão

    const studentUser = await findUserByEvoId(student.idMember);
    let allTests = [];

    // 1. Busca testes da subcoleção do usuário, se ele existir
    if (studentUser) {
        const userTestsQuery = query(collection(db, `users/${studentUser.id}/physicalTests`), orderBy("date", "desc"));
        const userTestsSnapshot = await getDocs(userTestsQuery);
        userTestsSnapshot.forEach(doc => {
            allTests.push({ id: doc.id, ...doc.data() });
        });
    }

    // 2. Busca testes da coleção principal, associados pelo evoMemberId
    const generalTestsQuery = query(
        collection(db, "physicalTests"),
        where("evoMemberId", "==", student.idMember),
        orderBy("date", "desc")
    );
    const generalTestsSnapshot = await getDocs(generalTestsQuery);
    generalTestsSnapshot.forEach(doc => {
        allTests.push({ id: doc.id, ...doc.data() });
    });

    // Ordena todos os testes combinados pela data
    allTests.sort((a, b) => b.date.toMillis() - a.date.toMillis());

    if (allTests.length === 0) {
        historyContainer.innerHTML = '<p class="text-gray-500">Nenhum teste físico registrado ainda.</p>';
    } else {
        let html = '<ul class="space-y-2">';
        allTests.forEach(data => {
            const date = data.date.toDate().toLocaleDateString('pt-BR');
            html += `
                <li class="flex justify-between items-center bg-gray-900 p-2 rounded">
                    <span>Data: <span class="font-semibold">${date}</span></span>
                    <span>Pontuação: <span class="font-semibold text-yellow-500">${data.score}</span></span>
                </li>
            `;
        });
        html += '</ul>';
        historyContainer.innerHTML = html;
    }

    saveBtn.onclick = () => handleSavePhysicalTest(student);
}

async function handleSavePhysicalTest(student) {
    const dateInput = document.getElementById('physical-test-date');
    const scoreInput = document.getElementById('physical-test-score');
    const button = document.getElementById('save-physical-test-btn');

    const dateValue = dateInput.value;
    const score = scoreInput.value;

    if (!dateValue || !score) {
        alert("Por favor, preencha a data e a pontuação.");
        return;
    }
    
    // Adiciona a hora atual para garantir que a data seja salva corretamente no fuso horário local
    const date = new Date(dateValue + 'T00:00:00');

    button.disabled = true;
    button.textContent = 'Salvando...';

    try {
        const studentUser = await findUserByEvoId(student.idMember);
        
        const testData = {
            date: Timestamp.fromDate(date),
            score: Number(score),
            evoMemberId: student.idMember, // Sempre salva o ID do EVO
            studentName: `${student.firstName} ${student.lastName}` // Salva o nome para referência
        };

        let testsCollection;
        // Se o usuário existe, salva na subcoleção dele. Senão, na coleção principal.
        if (studentUser) {
            testsCollection = collection(db, `users/${studentUser.id}/physicalTests`);
        } else {
            testsCollection = collection(db, "physicalTests");
        }
        
        await addDoc(testsCollection, testData);
        
        dateInput.value = '';
        scoreInput.value = '';
        await populatePhysicalTestTab(student); // Recarrega o histórico

    } catch (error) {
        console.error("Erro ao salvar o teste físico:", error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Adicionar Log';
    }
}

// A função findUserByEvoId foi removida do cliente para melhorar a segurança e o desempenho.
// A verificação agora é feita pela Cloud Function 'getRegisteredUsersByEvoId'.
// As funções abaixo que ainda a utilizam precisarão ser refatoradas no futuro se necessário.

// Função auxiliar para encontrar um usuário do Firestore pelo seu evoMemberId (LEGADO - MANTER PARA MODAL)
// TODO: Refatorar o modal para usar uma Cloud Function para buscar dados de um usuário específico.
async function findUserByEvoId(evoId) {
    // Esta é uma busca ineficiente e insegura. Mantida temporariamente para o modal funcionar.
    try {
        const allUsersSnapshot = await getDocs(collection(db, "users"));
        for (const doc of allUsersSnapshot.docs) {
            if (doc.data().evoMemberId === evoId) {
                return { id: doc.id, ...doc.data() };
            }
        }
    } catch (e) {
        console.warn("Permissão negada para buscar usuário. O modal pode não exibir permissões/testes. Este é o comportamento esperado após a mudança de segurança.");
        return null;
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

async function loadRankingData() {
    const rankingTableBody = document.getElementById('ranking-table-body');
    rankingTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Carregando ranking...</td></tr>';

    try {
        const getPublicRanking = httpsCallable(functions, 'getPublicRanking');
        const result = await getPublicRanking();
        const allStudentsForRanking = result.data || [];

        // Filtra e ordena os alunos pelas KihapCoins
        const rankedStudents = allStudentsForRanking
            .filter(student => student.totalFitCoins > 0)
            .sort((a, b) => (b.totalFitCoins || 0) - (a.totalFitCoins || 0));

        renderRanking(rankedStudents);

    } catch (error) {
        console.error("Erro ao carregar o ranking:", error);
        rankingTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao carregar o ranking.</td></tr>';
    }
}

function renderRanking(students) {
    const rankingTableBody = document.getElementById('ranking-table-body');
    
    if (students.length === 0) {
        rankingTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Nenhum aluno com KihapCoins encontrado nos filtros atuais.</td></tr>';
        return;
    }

    const rowsHtml = students.map((student, index) => {
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`;
        const unitName = student.branchName || 'N/A';
        const fitCoins = student.totalFitCoins || 0;

        return `
            <tr class="border-b border-gray-800">
                <td class="p-4 text-center font-medium">${index + 1}º</td>
                <td class="p-4">${fullName}</td>
                <td class="p-4">${unitName}</td>
                <td class="p-4 font-bold text-yellow-500">${fitCoins}</td>
            </tr>
        `;
    }).join('');

    rankingTableBody.innerHTML = rowsHtml;
}
