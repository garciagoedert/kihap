import { db, auth } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserData } from '../../intranet/auth.js';
import { initStories } from './kihap-stories.js';

export const loadFeed = () => {
    const feedList = document.getElementById('feed-list');
    if (!feedList) return;

    let userProfileCache = new Map();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Inicializar Stories
            initStories();
            
            try {
                // Obter dados do usuário para filtragem
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                const userUnit = userData.unidade || userData.unit || userData.unitId || '';

                feedList.innerHTML = '<div class="flex justify-center p-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>';

                // Buscar todos os posts e filtrar no cliente para suportar OR complexo
                const q = query(collection(db, 'feed'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    feedList.innerHTML = '<div class="text-center py-10 text-gray-500">Nenhuma postagem no feed ainda.</div>';
                    return;
                }

                feedList.innerHTML = '';

                querySnapshot.forEach(docSnap => {
                    const post = docSnap.data();
                    const postId = docSnap.id;
                    
                    // Lógica de Visibilidade para Alunos
                    if (post.authorId !== user.uid) {
                        const isForMe = post.targetStudents?.includes(user.uid);
                        const isForMyUnit = post.targetUnit === 'all' || post.targetUnit === userUnit;
                        const isPublic = !post.targetUnit && (!post.targetStudents || post.targetStudents.length === 0);
                        
                        // Se não for público, nem para a unidade, nem para o aluno específico, ignora
                        if (!isForMe && !isForMyUnit && !isPublic) return;
                    }

                    const postElement = document.createElement('div');
                    postElement.className = 'bg-[#1e1e1e] rounded-2xl border border-gray-800 shadow-xl overflow-hidden mb-6 transition-all hover:border-gray-700 animate-fade-in mx-4 md:mx-0';

                    // Fix Foto de Perfil
                    let authorPhoto = post.authorPhotoURL || '../intranet/default-profile.svg';
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
                            mediaHtml = `<div class="px-5 pb-5"><iframe class="w-full aspect-video rounded-xl shadow-lg" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen></iframe></div>`;
                        } else if (post.mediaType === 'spotify') {
                            const spotId = post.mediaUrl.split('/').pop().split('?')[0];
                            mediaHtml = `<div class="px-5 pb-5"><iframe src="https://open.spotify.com/embed/track/${spotId}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media" class="rounded-xl"></iframe></div>`;
                        } else if (post.mediaType && (post.mediaType.startsWith('image/') || post.mediaType === 'image')) {
                            mediaHtml = `<div class="px-5 pb-5"><img src="${post.mediaUrl}" class="w-full h-auto rounded-xl shadow-lg"></div>`;
                        } else if (post.mediaType && (post.mediaType.startsWith('video/') || post.mediaType === 'video')) {
                            mediaHtml = `<div class="px-5 pb-5"><video controls src="${post.mediaUrl}" class="w-full h-auto rounded-xl shadow-lg"></video></div>`;
                        }
                    }

                    const likes = post.likes || [];
                    const hasLiked = likes.includes(user.uid);
                    const createdAt = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recentemente';

                    postElement.innerHTML = `
                        <div class="p-5">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center">
                                    <a href="perfil-publico.html?id=${authorId}" class="relative w-10 h-10 flex-shrink-0 block hover:opacity-80 transition-opacity">
                                        <img src="${authorPhoto}" class="author-img-${authorId} w-10 h-10 rounded-full border-2 border-primary shadow-sm object-cover" onerror="this.src='../intranet/default-profile.svg'">
                                        <div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#1e1e1e] rounded-full"></div>
                                    </a>
                                    <div class="ml-3">
                                        <a href="perfil-publico.html?id=${authorId}" class="font-bold text-gray-100 text-[14px] hover:text-primary transition-colors">${post.authorName}</a>
                                        <p class="text-[9px] text-gray-500 uppercase font-medium mt-0.5 tracking-tight">${createdAt}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="prose prose-invert max-w-none text-gray-200 text-[14px] leading-relaxed mb-5">
                                ${post.isHtml ? post.content : `<p class="whitespace-pre-wrap">${post.content}</p>`}
                            </div>
                        </div>

                        ${mediaHtml}

                        ${post.ctaButton ? `
                            <div class="px-5 pb-5">
                                <a href="${post.ctaButton.url}" target="_blank" class="w-full flex items-center justify-center bg-primary hover:bg-primary-dark text-black font-bold py-2.5 rounded-xl transition-all shadow-md text-sm">
                                    ${post.ctaButton.text} <i class="fas fa-external-link-alt ml-2 text-[10px]"></i>
                                </a>
                            </div>
                        ` : ''}
                    `;

                    feedList.appendChild(postElement);
                });

            } catch (error) {
                console.error("Erro ao carregar o feed: ", error);
                feedList.innerHTML = '<p class="text-center p-10 text-red-500">Erro ao carregar o feed.</p>';
            }
        } else {
            feedList.innerHTML = '<p class="text-center p-10">Faça login para ver o feed.</p>';
        }
    });
};
