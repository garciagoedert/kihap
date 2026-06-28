import { collection, getDocs, doc, deleteDoc, collectionGroup, query, where, getDoc, limit, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

    // Listener para o botão de liberar acesso manual
    const btnGrant = document.getElementById('btn-grant-access');
    if (btnGrant) {
        btnGrant.addEventListener('click', async () => {
            const select = document.getElementById('select-add-subscriber');
            const selectedUserId = select.value;
            if (!selectedUserId) {
                alert('Por favor, selecione um aluno.');
                return;
            }

            const modal = document.getElementById('subscribers-modal');
            const courseId = modal.dataset.courseId;
            const courseTitle = document.getElementById('modal-course-name').textContent;

            btnGrant.disabled = true;
            const originalText = btnGrant.innerHTML;
            btnGrant.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Liberando...';

            try {
                // 1. Atualizar accessibleContent no documento do usuário
                const userRef = doc(db, 'users', selectedUserId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const accessibleContent = userData.accessibleContent || [];
                    if (!accessibleContent.includes(courseId)) {
                        accessibleContent.push(courseId);
                        await updateDoc(userRef, { accessibleContent: accessibleContent });
                    }
                }

                // 2. Registrar na subcoleção de assinaturas para log histórico
                const subsRef = collection(db, 'users', selectedUserId, 'subscriptions');
                const subQuery = await getDocs(query(subsRef, where('courseId', '==', courseId)));
                if (subQuery.empty) {
                    await addDoc(subsRef, {
                        courseId: courseId,
                        status: 'active',
                        paymentMethod: 'manual_admin',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }

                alert('Curso liberado para o aluno com sucesso!');
                // Recarrega a lista
                viewSubscribers(courseId, courseTitle);
            } catch (error) {
                console.error('Erro ao liberar acesso manual:', error);
                alert('Erro ao liberar curso: ' + error.message);
            } finally {
                btnGrant.disabled = false;
                btnGrant.innerHTML = originalText;
            }
        });
    }
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

async function loadUsersListForSelect(courseId, renderedUserIds) {
    const select = document.getElementById('select-add-subscriber');
    if (!select) return;

    select.innerHTML = '<option value="">Carregando alunos...</option>';

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const allUsers = [];
        querySnapshot.forEach((doc) => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        // Filtrar alunos que não possuem o acesso liberado ainda (não estão renderizados)
        const availableUsers = allUsers.filter(u => {
            if (!u.name || !u.email) return false;
            return !renderedUserIds.has(u.id) && !u.evoMemberId;
        });

        // Caso a lista de usuários sem a EVO ID esteja vazia, listamos também os que têm EVO ID (por segurança)
        const finalUsers = availableUsers.length > 0 ? availableUsers : allUsers.filter(u => u.name && u.email && !renderedUserIds.has(u.id));

        // Ordenação alfabética
        finalUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        select.innerHTML = '<option value="">Selecione um aluno para liberar...</option>';
        finalUsers.forEach(u => {
            const option = document.createElement('option');
            option.value = u.id;
            option.textContent = `${u.name} (${u.email})`;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Erro ao carregar lista de usuários para seleção:", e);
        select.innerHTML = '<option value="">Erro ao carregar alunos</option>';
    }
}

async function viewSubscribers(courseId, courseTitle) {
    const modal = document.getElementById('subscribers-modal');
    const list = document.getElementById('subscribers-list');
    const titleEl = document.getElementById('modal-course-name');

    modal.dataset.courseId = courseId;
    titleEl.textContent = courseTitle;
    list.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400 font-medium"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando alunos com acesso...</td></tr>';
    modal.classList.remove('hidden');

    const renderedUserIds = new Set();

    try {
        let snapshot;
        let isFallback = false;

        try {
            // Tenta primeiro usando o collectionGroup (requer regras e índice de coleção configurados)
            const q = query(collectionGroup(db, 'subscriptions'), where('courseId', '==', courseId));
            snapshot = await getDocs(q);
            if (snapshot.empty) {
                // Força fallback se o collectionGroup retornar vazio, para buscar permissões manuais de alunos
                throw new Error("No collectionGroup subscriptions found");
            }
        } catch (groupError) {
            console.warn("CollectionGroup falhou ou retornou vazio, usando fallback de usuários:", groupError.message);
            isFallback = true;
            // Fallback: Busca usuários que possuem o curso em accessibleContent
            const qFallback = query(collection(db, 'users'), where('accessibleContent', 'array-contains', courseId));
            snapshot = await getDocs(qFallback);
        }

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400 font-medium">Nenhum aluno com acesso encontrado.</td></tr>';
            loadUsersListForSelect(courseId, renderedUserIds);
            return;
        }

        if (isFallback) {
            // Caso de Fallback: Processa a lista de usuários e busca assinaturas individuais
            for (const userDoc of snapshot.docs) {
                const userData = userDoc.data();
                const userId = userDoc.id;
                renderedUserIds.add(userId);

                let subData = { status: 'active', createdAt: null };
                try {
                    const subSnapshot = await getDocs(query(collection(db, 'users', userId, 'subscriptions'), where('courseId', '==', courseId), limit(1)));
                    if (!subSnapshot.empty) {
                        subData = subSnapshot.docs[0].data();
                    }
                } catch (subErr) {
                    console.warn(`Erro ao carregar assinatura individual para o usuário ${userId}:`, subErr.message);
                }

                const row = document.createElement('tr');
                row.className = 'border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-all duration-200';

                let statusBadge = '';
                if (subData.status === 'active') {
                    statusBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-500/10 text-green-600 dark:text-green-400"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> ativo</span>`;
                } else if (subData.status === 'canceled' || subData.status === 'canceled_by_admin') {
                    statusBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> cancelado</span>`;
                } else {
                    statusBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> ${subData.status}</span>`;
                }

                const dateStr = subData.createdAt ? new Date(subData.createdAt.seconds * 1000).toLocaleDateString() : '-';

                row.innerHTML = `
                    <td class="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">${userData.name || 'Sem nome'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${userData.email || 'Sem email'}</td>
                    <td class="px-6 py-4 text-sm font-semibold">${statusBadge}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${dateStr}</td>
                    <td class="px-6 py-4 text-sm text-right">
                        ${subData.status === 'active' ? `
                            <button onclick="adminCancelSub('${userId}', '${courseId}')" class="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-500 hover:underline transition-all">
                                Cancelar Acesso
                            </button>
                        ` : '-'}
                    </td>
                `;
                list.appendChild(row);
            }
        } else {
            // Caso Principal (collectionGroup bem sucedido)
            for (const subDoc of snapshot.docs) {
                const subData = subDoc.data();
                const userId = subDoc.ref.parent.parent.id; // parent.parent é o doc do usuário
                renderedUserIds.add(userId);

                let userData = { name: 'Desconhecido', email: '---' };
                try {
                    const userSnap = await getDoc(doc(db, 'users', userId));
                    if (userSnap.exists()) {
                        userData = userSnap.data();
                    }
                } catch (e) {
                    console.error('Erro ao buscar usuário', userId, e);
                }

                const row = document.createElement('tr');
                row.className = 'border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-all duration-200';

                let statusBadge = '';
                if (subData.status === 'active') {
                    statusBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-500/10 text-green-600 dark:text-green-400"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> ativo</span>`;
                } else if (subData.status === 'canceled' || subData.status === 'canceled_by_admin') {
                    statusBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> cancelado</span>`;
                } else {
                    statusBadge = `<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> ${subData.status}</span>`;
                }

                const dateStr = subData.createdAt ? new Date(subData.createdAt.seconds * 1000).toLocaleDateString() : '-';

                row.innerHTML = `
                    <td class="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">${userData.name || 'Sem nome'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${userData.email || 'Sem email'}</td>
                    <td class="px-6 py-4 text-sm font-semibold">${statusBadge}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${dateStr}</td>
                    <td class="px-6 py-4 text-sm text-right">
                        ${subData.status === 'active' ? `
                            <button onclick="adminCancelSub('${userId}', '${courseId}')" class="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-500 hover:underline transition-all">
                                Cancelar Acesso
                            </button>
                        ` : '-'}
                    </td>
                `;
                list.appendChild(row);
            }
        }

        // Carrega a lista de seleção
        loadUsersListForSelect(courseId, renderedUserIds);

    } catch (error) {
        console.error("Erro ao carregar assinantes:", error);
        list.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-red-500 font-medium">Erro ao carregar dados.</td></tr>';
    }
}

async function adminCancelSub(userId, courseId) {
    if (!confirm('Tem certeza que deseja cancelar esta assinatura? O usuário perderá o acesso.')) {
        return;
    }

    try {
        // Verifica se a assinatura é manual ou pagarme/mercado pago
        const subsRef = collection(db, 'users', userId, 'subscriptions');
        const q = query(subsRef, where('courseId', '==', courseId), where('status', '==', 'active'), limit(1));
        const subSnap = await getDocs(q);

        let isManual = true;
        let subDocId = null;
        let subData = null;

        if (!subSnap.empty) {
            subDocId = subSnap.docs[0].id;
            subData = subSnap.docs[0].data();
            if (subData.paymentMethod !== 'manual_admin') {
                isManual = false;
            }
        }

        if (isManual) {
            // Cancelamento manual direto no Firestore
            if (subDocId) {
                await updateDoc(doc(db, 'users', userId, 'subscriptions', subDocId), {
                    status: 'canceled_by_admin',
                    canceledAt: new Date()
                });
            }

            // Remove da lista de acessos
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const accessibleContent = userData.accessibleContent || [];
                const index = accessibleContent.indexOf(courseId);
                if (index > -1) {
                    accessibleContent.splice(index, 1);
                    await updateDoc(userRef, { accessibleContent: accessibleContent });
                }
            }

            alert('Acesso manual cancelado com sucesso.');
            const courseTitle = document.getElementById('modal-course-name').textContent;
            viewSubscribers(courseId, courseTitle);
        } else {
            // Assinatura de pagamento (chama a cloud function)
            const functions = getFunctions();
            const adminCancelSubscription = httpsCallable(functions, 'adminCancelSubscription');
            await adminCancelSubscription({ userId, courseId });
            alert('Assinatura cancelada com sucesso.');
            const courseTitle = document.getElementById('modal-course-name').textContent;
            viewSubscribers(courseId, courseTitle);
        }
    } catch (error) {
        console.error("Erro ao cancelar:", error);
        alert('Erro ao cancelar: ' + error.message);
    }
}

window.deleteCourse = deleteCourse;
window.viewSubscribers = viewSubscribers;
window.adminCancelSub = adminCancelSub;
