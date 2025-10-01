import { app, db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, serverTimestamp, orderBy, query, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showAlert, showConfirm } from './common-ui.js';

const storage = getStorage(app);

let quill;

// Função para inicializar a página principal da Wiki
export function initWikiPage() {
    loadArticles();
    document.getElementById('searchInput').addEventListener('input', searchArticles);
}

// Função para inicializar a página do editor da Wiki
export function initEditorPage() {
    initializeEditor();
}

// Função para inicializar a página de visualização da Wiki
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
}

async function loadArticleForEditing(articleId) {
    try {
        const docRef = doc(db, 'wiki_articles', articleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('articleTitle').value = data.title;
            quill.setContents(data.content);
        } else {
            console.error("Nenhum artigo encontrado com este ID!");
            showAlert("Artigo não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao carregar artigo para edição: ", error);
    }
}

async function deleteArticle(articleId) {
    showConfirm("Tem certeza de que deseja excluir este artigo? Esta ação não pode ser desfeita.", async () => {
        try {
            await deleteDoc(doc(db, 'wiki_articles', articleId));
            showAlert("Artigo excluído com sucesso!");
            window.location.href = 'wiki.html';
        } catch (error) {
            console.error("Erro ao excluir artigo: ", error);
            showAlert("Ocorreu um erro ao excluir o artigo.");
        }
    });
}

async function loadArticleForViewing(articleId) {
    const titleEl = document.getElementById('article-title');
    const contentEl = document.getElementById('article-content');
    const editButton = document.getElementById('edit-button');

    try {
        const docRef = doc(db, 'wiki_articles', articleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            titleEl.innerText = data.title;
            editButton.href = `wiki-editor.html?id=${articleId}`;

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
    const content = quill.getContents();
    const user = auth.currentUser;

    if (!title || content.ops.every(op => !op.insert.trim())) {
        showAlert("Por favor, preencha o título e o conteúdo do artigo.");
        return;
    }

    // Converte o objeto Delta do Quill para um objeto JSON simples
    const contentAsObject = JSON.parse(JSON.stringify(content));

    try {
        if (articleId) {
            await updateDoc(doc(db, 'wiki_articles', articleId), {
                title: title,
                content: contentAsObject,
                updatedAt: serverTimestamp(),
                author: user.displayName || user.email
            });
            showAlert("Artigo atualizado com sucesso!");
        } else {
            await addDoc(collection(db, 'wiki_articles'), {
                title: title,
                content: contentAsObject,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                author: user.displayName || user.email
            });
            showAlert("Artigo salvo com sucesso!");
        }
        window.location.href = 'wiki.html';
    } catch (error) {
        console.error("Erro ao salvar artigo: ", error);
        showAlert("Ocorreu um erro ao salvar o artigo.");
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
            <a href="wiki-viewer.html?id=${doc.id}" class="bg-gray-700 hover:bg-yellow-500 hover:text-black text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 w-full text-center block">
                Visualizar
            </a>
        </div>
    `;
    return card;
}

async function loadArticles() {
    const articlesList = document.getElementById('articles-list');
    try {
        const q = query(collection(db, 'wiki_articles'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        articlesList.innerHTML = '';
        if (querySnapshot.empty) {
            articlesList.innerHTML = '<p class="text-center text-gray-500">Nenhum artigo encontrado. Crie o primeiro!</p>';
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
        const q = query(collection(db, 'wiki_articles'), orderBy('createdAt', 'desc'));
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
    const storageRef = ref(storage, `wiki_attachments/${user.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
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
