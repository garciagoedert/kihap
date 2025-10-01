import { app, db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents, setupUIListeners } from './common-ui.js';

let allData = [];
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    loadComponents(initializeDashboard);
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

    // Set default date for date filter
    dateFilter.valueAsDate = new Date();
    
    locationFilter.addEventListener('change', updateDashboard);
    yearFilter.addEventListener('change', updateDashboard);
    dateFilter.addEventListener('change', updateDashboard);
    viewByFilter.addEventListener('change', () => {
        if (viewByFilter.value === 'daily') {
            dateFilter.classList.remove('hidden');
            yearFilter.classList.add('hidden');
        } else {
            dateFilter.classList.add('hidden');
            yearFilter.classList.remove('hidden');
        }
        updateDashboard();
    });

    setupModal();
    updateDashboard();
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
            "Ligacoes": parseInt(document.getElementById('ligacoes').value) || 0,
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
    const chartsContainer = document.getElementById('charts-container');

    let baseData = allData;
    if (selectedLocation !== 'geral') {
        baseData = baseData.filter(d => d.Unidade === selectedLocation);
    }

    if (viewBy === 'daily') {
        chartsContainer.classList.add('hidden');
        const dailyData = baseData.filter(d => d.Data === selectedDate);
        updateKPIs(dailyData, 'daily');
        updateCharts(dailyData, 'daily'); // Pass daily data to clear charts
    } else {
        chartsContainer.classList.remove('hidden');
        let dataForCharts = baseData;
        if (selectedYear !== 'all') {
            dataForCharts = dataForCharts.filter(d => d.Ano == selectedYear);
        }
        
        if (dataForCharts.length === 0) {
            document.getElementById('kpi-container').innerHTML = `<div class="col-span-full text-center p-8 text-gray-500">Nenhum dado encontrado para a seleção atual.</div>`;
            updateCharts([], viewBy); // Clear charts
            return;
        }

        updateKPIs(dataForCharts, viewBy);
        updateCharts(dataForCharts, viewBy);
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
    if (viewBy === 'monthly') {
        const monthlyAggregated = {};
        data.forEach(row => {
            const key = `${row.Ano}-${row.Mês}`;
            if (!monthlyAggregated[key]) {
                monthlyAggregated[key] = { 
                    Ano: row.Ano, 
                    Mês: row.Mês, 
                    Data: new Date(row.Ano, getMonthNumber(row.Mês)-1, 28), 
                    Matriculas: 0, 
                    Baixas: 0, 
                    Renovacoes: 0,
                    Ativos: 0 // We'll take the last value
                };
            }
            monthlyAggregated[key].Matriculas += row.Matriculas || 0;
            monthlyAggregated[key].Baixas += row.Baixas || 0;
            monthlyAggregated[key].Renovacoes += row.Renovacoes || 0;
            monthlyAggregated[key].Ativos = row.Ativos; // Overwrite with the latest value for the month
        });
        return Object.values(monthlyAggregated).sort((a, b) => a.Data - b.Data);
    }
    // For weekly view, we can implement aggregation later if needed.
    // For now, just return the raw data sorted by date.
    return data.sort((a, b) => new Date(a.Data) - new Date(b.Data));
}


function updateKPIs(data, viewBy) {
    const kpiContainer = document.getElementById('kpi-container');
    let kpiData = {};

    if (viewBy === 'daily') {
        // For daily, we sum up all entries for that day (in case of multiple reports for the same day)
        kpiData = {
            ativos: data.reduce((sum, row) => sum + (row.Ativos || 0), 0),
            matriculas: data.reduce((sum, row) => sum + (row.Matriculas || 0), 0),
            baixas: data.reduce((sum, row) => sum + (row.Baixas || 0), 0),
            saldo: data.reduce((sum, row) => sum + (row.Matriculas || 0) - (row.Baixas || 0), 0)
        };
    } else { // monthly or weekly
        const latestData = data.length > 0 ? data[data.length - 1] : {};
        kpiData = {
            ativos: latestData.Ativos || 0, // Show the last known 'Ativos' for the period
            matriculas: data.reduce((sum, row) => sum + (row.Matriculas || 0), 0),
            baixas: data.reduce((sum, row) => sum + (row.Baixas || 0), 0),
            saldo: data.reduce((sum, row) => sum + (row.Matriculas || 0), 0) - data.reduce((sum, row) => sum + (row.Baixas || 0), 0)
        };
    }

    const kpis = [
        { label: 'Alunos Ativos', value: kpiData.ativos.toLocaleString('pt-BR'), icon: '👤' },
        { label: 'Matrículas', value: kpiData.matriculas.toLocaleString('pt-BR'), icon: '📈' },
        { label: 'Baixas', value: kpiData.baixas.toLocaleString('pt-BR'), icon: '📉' },
        { label: 'Saldo', value: kpiData.saldo.toLocaleString('pt-BR'), icon: '⚖️' }
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
            // Assuming 'Data' is in 'YYYY-MM-DD' format
            const date = new Date(row.Data + 'T00:00:00');
            const weekNumber = Math.ceil(date.getDate() / 7);
            return `S${weekNumber}/${row.Mês.substring(0, 3)}`;
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

    // The composition chart container is already removed from HTML.
}
