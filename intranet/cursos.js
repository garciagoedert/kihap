import { collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import { onAuthReady } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    setupUIListeners();

    onAuthReady(async (user) => {
        if (user) {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            if (isAdmin) {
                document.getElementById('add-course-btn').classList.remove('hidden');
            }
            loadCourses(isAdmin);
        }
    });
});

async function loadCourses(isAdmin) {
    const courseListContainer = document.getElementById('course-list');
    courseListContainer.innerHTML = ''; // Clear existing content

    try {
        const querySnapshot = await getDocs(collection(db, "courses"));
        if (querySnapshot.empty) {
            courseListContainer.innerHTML = '<p class="text-gray-400 col-span-full">Nenhum curso encontrado.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const course = doc.data();
            const courseId = doc.id;
            const courseCard = createCourseCard(course, courseId, isAdmin);
            courseListContainer.appendChild(courseCard);
        });
    } catch (error) {
        console.error("Error loading courses: ", error);
        courseListContainer.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar os cursos.</p>';
    }
}

function createCourseCard(course, courseId, isAdmin) {
    const card = document.createElement('div');
    card.className = 'course-card';

    const thumbnailUrl = course.thumbnailURL || 'https://placehold.co/640x360.png?text=Curso';

    let adminActionsHTML = '';
    if (isAdmin) {
        adminActionsHTML = `
            <div class="absolute top-3 right-3 z-10 flex space-x-2">
                <a href="course-editor.html?courseId=${courseId}" class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg" title="Editar">
                    <i class="fas fa-pencil-alt fa-sm"></i>
                </a>
                <button onclick="deleteCourse('${courseId}', '${course.title.replace(/'/g, "\\'")}')" class="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg" title="Excluir">
                    <i class="fas fa-trash-alt fa-sm"></i>
                </button>
            </div>
        `;
    }

    card.innerHTML = `
        <a href="player.html?courseId=${courseId}" class="absolute inset-0 z-10"></a>
        <img src="${thumbnailUrl}" alt="${course.title}" class="course-card-img">
        <div class="course-card-content">
            <h3 class="text-2xl font-bold font-title">${course.title}</h3>
            <p class="text-sm text-gray-300">Por ${course.author || 'Autor desconhecido'}</p>
        </div>
        ${adminActionsHTML}
    `;
    // Re-attach admin actions at a higher z-index to be clickable over the main link
    const adminActionsContainer = document.createElement('div');
    adminActionsContainer.innerHTML = adminActionsHTML;
    adminActionsContainer.className = "relative z-20";
    card.appendChild(adminActionsContainer);

    return card;
}

async function deleteCourse(courseId, courseTitle) {
    if (confirm(`Tem certeza que deseja excluir o curso "${courseTitle}"? Esta ação não pode ser desfeita.`)) {
        try {
            await deleteDoc(doc(db, "courses", courseId));
            location.reload(); 
        } catch (error) {
            console.error("Error removing course: ", error);
            alert("Erro ao excluir o curso. Por favor, tente novamente.");
        }
    }
}

window.deleteCourse = deleteCourse;
