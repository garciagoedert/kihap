import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import { onAuthReady } from './auth.js';

let courseId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    setupUIListeners();

    onAuthReady(async (user) => {
        if (user) {
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            if (!isAdmin) {
                alert('Acesso negado. Você precisa ser um administrador para acessar esta página.');
                window.location.href = 'cursos.html';
                return;
            }

            const params = new URLSearchParams(window.location.search);
            courseId = params.get('courseId');
            if (courseId) {
                document.getElementById('editor-title').textContent = 'Editar Curso';
                document.getElementById('editor-title-h1').textContent = 'Editar Curso';
                loadCourseData(courseId);
            }
        }
    });

    document.getElementById('add-module-btn').addEventListener('click', () => addModule());
    document.getElementById('course-form').addEventListener('submit', saveCourse);

    const accessTypeSelect = document.getElementById('access-type');
    const billingFields = document.getElementById('billing-fields');
    const priceField = document.getElementById('price-field');
    const planIdField = document.getElementById('plan-id-field');
    const intervalField = document.getElementById('interval-field');

    accessTypeSelect.addEventListener('change', () => {
        const value = accessTypeSelect.value;
        if (value === 'free') {
            billingFields.classList.add('hidden');
        } else if (value === 'subscription') {
            billingFields.classList.remove('hidden');
            priceField.classList.remove('hidden');
            planIdField.classList.remove('hidden');
            intervalField.classList.remove('hidden');
        } else if (value === 'one_time') {
            billingFields.classList.remove('hidden');
            priceField.classList.remove('hidden');
            planIdField.classList.add('hidden');
            intervalField.classList.add('hidden');
        }
    });
});

function addModule(module = { title: '', lessons: [] }) {
    const container = document.getElementById('modules-container');
    const moduleId = `module-${Date.now()}`;
    const moduleDiv = document.createElement('div');
    moduleDiv.className = 'bg-gray-50/50 dark:bg-[#202020]/30 p-6 rounded-3xl border border-gray-150 dark:border-white/5 shadow-sm mb-6';
    moduleDiv.id = moduleId;
    moduleDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4 gap-4">
            <div class="flex-grow">
                <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Título do Módulo</label>
                <input type="text" value="${module.title}" class="module-title w-full bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 rounded-2xl p-3 text-lg font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 dark:focus:ring-yellow-500/30 focus:border-yellow-500 transition-all" placeholder="Título do Módulo" required>
            </div>
            <button type="button" class="remove-module-btn text-red-500 hover:text-red-600 dark:hover:text-red-400 p-3 mt-6 rounded-xl hover:bg-red-500/10 transition-all duration-200 flex items-center justify-center self-end" title="Remover Módulo"><i class="fas fa-trash text-lg"></i></button>
        </div>
        <div class="lessons-container space-y-4 pl-0 md:pl-6 border-l-2 border-gray-100 dark:border-white/5 mt-4">
            <!-- Lessons will be here -->
        </div>
        <button type="button" class="add-lesson-btn mt-4 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-white text-xs font-black uppercase tracking-widest py-3 px-6 rounded-2xl transition-all active:scale-95 flex items-center gap-2">
            <i class="fas fa-plus"></i> Adicionar Aula
        </button>
    `;
    container.appendChild(moduleDiv);

    module.lessons.forEach(lesson => addLesson(moduleId, lesson));

    moduleDiv.querySelector('.remove-module-btn').addEventListener('click', () => moduleDiv.remove());
    moduleDiv.querySelector('.add-lesson-btn').addEventListener('click', () => addLesson(moduleId));
}

function addLesson(moduleId, lesson = { title: '', type: 'video', content: '', description: '' }) {
    const lessonsContainer = document.getElementById(moduleId).querySelector('.lessons-container');
    const lessonId = `lesson-${Date.now()}`;
    const editorId = `editor-${Date.now()}`;
    const lessonDiv = document.createElement('div');
    lessonDiv.className = 'p-5 bg-white dark:bg-[#252525]/40 border border-gray-150 dark:border-white/5 rounded-2xl mb-4 relative';
    lessonDiv.id = lessonId;
    lessonDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end w-full">
            <div class="md:col-span-4">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Título da Aula</label>
                <input type="text" value="${lesson.title}" class="lesson-title w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500" placeholder="Título da Aula" required>
            </div>
            <div class="md:col-span-3">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Tipo de Aula</label>
                <div class="relative">
                    <select class="lesson-type w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 appearance-none">
                        <option value="video" ${lesson.type === 'video' ? 'selected' : ''}>Vídeo</option>
                        <option value="text" ${lesson.type === 'text' ? 'selected' : ''}>Texto</option>
                        <option value="quiz" ${lesson.type === 'quiz' ? 'selected' : ''}>Quiz</option>
                    </select>
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                        <i class="fas fa-chevron-down text-[10px]"></i>
                    </div>
                </div>
            </div>
            <div class="md:col-span-4">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">URL / Conteúdo</label>
                <input type="text" value="${lesson.content}" class="lesson-content w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500" placeholder="URL do Vídeo / Conteúdo" required>
            </div>
            <div class="md:col-span-1 flex justify-end">
                <button type="button" class="remove-lesson-btn text-red-500 hover:text-red-600 dark:hover:text-red-400 p-2.5 rounded-xl hover:bg-red-500/10 transition-all duration-200" title="Remover Aula"><i class="fas fa-times text-lg"></i></button>
            </div>
        </div>
        <div class="mt-4">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Descrição / Notas de Aula</label>
            <div id="${editorId}" class="lesson-description bg-gray-50 dark:bg-[#1a1a1a] text-gray-900 dark:text-white"></div>
        </div>
    `;
    lessonsContainer.appendChild(lessonDiv);

    const quill = new Quill(`#${editorId}`, {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link']
            ]
        }
    });
    if (lesson.description) {
        quill.root.innerHTML = lesson.description;
    }

    lessonDiv.querySelector('.remove-lesson-btn').addEventListener('click', () => lessonDiv.remove());
}

async function loadCourseData(id) {
    const docRef = doc(db, "courses", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const course = docSnap.data();
        document.getElementById('course-title').value = course.title || '';
        document.getElementById('course-author').value = course.author || '';
        document.getElementById('course-description').value = course.description || '';
        document.getElementById('course-thumbnail').value = course.thumbnailURL || '';

        // Subscription fields
        const accessTypeSelect = document.getElementById('access-type');
        const billingFields = document.getElementById('billing-fields');
        const priceField = document.getElementById('price-field');
        const planIdField = document.getElementById('plan-id-field');
        const intervalField = document.getElementById('interval-field');

        if (course.isSubscription) {
            accessTypeSelect.value = 'subscription';
            billingFields.classList.remove('hidden');
            priceField.classList.remove('hidden');
            planIdField.classList.remove('hidden');
            intervalField.classList.remove('hidden');
            document.getElementById('subscription-plan-id').value = course.subscriptionPlanId || '';
            document.getElementById('subscription-price').value = course.subscriptionPrice || '';
            document.getElementById('subscription-interval').value = course.subscriptionInterval || 'month';
        } else if (course.isOneTimePurchase) {
            accessTypeSelect.value = 'one_time';
            billingFields.classList.remove('hidden');
            priceField.classList.remove('hidden');
            planIdField.classList.add('hidden');
            intervalField.classList.add('hidden');
            document.getElementById('subscription-price').value = course.subscriptionPrice || '';
        } else {
            accessTypeSelect.value = 'free';
            billingFields.classList.add('hidden');
        }

        if (course.modules) {
            course.modules.forEach(module => addModule(module));
        }
    } else {
        console.error("No such document!");
        alert("Curso não encontrado!");
        window.location.href = 'cursos.html';
    }
}

async function saveCourse(event) {
    event.preventDefault();
    const saveButton = document.getElementById('save-course-btn');
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando...';

    const user = JSON.parse(localStorage.getItem('currentUser'));
    const accessType = document.getElementById('access-type').value;
    const isSubscription = accessType === 'subscription';
    const isOneTimePurchase = accessType === 'one_time';

    const courseData = {
        title: document.getElementById('course-title').value,
        author: document.getElementById('course-author').value,
        description: document.getElementById('course-description').value,
        thumbnailURL: document.getElementById('course-thumbnail').value,
        updatedAt: serverTimestamp(),
        ownerId: user.uid,
        modules: [],
        isSubscription: isSubscription,
        isOneTimePurchase: isOneTimePurchase,
        subscriptionPlanId: isSubscription ? document.getElementById('subscription-plan-id').value : null,
        subscriptionPrice: (isSubscription || isOneTimePurchase) ? parseInt(document.getElementById('subscription-price').value) : null,
        subscriptionInterval: isSubscription ? document.getElementById('subscription-interval').value : null
    };

    document.querySelectorAll('#modules-container > div').forEach(moduleDiv => {
        const module = {
            title: moduleDiv.querySelector('.module-title').value,
            lessons: []
        };
        moduleDiv.querySelectorAll('.lessons-container > div').forEach(lessonDiv => {
            const quillInstance = Quill.find(lessonDiv.querySelector('.ql-editor').parentNode);
            const lesson = {
                title: lessonDiv.querySelector('.lesson-title').value,
                type: lessonDiv.querySelector('.lesson-type').value,
                content: lessonDiv.querySelector('.lesson-content').value,
                description: quillInstance.root.innerHTML
            };
            module.lessons.push(lesson);
        });
        courseData.modules.push(module);
    });

    try {
        if (courseId) {
            const courseRef = doc(db, "courses", courseId);
            await setDoc(courseRef, courseData, { merge: true });
        } else {
            courseData.createdAt = serverTimestamp();
            await addDoc(collection(db, "courses"), courseData);
        }
        alert('Curso salvo com sucesso!');
        window.location.href = 'cursos.html';
    } catch (error) {
        console.error("Error saving course: ", error);
        alert('Erro ao salvar o curso. Verifique o console para mais detalhes.');
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Curso';
    }
}
