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
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

const listAllMembers = httpsCallable(functions, 'listAllMembers');
const listAlunosLocais = httpsCallable(functions, 'listAlunosLocais');
const inviteStudent = httpsCallable(functions, 'inviteStudent');
const updateStudentPermissions = httpsCallable(functions, 'updateStudentPermissions');
const triggerEvoSync = httpsCallable(functions, 'triggerEvoSync');
const getDailyEntries = httpsCallable(functions, 'getDailyEntries');
const getRegisteredUsersByEvoId = httpsCallable(functions, 'getRegisteredUsersByEvoId');
const syncEvoStudentsToCache = httpsCallable(functions, 'syncEvoStudentsToCache');
const batchSetDefaultPasswords = httpsCallable(functions, 'batchSetDefaultPasswords');
const registerLocalStudent = httpsCallable(functions, 'registerLocalStudent');
const deleteLocalMember = httpsCallable(functions, 'deleteLocalMember');
const cleanupRemovedStudents = httpsCallable(functions, 'cleanupRemovedStudents');

// --- Belt Options Data ---
const BELT_OPTIONS = {
    'Tradicional': [
        'Branca Recomendada', 'Branca Decidida',
        'Laranja Recomendada', 'Laranja Decidida',
        'Amarela Recomendada', 'Amarela Decidida',
        'Camuflada Recomendada', 'Camuflada Decidida',
        'Verde Recomendada', 'Verde Decidida',
        'Roxa Recomendada', 'Roxa Decidida',
        'Azul Recomendada', 'Azul Decidida',
        'Marrom Recomendada', 'Marrom Decidida',
        'Vermelha Recomendada', 'Vermelha Decidida',
        'Vermelha e Preta', 'Preta'
    ],
    'Littles': [
        'Panda', 'Leão', 'Girafa', 'Borboleta', 'Jacaré', 'Coruja', 'Arara', 'Macaco', 'Fênix'
    ]
};

export let allStudents = []; // Cache para guardar a lista de alunos e facilitar a busca
let currentAppUser = null; 
let allCourses = [];
let allTatameContents = [];
let allBadges = []; // This will be populated by loadAllSelectableContent and used by the modal

export function setupAlunosPage() {
    onAuthReady(async (user) => {
        if (user) {
            currentAppUser = user;
            console.log("👤 Usuário autenticado na página de alunos:", user.email);
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
            const tabManageTuitions = document.getElementById('tab-manage-tuitions');
            const tabCheckEntries = document.getElementById('tab-check-entries');
            const tabManageBadges = document.getElementById('tab-manage-badges');
            const tabRanking = document.getElementById('tab-ranking');
            const tabAccessRanking = document.getElementById('tab-access-ranking');
            const contentManageStudents = document.getElementById('tab-content-manage-students');
            const contentManageTuitions = document.getElementById('tab-content-manage-tuitions');
            const contentCheckEntries = document.getElementById('tab-content-check-entries');
            const contentManageBadges = document.getElementById('tab-content-manage-badges');
            const contentRanking = document.getElementById('tab-content-ranking');
            const contentAccessRanking = document.getElementById('tab-content-access-ranking');

            // --- Modal Tab Elements ---
            const tabDetails = document.getElementById('tab-details');
            const tabPermissions = document.getElementById('tab-permissions');
            const tabPhysicalTest = document.getElementById('tab-physical-test');
            const tabBadgesModal = document.getElementById('tab-badges');
            const contentDetails = document.getElementById('tab-content-details');
            const contentPermissions = document.getElementById('tab-content-permissions');
            const contentPhysicalTest = document.getElementById('tab-content-physical-test');
            const contentBadgesModal = document.getElementById('tab-content-badges');

            // Set default date to today
            if (dailyEntriesDate) {
                dailyEntriesDate.value = new Date().toISOString().split('T')[0];
            }

            // --- Registration Modal Elements ---
            const registerModal = document.getElementById('register-modal');
            const addStudentBtn = document.getElementById('add-student-btn');
            const closeRegisterBtn = document.getElementById('close-register-modal');
            const cancelRegBtn = document.getElementById('cancel-reg-btn');
            const registerForm = document.getElementById('register-form');
            const cleanupTrashBtn = document.getElementById('cleanup-trash-btn');

            // --- Event Listeners ---
            if (unitFilter) unitFilter.addEventListener('change', () => {
                loadStudents();
                // Também atualiza mensalidades se estiver na aba
                if (!contentManageTuitions.classList.contains('hidden')) renderTuitionsTable();
            });
            if (checkEntriesBtn) checkEntriesBtn.addEventListener('click', handleCheckEntriesClick);
            if (searchInput) searchInput.addEventListener('input', debounce(() => {
                loadStudents();
                // Também atualiza mensalidades se estiver na aba
                if (!contentManageTuitions.classList.contains('hidden')) renderTuitionsTable();
            }, 500));

            // --- Dropdown Logic ---
            const dropdownBtn = document.getElementById('actions-dropdown-btn');
            const dropdownMenu = document.getElementById('actions-dropdown-menu');

            if (dropdownBtn && dropdownMenu) {
                dropdownBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isHidden = dropdownMenu.classList.contains('hidden');
                    if (isHidden) {
                        dropdownMenu.classList.remove('hidden');
                        // Pequeno delay para permitir a animação do Tailwind
                        requestAnimationFrame(() => {
                            dropdownMenu.classList.remove('scale-95', 'opacity-0');
                            dropdownMenu.classList.add('scale-100', 'opacity-100');
                        });
                    } else {
                        dropdownMenu.classList.add('scale-95', 'opacity-0');
                        dropdownMenu.classList.remove('scale-100', 'opacity-100');
                        // Espera a animação terminar antes de esconder
                        setTimeout(() => dropdownMenu.classList.add('hidden'), 200);
                    }
                });

                document.addEventListener('click', (e) => {
                    if (!dropdownMenu.classList.contains('hidden') && !e.target.closest('#actions-dropdown-container')) {
                        dropdownMenu.classList.add('scale-95', 'opacity-0');
                        dropdownMenu.classList.remove('scale-100', 'opacity-100');
                        setTimeout(() => dropdownMenu.classList.add('hidden'), 200);
                    }
                });
            }

            // --- Registration Modal Listeners ---
            if (addStudentBtn) {
                addStudentBtn.addEventListener('click', () => {
                    if (registerModal) {
                        registerModal.classList.remove('hidden');
                        registerModal.classList.add('flex');
                        updateBeltOptions(); // Initialize belts when opening
                    }
                });
            }

            // --- Dynamic Belt Selection Logic ---
            const regRankType = document.getElementById('reg-rank-type');
            const regBelt = document.getElementById('reg-belt');

            function updateBeltOptions() {
                if (!regRankType || !regBelt) return;
                const program = regRankType.value;
                const belts = BELT_OPTIONS[program] || [];
                
                regBelt.innerHTML = belts.map(belt => `<option value="${belt}">${belt}</option>`).join('');
            }

            if (regRankType) {
                regRankType.addEventListener('change', updateBeltOptions);
            }
            if (closeRegisterBtn) {
                closeRegisterBtn.addEventListener('click', () => {
                    if (registerModal) {
                        registerModal.classList.add('hidden');
                        registerModal.classList.remove('flex');
                    }
                });
            }
            if (cancelRegBtn) {
                cancelRegBtn.addEventListener('click', () => {
                    if (registerModal) {
                        registerModal.classList.add('hidden');
                        registerModal.classList.remove('flex');
                    }
                });
            }
            if (registerForm) {
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const saveBtn = document.getElementById('save-reg-btn');
                    if (!saveBtn) return;

                    const originalHtml = saveBtn.innerHTML;
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Cadastrando...';

                    const studentData = {
                        firstName: document.getElementById('reg-first-name').value,
                        lastName: document.getElementById('reg-last-name').value,
                        email: document.getElementById('reg-email').value,
                        unitId: document.getElementById('reg-unit').value,
                        phone: document.getElementById('reg-phone').value,
                        cpf: document.getElementById('reg-cpf').value,
                        birthDate: document.getElementById('reg-birth-date').value,
                        rankType: document.getElementById('reg-rank-type').value,
                        belt: document.getElementById('reg-belt').value,
                        responsible: document.getElementById('reg-responsible').value,
                        origin: document.getElementById('reg-origin').value,
                        address: document.getElementById('reg-address').value
                    };

                    try {
                        await registerLocalStudent(studentData);
                        alert('✅ Aluno cadastrado com sucesso!');
                        if (registerModal) {
                            registerModal.classList.add('hidden');
                            registerModal.classList.remove('flex');
                        }
                        registerForm.reset();
                        loadStudents();
                    } catch (error) {
                        console.error('Erro ao cadastrar aluno:', error);
                        alert(`❌ Erro: ${error.message}`);
                    } finally {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = originalHtml;
                    }
                });
            }

            // --- Cleanup Trash Listener ---
            if (cleanupTrashBtn) {
                cleanupTrashBtn.addEventListener('click', async () => {
                    if (!confirm('Você tem certeza que deseja remover todos os registros marcados como "***Dados Removidos***"? Esta ação é irreversível.')) {
                        return;
                    }

                    cleanupTrashBtn.disabled = true;
                    cleanupTrashBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Limpando...';

                    try {
                        const result = await cleanupRemovedStudents();
                        alert(`✅ Sucesso! ${result.data.count} registros removidos.`);
                        loadStudents();
                    } catch (error) {
                        console.error('Erro ao limpar lixo:', error);
                        alert(`❌ Erro: ${error.message}`);
                    } finally {
                        cleanupTrashBtn.disabled = false;
                        cleanupTrashBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i> Limpar Lixo';
                    }
                });
            }

            // Event listener delegated for the students table
            const tableBody = document.getElementById('students-table-body');
            if (tableBody) {
                tableBody.addEventListener('click', async (e) => {
                    // Row Click Listener
                    const row = e.target.closest('.student-row');
                    if (row) {
                        const memberId = parseInt(row.dataset.id, 10);
                        const student = allStudents.find(s => s.idMember === memberId);
                        if (student && student.unitId) {
                            window.location.href = `aluno.html?id=${memberId}&unit=${student.unitId}`;
                        } else {
                            window.location.href = `aluno.html?id=${memberId}`;
                        }
                    }
                    if (row) {
                        const memberId = parseInt(row.dataset.id, 10);
                        const student = allStudents.find(s => s.idMember === memberId);
                        if (student && student.unitId) {
                            window.location.href = `aluno.html?id=${memberId}&unit=${student.unitId}`;
                        } else {
                            window.location.href = `aluno.html?id=${memberId}`;
                        }
                    }
                });
            }

            // Modal Controls
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
                    'manage-tuitions': { content: contentManageTuitions, button: tabManageTuitions },
                    'check-entries': { content: contentCheckEntries, button: tabCheckEntries },
                    'manage-badges': { content: contentManageBadges, button: tabManageBadges },
                    'ranking': { content: contentRanking, button: tabRanking },
                    'access-ranking': { content: contentAccessRanking, button: tabAccessRanking }
                };

                for (const name in tabConfigs) {
                    const config = tabConfigs[name];
                    if (config.content) config.content.classList.add('hidden');
                    if (config.button) {
                        config.button.classList.remove('bg-primary', 'text-black', 'shadow-lg');
                        config.button.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'dark:hover:text-gray-200');
                    }
                }

                const activeConfig = tabConfigs[activeTabName];
                if (activeConfig && activeConfig.content) activeConfig.content.classList.remove('hidden');
                if (activeConfig && activeConfig.button) {
                    activeConfig.button.classList.add('bg-primary', 'text-black', 'shadow-lg');
                    activeConfig.button.classList.remove('text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'dark:hover:text-gray-200');
                }

                if (activeTabName === 'manage-badges') {
                    setupBadgeManagement();
                } else if (activeTabName === 'ranking') {
                    loadRankingData();
                } else if (activeTabName === 'access-ranking') {
                    loadAndRenderAccessRanking();
                }
            }

            if (tabManageStudents) tabManageStudents.addEventListener('click', () => switchMainTab('manage-students'));
            if (tabManageTuitions) tabManageTuitions.addEventListener('click', () => {
                switchMainTab('manage-tuitions');
                renderTuitionsTable();
            });
            if (tabCheckEntries) tabCheckEntries.addEventListener('click', () => switchMainTab('check-entries'));
            if (tabManageBadges) tabManageBadges.addEventListener('click', () => switchMainTab('manage-badges'));
            if (tabRanking) tabRanking.addEventListener('click', () => switchMainTab('ranking'));
            if (tabAccessRanking) tabAccessRanking.addEventListener('click', () => switchMainTab('access-ranking'));

            const tuitionSearch = document.getElementById('tuition-search-input');
            const tuitionStatusFilter = document.getElementById('tuition-status-filter');
            if (tuitionSearch) {
                tuitionSearch.addEventListener('input', debounce(() => renderTuitionsTable(), 500));
            }
            if (tuitionStatusFilter) {
                tuitionStatusFilter.addEventListener('change', () => renderTuitionsTable());
            }

            // --- Initial Load ---
            const urlParams = new URLSearchParams(window.location.search);
            const searchName = urlParams.get('search');
            if (searchName && searchInput) {
                searchInput.value = searchName;
            }

            // Load students
            loadStudents();
            loadAllSelectableContent();

            // Set the default active tab
            switchMainTab('manage-students');

            // --- Sync Button Event Listener ---
            const syncEvoBtn = document.getElementById('sync-evo-btn');
            if (syncEvoBtn) {
                syncEvoBtn.addEventListener('click', async () => {
                    const icon = document.getElementById('sync-icon');
                    const text = document.getElementById('sync-text');

                    syncEvoBtn.disabled = true;
                    if (icon) icon.classList.add('fa-spin');
                    if (text) text.textContent = 'Sincronizando...';

                    try {
                        const result = await syncEvoStudentsToCache({ unitId: 'all' });
                        const data = result.data;

                        alert(`✅ Sincronização concluída!\n\n` +
                            `✓ Unidades sincronizadas: ${data.success.length}\n` +
                            `✗ Unidades com erro: ${data.failed.length}\n` +
                            `📊 Total de alunos: ${data.totalStudents}\n\n` +
                            `Os dados estão agora no cache e serão carregados muito mais rápido!`);

                        await loadStudents();
                    } catch (error) {
                        console.error('Erro na sincronização:', error);
                        alert(`❌ Erro na sincronização: ${error.message}`);
                    } finally {
                        syncEvoBtn.disabled = false;
                        if (icon) icon.classList.remove('fa-spin');
                        if (text) text.textContent = 'Sincronizar Cache';
                    }
                });
            }

            // --- Batch Password Button Event Listener ---
            const batchPasswordBtn = document.getElementById('batch-password-btn');
            if (batchPasswordBtn) {
                batchPasswordBtn.addEventListener('click', async () => {
                    const selectedUnit = unitFilter ? unitFilter.value : 'todas';

                    if (!confirm(`ATENÇÃO: Isso irá criar contas de acesso para TODOS os alunos da unidade selecionada (${selectedUnit}) que ainda não possuem acesso, definindo a senha padrão como "kihap".\n\nDeseja continuar?`)) {
                        return;
                    }

                    batchPasswordBtn.disabled = true;
                    batchPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processando...</span>';

                    try {
                        const result = await batchSetDefaultPasswords({ unitId: selectedUnit, dryRun: false });
                        alert(`✅ Sucesso!\n\n${result.data.message}`);
                        await loadStudents();
                    } catch (error) {
                        console.error('Erro ao gerar senhas:', error);
                        alert(`❌ Erro: ${error.message}`);
                    } finally {
                        batchPasswordBtn.disabled = false;
                        batchPasswordBtn.innerHTML = '<i class="fas fa-key"></i> <span>Gerar Senhas Padrão</span>';
                    }
                });
            }

            // --- Feature visibility based on role ---
            const isAdmin = await checkAdminStatus(user);
            
            // "Novo Aluno" is now visible to all intranet users
            if (addStudentBtn) addStudentBtn.classList.remove('hidden');
            
            // "Limpar Lixo", Sync and Batch Password features stay admin-only
            if (isAdmin) {
                if (cleanupTrashBtn) cleanupTrashBtn.classList.remove('hidden');
                if (batchPasswordBtn) batchPasswordBtn.classList.remove('hidden');
                if (syncEvoBtn) syncEvoBtn.classList.remove('hidden');
            } else {
                if (cleanupTrashBtn) cleanupTrashBtn.classList.add('hidden');
                if (batchPasswordBtn) batchPasswordBtn.classList.add('hidden');
                if (syncEvoBtn) syncEvoBtn.classList.add('hidden');
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
        console.log("🚀 Buscando alunos nativamente através de Cloud Function (rápido)...", { selectedUnit, searchTerm });
        const startTime = Date.now();

        const result = await listAlunosLocais({ unitId: selectedUnit });
        let studentList = result.data || [];

        // Search logic local no frontend
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            studentList = studentList.filter(s => {
                const fullName = (s.firstName + " " + s.lastName).toLowerCase();
                return fullName.includes(lowerSearchTerm);
            });
        }

        console.log(`✅ Busca Cloud Function concluída em ${Date.now() - startTime}ms`);
        console.log(`📏 Total de alunos retornados: ${studentList.length}`);

        allStudents = studentList;
        const isAdmin = await checkAdminStatus(currentAppUser);
        renderStudents(studentList, isAdmin);
        updateCacheStatus();

    } catch (error) {
        console.error("Erro ao carregar lista de alunos:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao carregar alunos: ${error.message}</td></tr>`;
        allStudents = [];
        updateCacheStatus(false);
    }
}

async function updateCacheStatus(success = true) {
    // A seção de status do cache foi removida para uma UI mais clean.
    // Mantemos a função para evitar erros de referência, mas sem atualizar elementos inexistentes.
    console.log("Cache status check (silent):", success);
}

function renderStudents(students, isAdmin = false) {
    const tableBody = document.getElementById('students-table-body');
    if (!tableBody) return;

    // Filtra alunos com dados removidos
    const validStudents = students.filter(student => 
        !student.firstName || !student.firstName.startsWith('***Dados')
    );

    if (validStudents.length > 0) {
        const rowsHtml = validStudents.map(member => {
            const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
            const emailContact = member.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4);
            const email = emailContact?.description || 'N/A';
            const initials = (member.firstName?.[0] || '') + (member.lastName?.[0] || '');
            const photoUrl = member.photoUrl || member.photo || null;
            const avatarContent = photoUrl 
                ? `<img src="${photoUrl}" class="w-full h-full object-cover rounded-full" onerror="this.outerHTML='${initials.toUpperCase()}'">`
                : initials.toUpperCase();

            return `
                <tr data-id="${member.idMember}" class="student-row group transition-all duration-200 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer">
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-xs border border-primary/10 shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
                                ${avatarContent}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-gray-900 dark:text-white text-sm group-hover:text-primary transition-colors">${fullName}</span>
                                <span class="text-[10px] text-gray-400 font-medium">ID: ${member.idMember}</span>
                            </div>
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="flex flex-col">
                            <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">${email}</span>
                            <span class="text-[10px] text-gray-400">Principal</span>
                        </div>
                    </td>
                    <td class="p-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                            ${member.branchName || 'Centro'}
                        </span>
                    </td>
                    <td class="p-4 text-right">
                        <div class="flex justify-end">
                            <span class="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                <i class="fas fa-chevron-right text-[10px]"></i>
                            </span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        tableBody.innerHTML = rowsHtml;

        // Agora, chame a Cloud Function para obter os status e aplicar os destaques
        highlightRegisteredStudents(validStudents.map(s => s.idMember));

    } else {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-gray-400">Nenhum aluno encontrado com os filtros aplicados.</td></tr>';
    }
}

async function highlightRegisteredStudents(evoIds) {
    // A pedido do usuário, removemos a sinalização visual (check verde) de alunos registrados.
    // Mantemos a função para futuras implementações de status ou permissões se necessário.
    return;
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
            <div class="flex flex-col items-center text-center">
                <span class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Resultados para ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                <div class="flex items-baseline gap-2">
                    <span class="text-4xl font-black text-primary">${uniqueMembersCount}</span>
                    <span class="text-sm font-bold text-gray-500">alunos únicos</span>
                </div>
                <p class="text-xs text-gray-400 mt-2">de um total de <span class="font-bold text-gray-900 dark:text-white">${totalEntries}</span> entradas registradas.</p>
            </div>
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
        const initials = (student.firstName?.[0] || '') + (student.lastName?.[0] || '');

        let rankClass = "bg-gray-100 dark:bg-gray-800 text-gray-500";
        if (index === 0) rankClass = "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50";
        else if (index === 1) rankClass = "bg-gray-200 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600";
        else if (index === 2) rankClass = "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50";

        return `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all duration-200">
                <td class="p-4 text-center">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs ${rankClass}">
                        ${index + 1}
                    </span>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] border border-primary/10">
                            ${initials.toUpperCase()}
                        </div>
                        <span class="text-sm font-bold text-gray-900 dark:text-white">${fullName}</span>
                    </div>
                </td>
                <td class="p-4">
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${unitName}</span>
                </td>
                <td class="p-4 text-right pr-6">
                    <div class="flex justify-end">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white font-black text-[10px] shadow-sm shadow-primary/20">
                            <i class="fas fa-coins text-[8px]"></i>
                            ${fitCoins.toLocaleString()}
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    rankingTableBody.innerHTML = rowsHtml;
}

async function loadAndRenderAccessRanking() {
    const tableBody = document.getElementById('access-ranking-table-body');
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-8">Calculando ranking...</td></tr>';

    try {
        // 1. Get all students from all units
        const allStudentsResult = await listAllMembers({ unitId: 'all', name: '' });
        const allStudentsList = allStudentsResult.data.filter(s => s.firstName !== '***Dados Removidos***') || [];

        if (allStudentsList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-8">Nenhum aluno encontrado.</td></tr>';
            return;
        }

        // 2. Get all registered users
        const allStudentIds = allStudentsList.map(s => s.idMember);
        const registeredUsersResult = await getRegisteredUsersByEvoId({ evoIds: allStudentIds });
        const registeredEvoIds = new Set(registeredUsersResult.data.registeredEvoIds);

        // 3. Calculate counts per unit
        const unitCounts = {};
        allStudentsList.forEach(student => {
            if (registeredEvoIds.has(student.idMember)) {
                const unitName = student.branchName || 'Centro'; // Default to 'Centro' if null
                unitCounts[unitName] = (unitCounts[unitName] || 0) + 1;
            }
        });

        // 4. Sort units by count
        const rankedUnits = Object.entries(unitCounts)
            .map(([unitName, count]) => ({ unitName, count }))
            .sort((a, b) => b.count - a.count);

        // 5. Render the ranking
        renderAccessRanking(rankedUnits);

    } catch (error) {
        console.error("Erro ao carregar ranking de acessos:", error);
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center p-8 text-red-500">Erro ao carregar ranking: ${error.message}</td></tr>`;
    }
}

function renderAccessRanking(rankedUnits) {
    const tableBody = document.getElementById('access-ranking-table-body');

    if (rankedUnits.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-8">Nenhum aluno com acesso à plataforma encontrado.</td></tr>';
        return;
    }

    const rowsHtml = rankedUnits.map((unit, index) => {
        let rankClass = "bg-gray-100 dark:bg-gray-800 text-gray-500";
        if (index === 0) rankClass = "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50";
        else if (index === 1) rankClass = "bg-gray-200 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600";
        else if (index === 2) rankClass = "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50";

        return `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all duration-200">
                <td class="p-4 text-center">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs ${rankClass}">
                        ${index + 1}
                    </span>
                </td>
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-gray-900 dark:text-white">${unit.unitName}</span>
                        <span class="text-[10px] text-gray-400">Unidade Kihap</span>
                    </div>
                </td>
                <td class="p-4 text-right pr-6">
                    <div class="flex justify-end">
                        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 font-black text-[10px]">
                            <i class="fas fa-users text-[8px]"></i>
                            ${unit.count} Alunos
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rowsHtml;
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

async function renderTuitionsTable() {
    const tableBody = document.getElementById('tuitions-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando...</td></tr>';
    
    if (!window.tuitionPlansCache) {
        try {
            const getTuitionPlans = httpsCallable(functions, 'getTuitionPlans');
            const res = await getTuitionPlans({ unitId: 'all' });
            window.tuitionPlansCache = res.data || [];
        } catch (e) {
            console.error("Erro ao buscar planos:", e);
            window.tuitionPlansCache = [];
        }
    }
    
    const searchInput = document.getElementById('tuition-search-input');
    const statusFilter = document.getElementById('tuition-status-filter');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const unitFilter = document.getElementById('unit-filter').value;
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    
    let filtered = allStudents.filter(s => {
        // Unidade filter
        if (unitFilter !== 'all' && s.unitId !== unitFilter && s.branchName !== unitFilter) return false;
        
        // Nome filter
        if (searchTerm) {
            const name = (s.firstName + ' ' + (s.lastName || '')).toLowerCase();
            if (!name.includes(searchTerm)) return false;
        }

        // Status filter
        if (selectedStatus !== 'all') {
            const isAdimplente = s.tuitionStatus === 'active' || s.tuitionStatus === 'authorized';
            const isPendente = s.tuitionStatus === 'pending' || s.tuitionStatus === 'past_due' || s.tuitionStatus === 'cancelled';
            const withoutPlan = !s.tuitionPlanId;

            if (selectedStatus === 'adimplente' && !isAdimplente) return false;
            if (selectedStatus === 'inadimplente' && (!isPendente || withoutPlan)) return false;
            if (selectedStatus === 'sem_plano' && !withoutPlan) return false;
        }

        return true;
    });
    
    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400">Nenhum aluno encontrado para os filtros atuais.</td></tr>';
        return;
    }
    
    // Sort by status (active/pending first), then name
    filtered.sort((a, b) => {
        const hasA = a.tuitionPlanId ? 1 : 0;
        const hasB = b.tuitionPlanId ? 1 : 0;
        if (hasA !== hasB) return hasB - hasA;
        return a.firstName.localeCompare(b.firstName);
    });

    // Pagination for performance (show top 200 max)
    const displayList = filtered.slice(0, 200);

    let html = '';
    displayList.forEach(s => {
        let planName = 'Nenhum plano associado';
        if (s.tuitionPlanId) {
            const plan = window.tuitionPlansCache.find(p => p.id === s.tuitionPlanId);
            if (plan) planName = plan.name;
        }
        
        let statusBadge = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 uppercase tracking-wider">Sem Plano</span>';
        if (s.tuitionStatus === 'pending') statusBadge = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 uppercase tracking-wider">Aguardando Pgto</span>';
        if (s.tuitionStatus === 'active' || s.tuitionStatus === 'authorized') statusBadge = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 uppercase tracking-wider">Mensalidade Ativa</span>';
        if (s.tuitionStatus === 'cancelled') statusBadge = '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 uppercase tracking-wider">Cancelado</span>';
        
        html += `
            <tr class="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200">
                <td class="p-4 font-bold text-gray-900 dark:text-white text-sm">${s.firstName} ${s.lastName}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">${s.unitId || 'N/A'}</td>
                <td class="p-4"><span class="${s.tuitionPlanId ? 'text-primary font-bold text-sm' : 'text-gray-400 text-xs italic'}">${planName}</span></td>
                <td class="p-4 text-center">${statusBadge}</td>
                <td class="p-4 text-right">
                    <a href="aluno.html?id=${s.idMember}&unit=${s.unitId || ''}" class="inline-flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-black px-4 py-2 rounded-xl transition-all duration-300 text-xs font-bold shadow-sm active:scale-95 border border-primary/20">
                        <i class="fas fa-external-link-alt"></i> Abrir Ficha
                    </a>
                </td>
            </tr>
        `;
    });
    
    if (filtered.length > 200) {
        html += `<tr><td colspan="5" class="text-center p-4 text-gray-400 text-sm">Mostrando os 200 primeiros resultados. Refine sua busca.</td></tr>`;
    }
    
    tableBody.innerHTML = html;
}
