import { app, db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady, checkAdminStatus } from './auth.js';

const getEvoUnits = httpsCallable(functions, 'getEvoUnits');

// Estado Global da Página
let type = 'contracts'; // 'contracts', 'students', ou 'store'
let rawData = []; // Coleção crua de dados vinda do Firebase (snapshots ou vendas)
let allUnits = []; // Lista de IDs de todas as unidades
let activeChart = null; // Instância ativa do Chart.js
let isAdmin = false;

// Paleta de cores premium para os datasets de comparação de unidades
const colorPalette = [
    { border: 'rgba(59, 130, 246, 1)', bg: 'rgba(59, 130, 246, 0.15)' }, // Azul
    { border: 'rgba(16, 185, 129, 1)', bg: 'rgba(16, 185, 129, 0.15)' }, // Verde
    { border: 'rgba(245, 158, 11, 1)', bg: 'rgba(245, 158, 11, 0.15)' }, // Amarelo/Laranja
    { border: 'rgba(139, 92, 246, 1)', bg: 'rgba(139, 92, 246, 0.15)' }, // Roxo
    { border: 'rgba(239, 68, 68, 1)', bg: 'rgba(239, 68, 68, 0.15)' },   // Vermelho
    { border: 'rgba(6, 182, 212, 1)', bg: 'rgba(6, 182, 212, 0.15)' },   // Ciano
    { border: 'rgba(236, 72, 153, 1)', bg: 'rgba(236, 72, 153, 0.15)' }   // Rosa
];

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(async (user) => {
        if (user) {
            isAdmin = await checkAdminStatus(user);
        }
        loadComponents(initializePage);
    });
});

async function initializePage() {
    // 1. Identificar o tipo de dados pela URL
    const urlParams = new URLSearchParams(window.location.search);
    type = urlParams.get('type') || 'contracts';
    if (!['contracts', 'students', 'store'].includes(type)) {
        type = 'contracts';
    }

    // 2. Configurar Títulos e Cabeçalhos Dinamicamente
    setupDynamicTitles();

    // 3. Configurar Filtro de Datas Inicial (Últimos 30 Dias)
    setupDefaultDates();

    // 4. Buscar e Inicializar Filtros de Unidades (Checkboxes)
    await initializeUnitsFilter();

    // 5. Adicionar Listeners de Eventos para Filtros
    setupFilterListeners();

    // 6. Buscar Dados Iniciais e Renderizar Tudo
    await loadInitialData();
    updateUI();
}

function setupDynamicTitles() {
    const titleEl = document.getElementById('details-title');
    const subtitleEl = document.getElementById('details-subtitle');
    const chartSectionTitleEl = document.getElementById('chart-section-title');

    if (type === 'contracts') {
        titleEl.textContent = 'Evolução dos Contratos Ativos';
        subtitleEl.textContent = 'Acompanhamento do histórico total de contratos ativos importados do EVO.';
        chartSectionTitleEl.textContent = 'Gráfico de Contratos Ativos';
    } else if (type === 'students') {
        titleEl.textContent = 'Evolução dos Alunos Ativos';
        subtitleEl.textContent = 'Histórico diário de alunos ativos que realizaram check-in ou frequência.';
        chartSectionTitleEl.textContent = 'Gráfico de Alunos Ativos';
    } else if (type === 'store') {
        titleEl.textContent = 'Evolução da Store';
        subtitleEl.textContent = 'Análise diária de receita e vendas da Kihap Store.';
        chartSectionTitleEl.textContent = 'Gráfico de Receita da Store (R$)';
    }
}

function setupDefaultDates() {
    const endInput = document.getElementById('end-date');
    const startInput = document.getElementById('start-date');

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    endInput.value = today.toISOString().split('T')[0];
    startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
}

async function initializeUnitsFilter() {
    const container = document.getElementById('unit-checkboxes-container');
    if (!container) return;

    try {
        const result = await getEvoUnits();
        allUnits = result.data.sort();

        container.innerHTML = allUnits.map(unitId => {
            const displayName = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="unit-${unitId}" value="${unitId}" class="unit-checkbox w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-500 focus:ring-2 accent-yellow-500 cursor-pointer">
                    <label for="unit-${unitId}" class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">${displayName}</label>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Erro ao buscar unidades para os filtros:", error);
    }
}

function setupFilterListeners() {
    // Toggle do dropdown customizado de unidades
    const dropdownBtn = document.getElementById('unit-dropdown-btn');
    const dropdownMenu = document.getElementById('unit-dropdown-menu');
    const selectAllCheckbox = document.getElementById('unit-select-all');

    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
            dropdownBtn.querySelector('i.fa-chevron-down').classList.toggle('rotate-180');
        });

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.add('hidden');
                dropdownBtn.querySelector('i.fa-chevron-down').classList.remove('rotate-180');
            }
        });
    }

    // Listener para o checkbox de "Selecionar Todos"
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.unit-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
            });
            updateSelectedUnitsText();
            updateUI();
        });
    }

    // Listener para checkboxes de unidades individuais
    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('unit-checkbox')) {
            const checkboxes = document.querySelectorAll('.unit-checkbox');
            const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = checkedCount === checkboxes.length;
            }
            updateSelectedUnitsText();
            updateUI();
        }
    });

    // Listeners para filtros de data
    document.getElementById('start-date').addEventListener('change', updateUI);
    document.getElementById('end-date').addEventListener('change', updateUI);

    // Atalhos Rápidos de Datas
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const range = e.currentTarget.getAttribute('data-range');
            const startInput = document.getElementById('start-date');
            const endInput = document.getElementById('end-date');

            const today = new Date();
            let startDate = new Date();

            if (range === '7') {
                startDate.setDate(today.getDate() - 7);
            } else if (range === '30') {
                startDate.setDate(today.getDate() - 30);
            } else if (range === 'this-month') {
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            } else if (range === 'this-year') {
                startDate = new Date(today.getFullYear(), 0, 1);
            }

            startInput.value = startDate.toISOString().split('T')[0];
            endInput.value = today.toISOString().split('T')[0];

            updateUI();
        });
    });

    // Comparativo temporal
    document.getElementById('compare-period').addEventListener('change', updateUI);

    // Busca da tabela
    document.getElementById('table-search').addEventListener('input', () => {
        renderTable();
    });

    // Exportação CSV
    document.getElementById('export-csv-btn').addEventListener('click', exportToCsv);
}

function updateSelectedUnitsText() {
    const textEl = document.getElementById('selected-units-text');
    const selectAllCheckbox = document.getElementById('unit-select-all');
    const checkboxes = document.querySelectorAll('.unit-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);

    if (selectAllCheckbox && selectAllCheckbox.checked) {
        textEl.textContent = 'Geral (Todas as Unidades)';
    } else if (checked.length === 0) {
        textEl.textContent = 'Nenhuma selecionada';
    } else if (checked.length === 1) {
        const id = checked[0].value;
        textEl.textContent = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } else {
        textEl.textContent = `${checked.length} Unidades Selecionadas`;
    }
}

async function loadInitialData() {
    try {
        if (type === 'contracts' || type === 'students') {
            const snapshotsRef = collection(db, 'evo_daily_snapshots');
            const querySnapshot = await getDocs(snapshotsRef);
            
            // Mapeamos e ordenamos de forma crescente de data (necessário para gráfico)
            rawData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.timestamp.toDate()
                };
            }).sort((a, b) => a.date - b.date);

        } else if (type === 'store') {
            // Vendas da loja
            const salesRef = collection(db, 'inscricoesFaixaPreta');
            const querySnapshot = await getDocs(salesRef);
            
            rawData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.created ? data.created.toDate() : new Date()
                };
            }).sort((a, b) => a.date - b.date);
        }
    } catch (error) {
        console.error("Erro ao carregar dados do Firebase:", error);
        alert('Erro ao carregar dados de análise.');
    }
}

function getSelectedUnits() {
    const checkboxes = document.querySelectorAll('.unit-checkbox');
    return Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
}

function getFilteredData(startDate, endDate) {
    return rawData.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate >= startDate && itemDate <= endDate;
    });
}

function updateUI() {
    const startVal = document.getElementById('start-date').value;
    const endVal = document.getElementById('end-date').value;
    if (!startVal || !endVal) return;

    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);

    // 1. Filtrar dados primários
    const filteredData = getFilteredData(startDate, endDate);

    // 2. Filtrar dados do período anterior (para comparação)
    let comparisonData = [];
    const comparePeriodChecked = document.getElementById('compare-period').checked;
    if (comparePeriodChecked) {
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const compStartDate = new Date(startDate);
        compStartDate.setDate(compStartDate.getDate() - diffDays);
        const compEndDate = new Date(startDate);
        compEndDate.setDate(compEndDate.getDate() - 1);
        compEndDate.setHours(23, 59, 59, 999);

        comparisonData = getFilteredData(compStartDate, compEndDate);
    }

    // 3. Renderizar Gráfico
    renderChart(filteredData, comparisonData);

    // 4. Renderizar Tabela
    renderTable(filteredData);
}

function renderChart(filteredData, comparisonData) {
    const selectedUnits = getSelectedUnits();
    const isAllSelected = document.getElementById('unit-select-all')?.checked;
    const comparePeriodChecked = document.getElementById('compare-period').checked;

    // Gerar labels do eixo X baseadas nas datas do período atual
    const labels = filteredData.map(item => 
        item.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    );

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#a0aec0' : '#4b5563';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    let datasets = [];

    if (type === 'store') {
        // Para Store, os dados crua são transações individuais. Precisamos consolidar por dia.
        const consolidated = consolidateStoreSalesByDay(filteredData, selectedUnits, isAllSelected);
        
        // Se comparar período
        let consolidatedComp = null;
        if (comparePeriodChecked) {
            consolidatedComp = consolidateStoreSalesByDay(comparisonData, selectedUnits, isAllSelected);
        }

        if (isAllSelected || selectedUnits.length === 0) {
            // Série única Geral
            datasets.push({
                label: 'Receita Total Atual',
                data: consolidated.labels.map(l => consolidated.totals[l] || 0),
                backgroundColor: 'rgba(245, 158, 11, 0.5)',
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1.5,
                type: 'bar'
            });

            if (comparePeriodChecked && consolidatedComp) {
                // Adicionar barras transparentes/pontilhadas para período anterior
                datasets.push({
                    label: 'Receita Total Período Anterior',
                    data: consolidated.labels.map((l, index) => {
                        const compLabel = consolidatedComp.labels[index];
                        return compLabel ? (consolidatedComp.totals[compLabel] || 0) : 0;
                    }),
                    backgroundColor: 'rgba(156, 163, 175, 0.25)',
                    borderColor: 'rgba(156, 163, 175, 0.6)',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    type: 'bar'
                });
            }
        } else {
            // Série individual para cada unidade selecionada
            selectedUnits.forEach((unitId, i) => {
                const color = colorPalette[i % colorPalette.length];
                datasets.push({
                    label: `${unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Atual`,
                    data: consolidated.labels.map(l => consolidated.byUnit[unitId]?.[l] || 0),
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    borderWidth: 1.5,
                    type: 'bar'
                });

                if (comparePeriodChecked && consolidatedComp) {
                    datasets.push({
                        label: `${unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Anterior`,
                        data: consolidated.labels.map((l, index) => {
                            const compLabel = consolidatedComp.labels[index];
                            return compLabel ? (consolidatedComp.byUnit[unitId]?.[compLabel] || 0) : 0;
                        }),
                        backgroundColor: 'rgba(156, 163, 175, 0.1)',
                        borderColor: color.border.replace('1)', '0.4)'),
                        borderWidth: 1,
                        borderDash: [4, 4],
                        type: 'bar'
                    });
                }
            });
        }
    } else {
        // Para Contratos ou Alunos (Snapshots)
        if (isAllSelected || selectedUnits.length === 0) {
            // Série Geral
            const dataField = type === 'contracts' ? 'totalContracts' : 'totalDailyActives';
            datasets.push({
                label: type === 'contracts' ? 'Contratos Ativos (Geral)' : 'Alunos Ativos (Geral)',
                data: filteredData.map(d => d[dataField] || 0),
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 1)',
                tension: 0.25,
                borderWidth: 2,
                pointRadius: filteredData.length > 40 ? 0 : 3
            });

            if (comparePeriodChecked) {
                datasets.push({
                    label: 'Período Anterior',
                    data: labels.map((l, index) => {
                        const compItem = comparisonData[index];
                        return compItem ? (compItem[dataField] || 0) : null;
                    }),
                    fill: false,
                    borderColor: 'rgba(156, 163, 175, 0.6)',
                    borderWidth: 1.5,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    tension: 0.25
                });
            }
        } else {
            // Série por Unidade
            selectedUnits.forEach((unitId, i) => {
                const color = colorPalette[i % colorPalette.length];
                const unitName = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                datasets.push({
                    label: unitName,
                    data: filteredData.map(d => d.units?.[unitId]?.[type === 'contracts' ? 'contracts' : 'dailyActives'] || 0),
                    fill: false,
                    borderColor: color.border,
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: filteredData.length > 40 ? 0 : 3
                });

                if (comparePeriodChecked) {
                    datasets.push({
                        label: `${unitName} (Anterior)`,
                        data: labels.map((l, index) => {
                            const compItem = comparisonData[index];
                            return compItem ? (compItem.units?.[unitId]?.[type === 'contracts' ? 'contracts' : 'dailyActives'] || 0) : null;
                        }),
                        fill: false,
                        borderColor: color.border.replace('1)', '0.35)'),
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        tension: 0.25
                    });
                }
            });
        }
    }

    if (activeChart) {
        activeChart.destroy();
    }

    const ctx = document.getElementById('evolution-details-chart').getContext('2d');
    activeChart = new Chart(ctx, {
        type: type === 'store' ? 'bar' : 'line',
        data: {
            labels: type === 'store' ? (consolidateStoreSalesByDay(filteredData, selectedUnits, isAllSelected).labels) : labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { size: 11, weight: 'semibold' }
                    }
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (type === 'store') {
                                    label += context.parsed.y.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                } else {
                                    label += context.parsed.y.toLocaleString('pt-BR');
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    beginAtZero: type === 'store',
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            if (type === 'store') {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                            }
                            return value.toLocaleString('pt-BR');
                        }
                    },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

function consolidateStoreSalesByDay(salesData, selectedUnits, isAllSelected) {
    const totals = {};
    const byUnit = {};
    
    // Inicializar mapas por unidade
    selectedUnits.forEach(uid => {
        byUnit[uid] = {};
    });

    salesData.forEach(sale => {
        if (sale.created) {
            const dateStr = sale.created.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const amount = (sale.amountTotal || 0) / 100;
            const unit = sale.userUnit || 'default';

            if (!totals[dateStr]) totals[dateStr] = 0;
            totals[dateStr] += amount;

            if (byUnit[unit]) {
                if (!byUnit[unit][dateStr]) byUnit[unit][dateStr] = 0;
                byUnit[unit][dateStr] += amount;
            }
        }
    });

    const labels = Object.keys(totals); // Já ordenado cronologicamente devido à ordenação da consulta
    return { labels, totals, byUnit };
}

function renderTable(filteredData = null) {
    if (!filteredData) {
        const startVal = document.getElementById('start-date').value;
        const endVal = document.getElementById('end-date').value;
        const startDate = new Date(startVal);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);
        filteredData = getFilteredData(startDate, endDate);
    }

    const searchTerm = document.getElementById('table-search').value.toLowerCase();
    const selectedUnits = getSelectedUnits();
    const isAllSelected = document.getElementById('unit-select-all')?.checked;

    const headerRow = document.getElementById('table-header-row');
    const bodyContainer = document.getElementById('table-data-body');

    // Inverter para mostrar os mais recentes primeiro na tabela
    const displayData = [...filteredData].reverse();

    // 1. Configurar Cabeçalhos dinamicamente
    let headerHtml = `<th scope="col" class="px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Data</th>`;
    
    if (isAllSelected || selectedUnits.length === 0) {
        if (type === 'contracts') {
            headerHtml += `<th scope="col" class="px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Total Contratos (EVO)</th>`;
        } else if (type === 'students') {
            headerHtml += `<th scope="col" class="px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Total Alunos Ativos (Frequência)</th>`;
        } else if (type === 'store') {
            headerHtml += `
                <th scope="col" class="px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Total de Vendas</th>
                <th scope="col" class="px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Receita Total</th>
            `;
        }
    } else {
        selectedUnits.forEach(uid => {
            const displayName = uid.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            headerHtml += `<th scope="col" class="px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">${displayName}</th>`;
        });
        headerHtml += `<th scope="col" class="px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider font-bold">Total Geral</th>`;
    }
    headerRow.innerHTML = headerHtml;

    // 2. Preencher Linhas
    if (type === 'store') {
        // Agrupar transações da loja por dia para exibição na tabela
        const grouped = consolidateStoreSalesByDay(filteredData, selectedUnits, isAllSelected);
        const uniqueDates = [...grouped.labels].reverse(); // Recentes primeiro

        const filteredDates = uniqueDates.filter(d => d.includes(searchTerm));

        if (filteredDates.length === 0) {
            bodyContainer.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-500">Nenhum dado encontrado para "${searchTerm}".</td></tr>`;
            return;
        }

        bodyContainer.innerHTML = filteredDates.map(dateStr => {
            let rowHtml = `<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition border-b border-gray-100 dark:border-gray-800/50">`;
            rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">${dateStr}</td>`;

            if (isAllSelected || selectedUnits.length === 0) {
                // Encontrar total de vendas nesse dia
                const countSales = filteredData.filter(s => s.created && s.created.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) === dateStr).length;
                const revenue = grouped.totals[dateStr] || 0;

                rowHtml += `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${countSales}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-bold">${revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                `;
            } else {
                let sumRow = 0;
                selectedUnits.forEach(uid => {
                    const rev = grouped.byUnit[uid]?.[dateStr] || 0;
                    sumRow += rev;
                    rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${rev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>`;
                });
                rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold bg-gray-50/30 dark:bg-gray-800/20">${sumRow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>`;
            }
            rowHtml += `</tr>`;
            return rowHtml;
        }).join('');

    } else {
        // Contratos e Alunos
        const finalDisplayData = displayData.filter(item => {
            const displayDate = item.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return displayDate.includes(searchTerm);
        });

        if (finalDisplayData.length === 0) {
            bodyContainer.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-500">Nenhum dado encontrado para "${searchTerm}".</td></tr>`;
            return;
        }

        bodyContainer.innerHTML = finalDisplayData.map(item => {
            const displayDate = item.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            let rowHtml = `<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition border-b border-gray-100 dark:border-gray-800/50">`;
            rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">${displayDate}</td>`;

            const field = type === 'contracts' ? 'totalContracts' : 'totalDailyActives';

            if (isAllSelected || selectedUnits.length === 0) {
                rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-bold">${item[field] || 0}</td>`;
            } else {
                let sumRow = 0;
                selectedUnits.forEach(uid => {
                    const count = item.units?.[uid]?.[type === 'contracts' ? 'contracts' : 'dailyActives'] || 0;
                    sumRow += count;
                    rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">${count}</td>`;
                });
                rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold bg-gray-50/30 dark:bg-gray-800/20">${sumRow}</td>`;
            }
            rowHtml += `</tr>`;
            return rowHtml;
        }).join('');
    }
}

function exportToCsv() {
    const startVal = document.getElementById('start-date').value;
    const endVal = document.getElementById('end-date').value;
    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);

    const filteredData = getFilteredData(startDate, endDate);
    if (filteredData.length === 0) {
        alert('Nenhum dado disponível para exportar neste período.');
        return;
    }

    const selectedUnits = getSelectedUnits();
    const isAllSelected = document.getElementById('unit-select-all')?.checked;

    let headers = ['Data'];
    let rows = [];

    if (type === 'store') {
        const grouped = consolidateStoreSalesByDay(filteredData, selectedUnits, isAllSelected);
        const dates = grouped.labels;

        if (isAllSelected || selectedUnits.length === 0) {
            headers.push('Total Vendas', 'Receita Total (R$)');
            dates.forEach(d => {
                const countSales = filteredData.filter(s => s.created && s.created.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) === d).length;
                const revenue = (grouped.totals[d] || 0).toFixed(2).replace('.', ',');
                rows.push([d, countSales, revenue]);
            });
        } else {
            selectedUnits.forEach(uid => {
                const displayName = uid.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                headers.push(displayName);
            });
            headers.push('Total Geral (R$)');

            dates.forEach(d => {
                const row = [d];
                let rowSum = 0;
                selectedUnits.forEach(uid => {
                    const rev = grouped.byUnit[uid]?.[d] || 0;
                    rowSum += rev;
                    row.push(rev.toFixed(2).replace('.', ','));
                });
                row.push(rowSum.toFixed(2).replace('.', ','));
                rows.push(row);
            });
        }
    } else {
        const field = type === 'contracts' ? 'totalContracts' : 'totalDailyActives';

        if (isAllSelected || selectedUnits.length === 0) {
            headers.push(type === 'contracts' ? 'Total Contratos' : 'Total Alunos Ativos');
            filteredData.forEach(item => {
                const dateStr = item.date.toLocaleDateString('pt-BR');
                rows.push([dateStr, item[field] || 0]);
            });
        } else {
            selectedUnits.forEach(uid => {
                const displayName = uid.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                headers.push(displayName);
            });
            headers.push('Total Geral');

            filteredData.forEach(item => {
                const dateStr = item.date.toLocaleDateString('pt-BR');
                const row = [dateStr];
                let rowSum = 0;
                selectedUnits.forEach(uid => {
                    const val = item.units?.[uid]?.[type === 'contracts' ? 'contracts' : 'dailyActives'] || 0;
                    rowSum += val;
                    row.push(val);
                });
                row.push(rowSum);
                rows.push(row);
            });
        }
    }

    // Gerar conteúdo CSV (formato Windows/Excel amigável com separador ponto e vírgula)
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    const displayType = type === 'contracts' ? 'contratos' : type === 'students' ? 'alunos_ativos' : 'vendas_store';
    const filename = `relatorio_evolucao_${displayType}_${startVal}_a_${endVal}.csv`;

    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
