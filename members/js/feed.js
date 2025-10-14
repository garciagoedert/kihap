import { db, auth } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

                querySnapshot.forEach(doc => {
                    const post = doc.data();
                    const postElement = document.createElement('div');
                    postElement.className = 'bg-[#1e1e1e] p-6 rounded-lg shadow-md';

                    let mediaElement = '';
                    if (post.mediaUrl) {
                        if (post.mediaType === 'youtube') {
                            const videoId = new URL(post.mediaUrl).searchParams.get('v');
                            mediaElement = `<iframe class="mt-4 rounded-lg w-full aspect-video" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                        } else if (post.mediaType === 'spotify') {
                            const spotifyUri = new URL(post.mediaUrl).pathname.split('/').pop();
                            mediaElement = `<iframe class="mt-4 rounded-lg w-full" src="https://open.spotify.com/embed/track/${spotifyUri}" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
                        } else if (post.mediaType.startsWith('image/')) {
                            mediaElement = `<img src="${post.mediaUrl}" alt="Mídia da postagem" class="mt-4 rounded-lg max-w-full h-auto">`;
                        } else if (post.mediaType.startsWith('video/')) {
                            mediaElement = `<video controls src="${post.mediaUrl}" class="mt-4 rounded-lg max-w-full h-auto"></video>`;
                        } else if (post.mediaType.startsWith('audio/')) {
                            mediaElement = `<audio controls src="${post.mediaUrl}" class="mt-4 w-full"></audio>`;
                        }
                    }

                    postElement.innerHTML = `
                        <div class="flex items-center mb-4">
                            <div>
                                <p class="font-bold">${post.authorName}</p>
                                <p class="text-sm text-gray-400">${new Date(post.createdAt.seconds * 1000).toLocaleString()}</p>
                            </div>
                        </div>
                        <p class="text-gray-300 whitespace-pre-wrap">${post.content}</p>
                        ${mediaElement}
                    `;
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
