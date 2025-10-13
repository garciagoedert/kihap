import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from './firebase-config.js';

const listAllMembers = httpsCallable(functions, 'listAllMembers');

const unitIds = [
    "centro", "coqueiros", "asa-sul", "sudoeste", "lago-sul", 
    "pontos-de-ensino", "jardim-botanico", "dourados", "santa-monica", "noroeste"
];

async function fetchAndDisplayRanking() {
    const rankingBody = document.getElementById('ranking-body');
    rankingBody.innerHTML = `
        <tr>
            <td colspan="3" class="loader">
                <i class="fas fa-spinner fa-spin"></i> Atualizando Ranking...
            </td>
        </tr>`;

    try {
        // Fetch students from all units concurrently
        const promises = unitIds.map(unitId => listAllMembers({ unitId: unitId, status: 1 }));
        const results = await Promise.all(promises);
        const allStudents = results.flatMap(result => result.data || []);

        // Remove duplicates based on idMember
        const uniqueStudentsMap = new Map();
        allStudents.forEach(student => {
            if (!uniqueStudentsMap.has(student.idMember)) {
                uniqueStudentsMap.set(student.idMember, student);
            }
        });
        const uniqueStudentList = Array.from(uniqueStudentsMap.values());

        // Filter and sort students by totalFitCoins
        const rankedStudents = uniqueStudentList
            .filter(student => student.totalFitCoins > 0)
            .sort((a, b) => (b.totalFitCoins || 0) - (a.totalFitCoins || 0));

        renderRanking(rankedStudents);

    } catch (error) {
        console.error("Erro ao carregar o ranking:", error);
        rankingBody.innerHTML = `
            <tr>
                <td colspan="3" class="loader text-red-500">
                    Erro ao carregar o ranking. Tentando novamente em breve...
                </td>
            </tr>`;
    }
}

function renderRanking(students) {
    const rankingBody = document.getElementById('ranking-body');
    rankingBody.innerHTML = ''; // Clear previous content

    if (students.length === 0) {
        rankingBody.innerHTML = `
            <tr>
                <td colspan="3" class="loader">
                    Nenhum aluno com KihapCoins encontrado.
                </td>
            </tr>`;
        return;
    }

    const rowsHtml = students.slice(0, 10).map((student, index) => { // Display top 10
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`;
        const fitCoins = student.totalFitCoins || 0;
        const photoUrl = student.photoUrl || 'default-profile.svg';

        return `
            <tr class="ranking-table-row">
                <td class="rank-position">${index + 1}º</td>
                <td class="rank-student">
                    <img src="${photoUrl}" alt="Foto de ${fullName}">
                    <span class="rank-student-name">${fullName}</span>
                </td>
                <td class="rank-coins">${fitCoins}</td>
            </tr>
        `;
    }).join('');

    rankingBody.innerHTML = rowsHtml;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndDisplayRanking(); // Initial load
    setInterval(fetchAndDisplayRanking, 300000); // Refresh every 5 minutes (300000 ms)
});
