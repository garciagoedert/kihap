import { db, auth } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserData } from '../../intranet/auth.js';
import { initStories } from './kihap-stories.js';

export const loadFeed = async () => {
    const feedList = document.getElementById('feed-list');
    if (!feedList) return;

    let userProfileCache = new Map();

    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Inicializar Stories
                initStories();
                
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const userData = userDoc.exists() ? userDoc.data() : {};
                    const userUnit = userData.unidade || userData.unit || userData.unitId || '';

                    // Buscar os 20 posts mais recentes e filtrar no cliente
                    const { limit } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                    const q = query(collection(db, 'feed'), orderBy('createdAt', 'desc'), limit(20));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        feedList.innerHTML = '<div class="text-center py-10 text-gray-500">Nenhuma postagem no feed ainda.</div>';
                        resolve();
                        return;
                    }

                    feedList.innerHTML = '';

                    querySnapshot.forEach(docSnap => {
                        const post = docSnap.data();
                        const postId = docSnap.id;
                        
                        if (post.authorId !== user.uid) {
                            const isForMe = post.targetStudents?.includes(user.uid);
                            const isForMyUnit = post.targetUnit === 'all' || post.targetUnit === userUnit;
                            const isPublic = !post.targetUnit && (!post.targetStudents || post.targetStudents.length === 0);
                            
                            if (!isForMe && !isForMyUnit && !isPublic) return;
                        }

                        const postElement = document.createElement('div');
                        postElement.className = 'bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden mb-6 transition-all hover:border-gray-700 animate-fade-in mx-4 md:mx-0';

                        let authorPhoto = post.authorPhotoURL || '../intranet/default-profile.svg';
                        const authorId = post.authorId;
                        
                        if (!post.authorPhotoURL || post.authorPhotoURL.includes('default-profile.svg')) {
                            const cached = userProfileCache.get(authorId);
                            if (cached) {
                                if (cached.profilePicture) {
                                    const img = postElement.querySelector(`.author-img-${authorId}`);
                                    if (img) img.src = cached.profilePicture;
                                }
                            } else {
                                getUserData(authorId).then(u => {
                                    if (u) {
                                        userProfileCache.set(authorId, u);
                                        if (u.profilePicture) {
                                            const img = postElement.querySelector(`.author-img-${authorId}`);
                                            if (img) img.src = u.profilePicture;
                                        }
                                    }
                                });
                            }
                        }

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

                        const createdAt = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recentemente';

                        postElement.innerHTML = `
                            <div class="p-5">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="flex items-center">
                                        <a href="perfil-publico.html?id=${authorId}" class="relative w-10 h-10 flex-shrink-0 block hover:opacity-80 transition-opacity">
                                            <img src="${authorPhoto}" class="author-img-${authorId} w-10 h-10 rounded-full border-2 border-primary shadow-sm object-cover" onerror="this.src='../intranet/default-profile.svg'">
                                            <div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#1e1e1e] rounded-full"></div>
                                        </a>
                                        <div class="ml-3">
                                            <a href="perfil-publico.html?id=${authorId}" class="font-bold text-gray-900 dark:text-gray-100 text-[14px] hover:text-primary transition-colors">${post.authorName}</a>
                                            <p class="text-[9px] text-gray-500 uppercase font-medium mt-0.5 tracking-tight">${createdAt}</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-[14px] leading-relaxed mb-5">
                                    ${post.isHtml ? post.content : `<p class="whitespace-pre-wrap">${post.content}</p>`}
                                </div>
                            </div>
                            ${mediaHtml}
                            ${post.ctaButton ? `<div class="px-5 pb-5"><a href="${post.ctaButton.url}" target="_blank" class="w-full flex items-center justify-center bg-primary hover:bg-primary-dark text-black font-bold py-2.5 rounded-xl transition-all shadow-md text-sm">${post.ctaButton.text} <i class="fas fa-external-link-alt ml-2 text-[10px]"></i></a></div>` : ''}
                        `;
                        feedList.appendChild(postElement);
                    });
                    resolve();

                } catch (error) {
                    console.error("Erro ao carregar o feed: ", error);
                    feedList.innerHTML = '<p class="text-center p-10 text-red-500">Erro ao carregar o feed.</p>';
                    resolve();
                }
            } else {
                feedList.innerHTML = '<p class="text-center p-10">Faça login para ver o feed.</p>';
                resolve();
            }
        });
    });
};
