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

export let allStudents = []; // Cache para guardar a lista de alunos e facilitar a busca
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
                    const student = allStudents.find(s => s.idMember === memberId);
                    if (student && student.unitId) {
                        window.location.href = `aluno.html?id=${memberId}&unit=${student.unitId}`;
                    } else {
                        // Fallback para o caso de a unidade não ser encontrada (improvável)
                        window.location.href = `aluno.html?id=${memberId}`;
                    }
                }
            });
            
            // Modal Controls (REMOVED)
            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
            }
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                    }
                });
            }

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

            // Modal Tab Switching Logic (REMOVED)

            // --- Initial Load ---
            const urlParams = new URLSearchParams(window.location.search);
            const searchName = urlParams.get('search');
            if (searchName) {
                searchInput.value = searchName;
            }

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

// Funções do modal removidas

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
