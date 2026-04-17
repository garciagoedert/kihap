import { db, auth } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export const loadFeed = () => {
    const feedList = document.getElementById('feed-list');
    if (!feedList) return;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
        // Buscar a unidade do aluno
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userUnit = userDoc.exists() ? userDoc.data().unitId : null;

        feedList.innerHTML = ''; // Limpar a lista

        const q = query(
            collection(db, 'feed'),
            where('targetUnit', 'in', ['all', userUnit || null]),
            orderBy('createdAt', 'desc')
        );

                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    feedList.innerHTML = '<p>Nenhuma postagem no feed ainda.</p>';
                    return;
                }

                const formatContentLinks = (text) => {
                    if (!text) return '';
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    // Escape basic HTML before injecting links
                    let escaped = text.replace(/[&<>'"]/g, tag => ({
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        "'": '&#39;',
                        '"': '&quot;'
                    }[tag] || tag));
                    return escaped.replace(urlRegex, url => `<a href="${url}" target="_blank" class="text-yellow-500 hover:text-yellow-400 hover:underline break-words font-medium">${url}</a>`);
                };

                querySnapshot.forEach(docSnap => {
                    const post = docSnap.data();
                    const postId = docSnap.id;
                    const postElement = document.createElement('div');
                    postElement.className = 'py-5 border-b border-gray-800/60 first:border-t first:border-gray-800/60 px-4 md:px-0 transition-colors duration-300';

                    let mediaElement = '';
                    if (post.mediaUrl) {
                        if (post.mediaType === 'youtube') {
                            const videoId = new URL(post.mediaUrl).searchParams.get('v') || new URL(post.mediaUrl).pathname.split('/').pop();
                            mediaElement = `<iframe class="mt-2 rounded-xl w-full aspect-video border border-gray-800/50" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                        } else if (post.mediaType === 'spotify') {
                            const spotifyUri = new URL(post.mediaUrl).pathname.split('/').pop();
                            mediaElement = `<iframe class="mt-2 rounded-xl w-full" src="https://open.spotify.com/embed/track/${spotifyUri}" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
                        } else if (post.mediaType.startsWith('image/')) {
                            mediaElement = `<img src="${post.mediaUrl}" alt="Mídia da postagem" class="mt-2 rounded-xl w-full object-cover border border-gray-800/50">`;
                        } else if (post.mediaType.startsWith('video/')) {
                            mediaElement = `<video controls src="${post.mediaUrl}" class="mt-2 rounded-xl w-full border border-gray-800/50"></video>`;
                        } else if (post.mediaType.startsWith('audio/')) {
                            mediaElement = `<audio controls src="${post.mediaUrl}" class="mt-2 w-full"></audio>`;
                        }
                    }

                    const likes = post.likes || [];
                    const hasLiked = likes.includes(user.uid);
                    const likeIconClass = hasLiked ? "fas fa-heart text-red-500" : "far fa-heart font-bold";
                    const likeTextClass = hasLiked ? "text-red-500" : "text-gray-500";

                    postElement.innerHTML = `
                        <div class="flex items-start space-x-3 lg:space-x-4">
                            <img src="/imgs/kobe.png" alt="Avatar" class="author-avatar w-10 h-10 lg:w-11 lg:h-11 rounded-full object-cover border-2 border-gray-800 shrink-0 cursor-pointer mt-1">
                            <div class="flex-1 min-w-0">
                                <div class="flex flex-row items-center justify-between mb-1">
                                    <div class="flex items-center">
                                        <p class="font-semibold text-gray-100 text-[15px] cursor-pointer hover:underline">${post.authorName}</p>
                                    </div>
                                    <p class="text-[14px] text-gray-500 hover:text-gray-400 cursor-pointer whitespace-nowrap">
                                        ${new Date(post.createdAt.seconds * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </p>
                                </div>
                                <div class="mb-3 pr-2">
                                    <p class="text-gray-200 text-[15px] leading-relaxed whitespace-pre-wrap">${formatContentLinks(post.content)}</p>
                                </div>
                                
                                ${mediaElement ? `<div class="mb-3 pr-2">${mediaElement}</div>` : ''}
                                
                                <div class="flex items-center space-x-6 mt-1">
                                    <button class="like-btn flex items-center space-x-1.5 text-gray-500 hover:text-red-500 transition-colors group cursor-pointer focus:outline-none" data-id="${postId}">
                                        <i class="${likeIconClass} text-[18px] group-hover:text-red-500 transition-colors"></i>
                                        <span class="like-text ${likeTextClass} text-[14px] font-medium group-hover:text-red-500 transition-colors">${likes.length > 0 ? likes.length : ''}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;

                    // Puxar a foto de perfil do autor
                    if (post.authorId) {
                        getDoc(doc(db, 'users', post.authorId)).then(authorSnap => {
                            if (authorSnap.exists()) {
                                const ad = authorSnap.data();
                                const avatarSrc = ad.photoURL || ad.profilePicture;
                                if (avatarSrc) {
                                    const avatarImg = postElement.querySelector('.author-avatar');
                                    if (avatarImg) {
                                        avatarImg.src = avatarSrc;
                                    }
                                }
                            }
                        }).catch(err => console.error("Erro ao puxar foto do autor:", err));
                    }


                    // Like Button Logic
                    const likeBtn = postElement.querySelector('.like-btn');
                    const likeIcon = postElement.querySelector('.like-btn i');
                    const likeText = postElement.querySelector('.like-text');
                    const likesCountSpan = postElement.querySelector('.likes-count');

                    let currentHasLiked = hasLiked;
                    let currentLikesCount = likes.length;

                    likeBtn.addEventListener('click', async () => {
                        likeBtn.disabled = true; // prevent spam click
                        const postRef = doc(db, 'feed', postId);
                        
                        try {
                            if (currentHasLiked) {
                                await updateDoc(postRef, {
                                    likes: arrayRemove(user.uid)
                                });
                                currentHasLiked = false;
                                currentLikesCount = Math.max(0, currentLikesCount - 1);
                            } else {
                                await updateDoc(postRef, {
                                    likes: arrayUnion(user.uid)
                                });
                                currentHasLiked = true;
                                currentLikesCount++;
                            }
                            
                            // Visual Update
                            likeIcon.className = currentHasLiked ? "fas fa-heart text-red-500 text-[18px] group-hover:text-red-500 transition-colors" : "far fa-heart font-bold text-[18px] group-hover:text-red-500 transition-colors";
                            likeText.className = `like-text ${currentHasLiked ? "text-red-500" : "text-gray-500"} text-[14px] font-medium group-hover:text-red-500 transition-colors`;
                            likesCountSpan.textContent = currentLikesCount > 0 ? currentLikesCount : '';
                            
                        } catch (err) {
                            console.error("Error toggling like: ", err);
                        } finally {
                            likeBtn.disabled = false;
                        }
                    });

                    feedList.appendChild(postElement);
                });

            } catch (error) {
                console.error("Erro ao carregar o feed: ", error);
                feedList.innerHTML = '<p>Ocorreu um erro ao carregar o feed. Tente novamente mais tarde.</p>';
            }
        } else {
            feedList.innerHTML = '<p>Você precisa estar logado para ver o feed.</p>';
        }
    });
};
