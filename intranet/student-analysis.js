import { app, db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(user => {
        if (user) {
            checkAdminStatus(user).then(isAdmin => {
                currentUserIsAdmin = isAdmin;
                loadComponents(initializeDashboard);
            });
        } else {
            // Se não houver usuário, apenas carregue o dashboard com permissões limitadas
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
    dateFilter.addEventListener('change', updateDashboard);
    weekFilter.addEventListener('change', updateDashboard);
    viewByFilter.addEventListener('change', () => {
        if (viewByFilter.value === 'daily') {
            dateFilter.classList.remove('hidden');
            yearFilter.classList.add('hidden');
            weekFilter.classList.add('hidden');
        } else if (viewByFilter.value === 'weekly') {
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

    setupModal();
    setupEditModal();
    setupViewModal();
    setupConfirmationModal();
    updateDashboard();
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

    // Set default date to today
    document.getElementById('report-date').valueAsDate = new Date();

    const openModal = () => {
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

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    unidadeSelect.addEventListener('change', () => {
        if (unidadeSelect.value === 'nova') {
            document.getElementById('unidade-nova').classList.remove('hidden');
        } else {
            document.getElementById('unidade-nova').classList.add('hidden');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const reportDate = new Date(document.getElementById('report-date').value + 'T00:00:00'); // Treat date as local
        const year = reportDate.getFullYear();
        const month = reportDate.toLocaleString('pt-BR', { month: 'long' });
        
        let unidade = unidadeSelect.value;
        if (unidade === 'nova') {
            unidade = document.getElementById('unidade-nova').value.trim();
            if (!unidade) {
                alert('Por favor, insira o nome da nova unidade.');
                return;
            }
        }

        const newData = {
            "Data": document.getElementById('report-date').value,
            "Unidade": unidade,
            "Ano": year,
            "Mês": month,
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
            await addDoc(collection(db, 'analise_unidades'), newData);
            alert('Dados salvos com sucesso!');
            form.reset();
            document.getElementById('report-date').valueAsDate = new Date();
            closeModal();
            await fetchData(); // Refresh data
            populateFilters(allData);
            updateDashboard();
        } catch (error) {
            console.error("Erro ao salvar os dados: ", error);
            alert('Ocorreu um erro ao salvar os dados.');
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

function populateFilters(data) {
    const yearFilter = document.getElementById('year-filter');
    const locationFilter = document.getElementById('location-filter');

    const currentYear = yearFilter.value;
    const currentLocation = locationFilter.value;
    
    locationFilter.innerHTML = '<option value="geral">Visão Geral (Todas as Unidades)</option>';
    yearFilter.innerHTML = '<option value="all">Todos os Anos</option>';
    
    const years = [...new Set(data.map(row => row.Ano))].sort((a, b) => b - a);
    const locations = [...new Set(data.map(row => row.Unidade))].sort();
    
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = `Unidade ${location}`;
        locationFilter.appendChild(option);
    });

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
        renderDataLog(dailyData);
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
            document.getElementById('kpi-container').innerHTML = `<div class="col-span-full text-center p-8 text-gray-500">Nenhum dado encontrado para a seleção atual.</div>`;
            updateCharts([], viewBy); // Clear charts
            renderDataLog([]); // Clear log
            return;
        }

        updateKPIs(filteredData, viewBy);
        updateCharts(filteredData, viewBy);
        renderDataLog(filteredData);
    }
}

function renderDataLog(data) {
    const logBody = document.getElementById('data-log-body');
    if (!logBody) return;

    logBody.innerHTML = ''; // Clear existing content

    const sortedData = data.sort((a, b) => new Date(b.Data) - new Date(a.Data));

    if (sortedData.length === 0) {
        logBody.innerHTML = `<div class="text-center p-4 text-gray-500 md:col-span-5">Nenhum registro encontrado.</div>`;
        return;
    }

    sortedData.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'log-item cursor-pointer bg-[#2a2a2a] md:bg-transparent p-4 rounded-lg md:p-0 md:grid md:grid-cols-5 md:gap-4 md:px-6 md:py-4 md:border-b md:border-gray-700 hover:bg-[#3a3a3a]';
        itemElement.setAttribute('data-id', item.id);
        
        const displayDate = new Date(item.Data + 'T00:00:00').toLocaleDateString('pt-BR');

        itemElement.innerHTML = `
            <!-- Mobile view: Label + Value -->
            <div class="flex justify-between md:hidden">
                <span class="font-bold text-gray-400">Data:</span>
                <span class="text-gray-300">${displayDate}</span>
            </div>
            <!-- Desktop view: Just value -->
            <div class="hidden md:flex items-center text-sm text-gray-300">${displayDate}</div>

            <div class="flex justify-between md:hidden mt-2">
                <span class="font-bold text-gray-400">Unidade:</span>
                <span class="text-gray-300">${item.Unidade}</span>
            </div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Unidade}</div>

            <div class="flex justify-between md:hidden mt-2">
                <span class="font-bold text-gray-400">Matrículas:</span>
                <span class="text-gray-300">${item.Matriculas || 0}</span>
            </div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Matriculas || 0}</div>

            <div class="flex justify-between md:hidden mt-2">
                <span class="font-bold text-gray-400">Baixas:</span>
                <span class="text-gray-300">${item.Baixas || 0}</span>
            </div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Baixas || 0}</div>

            <div class="flex justify-between md:hidden mt-2">
                <span class="font-bold text-gray-400">Ativos:</span>
                <span class="text-gray-300">${item.Ativos || 0}</span>
            </div>
            <div class="hidden md:flex items-center text-sm text-gray-300">${item.Ativos || 0}</div>
        `;
        logBody.appendChild(itemElement);
    });

    // Add event listeners for the new log items
    logBody.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', handleView);
    });
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

    if (viewBy === 'monthly') {
        const monthlyAggregated = {};
        sortedData.forEach(row => {
            const key = `${row.Ano}-${row.Mês}`;
            if (!monthlyAggregated[key]) {
                monthlyAggregated[key] = { 
                    Ano: row.Ano, 
                    Mês: row.Mês, 
                    Data: new Date(row.Ano, getMonthNumber(row.Mês)-1, 28), 
                    Matriculas: 0, 
                    Baixas: 0, 
                    Renovacoes: 0,
                    Ativos: 0,
                    ContratosAtivos: 0
                };
            }
            monthlyAggregated[key].Matriculas += row.Matriculas || 0;
            monthlyAggregated[key].Baixas += row.Baixas || 0;
            monthlyAggregated[key].Renovacoes += row.Renovacoes || 0;
            monthlyAggregated[key].Ativos = row.Ativos; // Overwrite with the latest value for the month
            monthlyAggregated[key].ContratosAtivos = row.ContratosAtivos; // Overwrite with the latest value
        });
        return Object.values(monthlyAggregated).sort((a, b) => a.Data - b.Data);
    }
    
    if (viewBy === 'weekly') {
        const weeklyAggregated = {};
        sortedData.forEach(row => {
            const date = new Date(row.Data + 'T00:00:00');
            const week = getWeekNumber(date);
            const key = `${row.Ano}-W${week}`;

            if (!weeklyAggregated[key]) {
                weeklyAggregated[key] = {
                    Ano: row.Ano,
                    Mês: row.Mês,
                    Semana: week,
                    Data: date,
                    Matriculas: 0,
                    Baixas: 0,
                    Renovacoes: 0,
                    Ativos: 0,
                    ContratosAtivos: 0
                };
            }
            weeklyAggregated[key].Matriculas += row.Matriculas || 0;
            weeklyAggregated[key].Baixas += row.Baixas || 0;
            weeklyAggregated[key].Renovacoes += row.Renovacoes || 0;
            weeklyAggregated[key].Ativos = row.Ativos; // Overwrite with the latest value for the week
            weeklyAggregated[key].ContratosAtivos = row.ContratosAtivos; // Overwrite with the latest value
        });
        return Object.values(weeklyAggregated).sort((a, b) => a.Data - b.Data);
    }

    return sortedData;
}


function updateKPIs(data, viewBy) {
    const kpiContainer = document.getElementById('kpi-container');
    if (!data || data.length === 0) {
        kpiContainer.innerHTML = `<div class="col-span-full text-center p-8 text-gray-500">Nenhum dado de KPI para a seleção atual.</div>`;
        return;
    }

    // Always sort data by date to find the latest records
    const sortedData = data.sort((a, b) => new Date(a.Data) - new Date(b.Data));

    // For stock metrics like Ativos and ContratosAtivos, we find the record with the highest value for each unit in the period.
    // This prevents issues with multiple entries on the same day (e.g., one correct, one with 0).
    const latestDataPerUnit = {};
    sortedData.forEach(row => {
        const existingEntry = latestDataPerUnit[row.Unidade];
        // If there's no entry for the unit, or the current row has more 'Ativos', update it.
        if (!existingEntry || (row.Ativos || 0) > (existingEntry.Ativos || 0)) {
            latestDataPerUnit[row.Unidade] = row;
        }
    });

    const latestDataArray = Object.values(latestDataPerUnit);
    
    const totalAtivos = latestDataArray.reduce((sum, row) => sum + (row.Ativos || 0), 0);
    const totalContratos = latestDataArray.reduce((sum, row) => sum + (row.ContratosAtivos || 0), 0);

    // For flow metrics like Matriculas and Baixas, we sum up all occurrences in the period.
    const totalMatriculas = sortedData.reduce((sum, row) => sum + (row.Matriculas || 0), 0);
    const totalBaixas = sortedData.reduce((sum, row) => sum + (row.Baixas || 0), 0);

    const kpiData = {
        ativos: totalAtivos,
        contratos: totalContratos,
        percentualAtivos: totalContratos > 0 ? (totalAtivos / totalContratos * 100).toFixed(1) : 0,
        matriculas: totalMatriculas,
        baixas: totalBaixas,
        saldo: totalMatriculas - totalBaixas
    };

    const kpis = [
        { label: 'Alunos Ativos', value: kpiData.ativos.toLocaleString('pt-BR'), icon: '👤' },
        { label: '% de Ativos', value: `${kpiData.percentualAtivos}%`, icon: '📊' },
        { label: 'Matrículas', value: kpiData.matriculas.toLocaleString('pt-BR'), icon: '📈' },
        { label: 'Baixas', value: kpiData.baixas.toLocaleString('pt-BR'), icon: '📉' }
    ];
    
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

    // New vs Churn Chart
    if (charts.newVsChurn) charts.newVsChurn.destroy();
    charts.newVsChurn = new Chart(document.getElementById('newVsChurnChart'), {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Matrículas', data: processedData.map(row => row.Matriculas), backgroundColor: '#10B981' },
            { label: 'Baixas', data: processedData.map(row => row.Baixas), backgroundColor: '#EF4444' }
        ]},
        options: chartOptions
    });

    // Balance Chart
    if (charts.balance) charts.balance.destroy();
    const balanceData = processedData.map(row => (row.Matriculas || 0) - (row.Baixas || 0));
    charts.balance = new Chart(document.getElementById('balanceChart'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Saldo Mensal', data: balanceData, backgroundColor: balanceData.map(v => v >= 0 ? '#10B981' : '#EF4444') }] },
        options: chartOptions
    });

    // Renewals Chart
    if (charts.renewals) charts.renewals.destroy();
    charts.renewals = new Chart(document.getElementById('renewalsChart'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Renovações', data: processedData.map(row => row.Renovacoes), backgroundColor: '#8B5CF6' }] },
        options: chartOptions
    });

    // Contracts Chart
    if (charts.contracts) charts.contracts.destroy();
    charts.contracts = new Chart(document.getElementById('contractsChart'), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Contratos Ativos', data: processedData.map(row => row.ContratosAtivos), borderColor: '#A78BFA', backgroundColor: 'rgba(167, 139, 250, 0.1)', fill: true, tension: 0.3 }] },
        options: chartOptions
    });

    // The composition chart container is already removed from HTML.
}
