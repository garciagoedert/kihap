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
        moduleHeader.classList.add('module-header', 'flex', 'justify-between', 'items-center', 'cursor-pointer', 'p-2', 'hover:bg-gray-700', 'rounded-md');
        moduleHeader.innerHTML = `
            <h3 class="font-semibold text-lg text-white">${module.title}</h3>
            <i class="fas fa-chevron-down text-gray-400 transition-transform"></i>
        `;

        const lessonsList = document.createElement('ul');
        lessonsList.className = 'space-y-1 mt-1 pl-4 border-l border-gray-700 ml-2 hidden'; // Oculto por padrão
        
        module.lessons.forEach((lesson, lessonIndex) => {
            const lessonEl = document.createElement('li');
            lessonEl.innerHTML = `
                <a href="#" class="flex items-center gap-2 text-gray-300 hover:text-white p-1 rounded-md" data-module="${moduleIndex}" data-lesson="${lessonIndex}">
                    <i class="far fa-play-circle"></i>
                    <span>${lesson.title}</span>
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
            contentContainer.innerHTML = `<div class="p-6 bg-gray-800 rounded-lg">${lesson.content}</div>`;
            break;
        case 'quiz':
            // Basic quiz display, can be expanded
            contentContainer.innerHTML = `<div class="p-6 bg-gray-800 rounded-lg">Quiz: ${lesson.content}</div>`;
            break;
        default:
            contentContainer.innerHTML = `<div class="p-6 bg-gray-800 rounded-lg">Tipo de conteúdo não suportado.</div>`;
    }
}
