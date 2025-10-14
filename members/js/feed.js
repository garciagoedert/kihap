import { db } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { auth } from './auth.js';

export const loadFeed = async () => {
    const feedList = document.getElementById('feed-list');
    if (!feedList) return;

    const user = auth.currentUser;
    if (!user) {
        feedList.innerHTML = '<p>Você precisa estar logado para ver o feed.</p>';
        return;
    }

    try {
        // Buscar a unidade do aluno
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userUnit = userDoc.exists() ? userDoc.data().unitId : null;

        feedList.innerHTML = ''; // Limpar a lista

        const q = query(
            collection(db, 'feed'),
            where('targetUnit', 'in', ['all', userUnit]),
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
                if (post.mediaType.startsWith('image/')) {
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
};
