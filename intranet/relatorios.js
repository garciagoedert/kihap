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
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                <div class="bg-gray-800 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-400">Total de Presenças</h3>
                    <p class="text-3xl font-bold text-white">${totalPresents}</p>
                </div>
                <div class="bg-gray-800 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-400">Total de Alunos</h3>
                    <p class="text-3xl font-bold text-white">${totalStudentsInAllClasses}</p>
                </div>
                <div class="bg-gray-800 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-400">Média de Presença</h3>
                    <p class="text-3xl font-bold text-green-400">${overallPercentage}%</p>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-gray-800 rounded-lg">
                    <thead class="bg-gray-700">
                        <tr>
                            <th class="p-3 text-left">Turma</th>
                            <th class="p-3 text-center">Presenças</th>
                            <th class="p-3 text-center">Total de Alunos</th>
                            <th class="p-3 text-center">% de Presença</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        classesData.forEach(c => {
            tableHtml += `
                <tr class="border-b border-gray-700">
                    <td class="p-3">${c.name}</td>
                    <td class="p-3 text-center">${c.presences}</td>
                    <td class="p-3 text-center">${c.total}</td>
                    <td class="p-3 text-center ${c.percentage >= 75 ? 'text-green-400' : 'text-yellow-400'}">${c.percentage}%</td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="mt-6"><canvas id="reportChart"></canvas></div>
        `;
        
        reportResults.innerHTML = tableHtml;
        renderChart(classesData);
    }

    function renderChart(classesData) {
        const ctx = document.getElementById('reportChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }
        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: classesData.map(c => c.name),
                datasets: [{
                    label: '% de Presença',
                    data: classesData.map(c => c.percentage),
                    backgroundColor: 'rgba(251, 191, 36, 0.6)',
                    borderColor: 'rgba(251, 191, 36, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#9CA3AF' }
                    },
                    x: {
                        ticks: { color: '#9CA3AF' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#D1D5DB' }
                    }
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
