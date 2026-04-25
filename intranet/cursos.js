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
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
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
    } finally {
        const skeleton = document.getElementById('course-skeleton');
        if (skeleton) skeleton.classList.add('hidden');
        courseListContainer.classList.remove('hidden');
    }
}

function createCourseCard(course, courseId, isAdmin) {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800/50 flex flex-col group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative';

    const thumbnailUrl = course.thumbnailURL || 'https://placehold.co/640x360.png?text=Curso';

    let adminActionsHTML = '';
    if (isAdmin) {
        adminActionsHTML = `
            <div class="border-t border-gray-100 dark:border-gray-800/50 p-3 bg-gray-50/50 dark:bg-gray-900/30 flex justify-between items-center relative z-20">
                <span class="text-[10px] uppercase font-bold tracking-widest text-gray-400 pl-2">Admin</span>
                <div class="flex space-x-2">
                    <button onclick="viewSubscribers('${courseId}', '${course.title.replace(/'/g, "\\'")}')" class="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500 hover:text-white transition-colors" title="Ver Assinantes">
                        <i class="fas fa-users text-xs"></i>
                    </button>
                    <a href="course-editor.html?courseId=${courseId}" class="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-colors" title="Editar">
                        <i class="fas fa-pencil-alt text-xs"></i>
                    </a>
                    <button onclick="deleteCourse('${courseId}', '${course.title.replace(/'/g, "\\'")}')" class="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors" title="Excluir">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }

    card.innerHTML = `
        <a href="player.html?courseId=${courseId}" class="absolute inset-0 z-10 block"></a>
        <div class="relative h-48 overflow-hidden">
            <img src="${thumbnailUrl}" alt="${course.title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
        <div class="p-5 flex-1 flex flex-col relative z-10">
            <h3 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white mb-1 line-clamp-2">${course.title}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-auto font-medium">Por ${course.author || 'Autor desconhecido'}</p>
        </div>
        ${adminActionsHTML}
    `;

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
