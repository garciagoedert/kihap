import { onAuthReady } from './auth.js';
import { db, storage } from './firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

let loadedBadgesCache = {};
let removeHeroFlag = false;

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
                    const button = document.getElementById('badge-image-btn') || badgeImageInput.parentElement.querySelector('button');
                    const previewDiv = document.getElementById('badge-image-preview');
                    const previewImg = document.getElementById('badge-image-preview-img');
                    const previewName = document.getElementById('badge-image-name');
                    if (file) {
                        if (button) {
                            const span = button.querySelector('span');
                            if (span) span.textContent = 'Ícone selecionado';
                            const icon = button.querySelector('i');
                            if (icon) icon.className = 'fas fa-check text-green-500';
                        }
                        if (previewDiv && previewImg && previewName) {
                            previewImg.src = URL.createObjectURL(file);
                            previewName.textContent = file.name;
                            previewDiv.classList.remove('hidden');
                            previewDiv.classList.add('flex');
                        }
                    }
                });
            }

            const badgeHeroInput = document.getElementById('badge-hero-image');
            if (badgeHeroInput) {
                badgeHeroInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    removeHeroFlag = false;
                    const button = document.getElementById('badge-hero-image-btn');
                    const previewDiv = document.getElementById('badge-hero-preview');
                    const previewImg = document.getElementById('badge-hero-preview-img');
                    const previewName = document.getElementById('badge-hero-name');
                    if (file) {
                        if (button) {
                            const span = button.querySelector('span');
                            if (span) span.textContent = 'Hero selecionado';
                            const icon = button.querySelector('i');
                            if (icon) icon.className = 'fas fa-check text-green-500';
                        }
                        if (previewDiv && previewImg && previewName) {
                            previewImg.src = URL.createObjectURL(file);
                            previewName.textContent = file.name;
                            previewDiv.classList.remove('hidden');
                            previewDiv.classList.add('flex');
                        }
                    }
                });
            }

            const removeHeroBtn = document.getElementById('remove-hero-btn');
            if (removeHeroBtn) {
                removeHeroBtn.addEventListener('click', () => {
                    removeHeroFlag = true;
                    if (badgeHeroInput) badgeHeroInput.value = '';
                    const button = document.getElementById('badge-hero-image-btn');
                    if (button) {
                        const span = button.querySelector('span');
                        if (span) span.textContent = 'Sem hero (padrão)';
                        const icon = button.querySelector('i');
                        if (icon) icon.className = 'fas fa-image text-gray-400';
                    }
                    const previewDiv = document.getElementById('badge-hero-preview');
                    if (previewDiv) {
                        previewDiv.classList.add('hidden');
                        previewDiv.classList.remove('flex');
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
                        const heroImageUrl = deleteBtn.dataset.heroImageUrl;
                        handleDeleteBadge(badgeId, imageUrl, heroImageUrl);
                        return;
                    }

                    const editBtn = e.target.closest('.edit-badge-btn');
                    if (editBtn) {
                        const badgeId = editBtn.dataset.id;
                        const badge = loadedBadgesCache[badgeId];
                        if (badge) {
                            startEditBadge(badge);
                        }
                        return;
                    }

                    const movePrevBtn = e.target.closest('.move-badge-prev-btn');
                    if (movePrevBtn) {
                        const card = movePrevBtn.closest('.badge-card');
                        const prevCard = card?.previousElementSibling;
                        if (card && prevCard && prevCard.classList.contains('badge-card')) {
                            prevCard.before(card);
                            saveBadgesOrder();
                        }
                        return;
                    }

                    const moveNextBtn = e.target.closest('.move-badge-next-btn');
                    if (moveNextBtn) {
                        const card = moveNextBtn.closest('.badge-card');
                        const nextCard = card?.nextElementSibling;
                        if (card && nextCard && nextCard.classList.contains('badge-card')) {
                            nextCard.after(card);
                            saveBadgesOrder();
                        }
                        return;
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
        const categoryLabels = {
            'graduacao': 'Graduação',
            'conquista': 'Conquista',
            'especial': 'Especial',
            'desafio': 'Desafio'
        };

        badgesList.forEach((badge, index) => {
            const categoryText = categoryLabels[badge.category] || badge.category || 'Graduação';
            const hasHero = Boolean(badge.heroImageUrl || badge.backgroundUrl);
            badgesHtml += `
                <div class="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-150 dark:border-gray-800/80 shadow-sm flex flex-col items-center text-center badge-card relative" draggable="true" data-id="${badge.id}">
                    <div class="absolute top-4 left-4 cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 transition-colors" title="Arrastar para reorganizar">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                    <span class="order-badge absolute top-4 right-4 text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">#${index + 1}</span>

                    <div class="relative w-24 h-24 rounded-full bg-gray-50 dark:bg-gray-800/30 p-1.5 border border-gray-100 dark:border-gray-700 shadow-inner flex items-center justify-center mb-3">
                        <img src="${badge.imageUrl}" alt="${badge.name}" class="w-full h-full rounded-full object-cover shadow-sm pointer-events-none">
                    </div>
                    <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 mb-1.5 inline-block">${categoryText}</span>
                    <h3 class="font-bold text-base text-gray-900 dark:text-white tracking-tight">${badge.name}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex-grow font-medium leading-relaxed">${badge.description || ''}</p>
                    
                    ${hasHero ? `
                        <div class="mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            <i class="fas fa-image text-[9px]"></i> Hero Personalizado
                        </div>
                    ` : ''}

                    ${badge.story ? `
                        <div class="mt-1.5 text-[10px] font-semibold text-primary flex items-center justify-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
                            <i class="fas fa-scroll text-[9px]"></i> Possui História/Lore
                        </div>
                    ` : ''}

                    <div class="flex items-center justify-between w-full mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60">
                        <button type="button" class="move-badge-prev-btn px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-[10px] transition-all flex items-center gap-1" title="Mover para esquerda">
                            <i class="fas fa-arrow-left text-[9px] pointer-events-none"></i>
                            <span class="pointer-events-none">Antes</span>
                        </button>
                        <span class="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">Ordem</span>
                        <button type="button" class="move-badge-next-btn px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-[10px] transition-all flex items-center gap-1" title="Mover para direita">
                            <span class="pointer-events-none">Depois</span>
                            <i class="fas fa-arrow-right text-[9px] pointer-events-none"></i>
                        </button>
                    </div>

                    <div class="flex gap-2 w-full mt-2">
                        <button data-id="${badge.id}" class="edit-badge-btn py-2 flex-1 bg-primary/10 hover:bg-primary text-primary hover:text-black font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                            <i class="fas fa-pencil-alt text-xs pointer-events-none"></i>
                            <span class="pointer-events-none">Editar</span>
                        </button>
                        <button data-id="${badge.id}" data-image-url="${badge.imageUrl}" data-hero-image-url="${badge.heroImageUrl || badge.backgroundUrl || ''}" class="delete-badge-btn py-2 px-3 bg-red-500/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center">
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
    removeHeroFlag = false;
    document.getElementById('badge-name').value = badge.name || '';
    
    const catInput = document.getElementById('badge-category');
    if (catInput) catInput.value = badge.category || 'graduacao';

    document.getElementById('badge-description').value = badge.description || '';

    const howToEarnInput = document.getElementById('badge-how-to-earn');
    if (howToEarnInput) howToEarnInput.value = badge.howToEarn || '';

    const storyInput = document.getElementById('badge-story');
    if (storyInput) storyInput.value = badge.story || '';
    
    const form = document.getElementById('add-badge-form');
    if (form) {
        form.dataset.editId = badge.id;
    }
    
    const imageInput = document.getElementById('badge-image');
    if (imageInput) {
        imageInput.removeAttribute('required');
        imageInput.value = '';
    }

    const heroInput = document.getElementById('badge-hero-image');
    if (heroInput) {
        heroInput.value = '';
    }
    
    const uploadBtn = document.getElementById('badge-image-btn') || form?.querySelector('button[type="button"]');
    if (uploadBtn) {
        const span = uploadBtn.querySelector('span');
        if (span) span.textContent = 'Manter imagem atual';
        const icon = uploadBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-image text-primary';
    }

    const imagePreviewDiv = document.getElementById('badge-image-preview');
    const imagePreviewImg = document.getElementById('badge-image-preview-img');
    const imagePreviewName = document.getElementById('badge-image-name');
    if (badge.imageUrl && imagePreviewDiv && imagePreviewImg && imagePreviewName) {
        imagePreviewImg.src = badge.imageUrl;
        imagePreviewName.textContent = 'Ícone Atual';
        imagePreviewDiv.classList.remove('hidden');
        imagePreviewDiv.classList.add('flex');
    }

    const heroBtn = document.getElementById('badge-hero-image-btn');
    const heroPreviewDiv = document.getElementById('badge-hero-preview');
    const heroPreviewImg = document.getElementById('badge-hero-preview-img');
    const heroPreviewName = document.getElementById('badge-hero-name');
    const currentHero = badge.heroImageUrl || badge.backgroundUrl;

    if (currentHero) {
        if (heroBtn) {
            const span = heroBtn.querySelector('span');
            if (span) span.textContent = 'Alterar fundo hero';
            const icon = heroBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-sync text-primary';
        }
        if (heroPreviewDiv && heroPreviewImg && heroPreviewName) {
            heroPreviewImg.src = currentHero;
            heroPreviewName.textContent = 'Hero Atual';
            heroPreviewDiv.classList.remove('hidden');
            heroPreviewDiv.classList.add('flex');
        }
    } else {
        if (heroBtn) {
            const span = heroBtn.querySelector('span');
            if (span) span.textContent = 'Escolher fundo hero';
            const icon = heroBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-image';
        }
        if (heroPreviewDiv) {
            heroPreviewDiv.classList.add('hidden');
            heroPreviewDiv.classList.remove('flex');
        }
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
    removeHeroFlag = false;
    const form = document.getElementById('add-badge-form');
    if (form) {
        form.reset();
        delete form.dataset.editId;
    }
    
    const catInput = document.getElementById('badge-category');
    if (catInput) catInput.value = 'graduacao';

    const howToEarnInput = document.getElementById('badge-how-to-earn');
    if (howToEarnInput) howToEarnInput.value = '';

    const storyInput = document.getElementById('badge-story');
    if (storyInput) storyInput.value = '';

    const imageInput = document.getElementById('badge-image');
    if (imageInput) {
        imageInput.setAttribute('required', 'true');
        imageInput.value = '';
    }

    const heroInput = document.getElementById('badge-hero-image');
    if (heroInput) {
        heroInput.value = '';
    }

    const uploadBtn = document.getElementById('badge-image-btn') || form?.querySelector('button[type="button"]');
    if (uploadBtn) {
        const span = uploadBtn.querySelector('span');
        if (span) span.textContent = 'Escolher ícone';
        const icon = uploadBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-cloud-upload-alt';
    }

    const imagePreviewDiv = document.getElementById('badge-image-preview');
    if (imagePreviewDiv) {
        imagePreviewDiv.classList.add('hidden');
        imagePreviewDiv.classList.remove('flex');
    }

    const heroBtn = document.getElementById('badge-hero-image-btn');
    if (heroBtn) {
        const span = heroBtn.querySelector('span');
        if (span) span.textContent = 'Escolher fundo hero';
        const icon = heroBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-image';
    }

    const heroPreviewDiv = document.getElementById('badge-hero-preview');
    if (heroPreviewDiv) {
        heroPreviewDiv.classList.add('hidden');
        heroPreviewDiv.classList.remove('flex');
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
    const badgeCategory = document.getElementById('badge-category')?.value || 'graduacao';
    const badgeDescription = document.getElementById('badge-description').value || '';
    const badgeHowToEarn = document.getElementById('badge-how-to-earn')?.value || '';
    const badgeStory = document.getElementById('badge-story')?.value || '';
    const badgeImageFile = document.getElementById('badge-image').files[0];
    const badgeHeroImageFile = document.getElementById('badge-hero-image')?.files[0];

    if (!editId && (!badgeName || !badgeImageFile)) {
        alert("Por favor, preencha o nome e selecione um ícone para o emblema.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = editId ? 'Salvando Alterações...' : 'Salvando...';

    try {
        let imageUrl = null;
        let heroImageUrl = null;
        
        if (badgeImageFile) {
            const imageRef = ref(storage, `badges/${Date.now()}_${badgeImageFile.name}`);
            const snapshot = await uploadBytes(imageRef, badgeImageFile);
            imageUrl = await getDownloadURL(snapshot.ref);
            
            // Delete old icon if editing and upload succeeds
            if (editId) {
                const oldBadge = loadedBadgesCache[editId];
                if (oldBadge && oldBadge.imageUrl && oldBadge.imageUrl.includes('firebasestorage')) {
                    try {
                        const oldImageRef = ref(storage, oldBadge.imageUrl);
                        await deleteObject(oldImageRef);
                    } catch (deleteOldErr) {
                        console.warn("Erro ao deletar imagem antiga no Storage:", deleteOldErr);
                    }
                }
            }
        }

        if (badgeHeroImageFile) {
            const heroRef = ref(storage, `badge_heroes/${Date.now()}_${badgeHeroImageFile.name}`);
            const heroSnapshot = await uploadBytes(heroRef, badgeHeroImageFile);
            heroImageUrl = await getDownloadURL(heroSnapshot.ref);

            // Delete old hero image if editing and upload succeeds
            if (editId) {
                const oldBadge = loadedBadgesCache[editId];
                const oldHero = oldBadge?.heroImageUrl || oldBadge?.backgroundUrl;
                if (oldHero && oldHero.includes('firebasestorage')) {
                    try {
                        const oldHeroRef = ref(storage, oldHero);
                        await deleteObject(oldHeroRef);
                    } catch (err) {
                        console.warn("Erro ao deletar hero antigo no Storage:", err);
                    }
                }
            }
        }

        if (editId) {
            const updateData = {
                name: badgeName,
                category: badgeCategory,
                description: badgeDescription,
                howToEarn: badgeHowToEarn,
                story: badgeStory,
                updatedAt: serverTimestamp()
            };
            if (imageUrl) {
                updateData.imageUrl = imageUrl;
            }
            if (heroImageUrl) {
                updateData.heroImageUrl = heroImageUrl;
            } else if (removeHeroFlag) {
                updateData.heroImageUrl = null;
                const oldBadge = loadedBadgesCache[editId];
                const oldHero = oldBadge?.heroImageUrl || oldBadge?.backgroundUrl;
                if (oldHero && oldHero.includes('firebasestorage')) {
                    try {
                        await deleteObject(ref(storage, oldHero));
                    } catch (err) {
                        console.warn("Erro ao deletar hero removido:", err);
                    }
                }
            }
            await updateDoc(doc(db, "badges", editId), updateData);
            alert("Emblema atualizado com sucesso!");
        } else {
            const existingCards = document.getElementById('badges-list-container').querySelectorAll('.badge-card');
            const newOrder = existingCards.length;

            await addDoc(collection(db, "badges"), {
                name: badgeName,
                category: badgeCategory,
                description: badgeDescription,
                howToEarn: badgeHowToEarn,
                story: badgeStory,
                imageUrl: imageUrl,
                heroImageUrl: heroImageUrl || null,
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

async function handleDeleteBadge(badgeId, imageUrl, heroImageUrl) {
    if (!confirm("Tem certeza que deseja excluir este emblema? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "badges", badgeId));

        if (imageUrl && imageUrl.includes('firebasestorage')) {
            try {
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
            } catch (e) {
                console.warn("Erro ao deletar ícone do storage:", e);
            }
        }

        if (heroImageUrl && heroImageUrl.includes('firebasestorage')) {
            try {
                const heroRef = ref(storage, heroImageUrl);
                await deleteObject(heroRef);
            } catch (e) {
                console.warn("Erro ao deletar hero do storage:", e);
            }
        }

        alert("Emblema excluído com sucesso!");
        loadBadges();

    } catch (error) {
        console.error("Erro ao excluir emblema: ", error);
        alert(`Ocorreu um erro ao excluir o emblema: ${error.message}`);
    }
}

let orderToastTimeout = null;
function showOrderFeedback(message, isSuccess = true) {
    let toast = document.getElementById('badges-order-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'badges-order-toast';
        document.body.appendChild(toast);
    }

    if (isSuccess) {
        toast.className = 'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold transition-all duration-300 transform translate-y-0 opacity-100 bg-emerald-600 text-white';
        toast.innerHTML = `<i class="fas fa-check-circle text-sm"></i> <span>${message}</span>`;
    } else {
        toast.className = 'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold transition-all duration-300 transform translate-y-0 opacity-100 bg-red-600 text-white';
        toast.innerHTML = `<i class="fas fa-exclamation-triangle text-sm"></i> <span>${message}</span>`;
    }

    if (orderToastTimeout) clearTimeout(orderToastTimeout);
    orderToastTimeout = setTimeout(() => {
        toast.className = 'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold transition-all duration-300 transform translate-y-10 opacity-0 pointer-events-none bg-emerald-600 text-white';
    }, 2500);
}

async function saveBadgesOrder() {
    const container = document.getElementById('badges-list-container');
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('.badge-card'));
    
    // Update badge visual numbers and in-memory cache immediately
    cards.forEach((card, index) => {
        const orderBadge = card.querySelector('.order-badge');
        if (orderBadge) {
            orderBadge.textContent = `#${index + 1}`;
        }
        const badgeId = card.dataset.id;
        if (badgeId && loadedBadgesCache[badgeId]) {
            loadedBadgesCache[badgeId].order = index;
        }
    });

    try {
        const batchPromises = cards.map((card, index) => {
            const badgeId = card.dataset.id;
            if (badgeId) {
                const docRef = doc(db, "badges", badgeId);
                return updateDoc(docRef, { order: index });
            }
        });
        await Promise.all(batchPromises);
        console.log("Badge order updated successfully in Firestore!");
        showOrderFeedback("Ordem dos emblemas salva!");
    } catch (error) {
        console.error("Error saving badge order: ", error);
        showOrderFeedback("Erro ao salvar ordem: " + error.message, false);
    }
}

