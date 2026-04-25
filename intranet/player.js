import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import { onAuthReady } from './auth.js';

let courseData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    setupUIListeners();

    onAuthReady(user => {
        if (user) {
            const params = new URLSearchParams(window.location.search);
            const courseId = params.get('courseId');
            if (courseId) {
                loadCourse(courseId);
            } else {
                alert('Nenhum curso selecionado.');
                window.location.href = 'cursos.html';
            }
        }
    });
});

async function loadCourse(courseId) {
    const docRef = doc(db, "courses", courseId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        courseData = docSnap.data();
        document.title = `${courseData.title} - Player do Curso`;
        document.getElementById('course-title-sidebar').textContent = courseData.title;
        renderModules();
        // Load the first lesson of the first module by default
        if (courseData.modules && courseData.modules[0] && courseData.modules[0].lessons && courseData.modules[0].lessons[0]) {
            loadLesson(0, 0);
        }
    } else {
        alert('Curso não encontrado.');
        window.location.href = 'cursos.html';
    }
}

function renderModules() {
    const modulesList = document.getElementById('modules-list');
    modulesList.innerHTML = '';
    courseData.modules.forEach((module, moduleIndex) => {
        const moduleEl = document.createElement('div');
        moduleEl.classList.add('module-item');

        const moduleHeader = document.createElement('div');
        moduleHeader.classList.add('module-header', 'flex', 'justify-between', 'items-center', 'cursor-pointer', 'p-4', 'bg-gray-50', 'dark:bg-[#111111]', 'border', 'border-gray-100', 'dark:border-gray-800', 'hover:border-primary/50', 'rounded-xl', 'transition-all', 'group');
        moduleHeader.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center text-primary">
                    <i class="fas fa-layer-group text-xs"></i>
                </div>
                <h3 class="font-bold text-gray-900 dark:text-white">${module.title}</h3>
            </div>
            <i class="fas fa-chevron-down text-gray-400 transition-transform group-hover:text-primary"></i>
        `;

        const lessonsList = document.createElement('ul');
        lessonsList.className = 'space-y-2 mt-3 mb-6 pl-2 hidden'; // Oculto por padrão
        
        module.lessons.forEach((lesson, lessonIndex) => {
            const lessonEl = document.createElement('li');
            lessonEl.innerHTML = `
                <a href="#" class="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#111111] border border-transparent hover:border-gray-100 dark:hover:border-gray-800 p-3 rounded-xl transition-all group/lesson" data-module="${moduleIndex}" data-lesson="${lessonIndex}">
                    <div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-gray-400 group-hover/lesson:bg-primary group-hover/lesson:text-white transition-colors">
                        <i class="fas fa-play text-[8px] ml-0.5"></i>
                    </div>
                    <span class="line-clamp-2">${lesson.title}</span>
                </a>
            `;
            lessonsList.appendChild(lessonEl);
        });

        moduleHeader.addEventListener('click', () => {
            lessonsList.classList.toggle('hidden');
            const icon = moduleHeader.querySelector('i');
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        });

        moduleEl.appendChild(moduleHeader);
        moduleEl.appendChild(lessonsList);
        modulesList.appendChild(moduleEl);
    });

    // Add event listeners to lesson links
    modulesList.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const moduleIndex = parseInt(link.dataset.module);
            const lessonIndex = parseInt(link.dataset.lesson);
            loadLesson(moduleIndex, lessonIndex);
        });
    });
}

function loadLesson(moduleIndex, lessonIndex) {
    const lesson = courseData.modules[moduleIndex].lessons[lessonIndex];
    document.getElementById('lesson-title').textContent = lesson.title;
    document.getElementById('lesson-description').innerHTML = lesson.description || '';
    
    const contentContainer = document.getElementById('lesson-content-container');
    
    switch (lesson.type) {
        case 'video':
            // Simple URL to embeddable URL conversion
            let videoUrl = lesson.content;
            if (videoUrl.includes('youtube.com/watch?v=')) {
                const videoId = videoUrl.split('v=')[1];
                videoUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (videoUrl.includes('vimeo.com/')) {
                const videoId = videoUrl.split('/').pop();
                videoUrl = `https://player.vimeo.com/video/${videoId}`;
            }
            contentContainer.innerHTML = `<iframe src="${videoUrl}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
            break;
        case 'text':
            contentContainer.innerHTML = `<div class="p-8 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-2xl text-gray-900 dark:text-gray-300 min-h-[400px] prose dark:prose-invert max-w-none">${lesson.content}</div>`;
            break;
        case 'quiz':
            // Basic quiz display, can be expanded
            contentContainer.innerHTML = `<div class="p-8 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-2xl text-gray-900 dark:text-gray-300 min-h-[400px] flex items-center justify-center font-bold text-xl">Quiz: ${lesson.content}</div>`;
            break;
        default:
            contentContainer.innerHTML = `<div class="p-8 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-2xl text-red-500 min-h-[400px] flex items-center justify-center">Tipo de conteúdo não suportado.</div>`;
    }
}
