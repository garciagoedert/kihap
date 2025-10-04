import { onAuthReady, getUserData } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from '../../intranet/firebase-config.js';

const getActivitiesSchedule = httpsCallable(functions, 'getActivitiesSchedule');

export function setupAtividadesPage() {
    let currentDate = new Date();
    let unitId = 'centro'; // Default unitId

    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    const currentDateDisplay = document.getElementById('current-date-display');

    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            unitId = userData ? userData.unitId || 'centro' : 'centro';
            loadActivitiesForDate(currentDate);
        } else {
            document.getElementById('atividades-container').innerHTML = '<p>Você precisa estar logado para ver suas atividades.</p>';
        }
    });

    async function loadActivitiesForDate(date) {
        updateDateDisplay(date);
        const dateString = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const atividadesContainer = document.getElementById('atividades-container');
        atividadesContainer.querySelector('#tabs-content').innerHTML = '<p>Carregando atividades...</p>';

        try {
            const result = await getActivitiesSchedule({ unitId: unitId, date: dateString });
            displayActivities(result.data, atividadesContainer);
        } catch (error) {
            console.error(`Erro ao buscar atividades para ${dateString}:`, error);
            atividadesContainer.querySelector('#tabs-content').innerHTML = '<p>Ocorreu um erro ao carregar as atividades. Tente novamente mais tarde.</p>';
        }
    }

    function updateDateDisplay(date) {
        currentDateDisplay.textContent = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    prevDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        loadActivitiesForDate(currentDate);
    });

    nextDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        loadActivitiesForDate(currentDate);
    });
}

function displayActivities(activities, container) {
    const tabsContent = container.querySelector('#tabs-content');
    const tabsNav = container.querySelector('#tabs-nav');
    tabsNav.innerHTML = ''; // Limpa as abas de dias da semana, já que estamos vendo um dia por vez

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
        tabsContent.innerHTML = '<p>Nenhuma atividade encontrada para este dia.</p>';
        return;
    }

    // Ordena as atividades pelo horário de início
    activities.sort((a, b) => (a.startTime > b.startTime) ? 1 : -1);

    tabsContent.innerHTML = '';
    const activitiesList = document.createElement('div');
    activitiesList.className = 'flex flex-col gap-4';

    activities.forEach(activity => {
        const activityElement = document.createElement('div');
        activityElement.className = 'activity-card p-4 bg-gray-800 rounded-lg shadow-md';
        
        const name = activity.name || 'Atividade sem nome';
        const instructor = activity.instructor ? activity.instructor.name : 'Não informado';
        const time = `${activity.startTime} - ${activity.endTime}`;
        const spotsAvailable = activity.capacity - activity.ocupation;
        const spotsTotal = activity.capacity;

        activityElement.innerHTML = `
            <h3 class="text-lg font-bold text-white mb-2">${name}</h3>
            <p class="text-sm text-gray-400"><strong>Instrutor:</strong> ${instructor}</p>
            <p class="text-sm text-gray-300 font-semibold">${time}</p>
            <p class="text-xs text-gray-500 mt-1"><strong>Vagas:</strong> ${spotsAvailable} / ${spotsTotal}</p>
        `;
        activitiesList.appendChild(activityElement);
    });

    tabsContent.appendChild(activitiesList);
}
