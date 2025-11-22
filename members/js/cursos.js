import { db } from '../../intranet/firebase-config.js';
import { onAuthReady, getUserData } from './auth.js';
import { collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function loadStudentCourses() {
    onAuthReady(async (user) => {
        if (user) {
            const courseListContainer = document.getElementById('course-list');
            courseListContainer.innerHTML = '';

            try {
                // Fetch all courses directly, ignoring subscription status
                const q = query(collection(db, "courses"));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    courseListContainer.innerHTML = '<p class="text-gray-400 col-span-full">Nenhum curso encontrado.</p>';
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
                courseListContainer.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar os cursos.</p>';
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
