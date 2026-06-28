import { onAuthReady } from './auth.js';
import { db, storage } from './firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

let loadedBadgesCache = {};

export function setupGerenciarEmblemasPage() {
    onAuthReady(user => {
        if (user) {
            const addBadgeForm = document.getElementById('add-badge-form');
            if (addBadgeForm) {
                addBadgeForm.addEventListener('submit', handleAddBadge);
            }

            const badgeImageInput = document.getElementById('badge-image');
            if (badgeImageInput) {
                badgeImageInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    const button = badgeImageInput.parentElement.querySelector('button');
                    if (file && button) {
                        const span = button.querySelector('span');
                        if (span) {
                            span.textContent = file.name;
                        }
                        const icon = button.querySelector('i');
                        if (icon) {
                            icon.className = 'fas fa-check text-green-500';
                        }
                    }
                });
            }

            const container = document.getElementById('badges-list-container');
            if (container) {
                // Event delegation for Edit and Delete buttons
                container.addEventListener('click', (e) => {
                    const deleteBtn = e.target.closest('.delete-badge-btn');
                    if (deleteBtn) {
                        const badgeId = deleteBtn.dataset.id;
                        const imageUrl = deleteBtn.dataset.imageUrl;
                        handleDeleteBadge(badgeId, imageUrl);
                        return;
                    }

                    const editBtn = e.target.closest('.edit-badge-btn');
                    if (editBtn) {
                        const badgeId = editBtn.dataset.id;
                        const badge = loadedBadgesCache[badgeId];
                        if (badge) {
                            startEditBadge(badge);
                        }
                    }
                });

                // HTML5 Drag and Drop event delegation for reordering
                let draggedItem = null;

                container.addEventListener('dragstart', (e) => {
                    const card = e.target.closest('.badge-card');
                    if (card) {
                        draggedItem = card;
                        card.classList.add('opacity-40');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', card.dataset.id);
                    }
                });

                container.addEventListener('dragend', (e) => {
                    if (draggedItem) {
                        draggedItem.classList.remove('opacity-40');
                        draggedItem = null;
                    }
                    const cards = container.querySelectorAll('.badge-card');
                    cards.forEach(card => card.classList.remove('border-primary', 'border-2'));
                });

                container.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const card = e.target.closest('.badge-card');
                    if (card && card !== draggedItem) {
                        card.classList.add('border-primary', 'border-2');
                    }
                });

                container.addEventListener('dragleave', (e) => {
                    const card = e.target.closest('.badge-card');
                    if (card) {
                        card.classList.remove('border-primary', 'border-2');
                    }
                });

                container.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    const targetCard = e.target.closest('.badge-card');
                    if (targetCard && draggedItem && targetCard !== draggedItem) {
                        const children = Array.from(container.children).filter(el => el.classList.contains('badge-card'));
                        const draggedIdx = children.indexOf(draggedItem);
                        const targetIdx = children.indexOf(targetCard);

                        if (draggedIdx < targetIdx) {
                            targetCard.after(draggedItem);
                        } else {
                            targetCard.before(draggedItem);
                        }

                        targetCard.classList.remove('border-primary', 'border-2');

                        // Save new order to Firestore
                        await saveBadgesOrder();
                    }
                });
            }

            loadBadges();
        }
    });
}

async function loadBadges() {
    const container = document.getElementById('badges-list-container');
    if (!container) return;
    container.innerHTML = '<p class="col-span-full text-center text-gray-400 italic p-12"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando emblemas...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "badges"));

        if (querySnapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-400 italic p-12">Nenhum emblema cadastrado ainda.</p>';
            return;
        }

        // Cache all badges and sort by 'order' asc, falling back to alphabetical 'name'
        loadedBadgesCache = {};
        const badgesList = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const badge = { id: doc.id, ...data };
            loadedBadgesCache[doc.id] = badge;
            badgesList.push(badge);
        });

        badgesList.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 9999;
            const orderB = b.order !== undefined ? b.order : 9999;
            return orderA - orderB || a.name.localeCompare(b.name);
        });

        let badgesHtml = '';
        badgesList.forEach(badge => {
            badgesHtml += `
                <div class="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-150 dark:border-gray-800/80 shadow-sm flex flex-col items-center text-center badge-card relative" draggable="true" data-id="${badge.id}">
                    <div class="absolute top-4 left-4 cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 transition-colors" title="Arrastar para reorganizar">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                    <div class="relative w-24 h-24 rounded-full bg-gray-50 dark:bg-gray-800/30 p-1.5 border border-gray-100 dark:border-gray-700 shadow-inner flex items-center justify-center mb-4">
                        <img src="${badge.imageUrl}" alt="${badge.name}" class="w-full h-full rounded-full object-cover shadow-sm pointer-events-none">
                    </div>
                    <h3 class="font-bold text-base text-gray-900 dark:text-white tracking-tight">${badge.name}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 flex-grow font-medium leading-relaxed">${badge.description}</p>
                    
                    <div class="flex gap-2 w-full mt-4">
                        <button data-id="${badge.id}" class="edit-badge-btn py-2 flex-1 bg-primary/10 hover:bg-primary text-primary hover:text-black font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                            <i class="fas fa-pencil-alt text-xs pointer-events-none"></i>
                            <span class="pointer-events-none">Editar</span>
                        </button>
                        <button data-id="${badge.id}" data-image-url="${badge.imageUrl}" class="delete-badge-btn py-2 px-3 bg-red-500/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center">
                            <i class="fas fa-trash-alt text-xs pointer-events-none"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = badgesHtml;

    } catch (error) {
        console.error("Erro ao carregar emblemas: ", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Ocorreu um erro ao carregar os emblemas.</p>';
    }
}

function startEditBadge(badge) {
    document.getElementById('badge-name').value = badge.name;
    document.getElementById('badge-description').value = badge.description;
    
    const form = document.getElementById('add-badge-form');
    if (form) {
        form.dataset.editId = badge.id;
    }
    
    const imageInput = document.getElementById('badge-image');
    if (imageInput) {
        imageInput.removeAttribute('required');
    }
    
    const uploadBtn = form ? form.querySelector('button[type="button"]') : null;
    if (uploadBtn) {
        const span = uploadBtn.querySelector('span');
        if (span) span.textContent = 'Manter imagem atual';
        const icon = uploadBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-image text-primary';
    }

    const header = form ? form.parentElement.querySelector('h2') : null;
    if (header) {
        header.innerHTML = `<i class="fas fa-pencil-alt text-primary"></i> Editar Emblema: <span class="text-primary">${badge.name}</span>`;
    }

    const submitBtn = document.getElementById('submit-badge-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Salvar Alterações';
    }

    let cancelBtn = document.getElementById('cancel-edit-btn');
    if (!cancelBtn && submitBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.className = 'px-6 py-4 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all text-xs uppercase tracking-widest mr-4';
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.addEventListener('click', cancelEditBadge);
        submitBtn.before(cancelBtn);
    }
    
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEditBadge() {
    const form = document.getElementById('add-badge-form');
    if (form) {
        form.reset();
        delete form.dataset.editId;
    }
    
    const imageInput = document.getElementById('badge-image');
    if (imageInput) {
        imageInput.setAttribute('required', 'true');
    }

    const uploadBtn = form ? form.querySelector('button[type="button"]') : null;
    if (uploadBtn) {
        const span = uploadBtn.querySelector('span');
        if (span) span.textContent = 'Escolher ícone';
        const icon = uploadBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-cloud-upload-alt';
    }

    const header = form ? form.parentElement.querySelector('h2') : null;
    if (header) {
        header.innerHTML = `<i class="fas fa-shield-halved text-primary"></i> Adicionar Novo Emblema`;
    }

    const submitBtn = document.getElementById('submit-badge-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Salvar Emblema';
    }

    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
}

async function handleAddBadge(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-badge-btn');
    const form = e.target;
    const editId = form.dataset.editId;
    
    const badgeName = document.getElementById('badge-name').value;
    const badgeDescription = document.getElementById('badge-description').value || "";
    const badgeImageFile = document.getElementById('badge-image').files[0];

    if (!editId && (!badgeName || !badgeImageFile)) {
        alert("Por favor, preencha o nome e selecione uma imagem.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = editId ? 'Salvando Alterações...' : 'Salvando...';

    try {
        let imageUrl = null;
        
        if (badgeImageFile) {
            const imageRef = ref(storage, `badges/${Date.now()}_${badgeImageFile.name}`);
            const snapshot = await uploadBytes(imageRef, badgeImageFile);
            imageUrl = await getDownloadURL(snapshot.ref);
            
            // Delete old image if editing and upload succeeds
            if (editId) {
                const oldBadge = loadedBadgesCache[editId];
                if (oldBadge && oldBadge.imageUrl) {
                    try {
                        const oldImageRef = ref(storage, oldBadge.imageUrl);
                        await deleteObject(oldImageRef);
                    } catch (deleteOldErr) {
                        console.warn("Erro ao deletar imagem antiga no Storage:", deleteOldErr);
                    }
                }
            }
        }

        if (editId) {
            const updateData = {
                name: badgeName,
                description: badgeDescription,
                updatedAt: serverTimestamp()
            };
            if (imageUrl) {
                updateData.imageUrl = imageUrl;
            }
            await updateDoc(doc(db, "badges", editId), updateData);
            alert("Emblema atualizado com sucesso!");
        } else {
            const existingCards = document.getElementById('badges-list-container').querySelectorAll('.badge-card');
            const newOrder = existingCards.length;

            await addDoc(collection(db, "badges"), {
                name: badgeName,
                description: badgeDescription,
                imageUrl: imageUrl,
                order: newOrder,
                createdAt: serverTimestamp()
            });
            alert("Emblema adicionado com sucesso!");
        }

        cancelEditBadge();
        loadBadges();

    } catch (error) {
        console.error("Erro ao salvar emblema: ", error);
        alert(`Ocorreu um erro ao salvar o emblema: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editId ? 'Salvar Alterações' : 'Salvar Emblema';
    }
}

async function handleDeleteBadge(badgeId, imageUrl) {
    if (!confirm("Tem certeza que deseja excluir este emblema? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "badges", badgeId));

        if (imageUrl) {
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef);
        }

        alert("Emblema excluído com sucesso!");
        loadBadges();

    } catch (error) {
        console.error("Erro ao excluir emblema: ", error);
        alert(`Ocorreu um erro ao excluir o emblema: ${error.message}`);
    }
}

async function saveBadgesOrder() {
    const container = document.getElementById('badges-list-container');
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('.badge-card'));
    
    try {
        const batchPromises = cards.map((card, index) => {
            const badgeId = card.dataset.id;
            if (badgeId) {
                const docRef = doc(db, "badges", badgeId);
                return updateDoc(docRef, { order: index });
            }
        });
        await Promise.all(batchPromises);
        console.log("Badge order updated successfully!");
    } catch (error) {
        console.error("Error saving badge order: ", error);
    }
}
