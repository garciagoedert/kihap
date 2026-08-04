import { app, db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, serverTimestamp, orderBy, query, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showAlert, showConfirm } from './common-ui.js';

const storage = getStorage(app);

let quill;
let heroImageFile = null;

// Função para inicializar a página principal de Conteúdos
export function initTatamePage() {
    loadArticles();
    document.getElementById('searchInput').addEventListener('input', searchArticles);
}

// Função para inicializar a página do editor de Conteúdos
export function initEditorPage() {
    initializeEditor();
}

// Função para inicializar a página de visualização de Conteúdos
export function initViewerPage() {
    const urlParams = new URLSearchParams(window.location.search);
    let articleId = urlParams.get('id');
    if (!articleId) {
        articleId = sessionStorage.getItem('selectedTatameArticleId');
    }
    if (!articleId) {
        const hash = window.location.hash.replace('#', '');
        if (hash) articleId = hash;
    }
    if (articleId) {
        loadArticleForViewing(articleId);
    } else {
        showNotFoundState();
    }
}

function showNotFoundState() {
    const titleEl = document.getElementById('article-title');
    const contentEl = document.getElementById('article-content');
    const editButton = document.getElementById('edit-button');
    const metaEl = document.getElementById('article-meta');

    if (titleEl) {
        titleEl.innerText = "Conteúdo não encontrado";
        titleEl.className = "text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white";
    }
    if (metaEl) metaEl.innerText = "";
    if (editButton) editButton.classList.add('hidden');
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="text-center py-12 px-4">
                <i class="fas fa-exclamation-circle text-4xl text-amber-500 mb-4 opacity-80"></i>
                <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Nenhum conteúdo selecionado</h3>
                <p class="text-xs sm:text-sm text-gray-400 max-w-md mx-auto mb-6">
                    O conteúdo que você tentou acessar não foi encontrado ou o link é inválido.
                </p>
                <a href="tatame.html" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-dark text-black font-extrabold text-xs shadow-md transition-all">
                    <i class="fas fa-arrow-left"></i> Voltar ao Tatame
                </a>
            </div>
        `;
    }
}

async function loadArticleForViewing(articleId) {
    const titleEl = document.getElementById('article-title');
    const contentEl = document.getElementById('article-content');
    const editButton = document.getElementById('edit-button');
    const metaEl = document.getElementById('article-meta');
    const heroContainer = document.getElementById('hero-container');
    const heroImage = document.getElementById('hero-image');
    const videoContainer = document.getElementById('video-container');

    try {
        const docRef = doc(db, 'tatame_conteudos', articleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (titleEl) {
                titleEl.innerText = data.title;
                titleEl.className = "text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight";
            }
            if (editButton) {
                editButton.href = `conteudo-editor.html?id=${articleId}`;
                editButton.onclick = () => sessionStorage.setItem('selectedTatameArticleId', articleId);
                editButton.classList.remove('hidden');
            }

            const dateStr = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString('pt-BR') : '') : '';
            if (metaEl) {
                metaEl.innerText = `Por ${data.author || 'Equipe KIHAP'}${dateStr ? ' • ' + dateStr : ''}`;
            }

            if (data.heroImageUrl && data.heroImageUrl.startsWith('http')) {
                heroImage.src = data.heroImageUrl;
                heroContainer.classList.remove('hidden');
            }

            if (data.youtubeUrl) {
                const videoId = getYouTubeVideoId(data.youtubeUrl);
                if (videoId) {
                    videoContainer.innerHTML = '';
                    const iframe = document.createElement('iframe');
                    iframe.src = `https://www.youtube.com/embed/${videoId}`;
                    iframe.frameBorder = '0';
                    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                    iframe.allowFullscreen = true;
                    videoContainer.appendChild(iframe);
                    videoContainer.classList.remove('hidden');
                }
            }

            // Usa o Quill em modo read-only para renderizar o conteúdo
            contentEl.innerHTML = '';
            if (data.content && data.content.ops) {
                const viewerQuill = new Quill(contentEl, {
                    theme: 'snow',
                    readOnly: true,
                    modules: { toolbar: false }
                });
                viewerQuill.setContents(data.content);
            } else if (typeof data.content === 'string') {
                contentEl.innerHTML = data.content;
            } else {
                contentEl.innerHTML = '<p class="text-gray-400 italic">Sem conteúdo registrado.</p>';
            }

        } else {
            showNotFoundState();
        }
    } catch (error) {
        console.error("Erro ao carregar conteúdo para visualização: ", error);
        showNotFoundState();
    }
}

function initializeEditor() {
    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image'],
                ['clean']
            ]
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    let articleId = urlParams.get('id');
    if (!articleId) {
        articleId = sessionStorage.getItem('selectedTatameArticleId');
    }
    const deleteButton = document.getElementById('deleteArticle');

    if (articleId) {
        loadArticleForEditing(articleId);
        document.getElementById('editor-title').textContent = 'Editar Conteúdo';
        deleteButton.classList.remove('hidden');
        deleteButton.addEventListener('click', () => deleteArticle(articleId));
    }

    document.getElementById('saveArticle').addEventListener('click', () => saveArticle(articleId));
    document.getElementById('attachFile').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', uploadAttachment);
    document.getElementById('heroImageInput').addEventListener('change', handleHeroImageSelect);
    document.getElementById('removeHeroImage').addEventListener('click', removeHeroImage);
}

function createArticleCard(doc) {
    const article = doc.data();
    let contentText = '';
    if (article.content && article.content.ops) {
        contentText = article.content.ops.map(op => (typeof op.insert === 'string' ? op.insert : '')).join('').trim();
    } else if (typeof article.content === 'string') {
        const temp = document.createElement('div');
        temp.innerHTML = article.content;
        contentText = temp.textContent || temp.innerText || '';
    }
    if (contentText.length > 140) {
        contentText = contentText.substring(0, 140) + '...';
    }
    if (!contentText) contentText = 'Clique em visualizar para ver o conteúdo completo.';

    const dateCreated = article.createdAt && article.createdAt.toDate ? article.createdAt.toDate().toLocaleDateString('pt-BR') : '';

    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 border border-gray-150 dark:border-gray-800/80 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group flex flex-col justify-between relative cursor-pointer';
    
    card.addEventListener('click', (e) => {
        sessionStorage.setItem('selectedTatameArticleId', doc.id);
        window.location.href = `conteudo-viewer.html?id=${doc.id}`;
    });

    card.innerHTML = `
        <div>
            <div class="flex items-center justify-between mb-3">
                <span class="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-extrabold px-2.5 py-0.5 rounded-md uppercase">
                    <i class="fas fa-book-open mr-1"></i> Tatame
                </span>
                ${article.youtubeUrl ? '<i class="fab fa-youtube text-red-500 text-sm" title="Possui vídeo"></i>' : ''}
            </div>
            <h3 class="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white mb-2 leading-snug group-hover:text-amber-500 transition-colors line-clamp-2">${article.title}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-6 line-clamp-3">${contentText}</p>
        </div>
        
        <div class="pt-4 border-t border-gray-100 dark:border-gray-800/80 flex flex-col gap-3">
            <div class="text-[10px] text-gray-400 font-semibold flex items-center justify-between">
                <span class="truncate">Por ${article.author || 'Equipe KIHAP'}</span>
                ${dateCreated ? `<span>${dateCreated}</span>` : ''}
            </div>
            <a href="conteudo-viewer.html?id=${doc.id}" onclick="sessionStorage.setItem('selectedTatameArticleId', '${doc.id}')" class="w-full py-2.5 px-4 bg-gray-50 dark:bg-gray-800/60 hover:bg-amber-500 text-gray-700 dark:text-gray-200 hover:text-black font-extrabold text-xs rounded-xl transition-all border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500">
                <span>Visualizar</span> <i class="fas fa-arrow-right text-[10px]"></i>
            </a>
        </div>
    `;
    return card;
}

async function loadArticles() {
    const articlesList = document.getElementById('articles-list');
    try {
        const q = query(collection(db, 'tatame_conteudos'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        articlesList.innerHTML = '';
        if (querySnapshot.empty) {
            articlesList.className = '';
            articlesList.innerHTML = `
                <div class="text-center py-16 bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-150 dark:border-gray-800">
                    <i class="fas fa-folder-open text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-200">Nenhum conteúdo cadastrado</p>
                    <p class="text-xs text-gray-400 mt-1 mb-4">Seja o primeiro a publicar um conteúdo no Tatame.</p>
                    <a href="conteudo-editor.html" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-bold text-xs shadow-md">
                        <i class="fas fa-plus"></i> Criar Conteúdo
                    </a>
                </div>
            `;
            return;
        }
        articlesList.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
        querySnapshot.forEach((doc) => {
            articlesList.appendChild(createArticleCard(doc));
        });
    } catch (error) {
        console.error("Erro ao carregar conteúdos: ", error);
        articlesList.innerHTML = '<p class="text-center text-red-500 text-xs py-8">Erro ao carregar conteúdos.</p>';
    }
}

async function searchArticles() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const articlesList = document.getElementById('articles-list');
    
    try {
        const q = query(collection(db, 'tatame_conteudos'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        articlesList.innerHTML = '';
        
        const filteredDocs = querySnapshot.docs.filter(doc => {
            const article = doc.data();
            const title = (article.title || '').toLowerCase();
            const contentText = (article.content && article.content.ops) ? article.content.ops.map(op => (typeof op.insert === 'string' ? op.insert : '')).join('').toLowerCase() : '';
            return title.includes(searchTerm) || contentText.includes(searchTerm);
        });

        if (filteredDocs.length === 0) {
            articlesList.className = '';
            articlesList.innerHTML = `
                <div class="text-center py-12 bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-150 dark:border-gray-800">
                    <i class="fas fa-search text-3xl text-gray-300 dark:text-gray-600 mb-3 opacity-60"></i>
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-200">Nenhum resultado encontrado</p>
                    <p class="text-xs text-gray-400 mt-1">Tente pesquisar por outros termos.</p>
                </div>
            `;
            return;
        }
        
        articlesList.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
        filteredDocs.forEach(doc => {
            articlesList.appendChild(createArticleCard(doc));
        });
    } catch (error) {
        console.error("Erro ao buscar conteúdos: ", error);
        articlesList.innerHTML = '<p class="text-center text-red-500 text-xs py-8">Erro ao realizar a busca.</p>';
    }
}

function uploadAttachment(event) {
    const file = event.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    const storageRef = ref(storage, `tatame_attachments/${user.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            // Opcional: Mostrar progresso do upload para o usuário
        },
        (error) => {
            console.error("Erro no upload: ", error);
            showAlert("Falha no upload do anexo.");
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                console.log('File available at', downloadURL);
                const range = quill.getSelection(true);
                quill.insertText(range.index, file.name, 'link', downloadURL);
                quill.setSelection(range.index + file.name.length);
            });
        }
    );
}

function handleHeroImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    heroImageFile = file;
    const preview = document.getElementById('heroImagePreview');
    const icon = document.getElementById('heroImageIcon');
    const removeBtn = document.getElementById('removeHeroImage');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
        removeBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeHeroImage() {
    heroImageFile = null;
    const preview = document.getElementById('heroImagePreview');
    const icon = document.getElementById('heroImageIcon');
    const removeBtn = document.getElementById('removeHeroImage');
    const fileInput = document.getElementById('heroImageInput');

    preview.src = '';
    preview.classList.add('hidden');
    icon.classList.remove('hidden');
    removeBtn.classList.add('hidden');
    fileInput.value = ''; // Limpa o input de arquivo
}

async function uploadHeroImage(file) {
    const user = auth.currentUser;
    if (!user) {
        showAlert("Você precisa estar logado para fazer upload de imagens.");
        return null;
    }
    const storageRef = ref(storage, `tatame_banners/${user.uid}/${Date.now()}_${file.name}`);
    
    try {
        const snapshot = await uploadBytesResumable(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('Banner image available at', downloadURL);
        return downloadURL;
    } catch (error) {
        console.error("Erro no upload do banner: ", error);
        showAlert("Falha no upload do banner.");
        return null;
    }
}

function getYouTubeVideoId(url) {
    let videoId = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (e) {
        console.error('URL do YouTube inválida:', e);
    }
    return videoId;
}
