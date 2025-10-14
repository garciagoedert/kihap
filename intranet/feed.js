import { db, storage, functions, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

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
        console.log('Debug DB:', db);
        const postsCollection = query(collection(db, 'feed'), orderBy('createdAt', 'desc'));
        const postsSnapshot = await getDocs(postsCollection);
        postsSnapshot.forEach(doc => {
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.className = 'bg-[#1e1e1e] p-6 rounded-lg';
            
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
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <!-- <img src="${post.authorPhotoURL || 'default-profile.svg'}" alt="Foto do autor" class="w-12 h-12 rounded-full mr-4"> -->
                        <div>
                            <p class="font-bold">${post.authorName}</p>
                            <p class="text-sm text-gray-400">${new Date(post.createdAt.seconds * 1000).toLocaleString()}</p>
                        </div>
                    </div>
                    <button class="delete-post-btn text-gray-400 hover:text-red-500" data-id="${doc.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <p>${post.content}</p>
                ${mediaElement}
            `;
            feedList.appendChild(postElement);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-post-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const postId = e.currentTarget.dataset.id;
                if (confirm('Tem certeza que deseja apagar esta postagem?')) {
                    try {
                        await deleteDoc(doc(db, 'feed', postId));
                        loadPosts();
                    } catch (error) {
                        console.error("Erro ao apagar postagem: ", error);
                        alert('Ocorreu um erro ao apagar a postagem.');
                    }
                }
            });
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
        const mediaTypeOption = document.querySelector('input[name="media-type"]:checked').value;
        const targetUnit = document.getElementById('target-unit').value;

        let mediaUrl = '';
        let mediaType = '';

        if (mediaTypeOption === 'upload') {
            const mediaFile = document.getElementById('post-media').files[0];
            if (!content && !mediaFile) {
                alert('Você precisa adicionar conteúdo ou uma mídia para postar.');
                return;
            }
            if (mediaFile) {
                const storageRef = ref(storage, `feed-media/${Date.now()}_${mediaFile.name}`);
                await uploadBytes(storageRef, mediaFile);
                mediaUrl = await getDownloadURL(storageRef);
                mediaType = mediaFile.type;
            }
        } else {
            mediaUrl = document.getElementById('media-url').value;
            if (!content && !mediaUrl) {
                alert('Você precisa adicionar conteúdo ou um link para postar.');
                return;
            }
            if (mediaUrl.includes('youtube.com')) {
                mediaType = 'youtube';
            } else if (mediaUrl.includes('spotify.com')) {
                mediaType = 'spotify';
            } else {
                alert('Por favor, insira um link válido do YouTube ou Spotify.');
                return;
            }
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            const authorName = userDoc.exists() ? userDoc.data().name : 'Usuário Anônimo';

            console.log('User:', auth.currentUser);
            await addDoc(collection(db, 'feed'), {
                authorId: user.uid,
                authorName: authorName,
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
