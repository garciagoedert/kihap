import { collection, getDocs, doc, deleteDoc, collectionGroup, query, where, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import { onAuthReady } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

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

    document.getElementById('close-subscribers-modal').addEventListener('click', () => {
        document.getElementById('subscribers-modal').classList.add('hidden');
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
    card.className = 'course-card relative group'; // Added relative group for hover effects if needed

    const thumbnailUrl = course.thumbnailURL || 'https://placehold.co/640x360.png?text=Curso';

    let adminActionsHTML = '';
    if (isAdmin) {
        adminActionsHTML = `
            <div class="absolute top-3 right-3 z-20 flex space-x-2">
                <button onclick="viewSubscribers('${courseId}', '${course.title.replace(/'/g, "\\'")}')" class="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full shadow-lg" title="Ver Assinantes">
                    <i class="fas fa-users fa-sm"></i>
                </button>
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
        <img src="${thumbnailUrl}" alt="${course.title}" class="course-card-img w-full h-48 object-cover rounded-t-lg">
        <div class="course-card-content p-4">
            <h3 class="text-xl font-bold font-title text-white">${course.title}</h3>
            <p class="text-sm text-gray-400">Por ${course.author || 'Autor desconhecido'}</p>
        </div>
        ${adminActionsHTML}
    `;

    // Note: The onclick handlers need to be globally accessible or attached via event listeners.
    // Since we are using onclick in HTML string, we attach them to window below.

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

async function viewSubscribers(courseId, courseTitle) {
    const modal = document.getElementById('subscribers-modal');
    const list = document.getElementById('subscribers-list');
    const titleEl = document.getElementById('modal-course-name');

    titleEl.textContent = courseTitle;
    list.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center">Carregando...</td></tr>';
    modal.classList.remove('hidden');

    try {
        // Query all subscriptions for this course across all users
        const q = query(collectionGroup(db, 'subscriptions'), where('courseId', '==', courseId));
        const snapshot = await getDocs(q);

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center">Nenhum assinante encontrado.</td></tr>';
            return;
        }

        for (const subDoc of snapshot.docs) {
            const subData = subDoc.data();
            const userId = subDoc.ref.parent.parent.id; // users/{uid}/subscriptions/{subId} -> parent.parent is user doc

            // Fetch user data
            let userData = { name: 'Desconhecido', email: '---' };
            try {
                const userSnap = await getDoc(doc(db, 'users', userId));
                if (userSnap.exists()) {
                    userData = userSnap.data();
                }
            } catch (e) {
                console.error('Erro ao buscar usuario', userId, e);
            }

            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-700';

            const statusColor = subData.status === 'active' ? 'text-green-400' : 'text-red-400';
            const dateStr = subData.createdAt ? new Date(subData.createdAt.seconds * 1000).toLocaleDateString() : '-';

            row.innerHTML = `
                <td class="px-4 py-3 text-white">${userData.name || 'Sem nome'}</td>
                <td class="px-4 py-3 text-gray-400">${userData.email || 'Sem email'}</td>
                <td class="px-4 py-3 ${statusColor} font-bold">${subData.status}</td>
                <td class="px-4 py-3 text-gray-400">${dateStr}</td>
                <td class="px-4 py-3">
                    ${subData.status === 'active' ? `
                        <button onclick="adminCancelSub('${userId}', '${courseId}')" class="text-red-500 hover:text-red-400 text-sm underline">
                            Cancelar
                        </button>
                    ` : '-'}
                </td>
            `;
            list.appendChild(row);
        }

    } catch (error) {
        console.error("Erro ao carregar assinantes:", error);
        list.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-red-500">Erro ao carregar dados.</td></tr>';
    }
}

async function adminCancelSub(userId, courseId) {
    if (!confirm('Tem certeza que deseja cancelar esta assinatura? O usuário perderá o acesso.')) {
        return;
    }

    try {
        const functions = getFunctions();
        const adminCancelSubscription = httpsCallable(functions, 'adminCancelSubscription');

        await adminCancelSubscription({ userId, courseId });

        alert('Assinatura cancelada com sucesso.');
        // Refresh the list (hacky: close and reopen or just reload page, but ideally just refresh list. 
        // For now, let's just alert. The user can close/reopen to refresh or we can try to refresh if we had the course title.)
        // Let's close the modal to force refresh on next open
        document.getElementById('subscribers-modal').classList.add('hidden');
    } catch (error) {
        console.error("Erro ao cancelar:", error);
        alert('Erro ao cancelar: ' + error.message);
    }
}

window.deleteCourse = deleteCourse;
window.viewSubscribers = viewSubscribers;
window.adminCancelSub = adminCancelSub;
