import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import { onAuthReady } from './auth.js';

let courseData = null;
let courseId = null;
let user = null;
let userProgress = [];
let currentLessonIdentifier = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    setupUIListeners();

    onAuthReady(currentUser => {
        if (currentUser) {
            user = currentUser;
            const params = new URLSearchParams(window.location.search);
            courseId = params.get('courseId');
            if (courseId) {
                loadCourse(courseId);
            } else {
                alert('Nenhum curso selecionado.');
                window.location.href = 'cursos.html';
            }
        }
    });
});

async function loadCourse(id) {
    const courseRef = doc(db, "courses", id);
    const progressRef = doc(db, "users", user.uid, "course_progress", id);
    
    const [courseSnap, progressSnap] = await Promise.all([getDoc(courseRef), getDoc(progressRef)]);

    if (courseSnap.exists()) {
        courseData = courseSnap.data();
        if (progressSnap.exists()) {
            userProgress = progressSnap.data().completedLessons || [];
        }
        
        document.title = `${courseData.title} - Player do Curso`;
        document.getElementById('course-title-sidebar').textContent = courseData.title;
        renderModules();
        
        if (courseData.modules?.[0]?.lessons?.[0]) {
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
        moduleEl.innerHTML = `<h3 class="font-semibold text-lg text-white">${module.title}</h3>`;
        const lessonsList = document.createElement('ul');
        lessonsList.className = 'space-y-1 mt-1 pl-2';
        module.lessons.forEach((lesson, lessonIndex) => {
            const lessonIdentifier = `${moduleIndex}-${lessonIndex}`;
            const isCompleted = userProgress.includes(lessonIdentifier);
            const lessonEl = document.createElement('li');
            lessonEl.innerHTML = `
                <a href="#" class="flex items-center gap-2 text-gray-300 hover:text-white p-1 rounded-md" data-module="${moduleIndex}" data-lesson="${lessonIndex}">
                    <i class="${isCompleted ? 'fas fa-check-circle text-green-500' : 'far fa-play-circle'}"></i>
                    <span>${lesson.title}</span>
                </a>
            `;
            lessonsList.appendChild(lessonEl);
        });
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
    currentLessonIdentifier = `${moduleIndex}-${lessonIndex}`;
    const lesson = courseData.modules[moduleIndex].lessons[lessonIndex];
    document.getElementById('lesson-title').textContent = lesson.title;
    document.getElementById('lesson-description').innerHTML = lesson.description || '';
    
    updateCompleteButton();

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

function updateCompleteButton() {
    const btn = document.getElementById('complete-lesson-btn');
    if (userProgress.includes(currentLessonIdentifier)) {
        btn.textContent = 'Aula Concluída';
        btn.classList.replace('bg-green-600', 'bg-gray-500');
        btn.classList.replace('hover:bg-green-700', 'hover:bg-gray-600');
    } else {
        btn.textContent = 'Marcar como Concluída';
        btn.classList.replace('bg-gray-500', 'bg-green-600');
        btn.classList.replace('hover:bg-gray-600', 'hover:bg-green-700');
    }
}

async function toggleLessonCompletion() {
    const progressRef = doc(db, "users", user.uid, "course_progress", courseId);
    const isCompleted = userProgress.includes(currentLessonIdentifier);

    try {
        if (isCompleted) {
            await setDoc(progressRef, { completedLessons: arrayRemove(currentLessonIdentifier) }, { merge: true });
            userProgress = userProgress.filter(id => id !== currentLessonIdentifier);
        } else {
            await setDoc(progressRef, { completedLessons: arrayUnion(currentLessonIdentifier) }, { merge: true });
            userProgress.push(currentLessonIdentifier);
        }
        renderModules();
        updateCompleteButton();
    } catch (error) {
        console.error("Error updating progress:", error);
        alert("Erro ao atualizar o progresso.");
    }
}

document.getElementById('complete-lesson-btn').addEventListener('click', toggleLessonCompletion);
