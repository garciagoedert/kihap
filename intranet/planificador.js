import { db, storage } from './firebase-config.js';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { onAuthReady } from './auth.js';

// DOM Elements
const plansList = document.getElementById('plans-list');
const addPlanBtn = document.getElementById('add-plan-btn');
const planModal = document.getElementById('plan-modal');
const closePlanModalBtn = document.getElementById('close-plan-modal');
const cancelPlanBtn = document.getElementById('cancel-plan-btn');
const deletePlanBtn = document.getElementById('delete-plan-btn');
const planForm = document.getElementById('plan-form');
const planIdInput = document.getElementById('plan-id');
const planTitleInput = document.getElementById('plan-title');
const mediaUploadInput = document.getElementById('media-upload');
const mediaListContainer = document.getElementById('media-list');
const uploadStatus = document.getElementById('upload-status');
const modalTitle = document.getElementById('modal-title');
const youtubeLinkInput = document.getElementById('youtube-link');
const addYoutubeBtn = document.getElementById('add-youtube-btn');
const planCategoryInput = document.getElementById('plan-category');


// View Modal Elements
const viewModal = document.getElementById('view-modal');
const closeViewModalBtn = document.getElementById('close-view-modal');
const viewPlanTitle = document.getElementById('view-plan-title');
const viewPlanCategory = document.getElementById('view-plan-category');
const viewPlanMeta = document.getElementById('view-plan-meta');
const viewPlanContent = document.getElementById('view-plan-content');
const viewMediaList = document.getElementById('view-media-list');
const editPlanBtnView = document.getElementById('edit-plan-btn-view');

let currentMediaFiles = []; // Array to store { name, url, type, path }
let currentUser = null;
let quill; // Quill instance

// Initialization
onAuthReady(async (user) => {
    if (!user) return; // Auth redirects handled in auth.js

    // Initialize Quill
    if (document.getElementById('editor-container')) {
        quill = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                ]
            }
        });
    }
    if (!user) return; // Auth redirects handled in auth.js

    // Check permissions
    if (!user.isAdmin && !user.isInstructor) {
        alert("Acesso restrito a professores e administradores.");
        window.location.href = 'index.html';
        return;
    }

    currentUser = user;

    loadPlans();
    setupEventListeners();
});

function setupEventListeners() {
    addPlanBtn.addEventListener('click', openNewPlanModal);
    closePlanModalBtn.addEventListener('click', closeModal);
    cancelPlanBtn.addEventListener('click', closeModal);
    planForm.addEventListener('submit', handleFormSubmit);
    mediaUploadInput.addEventListener('change', handleFileUpload);
    addYoutubeBtn.addEventListener('click', handleYouTubeAdd);

    // Modal Delete Button
    deletePlanBtn.addEventListener('click', () => {
        const id = planIdInput.value;
        if (id) deletePlan(id);
    });

    // View Modal Listeners
    closeViewModalBtn.addEventListener('click', closeViewModal);
    editPlanBtnView.addEventListener('click', () => {
        const id = editPlanBtnView.dataset.id;
        if (id) {
            closeViewModal();
            openEditPlanModal(id);
        }
    });
}

function handleYouTubeAdd() {
    const url = youtubeLinkInput.value.trim();
    if (!url) return;

    const videoId = extractYouTubeID(url);
    if (!videoId) {
        alert("Link do YouTube inválido.");
        return;
    }

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/0.jpg`;

    currentMediaFiles.push({
        name: 'YouTube Video',
        url: url,
        type: 'youtube',
        thumbnail: thumbnailUrl
    });

    youtubeLinkInput.value = '';
    renderMediaList();
}

function extractYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// --- Plans CRUD ---

async function loadPlans() {
    plansList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin text-2xl"></i> Carregando planos...</div>';

    try {
        const q = query(
            collection(db, "plans"),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);

        plansList.innerHTML = '';

        if (querySnapshot.empty) {
            plansList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">Nenhum plano de aula encontrado.</div>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const plan = doc.data();
            const planEl = createPlanCard(doc.id, plan);
            plansList.appendChild(planEl);
        });
    } catch (error) {
        console.error("Erro ao carregar planos:", error);
        plansList.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">Erro ao carregar planos.</div>';
    }
}

function createPlanCard(id, plan) {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded-lg p-5 shadow-lg flex flex-col hover:bg-gray-750 transition-colors border border-gray-700 cursor-pointer group relative';

    // Category Badge Color
    let badgeClass = 'bg-gray-600';
    if (plan.category === 'A') badgeClass = 'bg-blue-600';
    if (plan.category === 'B') badgeClass = 'bg-green-600';
    if (plan.category === 'C') badgeClass = 'bg-purple-600';

    // Pre-formatting content snippet
    // Pre-formatting content snippet (strip HTML tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = plan.content || '';
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const snippet = textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '');

    const dateCreated = plan.createdAt ? new Date(plan.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desc.';
    const scheduledDateFormatted = plan.scheduledDate ? new Date(plan.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR') : dateCreated;

    div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex flex-col">
                <span class="${badgeClass} text-white text-[10px] font-bold px-2 py-0.5 rounded w-fit mb-3 mt-2">TIPO ${plan.category || 'A'}</span>
                <h3 class="text-xl font-bold text-white truncate w-full" title="${plan.title}">${plan.title}</h3>
            </div>
            ${plan.media && plan.media.length > 0 ? '<i class="fas fa-paperclip text-gray-400 ml-2" title="Possui anexos"></i>' : ''}
        </div>
        <div class="text-xs text-blue-400 mb-3 font-mono border-b border-gray-700 pb-2">
            ${plan.authorName || 'Autor desconhecido'} • ${dateCreated}
        </div>
        <p class="text-gray-400 text-sm whitespace-pre-wrap flex-grow mb-4 overflow-hidden h-24">${snippet}</p>
        
        <div class="flex justify-end space-x-2 mt-auto pt-2 border-t border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-xs text-gray-500">Clique para visualizar</span>
        </div>
    `;

    // Click on card opens View Modal
    div.addEventListener('click', () => openViewModal(id));

    // Delete button (prevent bubbling to card click)
    /* 
    div.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deletePlan(id);
    });
    */

    return div;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = planIdInput.value;
    const title = planTitleInput.value;
    const category = planCategoryInput.value;
    const content = quill.root.innerHTML; // Get HTML from Quill

    const planData = {
        title,
        category,
        content,
        media: currentMediaFiles,
        updatedAt: serverTimestamp()
    };

    const submitBtn = document.getElementById('save-plan-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        if (id) {
            // Update
            await updateDoc(doc(db, "plans", id), planData);
        } else {
            // Create
            planData.createdAt = serverTimestamp();
            planData.createdBy = currentUser.id || currentUser.uid;
            planData.authorName = currentUser.name || currentUser.email;
            await addDoc(collection(db, "plans"), planData);
        }

        closeModal();
        loadPlans();
    } catch (error) {
        console.error("Erro ao salvar plano:", error);
        alert("Erro ao salvar plano: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

async function deletePlan(id) {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
        await deleteDoc(doc(db, "plans", id));
        // Note: Ideally we should also delete files from Storage, but keeping it simple for now or could implement cloud function.
        // If we want client side deletion:
        // We would need to fetch the doc first to get file paths, then delete.
        closeModal(); // Close modal if open
        loadPlans();
    } catch (error) {
        console.error("Erro ao excluir plano:", error);
        alert("Erro ao excluir plano.");
    }
}

// --- Modals ---

function openNewPlanModal() {
    resetForm();
    modalTitle.textContent = "Novo Plano de Aula";
    deletePlanBtn.classList.add('hidden'); // Hide delete button for new plans
    planModal.classList.remove('hidden');
}

async function openEditPlanModal(id) {
    try {
        const docSnap = await getDoc(doc(db, "plans", id));
        if (!docSnap.exists()) {
            alert("Plano não encontrado!");
            return;
        }

        const data = docSnap.data();

        planIdInput.value = id;
        planTitleInput.value = data.title;
        planCategoryInput.value = data.category || 'A';
        quill.root.innerHTML = data.content || ''; // Set HTML to Quill
        currentMediaFiles = data.media || [];

        renderMediaList();

        modalTitle.textContent = "Editar Plano de Aula";
        deletePlanBtn.classList.remove('hidden'); // Show delete button for existing plans
        planModal.classList.remove('hidden');
    } catch (error) {
        console.error("Erro ao abrir plano:", error);
        alert("Erro ao carregar detalhes do plano.");
    }
}

async function openViewModal(id) {
    try {
        const docSnap = await getDoc(doc(db, "plans", id));
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const dateCreated = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desc.';

        viewPlanTitle.textContent = data.title;
        viewPlanContent.innerHTML = data.content; // Render HTML
        viewPlanCategory.textContent = `TIPO ${data.category || 'A'}`;
        viewPlanCategory.className = `text-white text-xs px-2 py-1 rounded ${data.category === 'B' ? 'bg-green-600' : data.category === 'C' ? 'bg-purple-600' : 'bg-blue-600'}`;
        viewPlanMeta.textContent = `${data.authorName || 'Desconhecido'} • ${dateCreated}`;

        // Store ID for edit button
        editPlanBtnView.dataset.id = id;

        // Render Media for View
        viewMediaList.innerHTML = '';
        if (data.media && data.media.length > 0) {
            data.media.forEach(media => {
                const item = document.createElement('div');
                item.className = 'bg-gray-900 rounded-lg overflow-hidden border border-gray-700 h-40 flex items-center justify-center relative group';

                let contentHTML = '';
                if (media.type === 'image') {
                    contentHTML = `<img src="${media.url}" class="w-full h-full object-cover">`;
                } else if (media.type === 'youtube') {
                    contentHTML = `
                        <img src="${media.thumbnail || 'https://img.youtube.com/vi/default/0.jpg'}" class="w-full h-full object-cover opacity-70">
                        <div class="absolute inset-0 flex items-center justify-center">
                            <i class="fab fa-youtube text-red-600 text-5xl bg-white rounded-full"></i>
                        </div>
                    `;
                } else {
                    contentHTML = `
                        <div class="text-center">
                            <i class="fas fa-video text-4xl mb-2"></i>
                            <p class="text-xs truncate max-w-[120px] px-2">${media.name}</p>
                        </div>
                    `;
                }

                item.innerHTML = `
                    <a href="${media.url}" target="_blank" class="w-full h-full flex items-center justify-center">
                        ${contentHTML}
                    </a>
                `;
                viewMediaList.appendChild(item);
            });
        } else {
            viewMediaList.innerHTML = '<p class="text-gray-500 text-sm italic col-span-full">Nenhum anexo.</p>';
        }

        viewModal.classList.remove('hidden');
    } catch (error) {
        console.error("Erro ao abrir visualização:", error);
    }
}

function closeViewModal() {
    viewModal.classList.add('hidden');
}

function closeModal() {
    planModal.classList.add('hidden');
    resetForm();
}

function resetForm() {
    planForm.reset();
    planIdInput.value = '';
    if (quill) quill.root.innerHTML = ''; // Reset Quill
    currentMediaFiles = [];
    mediaListContainer.innerHTML = '';
    uploadStatus.textContent = '';
}

// --- Media Upload ---

async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files.length) return;

    uploadStatus.textContent = 'Enviando...';

    for (const file of files) {
        try {
            // Generate unique path
            const timestamp = Date.now();
            const storagePath = `plans_media/${currentUser.uid}/${timestamp}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const type = file.type.startsWith('image/') ? 'image' : 'video';

            currentMediaFiles.push({
                name: file.name,
                url: downloadURL,
                path: storagePath,
                type: type
            });

        } catch (error) {
            console.error("Erro no upload:", error);
            alert(`Erro ao enviar ${file.name}`);
        }
    }

    uploadStatus.textContent = 'Upload concluído!';
    setTimeout(() => uploadStatus.textContent = '', 2000);

    renderMediaList();
    e.target.value = ''; // Reset input
}

function renderMediaList() {
    mediaListContainer.innerHTML = '';

    currentMediaFiles.forEach((media, index) => {
        const div = document.createElement('div');
        div.className = 'relative group bg-gray-900 rounded-lg overflow-hidden border border-gray-700 h-32 flex items-center justify-center';

        let content = '';
        if (media.type === 'image') {
            content = `<img src="${media.url}" class="w-full h-full object-cover">`;
        } else if (media.type === 'youtube') {
            content = `
                <div class="relative w-full h-full">
                    <img src="${media.thumbnail || 'https://img.youtube.com/vi/default/0.jpg'}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <i class="fab fa-youtube text-red-600 text-4xl bg-white rounded-full"></i>
                    </div>
                </div>
            `;
        } else {
            content = `
                <div class="text-center">
                    <i class="fas fa-video text-3xl mb-1"></i>
                    <p class="text-xs truncate max-w-[100px] px-2">${media.name}</p>
                </div>
            `;
        }

        div.innerHTML = `
            ${content}
            <div class="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                <a href="${media.url}" target="_blank" class="text-blue-400 hover:text-blue-300 p-1" title="Visualizar">
                    <i class="fas fa-external-link-alt"></i>
                </a>
                <button type="button" class="text-red-400 hover:text-red-300 p-1 delete-media-btn" data-index="${index}" title="Remover">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        div.querySelector('.delete-media-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // prevent triggering other clicks if any
            removeMedia(index);
        });

        mediaListContainer.appendChild(div);
    });
}

function removeMedia(index) {
    // Note: We are removing from the list to be saved, but not deleting from storage immediately to avoid accidental data loss if the user cancels.
    // Ideally we would delete from storage if the user confirms "Save", or have a cleanup process.
    // For now, we just remove the reference.
    currentMediaFiles.splice(index, 1);
    renderMediaList();
}
