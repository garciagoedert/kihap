import { db, storage, functions, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, deleteDoc, doc, getDoc, where, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { EmojiButton } from 'https://cdn.skypack.dev/@joeattardi/emoji-button@4.6.4';
import { getAllUsers, getUserData } from './auth.js';
import { getUnidades } from './common-ui.js';

// Funções utilitárias de normalização e checagem de unidades
export function normalizeUnitSlug(val) {
    if (!val || typeof val !== 'string') return '';
    return val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^kihap\s*-\s*/i, '')
        .replace(/^kihap\s+/i, '')
        .replace(/^unidade\s+/i, '')
        .replace(/\s*\(.*\)\s*/g, '')
        .trim()
        .replace(/[\s_]+/g, '-');
}

export function getUserUnitSlugs(userData) {
    if (!userData) return [];
    const rawUnits = [userData.unitId, userData.unidade, userData.unit, userData.branchName];
    if (Array.isArray(userData.units)) rawUnits.push(...userData.units);
    if (Array.isArray(userData.unidades)) rawUnits.push(...userData.unidades);
    return Array.from(new Set(rawUnits.map(normalizeUnitSlug).filter(Boolean)));
}

export function isItemForUserUnits(item, userUnitSlugs) {
    const targetUnit = normalizeUnitSlug(item.targetUnit);
    if (!targetUnit || targetUnit === 'all' || targetUnit === 'todas') {
        return true;
    }
    if (userUnitSlugs.includes(targetUnit)) {
        return true;
    }
    if (Array.isArray(item.targetUnits) && item.targetUnits.length > 0) {
        const targetSlugs = item.targetUnits.map(normalizeUnitSlug);
        if (targetSlugs.includes('all') || targetSlugs.includes('todas')) {
            return true;
        }
        if (targetSlugs.some(slug => userUnitSlugs.includes(slug))) {
            return true;
        }
    }
    return false;
}

export const initFeedPage = () => {
    const postForm = document.getElementById('post-form');
    const unitsCheckboxesContainer = document.getElementById('units-checkboxes-container');
    const feedList = document.getElementById('feed-list');

    // UI state for targeting
    let selectedStudents = [];
    let allUsersCache = [];
    let userProfileCache = new Map();

    // Inicializar Quill Editor
    const quill = new Quill('#post-editor', {
        theme: 'snow',
        placeholder: 'O que você quer compartilhar hoje?',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image']
            ]
        }
    });

    // Inicializar Quill para Edição
    const editQuill = new Quill('#edit-post-editor', {
        theme: 'snow',
        placeholder: 'Altere o conteúdo da postagem...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image']
            ]
        }
    });

    let currentEditingPost = null;

    const editModal = document.getElementById('edit-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveEditBtn = document.getElementById('save-edit-btn');
    
    const closeEditModal = () => {
        editModal.classList.add('hidden');
        currentEditingPost = null;
    };
    
    closeEditModalBtn?.addEventListener('click', closeEditModal);
    cancelEditBtn?.addEventListener('click', closeEditModal);

    saveEditBtn?.addEventListener('click', async () => {
        if (!currentEditingPost) return;
        
        const newContent = editQuill.root.innerHTML;
        const plainText = editQuill.getText().trim();
        
        if (!plainText && newContent === '<p><br></p>') {
            alert('O conteúdo não pode ficar vazio!');
            return;
        }

        saveEditBtn.disabled = true;
        saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            if (currentEditingPost.batchId) {
                const qUpdate = query(collection(db, 'feed'), where('batchId', '==', currentEditingPost.batchId));
                const snapUpdate = await getDocs(qUpdate);
                const updatePromises = [];
                snapUpdate.forEach(docUpdate => {
                    updatePromises.push(updateDoc(doc(db, 'feed', docUpdate.id), {
                        content: newContent
                    }));
                });
                await Promise.all(updatePromises);
            } else {
                await updateDoc(doc(db, 'feed', currentEditingPost.id), {
                    content: newContent
                });
            }
            closeEditModal();
            loadPosts();
        } catch (e) {
            console.error("Erro ao salvar edição:", e);
            alert("Erro ao salvar as alterações.");
        } finally {
            saveEditBtn.disabled = false;
            saveEditBtn.innerHTML = 'Salvar Alterações';
        }
    });
    // Inicializar Emoji Picker
    const picker = new EmojiButton({ theme: 'dark' });
    const trigger = document.querySelector('#emoji-trigger');

    if (picker && trigger) {
        picker.on('emoji', selection => {
            const range = quill.getSelection();
            if (range) {
                quill.insertText(range.index, selection);
            } else {
                quill.insertText(quill.getLength(), selection);
            }
        });

        trigger.addEventListener('click', () => picker.togglePicker(trigger));
    }

    // Seletor de Modo: Post Comum, Story ou Banner
    let currentFeedMode = 'post';
    const modePostBtn = document.getElementById('mode-post-btn');
    const modeStoryBtn = document.getElementById('mode-story-btn');
    const modeBannerBtn = document.getElementById('mode-banner-btn');
    const formHeaderIcon = document.getElementById('form-header-icon');
    const formHeaderText = document.getElementById('form-header-text');
    const postFields = document.getElementById('post-fields');
    const bannerFields = document.getElementById('banner-fields');
    const editorWrapper = document.getElementById('editor-wrapper');
    const ctaContainer = document.getElementById('toggle-cta')?.parentElement;
    const submitBtnText = document.getElementById('submit-btn-text');
    const submitBtnIcon = document.getElementById('submit-btn-icon');

    const setFeedMode = (mode) => {
        currentFeedMode = mode;
        [modePostBtn, modeStoryBtn, modeBannerBtn].forEach(btn => {
            if (!btn) return;
            btn.classList.remove('bg-white', 'dark:bg-[#333]', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            btn.classList.add('text-gray-500');
        });

        if (mode === 'post') {
            modePostBtn?.classList.add('bg-white', 'dark:bg-[#333]', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            modePostBtn?.classList.remove('text-gray-500');
            if (formHeaderIcon) formHeaderIcon.className = 'fas fa-edit mr-3 text-primary';
            if (formHeaderText) formHeaderText.textContent = 'Criar Nova Postagem';
            postFields?.classList.remove('hidden');
            editorWrapper?.classList.remove('hidden');
            ctaContainer?.classList.remove('hidden');
            bannerFields?.classList.add('hidden');
            if (submitBtnText) submitBtnText.textContent = 'Publicar Post';
            if (submitBtnIcon) submitBtnIcon.className = 'fas fa-paper-plane mr-2';
        } else if (mode === 'story') {
            modeStoryBtn?.classList.add('bg-white', 'dark:bg-[#333]', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            modeStoryBtn?.classList.remove('text-gray-500');
            if (formHeaderIcon) formHeaderIcon.className = 'fas fa-circle-notch mr-3 text-orange-500';
            if (formHeaderText) formHeaderText.textContent = 'Criar Story (24 Horas)';
            postFields?.classList.remove('hidden');
            editorWrapper?.classList.add('hidden');
            ctaContainer?.classList.add('hidden');
            bannerFields?.classList.add('hidden');
            if (submitBtnText) submitBtnText.textContent = 'Publicar Story';
            if (submitBtnIcon) submitBtnIcon.className = 'fas fa-bolt mr-2';
        } else if (mode === 'banner') {
            modeBannerBtn?.classList.add('bg-white', 'dark:bg-[#333]', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            modeBannerBtn?.classList.remove('text-gray-500');
            if (formHeaderIcon) formHeaderIcon.className = 'fas fa-image mr-3 text-yellow-500';
            if (formHeaderText) formHeaderText.textContent = 'Adicionar Banner em Destaque (Topo do Feed)';
            postFields?.classList.add('hidden');
            bannerFields?.classList.remove('hidden');
            if (submitBtnText) submitBtnText.textContent = 'Publicar Banner';
            if (submitBtnIcon) submitBtnIcon.className = 'fas fa-check-circle mr-2';
        }
    };

    modePostBtn?.addEventListener('click', () => setFeedMode('post'));
    modeStoryBtn?.addEventListener('click', () => setFeedMode('story'));
    modeBannerBtn?.addEventListener('click', () => setFeedMode('banner'));

    // Banner Preview & Quick Links
    const bannerImageInput = document.getElementById('banner-image-input');
    const bannerPlaceholder = document.getElementById('banner-placeholder');
    const bannerPreviewWrapper = document.getElementById('banner-preview-wrapper');
    const bannerPreviewImg = document.getElementById('banner-preview-img');
    const bannerLinkInput = document.getElementById('banner-link');

    bannerImageInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (bannerPreviewImg) bannerPreviewImg.src = evt.target.result;
                bannerPreviewWrapper?.classList.remove('hidden');
                bannerPlaceholder?.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    document.querySelectorAll('.banner-quick-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const route = btn.getAttribute('data-route');
            if (bannerLinkInput && route) {
                bannerLinkInput.value = route;
                bannerLinkInput.focus();
            }
        });
    });

    const targetTypeRadios = document.querySelectorAll('input[name="target-type"]');
    const unitContainer = document.getElementById('unit-target-container');
    const studentContainer = document.getElementById('student-target-container');
    const studentSearchInput = document.getElementById('student-search');
    const studentResultsList = document.getElementById('student-search-results');
    const selectedTagsContainer = document.getElementById('selected-students-tags');

    targetTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'unit') {
                unitContainer.classList.remove('hidden');
                studentContainer.classList.add('hidden');
            } else {
                unitContainer.classList.add('hidden');
                studentContainer.classList.remove('hidden');
                if (allUsersCache.length === 0) loadAllUsers();
            }
        });
    });

    const loadAllUsers = async () => {
        try {
            allUsersCache = await getAllUsers();
            console.log("Usuários carregados:", allUsersCache.length);
        } catch (error) {
            console.error("Erro ao carregar usuários:", error);
        }
    };

    const updateTags = () => {
        selectedTagsContainer.innerHTML = '';
        selectedStudents.forEach(student => {
            const tag = document.createElement('div');
            tag.className = 'bg-primary text-black text-[10px] font-bold px-2 py-1 rounded flex items-center shadow-sm';
            tag.innerHTML = `
                ${student.name}
                <button type="button" class="ml-2 hover:text-white" data-id="${student.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            tag.querySelector('button').onclick = () => {
                selectedStudents = selectedStudents.filter(s => s.id !== student.id);
                updateTags();
            };
            selectedTagsContainer.appendChild(tag);
        });
    };

    studentSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            studentResultsList.classList.add('hidden');
            return;
        }

        const filtered = allUsersCache.filter(u => 
            (u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)) &&
            !selectedStudents.find(s => s.id === u.id)
        ).slice(0, 8);

        if (filtered.length > 0) {
            studentResultsList.innerHTML = filtered.map(u => `
                <div class="p-3 hover:bg-[#3a3a3a] cursor-pointer flex items-center border-b border-gray-700 last:border-none" data-id="${u.id}" data-name="${u.name || u.email}">
                    <img src="${u.profilePicture || './default-profile.svg'}" class="w-8 h-8 rounded-full mr-3 border border-primary object-cover" onerror="this.src='./default-profile.svg'">
                    <div>
                        <p class="text-xs font-bold text-white">${u.name || 'Sem nome'}</p>
                        <p class="text-[10px] text-gray-500">${u.email || ''}</p>
                    </div>
                </div>
            `).join('');
            studentResultsList.classList.remove('hidden');
            
            studentResultsList.querySelectorAll('div[data-id]').forEach(el => {
                el.onclick = () => {
                    selectedStudents.push({ id: el.dataset.id, name: el.dataset.name });
                    studentSearchInput.value = '';
                    studentResultsList.classList.add('hidden');
                    updateTags();
                };
            });
        } else {
            studentResultsList.innerHTML = '<div class="p-3 text-gray-500 text-xs">Nenhum aluno encontrado</div>';
            studentResultsList.classList.remove('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!studentSearchInput.contains(e.target) && !studentResultsList.contains(e.target)) {
            studentResultsList.classList.add('hidden');
        }
    });

    // Event listener for "Todas as Unidades" checkbox
    const allCheckbox = document.getElementById('unit-checkbox-all');
    if (allCheckbox) {
        allCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const unitCheckboxes = document.querySelectorAll('input[name="target-unit"]');
            unitCheckboxes.forEach(cb => {
                cb.checked = isChecked;
                cb.disabled = isChecked;
            });
        });
    }

    // Carregar unidades da intranet/EVO
    const loadUnitsList = async () => {
        try {
            let units = [];
            try {
                units = await getUnidades();
            } catch (e) {
                console.warn('[feed] Falha em getUnidades, tentando getEvoUnits:', e);
            }

            if (!units || units.length === 0) {
                try {
                    const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
                    const result = await getEvoUnits();
                    const evoUnits = result.data || [];
                    units = evoUnits.map(uId => ({
                        id: uId,
                        name: uId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                    }));
                } catch (e) {
                    console.error('[feed] Erro ao carregar unidades do EVO:', e);
                }
            }

            // Fallback seguro se tudo falhar
            if (!units || units.length === 0) {
                units = [
                    { id: 'asa-sul', name: 'Asa Sul' },
                    { id: 'centro', name: 'Centro (Matriz)' },
                    { id: 'coqueiros', name: 'Coqueiros' },
                    { id: 'dourados', name: 'Dourados' },
                    { id: 'jardim-botanico', name: 'Jardim Botânico' },
                    { id: 'lago-sul', name: 'Lago Sul' },
                    { id: 'noroeste', name: 'Noroeste' },
                    { id: 'pontos-de-ensino', name: 'Pontos de Ensino' },
                    { id: 'santa-monica', name: 'Santa Mônica' },
                    { id: 'sudoeste', name: 'Sudoeste' }
                ];
            }

            const isAllChecked = allCheckbox ? allCheckbox.checked : true;

            // Limpar opções anteriores se houver (preservando "Todas as Unidades")
            const existingLabels = unitsCheckboxesContainer.querySelectorAll('label:not(:first-child)');
            existingLabels.forEach(l => l.remove());

            units.forEach(u => {
                const unitId = u.id;
                const unitName = u.name || unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const label = document.createElement('label');
                label.className = 'flex items-center cursor-pointer text-sm text-gray-900 dark:text-white font-medium hover:text-black dark:hover:text-white transition-colors';
                label.innerHTML = `
                    <input type="checkbox" name="target-unit" value="${unitId}" ${isAllChecked ? 'checked disabled' : ''} class="form-checkbox text-primary rounded border-gray-300 dark:border-gray-600 mr-2 focus:ring-0 focus:ring-offset-0">
                    <span>${unitName}</span>
                `;
                unitsCheckboxesContainer.appendChild(label);
            });
        } catch (error) {
            console.error("Erro ao carregar unidades:", error);
        }
    };

    // Carregar e Renderizar Postagens
    const loadPosts = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const uDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = uDoc.exists() ? uDoc.data() : {};
        const isAdmin = userData.isAdmin === true;
        const userUnitSlugs = getUserUnitSlugs(userData);

        feedList.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-2xl text-primary"></i></div>';
        
        const q = query(collection(db, 'feed'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        feedList.innerHTML = '';

        // Primeiro passo: mapear batches e coletar unidades de cada batch
        const batchUnitsMap = new Map();
        snap.forEach(d => {
            const data = d.data();
            if (data.batchId && data.targetUnit) {
                if (!batchUnitsMap.has(data.batchId)) {
                    batchUnitsMap.set(data.batchId, new Set());
                }
                batchUnitsMap.get(data.batchId).add(data.targetUnit);
            }
        });

        const seenBatches = new Set();
        
        snap.forEach(docRef => {
            const post = { id: docRef.id, ...docRef.data() };
            
            // Se pertencer a um lote, enriquecer com todas as unidades do lote se não houver targetUnits
            if (post.batchId && batchUnitsMap.has(post.batchId)) {
                const batchUnits = Array.from(batchUnitsMap.get(post.batchId));
                if (!post.targetUnits || post.targetUnits.length === 0) {
                    post.targetUnits = batchUnits;
                }
            }

            // Deduplicação de lotes (batchId) para que múltiplos docs do mesmo post não dupliquem na tela
            if (post.batchId) {
                if (seenBatches.has(post.batchId)) return;
                seenBatches.add(post.batchId);
            }

            // Check Scheduling
            const now = new Date();
            const postDate = post.createdAt ? new Date(post.createdAt.seconds * 1000) : now;
            const isScheduled = postDate > now;

            // Filtro de Visibilidade & Agendamento
            if (isScheduled) {
                // Se for agendado no futuro, apenas o admin e o autor do post podem ver
                if (!isAdmin && post.authorId !== user.uid) return;
            } else {
                // Filtro padrão de posts normais já publicados
                if (!isAdmin && post.authorId !== user.uid) {
                    const isForMe = post.targetStudents?.includes(user.uid);
                    const isForMyUnit = isItemForUserUnits(post, userUnitSlugs);
                    const isPublic = (!post.targetUnit || post.targetUnit === 'all') && (!post.targetStudents || post.targetStudents.length === 0);
                    
                    if (!isForMe && !isForMyUnit && !isPublic) return;
                }
            }

            const postElement = document.createElement('div');
            postElement.className = 'bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-xl rounded-3xl border border-gray-100 dark:border-gray-800/50 shadow-sm overflow-hidden mb-10 animate-fade-in group hover:shadow-md transition-shadow';
            
            // Fix Foto de Perfil
            let authorPhoto = post.authorPhotoURL || './default-profile.svg';
            const authorId = post.authorId;
            
            if (!post.authorPhotoURL || post.authorPhotoURL.includes('default-profile.svg')) {
                if (userProfileCache.has(authorId)) {
                    authorPhoto = userProfileCache.get(authorId);
                } else {
                    getUserData(authorId).then(u => {
                        if (u && u.profilePicture) {
                            userProfileCache.set(authorId, u.profilePicture);
                            const img = postElement.querySelector(`.author-img-${authorId}`);
                            if (img) img.src = u.profilePicture;
                        }
                    });
                }
            }

            // Media Elements
            let mediaHtml = '';
            if (post.mediaUrl) {
                if (post.mediaType === 'youtube') {
                    const vid = post.mediaUrl.includes('v=') ? post.mediaUrl.split('v=')[1].split('&')[0] : post.mediaUrl.split('/').pop();
                    mediaHtml = `<div class="px-6 pb-6"><iframe class="w-full aspect-video rounded-xl shadow-lg" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen></iframe></div>`;
                } else if (post.mediaType === 'spotify') {
                    const spotId = post.mediaUrl.split('/').pop().split('?')[0];
                    mediaHtml = `<div class="px-6 pb-6"><iframe src="https://open.spotify.com/embed/track/${spotId}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media" class="rounded-xl"></iframe></div>`;
                } else if (post.mediaType && post.mediaType.startsWith('image/')) {
                    mediaHtml = `<div class="px-6 pb-6"><img src="${post.mediaUrl}" class="w-full h-auto rounded-xl shadow-lg"></div>`;
                } else if (post.mediaType && post.mediaType.startsWith('video/')) {
                    mediaHtml = `<div class="px-6 pb-6"><video controls src="${post.mediaUrl}" class="w-full h-auto rounded-xl shadow-lg"></video></div>`;
                }
            }

            const createdAt = post.createdAt ? postDate.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Agora';

            // Montar badge descritivo de público/unidades
            let targetBadgeText = 'Público';
            if (post.targetStudents?.length > 0) {
                targetBadgeText = 'Privado';
            } else if (post.targetUnits?.length > 0) {
                if (post.targetUnits.includes('all')) {
                    targetBadgeText = 'Público';
                } else {
                    targetBadgeText = post.targetUnits.map(u => u.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
                }
            } else if (post.targetUnit && post.targetUnit !== 'all') {
                targetBadgeText = post.targetUnit.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }

            postElement.innerHTML = `
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <a href="../members/perfil-publico.html?id=${authorId}" class="relative w-11 h-11 flex-shrink-0 block hover:opacity-80 transition-opacity">
                                <img src="${authorPhoto}" class="author-img-${authorId} w-11 h-11 rounded-full border-2 border-primary shadow-sm object-cover" onerror="this.src='./default-profile.svg'">
                                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full"></div>
                            </a>
                            <div class="ml-3">
                                <a href="../members/perfil-publico.html?id=${authorId}" class="font-bold text-gray-900 dark:text-white text-sm hover:text-primary transition-colors">${post.authorName}</a>
                                <p class="text-[9px] text-gray-500 uppercase font-medium mt-0.5">${createdAt}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                             ${isScheduled ? '<span class="text-[8px] bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 py-0.5 px-2 rounded-full border border-yellow-500/25 font-bold uppercase tracking-widest flex items-center gap-1"><i class="fas fa-clock text-[9px]"></i> Agendado</span>' : ''}
                             ${post.targetStudents?.length > 0 ? '<span class="text-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 py-0.5 px-2 rounded-full border border-blue-500/20 font-bold uppercase tracking-widest">Privado</span>' : ''}
                             <span class="text-[8px] bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 py-0.5 px-2 rounded-full border border-gray-200/50 dark:border-gray-700/50 font-bold uppercase tracking-widest">${targetBadgeText}</span>
                             ${(isAdmin || post.authorId === user.uid) ? `
                                 <button class="edit-btn p-2 text-gray-400 hover:text-blue-500 transition-colors" data-id="${docRef.id}"><i class="fas fa-edit text-xs"></i></button>
                                 <button class="delete-btn p-2 text-gray-400 hover:text-red-500 transition-colors" data-id="${docRef.id}"><i class="fas fa-trash-alt text-xs"></i></button>
                             ` : ''}
                        </div>
                    </div>
                    <div class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-6">
                        ${post.isHtml ? post.content : `<p>${post.content.replace(/\n/g, '<br>')}</p>`}
                    </div>
                </div>
                ${mediaHtml}
                ${post.ctaButton ? `
                    <div class="px-6 pb-6 flex justify-center">
                        <a href="${post.ctaButton.url}" target="_blank" class="w-full md:w-auto px-6 py-2.5 bg-primary text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-md flex items-center justify-center text-sm">
                            ${post.ctaButton.text}
                        </a>
                    </div>
                ` : ''}
            `;
            
            feedList.appendChild(postElement);

            const delBtn = postElement.querySelector('.delete-btn');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (confirm('Deseja apagar esta postagem?')) {
                        if (post.batchId) {
                            try {
                                const qDel = query(collection(db, 'feed'), where('batchId', '==', post.batchId));
                                const snapDel = await getDocs(qDel);
                                const delPromises = [];
                                snapDel.forEach(docDel => {
                                    delPromises.push(deleteDoc(doc(db, 'feed', docDel.id)));
                                });
                                await Promise.all(delPromises);
                            } catch (e) {
                                console.error("Erro ao apagar lote de posts:", e);
                                await deleteDoc(doc(db, 'feed', docRef.id));
                            }
                        } else {
                            await deleteDoc(doc(db, 'feed', docRef.id));
                        }
                        loadPosts();
                    }
                };
            }

            const editBtn = postElement.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.onclick = () => {
                    currentEditingPost = { id: docRef.id, batchId: post.batchId };
                    editQuill.clipboard.dangerouslyPasteHTML(post.content || '');
                    editModal.classList.remove('hidden');
                };
            }
        });
    };

    // Submissão do Formulário
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const content = quill.root.innerHTML;
        const plainText = quill.getText().trim();
        const targetType = document.querySelector('input[name="target-type"]:checked').value;
        const targetStudentsIds = selectedStudents.map(s => s.id);
        const ctaText = document.getElementById('cta-text').value.trim();
        const ctaUrl = document.getElementById('cta-url').value.trim();

        // Retrieve scheduling info
        const publishDateVal = document.getElementById('publish-date').value;
        const publishTimestamp = publishDateVal ? new Date(publishDateVal) : null;

        if (publishTimestamp && publishTimestamp < new Date()) {
            alert('A data de agendamento não pode ser no passado!');
            return;
        }

        let targetUnits = [];
        if (targetType === 'unit') {
            if (allCheckbox && allCheckbox.checked) {
                targetUnits = ['all'];
            } else {
                const checkedCheckboxes = document.querySelectorAll('input[name="target-unit"]:checked');
                targetUnits = Array.from(checkedCheckboxes).map(cb => cb.value);
            }

            if (targetUnits.length === 0) {
                alert('Selecione pelo menos uma unidade!');
                return;
            }
        }

        const isBannerMode = currentFeedMode === 'banner';
        const isStoryMode = currentFeedMode === 'story';

        if (!isBannerMode) {
            const mediaUrlVal = document.getElementById('media-url').value.trim();
            const hasMedia = document.getElementById('post-media').files[0] || mediaUrlVal;

            if (!plainText && !hasMedia && content === '<p><br></p>') {
                alert('Adicione algum conteúdo!');
                return;
            }
        } else {
            const bannerFile = bannerImageInput?.files[0];
            if (!bannerFile) {
                alert('Selecione uma imagem para o banner!');
                return;
            }
        }

        const submitBtn = postForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const uDoc = await getDoc(doc(db, 'users', user.uid));
            const uData = uDoc.exists() ? uDoc.data() : {};
            const batchId = targetType === 'unit' && targetUnits.length > 1 ? `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : null;
            const targetList = targetType === 'unit' ? targetUnits : [null];
            const writePromises = [];

            if (isBannerMode) {
                const bannerFile = bannerImageInput.files[0];
                const sRef = ref(storage, `banners/${Date.now()}_${bannerFile.name}`);
                await uploadBytes(sRef, bannerFile);
                const bannerImageUrl = await getDownloadURL(sRef);
                const bannerTitle = document.getElementById('banner-title').value.trim() || 'Banner em Destaque';
                const bannerLink = document.getElementById('banner-link').value.trim();

                for (const unit of targetList) {
                    const bannerData = {
                        authorId: user.uid,
                        authorName: uData.name || user.displayName || 'Admin',
                        imageUrl: bannerImageUrl,
                        title: bannerTitle,
                        link: bannerLink,
                        targetUnit: unit || 'all',
                        targetUnits: targetType === 'unit' ? targetUnits : ['all'],
                        targetStudents: targetType === 'students' ? targetStudentsIds : [],
                        active: true,
                        createdAt: serverTimestamp()
                    };
                    if (batchId) bannerData.batchId = batchId;
                    writePromises.push(addDoc(collection(db, 'banners'), bannerData));
                }

                await Promise.all(writePromises);

                // Reset Banner Form
                bannerImageInput.value = '';
                if (bannerPreviewWrapper) bannerPreviewWrapper.classList.add('hidden');
                if (bannerPlaceholder) bannerPlaceholder.classList.remove('hidden');
                document.getElementById('banner-title').value = '';
                document.getElementById('banner-link').value = '';
                loadBanners();

            } else {
                let mediaUrl = '';
                let mediaType = '';
                const mTypeOption = document.querySelector('input[name="media-type"]:checked').value;

                if (mTypeOption === 'upload') {
                    const file = document.getElementById('post-media').files[0];
                    if (file) {
                        const sRef = ref(storage, `${isStoryMode ? 'stories' : 'feed-media'}/${Date.now()}_${file.name}`);
                        await uploadBytes(sRef, file);
                        mediaUrl = await getDownloadURL(sRef);
                        mediaType = file.type;
                    }
                } else {
                    mediaUrl = document.getElementById('media-url').value;
                    if (mediaUrl.includes('youtube') || mediaUrl.includes('youtu.be')) mediaType = 'youtube';
                    else if (mediaUrl.includes('spotify')) mediaType = 'spotify';
                }

                if (isStoryMode && !mediaUrl) {
                    alert('Stories precisam de uma imagem ou vídeo!');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Publicar';
                    return;
                }

                for (const unit of targetList) {
                    if (isStoryMode) {
                        const storyData = {
                            authorId: user.uid,
                            authorName: uData.name || user.displayName || 'Usuário',
                            authorPhotoURL: uData.profilePicture || user.photoURL || '',
                            mediaUrl,
                            mediaType: mediaType.startsWith('video') ? 'VIDEO' : 'IMAGE',
                            targetUnit: unit,
                            targetUnits: targetType === 'unit' ? targetUnits : [],
                            targetStudents: targetType === 'students' ? targetStudentsIds : [],
                            createdAt: publishTimestamp || serverTimestamp(),
                            expiresAt: new Date((publishTimestamp ? publishTimestamp.getTime() : Date.now()) + 24 * 60 * 60 * 1000)
                        };
                        if (batchId) storyData.batchId = batchId;
                        writePromises.push(addDoc(collection(db, 'stories'), storyData));
                    } else {
                        const feedData = {
                            authorId: user.uid,
                            authorName: uData.name || user.displayName || 'Usuário',
                            authorPhotoURL: uData.profilePicture || user.photoURL || '',
                            content,
                            isHtml: true,
                            mediaUrl,
                            mediaType,
                            ctaButton: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : null,
                            targetUnit: unit,
                            targetUnits: targetType === 'unit' ? targetUnits : [],
                            targetStudents: targetType === 'students' ? targetStudentsIds : [],
                            createdAt: publishTimestamp || serverTimestamp()
                        };
                        if (batchId) feedData.batchId = batchId;
                        writePromises.push(addDoc(collection(db, 'feed'), feedData));
                    }
                }

                await Promise.all(writePromises);
            }

            postForm.reset();
            // Reset schedule toggle fields in UI
            document.getElementById('schedule-fields').classList.add('hidden');
            const schedIcon = document.getElementById('toggle-schedule')?.querySelector('i');
            if (schedIcon) schedIcon.className = 'fas fa-clock mr-2';

            // Reset checkboxes state
            if (allCheckbox) {
                allCheckbox.checked = true;
                const unitCheckboxes = document.querySelectorAll('input[name="target-unit"]');
                unitCheckboxes.forEach(cb => {
                    cb.checked = true;
                    cb.disabled = true;
                });
            }
            quill.setContents([]);
            selectedStudents = [];
            updateTags();
            document.getElementById('file-name').textContent = 'Escolher arquivo...';
            loadPosts();

        } catch (err) {
            console.error(err);
            alert('Erro ao postar.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Publicar';
        }
    });

    loadUnitsList();
    loadPosts();

    // Carregar e Gerenciar Banners em Destaque
    const bannersListContainer = document.getElementById('banners-list-container');
    const refreshBannersBtn = document.getElementById('refresh-banners-btn');

    const loadBanners = async () => {
        if (!bannersListContainer) return;
        bannersListContainer.innerHTML = '<div class="col-span-full text-center py-6 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando banners...</div>';

        try {
            const snap = await getDocs(collection(db, 'banners'));

            if (snap.empty) {
                bannersListContainer.innerHTML = `
                    <div class="col-span-full text-center py-8 bg-gray-50/50 dark:bg-[#202020]/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                        <i class="fas fa-image text-3xl text-gray-400 mb-2"></i>
                        <p class="text-sm font-bold text-gray-600 dark:text-gray-300">Nenhum banner cadastrado</p>
                        <p class="text-xs text-gray-400 mt-1">Crie um banner acima para divulgar novidades no topo do feed do app.</p>
                    </div>
                `;
                return;
            }

            const batchUnitsMap = new Map();
            snap.forEach(d => {
                const data = d.data();
                if (data.batchId && data.targetUnit) {
                    if (!batchUnitsMap.has(data.batchId)) {
                        batchUnitsMap.set(data.batchId, new Set());
                    }
                    batchUnitsMap.get(data.batchId).add(data.targetUnit);
                }
            });

            const seenBannerBatches = new Set();
            const bannerList = [];
            snap.forEach(docSnap => {
                const b = { id: docSnap.id, ...docSnap.data() };
                if (b.batchId && batchUnitsMap.has(b.batchId)) {
                    const batchUnits = Array.from(batchUnitsMap.get(b.batchId));
                    if (!b.targetUnits || b.targetUnits.length === 0) {
                        b.targetUnits = batchUnits;
                    }
                }
                if (b.batchId) {
                    if (seenBannerBatches.has(b.batchId)) return;
                    seenBannerBatches.add(b.batchId);
                }
                bannerList.push(b);
            });
            bannerList.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            bannersListContainer.innerHTML = '';
            bannerList.forEach(banner => {
                const isActive = banner.active !== false;

                const card = document.createElement('div');
                card.className = `p-4 rounded-2xl border transition-all ${isActive ? 'bg-white dark:bg-[#252525] border-gray-200 dark:border-gray-700 shadow-sm' : 'bg-gray-100/60 dark:bg-[#1a1a1a]/60 border-gray-200/50 dark:border-gray-800 opacity-60'}`;
                
                let unitLabel = 'Todas as Unidades';
                if (banner.targetUnits?.length > 0 && !banner.targetUnits.includes('all')) {
                    unitLabel = banner.targetUnits.map(u => u.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
                } else if (banner.targetUnit && banner.targetUnit !== 'all') {
                    unitLabel = banner.targetUnit.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }

                card.innerHTML = `
                    <div class="relative rounded-xl overflow-hidden aspect-[2.5/1] bg-black mb-3 border border-gray-200 dark:border-white/10">
                        <img src="${banner.imageUrl}" class="w-full h-full object-cover">
                        <div class="absolute top-2 right-2">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}">
                                ${isActive ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-sm text-gray-900 dark:text-white truncate">${banner.title || 'Banner'}</h4>
                            <p class="text-[11px] text-gray-400 truncate mt-0.5 font-mono">
                                <i class="fas ${banner.link?.startsWith('http') ? 'fa-external-link-alt' : 'fa-mobile-alt'} mr-1"></i>
                                ${banner.link || 'Sem link'}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
                        <span class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <i class="fas fa-location-dot text-[10px]"></i> ${unitLabel}
                        </span>
                        <div class="flex items-center gap-2">
                            <button type="button" class="toggle-banner-btn px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${isActive ? 'bg-gray-100 dark:bg-[#333] hover:bg-gray-200 text-gray-700 dark:text-gray-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'}" data-id="${banner.id}" data-active="${isActive}">
                                ${isActive ? 'Pausar' : 'Ativar'}
                            </button>
                            <button type="button" class="delete-banner-btn p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" data-id="${banner.id}" title="Excluir Banner">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                `;

                // Toggle active
                card.querySelector('.toggle-banner-btn').addEventListener('click', async (e) => {
                    const bId = e.currentTarget.getAttribute('data-id');
                    const currentActive = e.currentTarget.getAttribute('data-active') === 'true';
                    try {
                        await updateDoc(doc(db, 'banners', bId), { active: !currentActive });
                        loadBanners();
                    } catch (err) {
                        console.error('Erro ao atualizar banner:', err);
                        alert('Erro ao alterar status do banner.');
                    }
                });

                // Delete banner
                card.querySelector('.delete-banner-btn').addEventListener('click', async (e) => {
                    const bId = e.currentTarget.getAttribute('data-id');
                    if (confirm('Tem certeza que deseja excluir este banner?')) {
                        try {
                            await deleteDoc(doc(db, 'banners', bId));
                            loadBanners();
                        } catch (err) {
                            console.error('Erro ao excluir banner:', err);
                            alert('Erro ao excluir banner.');
                        }
                    }
                });

                bannersListContainer.appendChild(card);
            });
        } catch (err) {
            console.error('Erro ao carregar banners:', err);
            bannersListContainer.innerHTML = '<div class="col-span-full text-center py-6 text-red-500 text-sm">Erro ao carregar banners.</div>';
        }
    };

    refreshBannersBtn?.addEventListener('click', loadBanners);
    loadBanners();
};
