import { db } from '../../intranet/firebase-config.js';
import { onAuthReady } from './auth.js';
import { collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

let currentUser = null;
let userSubscriptions = [];

export function loadStudentCourses() {
    onAuthReady(async (user) => {
        if (user) {
            currentUser = user;
            const courseListContainer = document.getElementById('course-list');
            courseListContainer.innerHTML = '<p class="text-gray-400 col-span-full">Carregando cursos...</p>';

            try {
                // 1. Fetch user subscriptions
                const subQuery = query(collection(db, `users/${user.uid}/subscriptions`));
                const subSnapshot = await getDocs(subQuery);
                userSubscriptions = subSnapshot.docs.map(doc => doc.data().courseId);

                // 2. Fetch all courses
                const q = query(collection(db, "courses"));
                const querySnapshot = await getDocs(q);

                courseListContainer.innerHTML = '';

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

                setupModalListeners();

            } catch (error) {
                console.error("Error loading student courses: ", error);
                courseListContainer.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar os cursos.</p>';
            }
        }
    });
}

function createCourseCard(course, courseId) {
    const card = document.createElement('div');
    card.className = 'course-card bg-[#1a1a1a] rounded-lg overflow-hidden shadow-lg flex flex-col';
    const thumbnailUrl = course.thumbnailURL || 'https://placehold.co/640x360.png?text=Curso';

    // Check access
    const hasAccess = userSubscriptions.includes(courseId);
    const isSubscription = course.isSubscription;

    let actionButton = '';

    if (hasAccess) {
        let cancelBtn = '';
        if (isSubscription) {
            cancelBtn = `
                <button onclick="cancelSubscription('${courseId}', '${course.title.replace(/'/g, "\\'")}')" class="mt-2 w-full text-center text-red-500 hover:text-red-400 text-sm underline">
                    Cancelar Assinatura
                </button>
            `;
        }

        actionButton = `
            <a href="player.html?courseId=${courseId}" class="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-200">
                Acessar Curso
            </a>
            ${cancelBtn}
        `;
    } else if (isSubscription) {
        const price = course.subscriptionPrice ? (course.subscriptionPrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Assinar';
        const interval = course.subscriptionInterval === 'year' ? '/ano' : '/mês';

        actionButton = `
            <button onclick="openSubscriptionModal('${courseId}', '${course.title.replace(/'/g, "\\'")}', '${course.subscriptionPlanId}', '${price}${interval}')" 
                class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-200">
                Assinar por ${price}${interval}
            </button>
        `;
    } else {
        // Course is not subscription based and user doesn't have explicit subscription. 
        // Maybe it's free or legacy? For now, let's assume if not subscription, it's free/open or handled elsewhere.
        // Or show "Indisponível" if we want to be strict.
        // Let's assume open for now to match previous behavior, OR "Acessar" if we assume all non-sub courses are free.
        // Previous code allowed access to all. Let's keep it accessible if NOT isSubscription.
        actionButton = `
            <a href="player.html?courseId=${courseId}" class="block w-full text-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-200">
                Acessar Grátis
            </a>
        `;
    }

    card.innerHTML = `
        <div class="relative">
            <img src="${thumbnailUrl}" alt="${course.title}" class="w-full h-48 object-cover">
            ${!hasAccess && isSubscription ? '<div class="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">Premium</div>' : ''}
        </div>
        <div class="p-4 flex-1 flex flex-col justify-between">
            <div>
                <h3 class="text-xl font-bold font-title mb-1 text-white">${course.title}</h3>
                <p class="text-sm text-gray-400 mb-4">Por ${course.author || 'Autor desconhecido'}</p>
            </div>
            <div class="mt-auto">
                ${actionButton}
            </div>
        </div>
    `;
    return card;
}

// Modal Logic
function setupModalListeners() {
    const modal = document.getElementById('subscription-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const form = document.getElementById('subscription-form');

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('confirm-subscription-btn');
        btn.disabled = true;
        btn.textContent = 'Processando...';

        const courseId = document.getElementById('modal-course-id').value;
        const planId = document.getElementById('modal-plan-id').value;

        // Basic card data collection (In production, use Pagar.me Elements/Encryption)
        const cardData = {
            number: document.getElementById('card-number').value.replace(/\s/g, ''),
            holder_name: document.getElementById('card-holder').value,
            exp_month: document.getElementById('card-expiry').value.split('/')[0],
            exp_year: '20' + document.getElementById('card-expiry').value.split('/')[1],
            cvv: document.getElementById('card-cvv').value
        };

        try {
            const functions = getFunctions();
            const createSubscription = httpsCallable(functions, 'createSubscription');

            const result = await createSubscription({
                planId: planId,
                courseId: courseId,
                paymentMethod: 'credit_card',
                cardData: cardData
            });

            if (result.data.success) {
                alert('Assinatura realizada com sucesso!');
                modal.classList.add('hidden');
                loadStudentCourses(); // Reload to update UI
            } else {
                throw new Error('Falha na assinatura');
            }

        } catch (error) {
            console.error("Erro na assinatura:", error);
            alert('Erro ao processar assinatura: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirmar Assinatura';
        }
    });
}

// Expose to window for onclick
window.openSubscriptionModal = (courseId, title, planId, priceLabel) => {
    document.getElementById('modal-course-title').textContent = title;
    document.getElementById('modal-course-price').textContent = priceLabel;
    document.getElementById('modal-course-id').value = courseId;
    document.getElementById('modal-plan-id').value = planId;
    document.getElementById('subscription-modal').classList.remove('hidden');
};

window.cancelSubscription = async (courseId, title) => {
    if (!confirm(`Tem certeza que deseja cancelar a assinatura do curso "${title}"? Você perderá o acesso imediatamente.`)) {
        return;
    }

    try {
        const functions = getFunctions();
        const cancelSubscription = httpsCallable(functions, 'cancelSubscription');

        await cancelSubscription({ courseId: courseId });

        alert('Assinatura cancelada com sucesso.');
        loadStudentCourses();
    } catch (error) {
        console.error("Erro ao cancelar assinatura:", error);
        alert('Erro ao cancelar assinatura: ' + error.message);
    }
};
