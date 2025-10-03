import { app, db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, serverTimestamp, orderBy, query, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showAlert, showConfirm } from './common-ui.js';

const storage = getStorage(app);

let quill;
let heroImageFile = null;

// Função para inicializar a página principal de Processos
export function initProcessosPage() {
    loadArticles();
    document.getElementById('searchInput').addEventListener('input', searchArticles);
}

// Função para inicializar a página do editor de Processos
export function initEditorPage() {
    initializeEditor();
}

// Função para inicializar a página de visualização de Processos
export function initViewerPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    if (articleId) {
        loadArticleForViewing(articleId);
    } else {
        document.getElementById('article-title').innerText = "Artigo não encontrado";
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
    const articleId = urlParams.get('id');
    const deleteButton = document.getElementById('deleteArticle');

    if (articleId) {
        loadArticleForEditing(articleId);
        document.getElementById('editor-title').textContent = 'Editar Artigo';
        deleteButton.classList.remove('hidden');
        deleteButton.addEventListener('click', () => deleteArticle(articleId));
    }

    document.getElementById('saveArticle').addEventListener('click', () => saveArticle(articleId));
    document.getElementById('attachFile').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', uploadAttachment);
    document.getElementById('heroImageInput').addEventListener('change', handleHeroImageSelect);
}

async function loadArticleForEditing(articleId) {
    try {
        const docRef = doc(db, 'processos_articles', articleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('articleTitle').value = data.title;
            quill.setContents(data.content);
            if (data.youtubeUrl) {
                document.getElementById('youtubeUrl').value = data.youtubeUrl;
            }

            if (data.heroImageUrl) {
                const preview = document.getElementById('heroImagePreview');
                const icon = document.getElementById('heroImageIcon');
                preview.src = data.heroImageUrl;
                preview.classList.remove('hidden');
                icon.classList.add('hidden');
            }
        } else {
            console.error("Nenhum artigo encontrado com este ID!");
            showAlert("Artigo não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao carregar artigo para edição: ", error);
    }
}

async function deleteArticle(articleId) {
    showConfirm("Tem certeza de que deseja excluir este processo? Esta ação não pode ser desfeita.", async () => {
        try {
            await deleteDoc(doc(db, 'processos_articles', articleId));
            showAlert("Processo excluído com sucesso!");
            window.location.href = 'processos.html';
        } catch (error) {
            console.error("Erro ao excluir processo: ", error);
            showAlert("Ocorreu um erro ao excluir o processo.");
        }
    });
}

async function loadArticleForViewing(articleId) {
    const titleEl = document.getElementById('article-title');
    const contentEl = document.getElementById('article-content');
    const editButton = document.getElementById('edit-button');
    const heroContainer = document.getElementById('hero-container');
    const heroImage = document.getElementById('hero-image');
    const videoContainer = document.getElementById('video-container');

    try {
        const docRef = doc(db, 'processos_articles', articleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            titleEl.innerText = data.title;
            editButton.href = `processos-editor.html?id=${articleId}`;

            if (data.heroImageUrl) {
                heroImage.src = data.heroImageUrl;
                heroContainer.classList.remove('hidden');
            }

            if (data.youtubeUrl) {
                const videoId = getYouTubeVideoId(data.youtubeUrl);
                if (videoId) {
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
            const viewerQuill = new Quill(contentEl, {
                theme: 'snow',
                readOnly: true,
                modules: { toolbar: false }
            });
            viewerQuill.setContents(data.content);

        } else {
            titleEl.innerText = "Artigo não encontrado";
            contentEl.innerHTML = "<p>O artigo que você está procurando não existe ou foi removido.</p>";
            editButton.style.display = 'none';
        }
    } catch (error) {
        console.error("Erro ao carregar artigo para visualização: ", error);
        titleEl.innerText = "Erro ao carregar";
        contentEl.innerHTML = "<p>Ocorreu um erro ao carregar o artigo.</p>";
    }
}

async function saveArticle(articleId) {
    const title = document.getElementById('articleTitle').value.trim();
    const youtubeUrl = document.getElementById('youtubeUrl').value.trim();
    const content = quill.getContents();
    const user = auth.currentUser;

    if (!title || content.ops.every(op => !op.insert.trim())) {
        showAlert("Por favor, preencha o título e o conteúdo do processo.");
        return;
    }

    // Converte o objeto Delta do Quill para um objeto JSON simples
    const contentAsObject = JSON.parse(JSON.stringify(content));

    try {
        let heroImageUrl = document.getElementById('heroImagePreview').src;
        if (heroImageFile) {
            heroImageUrl = await uploadHeroImage(heroImageFile);
        }

        const articleData = {
            title: title,
            content: contentAsObject,
            youtubeUrl: youtubeUrl,
            updatedAt: serverTimestamp(),
            author: user.displayName || user.email,
            heroImageUrl: heroImageUrl.startsWith('http') ? heroImageUrl : ''
        };

        if (articleId) {
            await updateDoc(doc(db, 'processos_articles', articleId), articleData);
            showAlert("Processo atualizado com sucesso!");
        } else {
            articleData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'processos_articles'), articleData);
            showAlert("Processo salvo com sucesso!");
        }
        window.location.href = 'processos.html';
    } catch (error) {
        console.error("Erro ao salvar processo: ", error);
        showAlert("Ocorreu um erro ao salvar o processo.");
    }
}

function createArticleCard(doc) {
    const article = doc.data();
    const contentText = (article.content && article.content.ops) 
        ? article.content.ops.map(op => op.insert).join('').trim().substring(0, 150) + '...'
        : 'Nenhum conteúdo.';

    const card = document.createElement('div');
    card.className = 'article-card';
    card.innerHTML = `
        <div>
            <div class="flex items-center gap-3 mb-2">
                <i class="fas fa-book-open text-yellow-500"></i>
                <h3 class="text-xl font-bold text-gray-100">${article.title}</h3>
            </div>
            <div class="article-card-content mb-4">
                <p class="text-gray-400 text-sm">${contentText}</p>
            </div>
        </div>
        <div>
            <div class="text-xs text-gray-500 mb-4">
                <span>Por ${article.author}</span> | <span>Em ${article.createdAt.toDate().toLocaleDateString()}</span>
            </div>
            <a href="processos-viewer.html?id=${doc.id}" class="bg-gray-700 hover:bg-yellow-500 hover:text-black text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 w-full text-center block">
                Visualizar
            </a>
        </div>
    `;
    return card;
}

async function loadArticles() {
    const articlesList = document.getElementById('articles-list');
    try {
        const q = query(collection(db, 'processos_articles'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        articlesList.innerHTML = '';
        if (querySnapshot.empty) {
            articlesList.innerHTML = '<p class="text-center text-gray-500">Nenhum processo encontrado. Crie o primeiro!</p>';
            return;
        }
        articlesList.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
        querySnapshot.forEach((doc) => {
            articlesList.appendChild(createArticleCard(doc));
        });
    } catch (error) {
        console.error("Erro ao carregar artigos: ", error);
        articlesList.innerHTML = '<p>Erro ao carregar artigos.</p>';
    }
}

async function searchArticles() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const articlesList = document.getElementById('articles-list');
    
    try {
        const q = query(collection(db, 'processos_articles'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        articlesList.innerHTML = '';
        
        const filteredDocs = querySnapshot.docs.filter(doc => {
            const article = doc.data();
            const title = article.title.toLowerCase();
            const contentText = (article.content && article.content.ops) ? article.content.ops.map(op => op.insert).join('').toLowerCase() : '';
            return title.includes(searchTerm) || contentText.includes(searchTerm);
        });

        if (filteredDocs.length === 0) {
            articlesList.className = '';
            articlesList.innerHTML = '<p class="text-center text-gray-500">Nenhum artigo encontrado com o termo buscado.</p>';
            return;
        }
        
        articlesList.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
        filteredDocs.forEach(doc => {
            articlesList.appendChild(createArticleCard(doc));
        });
    } catch (error) {
        console.error("Erro ao buscar artigos: ", error);
        articlesList.innerHTML = '<p>Erro ao realizar a busca.</p>';
    }
}

function uploadAttachment(event) {
    const file = event.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    const storageRef = ref(storage, `processos_attachments/${user.uid}/${Date.now()}_${file.name}`);
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
    
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

async function uploadHeroImage(file) {
    const user = auth.currentUser;
    if (!user) {
        showAlert("Você precisa estar logado para fazer upload de imagens.");
        return null;
    }
    const storageRef = ref(storage, `processos_banners/${user.uid}/${Date.now()}_${file.name}`);
    
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
