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
            if (unitFilter) unitFilter.addEventListener('change', () => loadStudents());
            if (checkEntriesBtn) checkEntriesBtn.addEventListener('click', handleCheckEntriesClick);
            if (searchInput) searchInput.addEventListener('input', debounce(() => loadStudents(), 500));

            // --- Registration Modal Listeners ---
            if (addStudentBtn) {
                addStudentBtn.addEventListener('click', () => {
                    if (registerModal) {
                        registerModal.classList.remove('hidden');
                        registerModal.classList.add('flex');
                    }
                });
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
                    const deleteBtn = e.target.closest('.delete-student-btn');
                    if (deleteBtn) {
                        const memberId = deleteBtn.dataset.id;
                        const studentName = deleteBtn.dataset.name;

                        if (confirm(`Tem certeza que deseja excluir o aluno ${studentName} e remover todo o seu acesso à plataforma?`)) {
                            try {
                                deleteBtn.disabled = true;
                                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                                await deleteLocalMember({ idMember: memberId });
                                alert('✅ Aluno removido com sucesso!');
                                loadStudents();
                            } catch (error) {
                                console.error('Erro ao deletar aluno:', error);
                                alert(`❌ Erro: ${error.message}`);
                                deleteBtn.disabled = false;
                                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                            }
                        }
                        return;
                    }

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
                    if (tabConfigs[name].content) tabConfigs[name].content.classList.add('hidden');
                    if (tabConfigs[name].button) {
                        tabConfigs[name].button.classList.remove('text-yellow-500', 'border-yellow-500');
                        tabConfigs[name].button.classList.add('text-gray-400', 'hover:text-white');
                    }
                }

                const activeConfig = tabConfigs[activeTabName];
                if (activeConfig.content) activeConfig.content.classList.remove('hidden');
                if (activeConfig.button) {
                    activeConfig.button.classList.add('text-yellow-500', 'border-yellow-500');
                    activeConfig.button.classList.remove('text-gray-400', 'hover:text-white');
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
    const cacheStatusEl = document.getElementById('cache-status');
    if (!cacheStatusEl) return;

    if (!success) {
        cacheStatusEl.innerHTML = '<span class="text-red-500"><i class="fas fa-exclamation-circle"></i> Erro ao carregar dados</span>';
        return;
    }

    try {
        // Verifica o estado do cache na nova coleção de status
        const syncStatusQuery = await getDocs(collection(db, 'evo_sync_status'));

        if (syncStatusQuery.empty) {
            cacheStatusEl.innerHTML = '<span class="text-yellow-500"><i class="fas fa-exclamation-triangle"></i> Cache vazio - clique em "Sincronizar Cache"</span>';
        } else {
            let oldestSync = null;
            let hasErrors = false;

            syncStatusQuery.forEach(doc => {
                const data = doc.data();
                if (data.status === 'error') hasErrors = true;
                if (data.lastSync) {
                    const syncDate = data.lastSync.toDate();
                    if (!oldestSync || syncDate < oldestSync) oldestSync = syncDate;
                }
            });

            if (oldestSync) {
                const hoursAgo = Math.round((new Date() - oldestSync) / (1000 * 60 * 60));
                const isExpired = hoursAgo >= 24;
                const icon = hasErrors ? 'fa-exclamation-circle' : (isExpired ? 'fa-exclamation-triangle' : 'fa-check-circle');
                const color = hasErrors ? 'text-red-500' : (isExpired ? 'text-yellow-500' : 'text-green-500');
                const message = hasErrors
                    ? 'Algumas unidades falharam na sincronização'
                    : (isExpired ? `Cache desatualizado (${hoursAgo}h atrás)` : `✓ Cache atualizado (${hoursAgo}h atrás)`);

                cacheStatusEl.innerHTML = `<span class="${color}"><i class="fas ${icon}"></i> ${message}</span>`;
            } else {
                cacheStatusEl.innerHTML = '<span class="text-blue-500"><i class="fas fa-database"></i> Sincronização em andamento ou incompleta</span>';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar status do cache:', error);
        cacheStatusEl.innerHTML = '<span class="text-blue-500"><i class="fas fa-database"></i> Dados do Firestore prontos</span>';
    }
}

function renderStudents(students, isAdmin = false) {
    const tableBody = document.getElementById('students-table-body');
    const totalStudentsCountEl = document.getElementById('total-students-count');

    // Filtra alunos com dados removidos (flexível com maiúsculas/minúsculas e quantidade de asteriscos)
    const validStudents = students.filter(student => 
        !student.firstName || !student.firstName.startsWith('***Dados')
    );

    // Atualiza o contador total de alunos
    totalStudentsCountEl.textContent = validStudents.length;


    if (validStudents.length > 0) {
        // isAdmin is passed as parameter
        
        const rowsHtml = validStudents.map(member => {
            const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
            const emailContact = member.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4);
            const email = emailContact?.description || 'N/A';

            let actionsHtml = '';
            if (isAdmin) {
                actionsHtml = `
                    <button class="delete-student-btn text-red-500 hover:text-red-700 p-2 transition-colors ml-auto" 
                            data-id="${member.idMember}" data-name="${fullName}" title="Excluir Aluno">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            }

            return `
                <tr data-id="${member.idMember}" class="border-b border-gray-800 hover:bg-gray-700 cursor-pointer student-row group">
                    <td class="p-4 font-medium">${fullName}</td>
                    <td class="p-4 text-gray-400">${email}</td>
                    <td class="p-4 text-gray-400">${member.branchName || 'Centro'}</td>
                    <td class="p-4 text-right flex justify-end">${actionsHtml}</td>
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
    const registeredStudentsCountEl = document.getElementById('registered-students-count');
    if (evoIds.length === 0) {
        registeredStudentsCountEl.textContent = '0';
        return;
    }

    try {
        const result = await getRegisteredUsersByEvoId({ evoIds });
        const registeredEvoIds = new Set(result.data.registeredEvoIds);

        // Atualiza o contador de alunos registrados
        registeredStudentsCountEl.textContent = registeredEvoIds.size;

        const rows = document.querySelectorAll('.student-row');
        rows.forEach(row => {
            const memberId = parseInt(row.dataset.id, 10);
            if (registeredEvoIds.has(memberId)) {
                // Remove highlight visual antigo se existir
                row.classList.remove('bg-blue-900');

                // Adiciona ícone de check verde ANTES do nome
                const nameCell = row.cells[0]; // Primeira célula é o nome
                if (nameCell && !nameCell.querySelector('.fa-check-circle')) {
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-check-circle text-green-500 mr-2'; // mr-2 para margem à direita
                    icon.title = 'Aluno com acesso à plataforma';
                    // Adiciona classes para alinhamento vertical se necessário, mas prepend costuma funcionar bem
                    nameCell.prepend(icon);
                }
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
        return `
            <tr class="border-b border-gray-800">
                <td class="p-4 text-center font-medium">${index + 1}º</td>
                <td class="p-4">${unit.unitName}</td>
                <td class="p-4 font-bold text-blue-400">${unit.count}</td>
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
        
        let statusBadge = '<span class="text-gray-500 border border-gray-700 px-2 py-1 rounded text-xs">Sem Plano</span>';
        if (s.tuitionStatus === 'pending') statusBadge = '<span class="text-yellow-500 bg-yellow-900/30 border border-yellow-800 px-2 py-1 rounded text-xs">Aguardando Pgto</span>';
        if (s.tuitionStatus === 'active' || s.tuitionStatus === 'authorized') statusBadge = '<span class="text-green-500 bg-green-900/30 border border-green-800 px-2 py-1 rounded text-xs">Mensalidade Ativa</span>';
        if (s.tuitionStatus === 'cancelled') statusBadge = '<span class="text-red-500 bg-red-900/30 border border-red-800 px-2 py-1 rounded text-xs">Cancelado</span>';
        
        html += `
            <tr class="border-b border-gray-800 hover:bg-gray-700/50 transition-colors">
                <td class="p-4 font-medium text-white">${s.firstName} ${s.lastName}</td>
                <td class="p-4 text-gray-400 text-sm">${s.unitId || 'N/A'}</td>
                <td class="p-4"><span class="${s.tuitionPlanId ? 'text-yellow-500 font-semibold' : 'text-gray-500'}">${planName}</span></td>
                <td class="p-4 text-center">${statusBadge}</td>
                <td class="p-4 text-right">
                    <a href="aluno.html?id=${s.idMember}&unit=${s.unitId || ''}" class="inline-flex items-center justify-center text-blue-400 hover:text-white bg-blue-900/30 hover:bg-blue-600 px-3 py-2 rounded transition-colors text-sm font-medium">
                        <i class="fas fa-external-link-alt mr-2"></i> Abrir Ficha
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
