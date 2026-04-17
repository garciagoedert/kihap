import { db, storage, functions, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { EmojiButton } from 'https://cdn.skypack.dev/@joeattardi/emoji-button@4.6.4';
import { getAllUsers, getUserData } from './auth.js';

export const initFeedPage = () => {
    const postForm = document.getElementById('post-form');
    const targetUnitSelect = document.getElementById('target-unit');
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

    // Lógica de Direcionamento por Aluno
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

    // Carregar unidades do EVO
    const loadUnitsList = async () => {
        try {
            const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
            const result = await getEvoUnits();
            const units = result.data || [];
            units.forEach(unitId => {
                const option = document.createElement('option');
                option.value = unitId;
                option.textContent = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                targetUnitSelect.appendChild(option);
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
        const userUnit = userData.unidade || userData.unit || '';

        feedList.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-2xl text-primary"></i></div>';
        
        const q = query(collection(db, 'feed'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        feedList.innerHTML = '';

        snap.forEach(docRef => {
            const post = docRef.data();
            
            // Filtro de Visibilidade
            if (!isAdmin && post.authorId !== user.uid) {
                const isForMe = post.targetStudents?.includes(user.uid);
                const isForMyUnit = post.targetUnit === 'all' || post.targetUnit === userUnit;
                const isPublic = !post.targetUnit && (!post.targetStudents || post.targetStudents.length === 0);
                
                if (!isForMe && !isForMyUnit && !isPublic) return;
            }

            const postElement = document.createElement('div');
            postElement.className = 'bg-[#1e1e1e] rounded-2xl border border-gray-800 shadow-xl overflow-hidden mb-8 animate-fade-in group';
            
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

            const createdAt = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Agora';

            postElement.innerHTML = `
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <a href="../members/perfil-publico.html?id=${authorId}" class="relative w-11 h-11 flex-shrink-0 block hover:opacity-80 transition-opacity">
                                <img src="${authorPhoto}" class="author-img-${authorId} w-11 h-11 rounded-full border-2 border-primary shadow-sm object-cover" onerror="this.src='./default-profile.svg'">
                                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1e1e1e] rounded-full"></div>
                            </a>
                            <div class="ml-3">
                                <a href="../members/perfil-publico.html?id=${authorId}" class="font-bold text-gray-100 text-sm hover:text-primary transition-colors">${post.authorName}</a>
                                <p class="text-[9px] text-gray-500 uppercase font-medium mt-0.5">${createdAt}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                             ${post.targetStudents?.length > 0 ? '<span class="text-[8px] bg-blue-500/10 text-blue-400 py-0.5 px-2 rounded-full border border-blue-500/20 font-bold uppercase tracking-widest">Privado</span>' : ''}
                             <span class="text-[8px] bg-gray-800 text-gray-400 py-0.5 px-2 rounded-full border border-gray-700 font-bold uppercase tracking-widest">${post.targetUnit === 'all' ? 'Público' : (post.targetUnit || 'Unidade')}</span>
                             ${(isAdmin || post.authorId === user.uid) ? `<button class="delete-btn p-2 text-gray-600 hover:text-red-500 transition-colors" data-id="${docRef.id}"><i class="fas fa-trash-alt text-xs"></i></button>` : ''}
                        </div>
                    </div>
                    <div class="prose prose-invert max-w-none text-gray-300 text-sm leading-relaxed mb-6">
                        ${post.isHtml ? post.content : `<p>${post.content.replace(/\n/g, '<br>')}</p>`}
                    </div>
                </div>
                ${mediaHtml}
                ${post.ctaButton ? `
                    <div class="px-6 pb-6 flex justify-center">
                        <a href="${post.ctaButton.url}" target="_blank" class="w-full md:w-auto px-6 py-2.5 bg-primary text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-md flex items-center justify-center text-sm">
                            ${post.ctaButton.text} <i class="fas fa-external-link-alt ml-2 text-[10px]"></i>
                        </a>
                    </div>
                ` : ''}
            `;
            
            feedList.appendChild(postElement);

            const delBtn = postElement.querySelector('.delete-btn');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (confirm('Deseja apagar esta postagem?')) {
                        await deleteDoc(doc(db, 'feed', docRef.id));
                        loadPosts();
                    }
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
        const targetUnit = document.getElementById('target-unit').value;
        const targetStudentsIds = selectedStudents.map(s => s.id);
        const ctaText = document.getElementById('cta-text').value.trim();
        const ctaUrl = document.getElementById('cta-url').value.trim();

        if (!plainText && !document.getElementById('post-media').files[0] && content === '<p><br></p>') {
            alert('Adicione algum conteúdo!');
            return;
        }

        const submitBtn = postForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            let mediaUrl = '';
            let mediaType = '';
            const mTypeOption = document.querySelector('input[name="media-type"]:checked').value;

            if (mTypeOption === 'upload') {
                const file = document.getElementById('post-media').files[0];
                if (file) {
                    const sRef = ref(storage, `feed-media/${Date.now()}_${file.name}`);
                    await uploadBytes(sRef, file);
                    mediaUrl = await getDownloadURL(sRef);
                    mediaType = file.type;
                }
            } else {
                mediaUrl = document.getElementById('media-url').value;
                if (mediaUrl.includes('youtube') || mediaUrl.includes('youtu.be')) mediaType = 'youtube';
                else if (mediaUrl.includes('spotify')) mediaType = 'spotify';
            }

            const uDoc = await getDoc(doc(db, 'users', user.uid));
            const uData = uDoc.exists() ? uDoc.data() : {};

            await addDoc(collection(db, 'feed'), {
                authorId: user.uid,
                authorName: uData.name || user.displayName || 'Usuário',
                authorPhotoURL: uData.profilePicture || user.photoURL || '',
                content,
                isHtml: true,
                mediaUrl,
                mediaType,
                ctaButton: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : null,
                targetUnit: targetType === 'unit' ? targetUnit : null,
                targetStudents: targetType === 'students' ? targetStudentsIds : [],
                createdAt: serverTimestamp()
            });

            postForm.reset();
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
};
