import { db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthReady } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const unitFilter = document.getElementById('unit-filter');
    const periodFilter = document.getElementById('period-filter');
    const rangeFilter = document.getElementById('range-filter');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const reportResults = document.getElementById('report-results');

    let myChart = null;

    // --- Funções de Data ---
    function getReportDateRange(selectedDate, rangeType) {
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);

        if (rangeType === 'day') {
            end.setHours(23, 59, 59, 999);
        } else if (rangeType === 'week') {
            const firstDayOfWeek = start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1);
            start.setDate(firstDayOfWeek);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (rangeType === 'month') {
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
        }
        return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
    }

    // --- Funções do Relatório ---
    async function generateReport() {
        const unitId = unitFilter.value;
        const selectedDate = periodFilter.value;
        const rangeType = rangeFilter.value;

        if (!unitId || !selectedDate) {
            reportResults.innerHTML = '<p class="text-center text-red-400">Por favor, selecione uma unidade e um período.</p>';
            return;
        }

        reportResults.innerHTML = '<p class="text-center text-gray-400">Gerando relatório...</p>';

        const { start, end } = getReportDateRange(selectedDate, rangeType);

        try {
            const q = query(collection(db, 'classes'),
                where('unitId', '==', unitId),
                where('startTime', '>=', start),
                where('startTime', '<=', end)
            );

            const querySnapshot = await getDocs(q);

            let totalStudentsInAllClasses = 0;
            let totalPresents = 0;
            const classesData = [];

            querySnapshot.forEach(doc => {
                const classData = doc.data();
                const presences = classData.presentStudents?.length || 0;
                const totalStudents = classData.students?.length || 0;

                totalPresents += presences;
                totalStudentsInAllClasses += totalStudents;

                classesData.push({
                    name: classData.name,
                    presences: presences,
                    total: totalStudents,
                    percentage: totalStudents > 0 ? ((presences / totalStudents) * 100).toFixed(1) : 0
                });
            });

            renderReport(classesData, totalPresents, totalStudentsInAllClasses);

        } catch (error) {
            console.error("Erro ao gerar relatório:", error);
            reportResults.innerHTML = '<p class="text-center text-red-500">Ocorreu um erro ao gerar o relatório.</p>';
        }
    }

    function renderReport(classesData, totalPresents, totalStudentsInAllClasses) {
        const overallPercentage = totalStudentsInAllClasses > 0 ? ((totalPresents / totalStudentsInAllClasses) * 100).toFixed(1) : 0;

        let tableHtml = `
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-gradient-to-br from-[#222] to-[#1a1a1a] p-6 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden group hover:border-gray-700 transition-all">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i class="fas fa-check-circle text-5xl text-blue-500"></i>
                    </div>
                    <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Total de Presenças</h3>
                    <div class="flex items-baseline gap-2">
                        <p class="text-4xl font-bold text-white">${totalPresents}</p>
                        <span class="text-xs text-gray-500">alunos presentes</span>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-[#222] to-[#1a1a1a] p-6 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden group hover:border-gray-700 transition-all">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i class="fas fa-users text-5xl text-purple-500"></i>
                    </div>
                    <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Total de Alunos</h3>
                    <div class="flex items-baseline gap-2">
                        <p class="text-4xl font-bold text-white">${totalStudentsInAllClasses}</p>
                        <span class="text-xs text-gray-500">inscritos</span>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-[#222] to-[#1a1a1a] p-6 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden group hover:border-gray-700 transition-all">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i class="fas fa-percentage text-5xl text-green-500"></i>
                    </div>
                    <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Média de Presença</h3>
                    <div class="flex items-baseline gap-2">
                        <p class="text-4xl font-bold ${overallPercentage >= 75 ? 'text-green-500' : overallPercentage >= 50 ? 'text-yellow-500' : 'text-red-500'}">${overallPercentage}%</p>
                        <span class="text-xs text-gray-500">frequência geral</span>
                    </div>
                </div>
            </div>

            <!-- Chart Section -->
            <div class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg mb-8">
                <h3 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <i class="fas fa-chart-bar text-blue-500"></i>
                    Desempenho por Turma
                </h3>
                <div class="relative h-80 w-full">
                    <canvas id="reportChart"></canvas>
                </div>
            </div>

            <!-- Table Section -->
            <div class="bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div class="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                        <i class="fas fa-list text-gray-400"></i>
                        Detalhamento
                    </h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-800">
                        <thead class="bg-[#222]">
                            <tr>
                                <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Turma</th>
                                <th scope="col" class="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Presenças</th>
                                <th scope="col" class="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Total Alunos</th>
                                <th scope="col" class="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">% Frequência</th>
                                <th scope="col" class="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-800 bg-[#1a1a1a]">
        `;

        classesData.forEach(c => {
            let statusBadge = '';
            if (c.percentage >= 80) {
                statusBadge = '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-900/30 text-green-400 border border-green-900/50">Excelente</span>';
            } else if (c.percentage >= 60) {
                statusBadge = '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-900/50">Regular</span>';
            } else {
                statusBadge = '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-900/30 text-red-400 border border-red-900/50">Atenção</span>';
            }

            tableHtml += `
                <tr class="hover:bg-[#222] transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white border-l-2 border-transparent hover:border-blue-500 transition-all">${c.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">${c.presences}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">${c.total}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-center ${c.percentage >= 75 ? 'text-green-500' : 'text-yellow-500'}">${c.percentage}%</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">${statusBadge}</td>
                </tr>
            `;
        });

        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        reportResults.innerHTML = tableHtml;
        renderChart(classesData);
    }

    function renderChart(classesData) {
        const ctx = document.getElementById('reportChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Blue-500
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: classesData.map(c => c.name),
                datasets: [{
                    label: '% de Presença',
                    data: classesData.map(c => c.percentage),
                    backgroundColor: gradient,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderRadius: 4,
                    borderSkipped: false,
                    barThickness: 'flex',
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function (context) {
                                return `Presença: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(75, 85, 99, 0.2)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#9CA3AF',
                            font: {
                                family: "'Inter', sans-serif",
                                size: 11
                            },
                            callback: function (value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#9CA3AF',
                            font: {
                                family: "'Inter', sans-serif",
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // --- Carregamento Inicial ---
    async function initialize() {
        try {
            const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
            const result = await getPublicEvoUnits();
            const units = result.data;

            unitFilter.innerHTML = '<option value="">Selecione a Unidade</option>';
            units.forEach(unitId => {
                const option = document.createElement('option');
                option.value = unitId;
                option.textContent = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                unitFilter.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar unidades do EVO:", error);
            unitFilter.innerHTML = '<option value="">Erro ao carregar unidades</option>';
        }
        periodFilter.valueAsDate = new Date();
    }

    generateReportBtn.addEventListener('click', generateReport);

    onAuthReady(user => {
        if (user) {
            initialize();
        } else {
            console.log("Usuário não autenticado.");
        }
    });
});
