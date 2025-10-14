import { db, storage, functions } from './firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-functions.js";
import { auth } from './auth.js';

export const initFeedPage = () => {
    const postForm = document.getElementById('post-form');
    const targetUnitSelect = document.getElementById('target-unit');
    const feedList = document.getElementById('feed-list');

    // Carregar unidades da API do EVO
    const loadUnits = async () => {
        try {
            const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
            const result = await getEvoUnits();
            const units = result.data;
            units.forEach(unitId => {
                const option = document.createElement('option');
                option.value = unitId;
                // Transforma o ID da unidade em um nome mais legível
                option.textContent = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                targetUnitSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar unidades do EVO:", error);
            // Adiciona uma opção de erro para feedback
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Erro ao carregar unidades';
            option.disabled = true;
            targetUnitSelect.appendChild(option);
        }
    };

    // Carregar postagens
    const loadPosts = async () => {
        feedList.innerHTML = ''; // Limpar a lista antes de carregar
        const postsCollection = query(collection(db, 'feed'), orderBy('createdAt', 'desc'));
        const postsSnapshot = await getDocs(postsCollection);
        postsSnapshot.forEach(doc => {
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.className = 'bg-[#1e1e1e] p-6 rounded-lg';
            
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
                    <!-- <img src="${post.authorPhotoURL || 'default-profile.svg'}" alt="Foto do autor" class="w-12 h-12 rounded-full mr-4"> -->
                    <div>
                        <p class="font-bold">${post.authorName}</p>
                        <p class="text-sm text-gray-400">${new Date(post.createdAt.seconds * 1000).toLocaleString()}</p>
                    </div>
                </div>
                <p>${post.content}</p>
                ${mediaElement}
            `;
            feedList.appendChild(postElement);
        });
    };

    // Envio do formulário
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            alert('Você precisa estar logado para criar uma postagem.');
            return;
        }

        const content = document.getElementById('post-content').value;
        const mediaFile = document.getElementById('post-media').files[0];
        const targetUnit = document.getElementById('target-unit').value;

        if (!content && !mediaFile) {
            alert('Você precisa adicionar conteúdo ou uma mídia para postar.');
            return;
        }

        try {
            let mediaUrl = '';
            let mediaType = '';

            if (mediaFile) {
                const storageRef = ref(storage, `feed-media/${Date.now()}_${mediaFile.name}`);
                await uploadBytes(storageRef, mediaFile);
                mediaUrl = await getDownloadURL(storageRef);
                mediaType = mediaFile.type;
            }

            await addDoc(collection(db, 'feed'), {
                authorId: user.uid,
                authorName: user.displayName || 'Usuário Anônimo', // Idealmente, puxe de um perfil de usuário
                content: content,
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                targetUnit: targetUnit,
                createdAt: serverTimestamp(),
                likes: 0,
            });

            postForm.reset();
            loadPosts(); // Recarregar as postagens
        } catch (error) {
            console.error("Erro ao criar postagem: ", error);
            alert('Ocorreu um erro ao criar a postagem. Tente novamente.');
        }
    });

    loadUnits();
    loadPosts();
};
