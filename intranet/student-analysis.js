import { app, db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
const getDailyEntries = httpsCallable(functions, 'getDailyEntries');
const getContractsEvolution = httpsCallable(functions, 'getContractsEvolution');
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents, setupUIListeners } from './common-ui.js';
import { onAuthReady, checkAdminStatus } from './auth.js';

// Helper function to get ISO week number
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

let allData = [];
let charts = {};
let currentViewingId = null;
let currentUserIsAdmin = false;

let fullLogData = [];
let renderedLogCount = 0;
const LOG_PAGE_SIZE = 20;

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(user => {
        if (user) {
            checkAdminStatus(user).then(isAdmin => {
                currentUserIsAdmin = isAdmin;
                loadComponents(initializeDashboard);
            });
        } else {
            loadComponents(initializeDashboard);
        }
    });
});

async function initializeDashboard() {
    // common-ui.js já executa setupUIListeners, então não precisamos chamar de novo.
    // Apenas garantimos que os elementos específicos desta página funcionem.
    document.getElementById('addProspectBtnHeader')?.remove();

    await fetchData();
    populateFilters(allData);
    
    const locationFilter = document.getElementById('location-filter');
    const yearFilter = document.getElementById('year-filter');
    const viewByFilter = document.getElementById('view-by-filter');
    const dateFilter = document.getElementById('date-filter');
    const weekFilter = document.getElementById('week-filter');

    // Set default date for date filter
    dateFilter.valueAsDate = new Date();
    
    locationFilter.addEventListener('change', updateDashboard);
    yearFilter.addEventListener('change', () => {
        if (viewByFilter.value === 'weekly') {
            populateWeekFilter(allData);
        }
        updateDashboard();
    });
    // Atualiza os KPIs do EVO sempre que o filtro de localização mudar
    locationFilter.addEventListener('change', () => {
        displayEvoKpi();
        displayDailyEntriesKpi();
    });
    dateFilter.addEventListener('change', updateDashboard);
    weekFilter.addEventListener('change', updateDashboard);
    viewByFilter.addEventListener('change', () => {
        if (viewByFilter.value === 'daily') {
            dateFilter.classList.remove('hidden');
            yearFilter.classList.add('hidden');
            weekFilter.classList.add('hidden');
        } else if (viewByFilter.value === 'weekly') {
            // If switching to weekly view and "All Years" is selected, default to the most recent year.
            if (yearFilter.value === 'all' && yearFilter.options.length > 1) {
                yearFilter.value = yearFilter.options[1].value; // The first actual year
            }
            dateFilter.classList.add('hidden');
            yearFilter.classList.remove('hidden');
            weekFilter.classList.remove('hidden');
            populateWeekFilter(allData);
        } else { // monthly
            dateFilter.classList.add('hidden');
            yearFilter.classList.remove('hidden');
            weekFilter.classList.add('hidden');
        }
        updateDashboard();
    });

    document.getElementById('load-more-btn').addEventListener('click', renderMoreLogItems);

    setupModal();
    setupEditModal();
    setupViewModal();
    setupConfirmationModal();
    updateDashboard();
    displayEvoKpi();
    displayDailyEntriesKpi();
}

function populateWeekFilter(data) {
    const weekFilter = document.getElementById('week-filter');
    const selectedYear = document.getElementById('year-filter').value;
    weekFilter.innerHTML = '<option value="all">Todas as Semanas</option>';

    if (selectedYear === 'all') {
        // Do not populate if 'All Years' is selected, as weeks would be ambiguous.
        return;
    }

    const yearData = data.filter(d => d.Ano == selectedYear);
    const weeks = [...new Set(yearData.map(row => {
        const date = new Date(row.Data + 'T00:00:00');
        return getWeekNumber(date);
    }))].sort((a, b) => a - b);

    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = `Semana ${week}`;
        weekFilter.appendChild(option);
    });
}

async function fetchData() {
    const dataCollection = collection(db, 'analise_unidades');
    const q = query(dataCollection, orderBy("Data", "asc"));
    const dataSnapshot = await getDocs(q);
    allData = dataSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Fetched Data:", allData);
}

function setupModal() {
    const modal = document.getElementById('addDataModal');
    const openBtn = document.getElementById('addDataBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const form = document.getElementById('addDataForm');
    const unidadeSelect = document.getElementById('unidade-select');
    const editUnidadeBtn = document.getElementById('edit-unidade-btn');

    // Set default date to today
    document.getElementById('report-date').valueAsDate = new Date();

    const openModal = () => {
        const preDefinedUnidades = [
            'Asa Sul', 'Sudoeste', 'Lago Sul', 'Noroeste', 'Jardim Botânico',
            'Pontos de Ensino', 'Centro', 'Santa Mônica', 'Coqueiros', 'Dourados'
        ];
        const existingUnidades = [...new Set(allData.map(item => item.Unidade))];
        const allUnidades = [...new Set([...preDefinedUnidades, ...existingUnidades])].sort();

        unidadeSelect.innerHTML = '<option value="">Selecione a Unidade</option>';
        allUnidades.forEach(unidade => {
            const option = document.createElement('option');
            option.value = unidade;
            option.textContent = unidade;
            unidadeSelect.appendChild(option);
        });
        const novaUnidadeOption = document.createElement('option');
        novaUnidadeOption.value = 'nova';
        novaUnidadeOption.textContent = '--- Adicionar Nova Unidade ---';
        unidadeSelect.appendChild(novaUnidadeOption);

        document.getElementById('unidade-nova').classList.add('hidden');
        
        modal.classList.remove('hidden');
        document.body.classList.add('modal-active');
        setTimeout(() => {
            modal.querySelector('.modal-content').classList.remove('scale-95');
            modal.querySelector('.modal-content').classList.add('scale-100');
        }, 10);
    };

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-active');
        }, 250);
    };

    if (openBtn) {
        openBtn.addEventListener('click', openModal);
    }
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    unidadeSelect.addEventListener('change', () => {
        const isNova = unidadeSelect.value === 'nova';
        const isValidUnidade = unidadeSelect.value && !isNova;
        document.getElementById('unidade-nova').classList.toggle('hidden', !isNova);
        editUnidadeBtn.classList.toggle('hidden', !(currentUserIsAdmin && isValidUnidade));
    });

    editUnidadeBtn.addEventListener('click', handleEditUnidade);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dateValue = document.getElementById('report-date').value;
        if (!dateValue) {
            showNotification('Por favor, selecione uma data.', true);
            return;
        }
        const reportDate = new Date(dateValue + 'T12:00:00'); // Use noon to avoid timezone issues
        
        let unidade = unidadeSelect.value;
        if (unidade === 'nova') {
            unidade = document.getElementById('unidade-nova').value.trim();
            if (!unidade) {
                showNotification('Por favor, insira o nome da nova unidade.', true);
                return;
            }
        }

        const newData = {
            "Data": dateValue,
            "Unidade": unidade,
            "Ano": reportDate.getFullYear(),
            "Mês": reportDate.toLocaleString('pt-BR', { month: 'long' }),
            "AulasIntro": parseInt(document.getElementById('aulas-intro').value) || 0,
            "Matriculas": parseInt(document.getElementById('matriculas').value) || 0,
            "ContratosAtivos": parseInt(document.getElementById('contratos-ativos').value) || 0,
            "Ativos": parseInt(document.getElementById('alunos-ativos').value) || 0,
            "Renovacoes": parseInt(document.getElementById('renovacoes').value) || 0,
            "Retornos": parseInt(document.getElementById('retornos').value) || 0,
            "Leads": parseInt(document.getElementById('leads').value) || 0,
            "Baixas": parseInt(document.getElementById('baixas').value) || 0,
            "AcoesDivulgacao": document.getElementById('acoes-divulgacao').value || ""
        };

        try {
            // Check if a doc for this date and unit already exists to update it
            const q = query(collection(db, 'analise_unidades'), where("Data", "==", dateValue), where("Unidade", "==", unidade));
            const existingDocs = await getDocs(q);

            if (!existingDocs.empty) {
                const docId = existingDocs.docs[0].id;
                await updateDoc(doc(db, 'analise_unidades', docId), newData);
                showNotification('Dados do dia atualizados com sucesso!');
            } else {
                await addDoc(collection(db, 'analise_unidades'), newData);
                showNotification('Dados salvos com sucesso!');
            }

            form.reset();
            document.getElementById('report-date').valueAsDate = new Date();
            closeModal();
            await fetchData(); // Refresh data
            populateFilters(allData);
            updateDashboard();
        } catch (error) {
            console.error("Erro ao salvar os dados: ", error);
            showNotification('Ocorreu um erro ao salvar os dados.', true);
        }
    });
}

function setupEditModal() {
    const modal = document.getElementById('editDataModal');
    const closeBtn = document.getElementById('closeEditModalBtn');
    const cancelBtn = document.getElementById('cancelEditModalBtn');
    const form = document.getElementById('editDataForm');

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-active');
        }, 250);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const docId = document.getElementById('edit-doc-id').value;
        if (!docId) {
            alert('Erro: ID do documento não encontrado.');
            return;
        }

        const reportDate = new Date(document.getElementById('edit-report-date').value + 'T00:00:00');
        const year = reportDate.getFullYear();
        const month = reportDate.toLocaleString('pt-BR', { month: 'long' });

        const updatedData = {
            "Data": document.getElementById('edit-report-date').value,
            "Unidade": document.getElementById('edit-unidade-select').value,
            "Ano": year,
            "Mês": month,
            "AulasIntro": parseInt(document.getElementById('edit-aulas-intro').value) || 0,
            "Matriculas": parseInt(document.getElementById('edit-matriculas').value) || 0,
            "ContratosAtivos": parseInt(document.getElementById('edit-contratos-ativos').value) || 0,
            "Ativos": parseInt(document.getElementById('edit-alunos-ativos').value) || 0,
            "Renovacoes": parseInt(document.getElementById('edit-renovacoes').value) || 0,
            "Retornos": parseInt(document.getElementById('edit-retornos').value) || 0,
            "Leads": parseInt(document.getElementById('edit-leads').value) || 0,
            "Baixas": parseInt(document.getElementById('edit-baixas').value) || 0,
            "AcoesDivulgacao": document.getElementById('edit-acoes-divulgacao').value || ""
        };

        try {
            const docRef = doc(db, 'analise_unidades', docId);
            await updateDoc(docRef, updatedData);
            alert('Dados atualizados com sucesso!');
            closeModal();
            await fetchData(); // Refresh data
            populateFilters(allData);
            updateDashboard();
        } catch (error) {
            console.error("Erro ao atualizar os dados: ", error);
            alert('Ocorreu um erro ao atualizar os dados.');
        }
    });
}

async function populateFilters(data) {
    const yearFilter = document.getElementById('year-filter');
    const locationFilter = document.getElementById('location-filter');
    const getEvoUnits = httpsCallable(functions, 'getEvoUnits');

    const currentYear = yearFilter.value;
    const currentLocation = locationFilter.value;
    
    locationFilter.innerHTML = '<option value="geral">Visão Geral (Todas as Unidades)</option>';
    yearFilter.innerHTML = '<option value="all">Todos os Anos</option>';
    
    const years = [...new Set(data.map(row => row.Ano))].sort((a, b) => b - a);
    
    try {
        const result = await getEvoUnits();
        const evoUnits = result.data.sort();
        
        evoUnits.forEach(unitId => {
            const option = document.createElement('option');
            option.value = unitId;
            // Formata o nome para exibição
            const displayName = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            option.textContent = `Unidade ${displayName}`;
            locationFilter.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao buscar unidades do EVO:", error);
    }

    years.forEach(year => {
        const yearOpt = document.createElement('option');
        yearOpt.value = year;
        yearOpt.textContent = year;
        yearFilter.appendChild(yearOpt);
    });

    if (Array.from(locationFilter.options).some(opt => opt.value === currentLocation)) {
        locationFilter.value = currentLocation;
    }
    if (Array.from(yearFilter.options).some(opt => opt.value == currentYear)) {
        yearFilter.value = currentYear;
    }
}

function updateDashboard() {
    const selectedLocation = document.getElementById('location-filter').value;
    const selectedYear = document.getElementById('year-filter').value;
    const viewBy = document.getElementById('view-by-filter').value;
    const selectedDate = document.getElementById('date-filter').value;
    const selectedWeek = document.getElementById('week-filter').value;
    const chartsContainer = document.getElementById('charts-container');
    const dataLogContainer = document.getElementById('data-log-container');
    const dataLogTitle = document.getElementById('data-log-title');

    let titleParts = ["Log de Dados"];
    if (selectedLocation !== 'geral') {
        titleParts.push(`Unidade ${selectedLocation}`);
    }
    if (selectedYear !== 'all') {
        titleParts.push(selectedYear);
    }
    if (viewBy === 'daily') {
        titleParts.push(new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR'));
    } else if (viewBy === 'weekly' && selectedWeek !== 'all') {
        titleParts.push(`Semana ${selectedWeek}`);
    }
    dataLogTitle.textContent = titleParts.join(' - ');

    let filteredData = allData;
    if (selectedLocation !== 'geral') {
        filteredData = filteredData.filter(d => d.Unidade === selectedLocation);
    }

    if (viewBy === 'daily') {
        chartsContainer.classList.add('hidden');
        const dailyData = filteredData.filter(d => d.Data === selectedDate);
        updateKPIs(dailyData, 'daily');
        updateCharts(dailyData, 'daily'); // Pass daily data to clear charts
        
        fullLogData = dailyData.sort((a, b) => new Date(b.Data) - new Date(a.Data));
        renderedLogCount = 0;
        document.getElementById('data-log-body').innerHTML = '';
        renderMoreLogItems();
    } else {
        chartsContainer.classList.remove('hidden');
        if (selectedYear !== 'all') {
            filteredData = filteredData.filter(d => d.Ano == selectedYear);
        }

        if (viewBy === 'weekly' && selectedWeek !== 'all') {
            filteredData = filteredData.filter(d => {
                const date = new Date(d.Data + 'T00:00:00');
                return getWeekNumber(date) == selectedWeek;
            });
        }
        
        if (filteredData.length === 0) {
            document.getElementById('kpi-container').innerHTML = ``;
            updateCharts([], viewBy); // Clear charts
            fullLogData = [];
            renderedLogCount = 0;
            document.getElementById('data-log-body').innerHTML = '';
            renderMoreLogItems(); // Will show "Nenhum registro"
            return;
        }

        updateKPIs(filteredData, viewBy);
        updateCharts(filteredData, viewBy);
        
        fullLogData = filteredData.sort((a, b) => new Date(b.Data) - new Date(a.Data));
        renderedLogCount = 0;
        document.getElementById('data-log-body').innerHTML = '';
        renderMoreLogItems();
    }
}

function renderMoreLogItems() {
    const logBody = document.getElementById('data-log-body');
    const loadMoreContainer = document.getElementById('load-more-container');

    const startIndex = renderedLogCount;
    const endIndex = startIndex + LOG_PAGE_SIZE;
    const dataToRender = fullLogData.slice(startIndex, endIndex);

    if (startIndex === 0 && dataToRender.length === 0) {
        logBody.innerHTML = `<div class="text-center p-4 text-gray-500 md:col-span-5">Nenhum registro encontrado.</div>`;
        loadMoreContainer.classList.add('hidden');
        return;
    }

    dataToRender.forEach(item => {
        const itemElement = document.createElement('div');
        // Add a class to prevent re-adding listeners
        itemElement.className = 'log-item cursor-pointer bg-[#2a2a2a] md:bg-transparent p-4 rounded-lg md:p-0 md:grid md:grid-cols-5 md:gap-4 md:px-6 md:py-4 md:border-b md:border-gray-700 hover:bg-[#3a3a3a]';
        itemElement.setAttribute('data-id', item.id);
        
        const displayDate = new Date(item.Data + 'T00:00:00').toLocaleDateString('pt-BR');

        itemElement.innerHTML = `
            <div class="hidden md:flex items-center text-sm text-gray-300">${displayDate}</div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Unidade}</div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Matriculas || 0}</div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Baixas || 0}</div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Ativos || 0}</div>
            <!-- Mobile view -->
            <div class="flex justify-between md:hidden"><span class="font-bold text-gray-400">Data:</span><span class="text-gray-300">${displayDate}</span></div>
            <div class="flex justify-between md:hidden mt-2"><span class="font-bold text-gray-400">Unidade:</span><span class="text-gray-300">${item.Unidade}</span></div>
            <div class="flex justify-between md:hidden mt-2"><span class="font-bold text-gray-400">Matrículas:</span><span class="text-gray-300">${item.Matriculas || 0}</span></div>
            <div class="flex justify-between md:hidden mt-2"><span class="font-bold text-gray-400">Baixas:</span><span class="text-gray-300">${item.Baixas || 0}</span></div>
            <div class="flex justify-between md:hidden mt-2"><span class="font-bold text-gray-400">Ativos:</span><span class="text-gray-300">${item.Ativos || 0}</span></div>
        `;
        itemElement.addEventListener('click', handleView);
        logBody.appendChild(itemElement);
    });

    renderedLogCount += dataToRender.length;

    if (renderedLogCount < fullLogData.length) {
        loadMoreContainer.classList.remove('hidden');
    } else {
        loadMoreContainer.classList.add('hidden');
    }
}

function setupViewModal() {
    const modal = document.getElementById('viewDataModal');
    const closeBtn = document.getElementById('closeViewModalBtn');
    const editBtn = document.getElementById('editFromViewBtn');
    const deleteBtn = document.getElementById('deleteFromViewBtn');

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-active');
            currentViewingId = null;
        }, 250);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    editBtn.addEventListener('click', () => {
        if (currentViewingId) {
            closeModal();
            // Pass a mock event object to handleEdit
            handleEdit({ target: { getAttribute: () => currentViewingId } });
        }
    });

    deleteBtn.addEventListener('click', () => {
        if (currentViewingId) {
            // Don't close the view modal yet.
            const confirmationModal = document.getElementById('confirmationModal');
            confirmationModal.classList.remove('hidden');
            setTimeout(() => {
                confirmationModal.querySelector('.modal-content').classList.remove('scale-95');
                confirmationModal.querySelector('.modal-content').classList.add('scale-100');
            }, 10);
        }
    });
}

function handleView(event) {
    const docId = event.currentTarget.getAttribute('data-id');
    const dataEntry = allData.find(item => item.id === docId);
    if (!dataEntry) {
        alert('Erro: Registro não encontrado.');
        return;
    }

    currentViewingId = docId;
    const modal = document.getElementById('viewDataModal');
    const modalBody = document.getElementById('view-modal-body');
    const deleteButton = document.getElementById('deleteFromViewBtn');

    // Controla a visibilidade do botão de exclusão
    if (currentUserIsAdmin) {
        deleteButton.style.display = 'block';
    } else {
        deleteButton.style.display = 'none';
    }

    const displayDate = new Date(dataEntry.Data + 'T00:00:00').toLocaleDateString('pt-BR');

    modalBody.innerHTML = `
        <p><strong>Data:</strong> ${displayDate}</p>
        <p><strong>Unidade:</strong> ${dataEntry.Unidade}</p>
        <hr class="border-gray-600 my-2">
        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <p><strong>Aulas Intro:</strong></p><p>${dataEntry.AulasIntro || 0}</p>
            <p><strong>Matrículas:</strong></p><p>${dataEntry.Matriculas || 0}</p>
            <p><strong>Contratos Ativos:</strong></p><p>${dataEntry.ContratosAtivos || 0}</p>
            <p><strong>Alunos Ativos:</strong></p><p>${dataEntry.Ativos || 0}</p>
            <p><strong>Renovações:</strong></p><p>${dataEntry.Renovacoes || 0}</p>
            <p><strong>Retornos:</strong></p><p>${dataEntry.Retornos || 0}</p>
            <p><strong>Leads:</strong></p><p>${dataEntry.Leads || 0}</p>
            <p><strong>Baixas:</strong></p><p>${dataEntry.Baixas || 0}</p>
        </div>
        <hr class="border-gray-600 my-2">
        <p><strong>Ações de Divulgação:</strong></p>
        <p class="text-sm text-gray-400">${dataEntry.AcoesDivulgacao || 'Nenhuma ação descrita.'}</p>
    `;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-active');
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

async function handleEdit(event) {
    const docId = event.target.getAttribute('data-id');
    const dataEntry = allData.find(item => item.id === docId);
    if (!dataEntry) {
        alert('Erro: Registro não encontrado.');
        return;
    }

    // Populate and show the modal
    const modal = document.getElementById('editDataModal');
    document.getElementById('edit-doc-id').value = docId;
    document.getElementById('edit-report-date').value = dataEntry.Data;
    
    const unidadeSelect = document.getElementById('edit-unidade-select');
    const unidades = [...new Set(allData.map(item => item.Unidade))].sort();
    unidadeSelect.innerHTML = ''; // Clear previous options
    unidades.forEach(unidade => {
        const option = document.createElement('option');
        option.value = unidade;
        option.textContent = unidade;
        unidadeSelect.appendChild(option);
    });
    unidadeSelect.value = dataEntry.Unidade;

    document.getElementById('edit-aulas-intro').value = dataEntry.AulasIntro || 0;
    document.getElementById('edit-matriculas').value = dataEntry.Matriculas || 0;
    document.getElementById('edit-contratos-ativos').value = dataEntry.ContratosAtivos || 0;
    document.getElementById('edit-alunos-ativos').value = dataEntry.Ativos || 0;
    document.getElementById('edit-renovacoes').value = dataEntry.Renovacoes || 0;
    document.getElementById('edit-retornos').value = dataEntry.Retornos || 0;
    document.getElementById('edit-leads').value = dataEntry.Leads || 0;
    document.getElementById('edit-baixas').value = dataEntry.Baixas || 0;
    document.getElementById('edit-acoes-divulgacao').value = dataEntry.AcoesDivulgacao || "";

    modal.classList.remove('hidden');
    document.body.classList.add('modal-active');
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

function setupConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    const closeModal = () => {
        modal.querySelector('.modal-content').classList.remove('scale-100');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 250);
    };

    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        if (currentViewingId) {
            handleDelete(currentViewingId);
            closeModal();
            // Also close the view modal
            document.getElementById('closeViewModalBtn').click();
        }
    });
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('custom-notification');
    const notificationText = notification.querySelector('p');
    
    notificationText.textContent = message;
    notification.classList.remove('bg-green-500', 'bg-red-500');
    notification.classList.add(isError ? 'bg-red-500' : 'bg-green-500');

    notification.classList.remove('translate-x-[120%]');
    notification.classList.add('translate-x-0');

    setTimeout(() => {
        notification.classList.remove('translate-x-0');
        notification.classList.add('translate-x-[120%]');
    }, 3000);
}

async function handleDelete(docId) {
    if (!currentUserIsAdmin) {
        showNotification('Você não tem permissão para excluir registros.', true);
        return;
    }
    try {
        await deleteDoc(doc(db, 'analise_unidades', docId));
        showNotification('Registro excluído com sucesso!');
        await fetchData(); // Refresh data
        populateFilters(allData);
        updateDashboard();
    } catch (error) {
        console.error("Erro ao excluir o registro: ", error);
        showNotification('Ocorreu um erro ao excluir o registro.', true);
    }
}

function getMonthNumber(monthName) {
    const months = {
        "January": "01", "February": "02", "March": "03", "April": "04", "May": "05", "June": "06",
        "July": "07", "August": "08", "September": "09", "October": "10", "November": "11", "December": "12"
    };
    return months[monthName];
}

function processDataForView(data, viewBy) {
    const sortedData = data.sort((a, b) => new Date(a.Data) - new Date(b.Data));

    const aggregatePeriodData = (periodData) => {
        const latestDataPerUnit = {};
        periodData.forEach(row => {
            const existingEntry = latestDataPerUnit[row.Unidade];
            if (!existingEntry || (row.Ativos || 0) > (existingEntry.Ativos || 0)) {
                latestDataPerUnit[row.Unidade] = row;
            }
        });
        const latestDataArray = Object.values(latestDataPerUnit);

        const totalAtivos = latestDataArray.reduce((sum, row) => sum + (row.Ativos || 0), 0);
        const totalContratosAtivos = latestDataArray.reduce((sum, row) => sum + (row.ContratosAtivos || 0), 0);

        const totalMatriculas = periodData.reduce((sum, row) => sum + (row.Matriculas || 0), 0);
        const totalBaixas = periodData.reduce((sum, row) => sum + (row.Baixas || 0), 0);
        const totalRenovacoes = periodData.reduce((sum, row) => sum + (row.Renovacoes || 0), 0);

        return {
            Ativos: totalAtivos,
            ContratosAtivos: totalContratosAtivos,
            Matriculas: totalMatriculas,
            Baixas: totalBaixas,
            Renovacoes: totalRenovacoes
        };
    };

    if (viewBy === 'monthly') {
        const monthlyData = {};
        sortedData.forEach(row => {
            const key = `${row.Ano}-${row.Mês}`;
            if (!monthlyData[key]) monthlyData[key] = [];
            monthlyData[key].push(row);
        });

        const monthlyAggregated = Object.values(monthlyData).map(dataForMonth => {
            const aggregated = aggregatePeriodData(dataForMonth);
            const firstEntry = dataForMonth[0];
            return {
                Ano: firstEntry.Ano,
                Mês: firstEntry.Mês,
                Data: new Date(firstEntry.Ano, getMonthNumber(firstEntry.Mês) - 1, 28),
                ...aggregated
            };
        });
        return monthlyAggregated.sort((a, b) => a.Data - b.Data);
    }
    
    if (viewBy === 'weekly') {
        const weeklyData = {};
        sortedData.forEach(row => {
            const date = new Date(row.Data + 'T00:00:00');
            const week = getWeekNumber(date);
            const key = `${row.Ano}-W${week}`;
            if (!weeklyData[key]) weeklyData[key] = [];
            weeklyData[key].push(row);
        });

        const weeklyAggregated = Object.values(weeklyData).map(dataForWeek => {
            const aggregated = aggregatePeriodData(dataForWeek);
            const firstEntry = dataForWeek[0];
            const date = new Date(firstEntry.Data + 'T00:00:00');
            return {
                Ano: firstEntry.Ano,
                Mês: firstEntry.Mês,
                Semana: getWeekNumber(date),
                Data: date,
                ...aggregated
            };
        });
        return weeklyAggregated.sort((a, b) => a.Data - b.Data);
    }

    return sortedData;
}


function updateKPIs(data, viewBy) {
    const kpiContainer = document.getElementById('kpi-container');
    if (!data || data.length === 0) {
        kpiContainer.innerHTML = ``;
        return;
    }

    const sortedData = data.sort((a, b) => new Date(a.Data) - new Date(b.Data));

    // Flow metrics are always the sum over the period.
    const totalMatriculas = sortedData.reduce((sum, row) => sum + (row.Matriculas || 0), 0);
    const totalBaixas = sortedData.reduce((sum, row) => sum + (row.Baixas || 0), 0);
    const totalRenovacoes = sortedData.reduce((sum, row) => sum + (row.Renovacoes || 0), 0);

    let kpis = [];

    // Stock metrics (like Ativos/Contratos) need to be calculated based on the latest record for each unit.
    const latestDataPerUnit = {};
    sortedData.forEach(row => {
        const existingEntry = latestDataPerUnit[row.Unidade];
        // To get the most accurate stock value, we prefer the one with more 'Ativos', or the latest date as a tie-breaker.
        if (!existingEntry || 
            (row.Ativos || 0) > (existingEntry.Ativos || 0) ||
            ((row.Ativos || 0) === (existingEntry.Ativos || 0) && new Date(row.Data) >= new Date(existingEntry.Data))) 
        {
            latestDataPerUnit[row.Unidade] = row;
        }
    });
    const latestDataArray = Object.values(latestDataPerUnit);
    // O KPI de Contratos Ativos agora vem do EVO, então removemos a lógica daqui.
    // const totalContratos = latestDataArray.reduce((sum, row) => sum + (row.ContratosAtivos || 0), 0);

    if (viewBy === 'daily') {
        const totalAtivos = latestDataArray.reduce((sum, row) => sum + (row.Ativos || 0), 0);
        // const percentualAtivos = totalContratos > 0 ? (totalAtivos / totalContratos * 100).toFixed(1) : 0;
        const percentualAtivos = totalContratos > 0 ? (totalAtivos / totalContratos * 100).toFixed(1) : 0;
        
        kpis = [];
    } else { // For 'weekly' and 'monthly' views
        const totalAtivos = latestDataArray.reduce((sum, row) => sum + (row.Ativos || 0), 0);
        kpis = [];
    }
    
    kpiContainer.innerHTML = kpis.map(kpi => `
        <div class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
            <div class="text-3xl mr-4">${kpi.icon}</div>
            <div>
                <p class="text-gray-400 text-sm">${kpi.label}</p>
                <p class="text-2xl font-bold text-white">${kpi.value}</p>
            </div>
        </div>
    `).join('');
}

function updateCharts(data, viewBy) {
    // Don't render charts for daily view or if data is empty
    if (viewBy === 'daily' || !data || data.length === 0) {
        Object.values(charts).forEach(chart => { if(chart) chart.destroy(); });
        charts = {};
        return;
    }

    const processedData = processDataForView(data, viewBy);

    const labels = processedData.map(row => {
        if (viewBy === 'weekly') {
            return `S${row.Semana}/${String(row.Ano).slice(-2)}`;
        }
        return `${row.Mês.substring(0, 3)}/${String(row.Ano).slice(-2)}`;
    });

    const textColor = '#E5E7EB';
    const gridColor = 'rgba(255, 255, 255, 0.1)';
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
        }
    };

    // Active Students Chart
    if (charts.activeStudents) charts.activeStudents.destroy();
    charts.activeStudents = new Chart(document.getElementById('activeStudentsChart'), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Alunos Ativos', data: processedData.map(row => row.Ativos), borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 }] },
        options: chartOptions
    });

    // Contracts Chart (EVO)
    const selectedUnit = document.getElementById('location-filter').value;
    getContractsEvolution({ unitId: selectedUnit }).then(result => {
        const { labels, data } = result.data;
        if (charts.contracts) charts.contracts.destroy();
        charts.contracts = new Chart(document.getElementById('contractsChart'), {
            type: 'line',
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: 'Contratos Ativos (EVO)', 
                    data: data, 
                    borderColor: '#A78BFA', 
                    backgroundColor: 'rgba(167, 139, 250, 0.1)', 
                    fill: true, 
                    tension: 0.3 
                }] 
            },
            options: chartOptions
        });
    }).catch(error => {
        console.error("Erro ao buscar evolução de contratos:", error);
        // Opcional: Mostrar uma mensagem de erro no lugar do gráfico
    });

    // The composition chart container is already removed from HTML.
}

async function handleEditUnidade() {
    const unidadeSelect = document.getElementById('unidade-select');
    const oldUnidadeName = unidadeSelect.value;

    if (!oldUnidadeName) {
        showNotification('Selecione uma unidade válida para editar.', true);
        return;
    }

    const newUnidadeName = prompt(`Digite o novo nome para a unidade "${oldUnidadeName}":`, oldUnidadeName);

    if (newUnidadeName && newUnidadeName.trim() !== '' && newUnidadeName.trim() !== oldUnidadeName) {
        const trimmedNewName = newUnidadeName.trim();
        
        if (!confirm(`Tem certeza que deseja renomear "${oldUnidadeName}" para "${trimmedNewName}"? Isso atualizará TODOS os registros existentes.`)) {
            return;
        }

        try {
            showNotification('Renomeando unidade...');
            
            const dataCollection = collection(db, 'analise_unidades');
            const q = query(dataCollection, where("Unidade", "==", oldUnidadeName));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showNotification('Nenhum registro encontrado para a unidade selecionada.', true);
                return;
            }

            const batch = writeBatch(db);
            querySnapshot.forEach((doc) => {
                batch.update(doc.ref, { "Unidade": trimmedNewName });
            });
            await batch.commit();

            showNotification('Unidade renomeada com sucesso!');
            
            // Atualizar dados e UI
            await fetchData();
            populateFilters(allData);
            updateDashboard();

            // Re-popular o select no modal e manter o novo nome selecionado
            const unidades = [...new Set(allData.map(item => item.Unidade))].sort();
            unidadeSelect.innerHTML = '<option value="">Selecione a Unidade</option>';
            unidades.forEach(unidade => {
                const option = document.createElement('option');
                option.value = unidade;
                option.textContent = unidade;
                unidadeSelect.appendChild(option);
            });
            const novaUnidadeOption = document.createElement('option');
            novaUnidadeOption.value = 'nova';
            novaUnidadeOption.textContent = '--- Adicionar Nova Unidade ---';
            unidadeSelect.appendChild(novaUnidadeOption);
            
            unidadeSelect.value = trimmedNewName;
            unidadeSelect.dispatchEvent(new Event('change')); // Trigger change to update button visibility

        } catch (error) {
            console.error("Erro ao renomear unidade: ", error);
            showNotification('Ocorreu um erro ao renomear a unidade.', true);
        }
    }
}

async function displayEvoKpi() {
    const kpiContainer = document.getElementById('kpi-container');
    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter.value;
    const getActiveContractsCount = httpsCallable(functions, 'getActiveContractsCount');

    // Remove o card antigo, se existir
    const oldCard = document.getElementById('evo-kpi-card');
    if (oldCard) {
        oldCard.remove();
    }

    // Adiciona um placeholder de carregamento
    const placeholderHtml = `
        <div id="evo-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center animate-pulse">
            <div class="text-3xl mr-4">🔄</div>
            <div>
                <p class="text-gray-400 text-sm">Contratos Ativos (EVO)</p>
                <p class="text-2xl font-bold text-white">...</p>
            </div>
        </div>`;
    kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

    try {
        const result = await getActiveContractsCount({ unitId: selectedUnit });
        const counts = result.data;
        
        let label;
        let value;

        if (selectedUnit && selectedUnit !== 'geral') {
            // Formata o nome da unidade para exibição
            const displayName = selectedUnit.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            label = `Contratos Ativos (${displayName})`;
            value = counts[selectedUnit] !== undefined ? counts[selectedUnit] : 0;
        } else {
            label = "Total de Contratos Ativos (EVO)";
            value = counts.totalGeral !== undefined ? counts.totalGeral : 0;
        }
        
        const finalHtml = `
            <div id="evo-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">📝</div>
                <div>
                    <p class="text-gray-400 text-sm">${label}</p>
                    <p class="text-2xl font-bold text-white">${value.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;
        
        const placeholderCard = document.getElementById('evo-kpi-card');
        if (placeholderCard) {
            placeholderCard.outerHTML = finalHtml;
        }

    } catch (error) {
        console.error("Erro ao carregar KPIs da EVO:", error);
        const errorHtml = `
            <div id="evo-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">⚠️</div>
                <div>
                    <p class="text-gray-400 text-sm">Contratos Ativos (EVO)</p>
                    <p class="text-xl font-bold text-red-500">Erro</p>
                </div>
            </div>
        `;
        const placeholderCard = document.getElementById('evo-kpi-card');
        if (placeholderCard) {
            placeholderCard.outerHTML = errorHtml;
        }
    }
}

async function displayDailyEntriesKpi() {
    const kpiContainer = document.getElementById('kpi-container');
    const locationFilter = document.getElementById('location-filter');
    const selectedUnit = locationFilter.value;

    // Remove o card antigo, se existir
    const oldCard = document.getElementById('daily-entries-kpi-card');
    if (oldCard) {
        oldCard.remove();
    }

    if (selectedUnit === 'geral') {
        const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
        const placeholderHtml = `
        <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center animate-pulse">
            <div class="text-3xl mr-4">🏃</div>
            <div>
                <p class="text-gray-400 text-sm">Total Alunos Ativos (Hoje)</p>
                <p class="text-2xl font-bold text-white">...</p>
            </div>
        </div>`;
        kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

        try {
            const result = await getEvoUnits();
            const evoUnits = result.data;
            const today = new Date().toISOString().split('T')[0];
            let totalAtivosHoje = 0;

            const promises = evoUnits.map(unitId => getDailyEntries({ unitId: unitId, date: today }));
            const results = await Promise.all(promises);

            results.forEach(result => {
                totalAtivosHoje += result.data.uniqueMembersCount;
            });

            const finalHtml = `
                <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                    <div class="text-3xl mr-4">🏃</div>
                    <div>
                        <p class="text-gray-400 text-sm">Total Alunos Ativos (Hoje)</p>
                        <p class="text-2xl font-bold text-white">${totalAtivosHoje.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            `;
            const placeholderCard = document.getElementById('daily-entries-kpi-card');
            if (placeholderCard) {
                placeholderCard.outerHTML = finalHtml;
            }

        } catch (error) {
            console.error("Erro ao carregar KPI de entradas diárias total:", error);
            const errorHtml = `
                <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                    <div class="text-3xl mr-4">⚠️</div>
                    <div>
                        <p class="text-gray-400 text-sm">Total Alunos Ativos (Hoje)</p>
                        <p class="text-xl font-bold text-red-500">Erro</p>
                    </div>
                </div>
            `;
            const placeholderCard = document.getElementById('daily-entries-kpi-card');
            if (placeholderCard) {
                placeholderCard.outerHTML = errorHtml;
            }
        }
        return;
    }

    // Adiciona um placeholder de carregamento
    const placeholderHtml = `
        <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center animate-pulse">
            <div class="text-3xl mr-4">🏃</div>
            <div>
                <p class="text-gray-400 text-sm">Alunos Ativos (Hoje)</p>
                <p class="text-2xl font-bold text-white">...</p>
            </div>
        </div>`;
    kpiContainer.insertAdjacentHTML('beforeend', placeholderHtml);

    try {
        const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const result = await getDailyEntries({ unitId: selectedUnit, date: today });
        const { uniqueMembersCount } = result.data;
        
        const finalHtml = `
            <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">🏃</div>
                <div>
                    <p class="text-gray-400 text-sm">Alunos Ativos (Hoje)</p>
                    <p class="text-2xl font-bold text-white">${uniqueMembersCount.toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;
        
        const placeholderCard = document.getElementById('daily-entries-kpi-card');
        if (placeholderCard) {
            placeholderCard.outerHTML = finalHtml;
        }

    } catch (error) {
        console.error("Erro ao carregar KPI de entradas diárias:", error);
        const errorHtml = `
            <div id="daily-entries-kpi-card" class="kpi-card bg-[#1a1a1a] p-4 rounded-xl shadow-md flex items-center">
                <div class="text-3xl mr-4">⚠️</div>
                <div>
                    <p class="text-gray-400 text-sm">Alunos Ativos (Hoje)</p>
                    <p class="text-xl font-bold text-red-500">Erro</p>
                </div>
            </div>
        `;
        const placeholderCard = document.getElementById('daily-entries-kpi-card');
        if (placeholderCard) {
            placeholderCard.outerHTML = errorHtml;
        }
    }
}
