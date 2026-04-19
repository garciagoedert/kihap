import { db, auth } from '../../intranet/firebase-config.js';
import { collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/**
 * Inicializa a barra de stories no feed buscando dados do Firestore.
 */
export async function initStories() {
    const storiesContainer = document.getElementById('stories-container');
    const storiesBar = document.getElementById('stories-bar');
    
    if (!storiesContainer || !storiesBar) return;

    // Aguardar autenticação para obter a unidade do aluno
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            storiesContainer.classList.add('hidden');
            return;
        }

        try {
            // Obter dados do aluno para filtrar visibilidade
            // (Assumindo que os dados básicos já foram carregados no feed.js, 
            // mas buscaremos aqui para garantir isolamento se necessário)
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
            const userData = !userDoc.empty ? userDoc.docs[0].data() : {};
            const userUnit = userData.unidade || userData.unit || '';

            // 1. Buscar Stories que ainda não expiraram
            const now = new Date();
            const q = query(
                collection(db, 'stories'), 
                where('expiresAt', '>=', now),
                orderBy('expiresAt', 'asc')
            );
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                storiesContainer.classList.add('hidden');
                return;
            }

            const allStories = [];
            querySnapshot.forEach(doc => {
                const story = { id: doc.id, ...doc.data() };
                
                // 2. Filtro de Visibilidade (Lógica idêntica ao Feed)
                const isForMe = story.targetStudents?.includes(user.uid);
                const isForMyUnit = story.targetUnit === 'all' || story.targetUnit === userUnit;
                const isAuthor = story.authorId === user.uid; // Criador sempre vê
                
                if (isForMe || isForMyUnit || isAuthor) {
                    allStories.push(story);
                }
            });

            if (allStories.length === 0) {
                storiesContainer.classList.add('hidden');
                return;
            }

            // 3. Agrupar stories por Autor (para criar os círculos)
            const groupedStories = allStories.reduce((acc, story) => {
                if (!acc[story.authorId]) {
                    acc[story.authorId] = {
                        authorName: story.authorName,
                        authorPhotoURL: story.authorPhotoURL,
                        stories: []
                    };
                }
                acc[story.authorId].stories.push({
                    id: story.id,
                    url: story.mediaUrl,
                    type: story.mediaType,
                    timestamp: story.createdAt
                });
                return acc;
            }, {});

            // 4. Renderizar Barra
            storiesContainer.classList.remove('hidden');
            storiesBar.innerHTML = '';

            Object.keys(groupedStories).forEach(authorId => {
                const authorData = groupedStories[authorId];
                const circle = createStoryCircle(authorData);
                storiesBar.appendChild(circle);
            });

        } catch (err) {
            console.error("Erro ao carregar Kihap Stories:", err);
            storiesContainer.classList.add('hidden');
        }
    });
}

/**
 * Cria o elemento visual do círculo de story.
 */
function createStoryCircle(authorData) {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center gap-1 cursor-pointer min-w-[80px] group';
    
    div.innerHTML = `
        <div class="relative p-[3px] rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 group-active:scale-95 transition-transform">
            <div class="p-[2px] bg-[#111] rounded-full">
                <img src="${authorData.authorPhotoURL || '../intranet/default-profile.svg'}" 
                     alt="${authorData.authorName}" 
                     class="w-16 h-16 rounded-full object-cover border-2 border-transparent"
                     onerror="this.src='../intranet/default-profile.svg'">
            </div>
        </div>
        <span class="text-[11px] text-gray-400 font-medium truncate w-20 text-center">${authorData.authorName}</span>
    `;

    div.addEventListener('click', () => {
        openStoryPlayer(authorData.stories, {
            username: authorData.authorName,
            profile_picture: authorData.authorPhotoURL
        });
    });

    return div;
}

/**
 * Abre o player de stories customizado.
 */
function openStoryPlayer(stories, account) {
    let currentIndex = 0;
    
    const modal = document.createElement('div');
    modal.id = 'story-player-modal';
    modal.className = 'fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-0 md:p-4';
    
    modal.innerHTML = `
        <div class="relative w-full h-full max-w-lg bg-black rounded-none md:rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <!-- Progress Bars -->
            <div class="absolute top-4 left-4 right-4 z-50 flex gap-1">
                ${stories.map((_, i) => `<div class="h-1 bg-white/30 flex-1 rounded-full overflow-hidden"><div id="progress-${i}" class="h-full bg-white w-0 transition-all duration-[5000ms] linear"></div></div>`).join('')}
            </div>

            <!-- Header -->
            <div class="absolute top-8 left-4 right-4 z-50 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <img src="${account.profile_picture || '../intranet/default-profile.svg'}" class="w-8 h-8 rounded-full border border-white/20 object-cover" onerror="this.src='../intranet/default-profile.svg'">
                    <span class="text-white font-bold text-sm shadow-sm">${account.username}</span>
                </div>
                <button id="close-player" class="text-white hover:text-gray-300 transition-colors p-2">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <!-- Content Container -->
            <div id="story-content" class="w-full h-full flex items-center justify-center bg-gray-900">
                <!-- Media will be injected here -->
            </div>

            <!-- Navigation Overlays -->
            <div class="absolute inset-y-0 left-0 w-1/3 z-40 cursor-pointer" id="prev-btn"></div>
            <div class="absolute inset-y-0 right-0 w-1/3 z-40 cursor-pointer" id="next-btn"></div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const contentArea = modal.querySelector('#story-content');
    const closeBtn = modal.querySelector('#close-player');
    let timer;

    const showStory = (index) => {
        clearTimeout(timer);
        currentIndex = index;
        const story = stories[index];
        
        // Reset and animate current progress bar
        stories.forEach((_, i) => {
            const bar = modal.querySelector(`#progress-${i}`);
            bar.style.transition = 'none';
            bar.style.width = i < index ? '100%' : '0%';
        });

        requestAnimationFrame(() => {
            const currentBar = modal.querySelector(`#progress-${index}`);
            currentBar.style.transition = 'width 5000ms linear';
            currentBar.style.width = '100%';
        });

        // Injetar mídia
        if (story.type === 'VIDEO') {
            contentArea.innerHTML = `<video src="${story.url}" autoplay muted playsinline class="w-full h-full object-contain"></video>`;
            const video = contentArea.querySelector('video');
            video.onended = nextStory;
        } else {
            contentArea.innerHTML = `<img src="${story.url}" class="w-full h-full object-contain">`;
            timer = setTimeout(nextStory, 5000);
        }
    };

    const nextStory = () => {
        if (currentIndex < stories.length - 1) {
            showStory(currentIndex + 1);
        } else {
            closePlayer();
        }
    };

    const prevStory = () => {
        if (currentIndex > 0) {
            showStory(currentIndex - 1);
        }
    };

    const closePlayer = () => {
        clearTimeout(timer);
        document.body.removeChild(modal);
        document.body.style.overflow = '';
    };

    closeBtn.onclick = closePlayer;
    modal.querySelector('#next-btn').onclick = nextStory;
    modal.querySelector('#prev-btn').onclick = prevStory;

    // Iniciar
    showStory(0);
}
