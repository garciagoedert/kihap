import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from './firebase-config.js';

// Usando a mesma Cloud Function que a página de alunos para garantir dados atualizados
const listAllMembers = httpsCallable(functions, 'listAllMembers');

async function fetchAndDisplayRanking() {
    const rankingBody = document.getElementById('ranking-body');
    rankingBody.innerHTML = `
        <tr>
            <td colspan="3" class="loader">
                <i class="fas fa-spinner fa-spin"></i> Atualizando Ranking...
            </td>
        </tr>`;

    try {
        // Lista de todas as unidades para buscar um ranking global
        const unitIds = [
            "centro", "coqueiros", "asa-sul", "sudoeste", "lago-sul", 
            "pontos-de-ensino", "jardim-botanico", "dourados", 
            "santa-monica", "noroeste"
        ];

        // Busca alunos ativos (status: 1) de todas as unidades em paralelo
        const promises = unitIds.map(unitId => listAllMembers({ unitId: unitId, status: 1 }));
        const results = await Promise.all(promises);
        
        // Junta os resultados de todas as unidades em uma única lista
        const allStudents = results.flatMap(result => result.data || []);

        // Remove duplicatas caso um aluno esteja em mais de uma lista (pouco provável, mas seguro)
        const uniqueStudentsMap = new Map();
        allStudents.forEach(student => {
            if (!uniqueStudentsMap.has(student.idMember)) {
                uniqueStudentsMap.set(student.idMember, student);
            }
        });
        const uniqueStudentList = Array.from(uniqueStudentsMap.values());

        // Filtra e ordena os alunos pelo totalFitCoins (KihapCoins)
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
    rankingBody.innerHTML = ''; // Limpa o conteúdo anterior

    if (students.length === 0) {
        rankingBody.innerHTML = `
            <tr>
                <td colspan="3" class="loader">
                    Nenhum aluno com KihapCoins encontrado.
                </td>
            </tr>`;
        return;
    }

    // Mantém a exibição do Top 10 como no original
    const rowsHtml = students.slice(0, 10).map((student, index) => { 
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

function initVideoSlider() {
    const videos = document.querySelectorAll('#video-slider .tiktok-video');
    let currentVideoIndex = 0;

    if (videos.length > 0) {
        setInterval(() => {
            videos[currentVideoIndex].classList.remove('active');
            currentVideoIndex = (currentVideoIndex + 1) % videos.length;
            videos[currentVideoIndex].classList.add('active');
        }, 30000); // Troca de vídeo a cada 30 segundos
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndDisplayRanking(); // Carga inicial
    setInterval(fetchAndDisplayRanking, 300000); // Atualiza a cada 5 minutos
    initVideoSlider();
});
