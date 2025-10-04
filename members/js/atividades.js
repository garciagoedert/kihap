import { onAuthReady, getUserData } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from '../../intranet/firebase-config.js';

const getActivitiesSchedule = httpsCallable(functions, 'getActivitiesSchedule');

export function setupAtividadesPage() {
    const atividadesContainer = document.getElementById('atividades-container');

    onAuthReady(async (user) => {
        if (user) {
            try {
                const userData = await getUserData(user.uid);
                
                // SOLUÇÃO TEMPORÁRIA: Usa 'centro' se unitId não estiver no perfil do usuário.
                // A solução definitiva é garantir que unitId seja salvo no Firestore durante o cadastro/convite.
                const unitId = userData ? userData.unitId || 'centro' : 'centro';

                if (unitId) {
                    const result = await getActivitiesSchedule({ unitId: unitId });
                    const activities = result.data;
                    displayActivities(activities, atividadesContainer);
                } else {
                    // Este caso agora é menos provável devido ao fallback acima.
                    atividadesContainer.innerHTML = '<p>Não foi possível identificar sua unidade para carregar as atividades.</p>';
                }
            } catch (error) {
                console.error("Erro ao buscar atividades:", error);
                atividadesContainer.innerHTML = '<p>Ocorreu um erro ao carregar as atividades. Tente novamente mais tarde.</p>';
            }
        } else {
            atividadesContainer.innerHTML = '<p>Você precisa estar logado para ver suas atividades.</p>';
        }
    });
}

function displayActivities(activities, container) {
    if (!activities || !Array.isArray(activities) || activities.length === 0) {
        container.innerHTML = '<p>Nenhuma atividade encontrada para sua unidade no momento.</p>';
        return;
    }

    container.innerHTML = '';

    const activitiesList = document.createElement('div');
    activitiesList.className = 'activities-list';

    activities.forEach(activity => {
        const activityElement = document.createElement('div');
        activityElement.className = 'activity-card p-4 bg-gray-800 rounded-lg shadow-md mb-4';
        
        const name = activity.name || 'Atividade sem nome';
        const instructor = activity.instructor ? activity.instructor.name : 'Não informado';
        const time = activity.schedule ? `${activity.schedule.startTime} - ${activity.schedule.endTime}` : 'Horário a definir';
        const spotsAvailable = activity.schedule ? activity.schedule.spotsAvailable : '-';
        const spotsTotal = activity.schedule ? activity.schedule.spotsTotal : '-';

        activityElement.innerHTML = `
            <h3 class="text-xl font-bold text-white mb-2">${name}</h3>
            <p class="text-gray-400"><strong>Instrutor:</strong> ${instructor}</p>
            <p class="text-gray-400"><strong>Horário:</strong> ${time}</p>
            <p class="text-gray-400"><strong>Vagas:</strong> ${spotsAvailable} / ${spotsTotal}</p>
        `;
        
        activitiesList.appendChild(activityElement);
    });

    container.appendChild(activitiesList);
}
