import { db } from '../../intranet/firebase-config.js';
import { onAuthReady, getUserData } from './auth.js';
import { collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function loadStudentCourses() {
    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);

            // Controle de Acesso por Assinatura
            if (!userData || userData.subscriptionStatus !== 'active') {
                // Se não tiver dados ou a assinatura não estiver ativa, redireciona
                window.location.href = 'assinatura.html';
                return; 
            }

            const accessibleContent = userData?.accessibleContent || [];
            
            const courseListContainer = document.getElementById('course-list');
            courseListContainer.innerHTML = '';

            if (!accessibleContent.length) {
                courseListContainer.innerHTML = '<p class="text-gray-400 col-span-full">Você ainda não tem acesso a nenhum curso. Fale com seu instrutor.</p>';
                return;
            }

            // Filtra apenas os IDs que podem ser de cursos (para otimizar a consulta)
            const courseIds = accessibleContent.filter(id => id); // Simples verificação, pode ser melhorada se houver um padrão de ID

            if (!courseIds.length) {
                 courseListContainer.innerHTML = '<p class="text-gray-400 col-span-full">Nenhum curso encontrado em suas permissões.</p>';
                return;
            }

            try {
                const q = query(collection(db, "courses"), where(documentId(), "in", courseIds));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    courseListContainer.innerHTML = '<p class="text-gray-400 col-span-full">Nenhum dos cursos em suas permissões foi encontrado.</p>';
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const course = doc.data();
                    const courseId = doc.id;
                    const courseCard = createCourseCard(course, courseId);
                    courseListContainer.appendChild(courseCard);
                });

            } catch (error) {
                console.error("Error loading student courses: ", error);
                courseListContainer.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar seus cursos.</p>';
            }
        }
    });
}

function createCourseCard(course, courseId) {
    const card = document.createElement('div');
    card.className = 'course-card';
    const thumbnailUrl = course.thumbnailURL || 'https://placehold.co/640x360.png?text=Curso';

    card.innerHTML = `
        <a href="player.html?courseId=${courseId}" class="absolute inset-0 z-10"></a>
        <img src="${thumbnailUrl}" alt="${course.title}" class="course-card-img">
        <div class="course-card-content">
            <h3 class="text-2xl font-bold font-title">${course.title}</h3>
            <p class="text-sm text-gray-300">Por ${course.author || 'Autor desconhecido'}</p>
        </div>
    `;
    return card;
}
