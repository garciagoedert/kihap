import { db } from '../../intranet/firebase-config.js';
import { onAuthReady, getUserData } from './auth.js';
import { collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function loadStudentTatameContent() {
    onAuthReady(async (user) => {
        if (user) {
            const articlesList = document.getElementById('articles-list');
            articlesList.innerHTML = '';

            try {
                // Fetch all tatame content directly
                const q = query(collection(db, "tatame_conteudos"));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    articlesList.innerHTML = '<p class="text-gray-400 col-span-full">Nenhum conteúdo encontrado.</p>';
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const article = doc.data();
                    const articleId = doc.id;
                    const articleCard = createArticleCard(article, articleId);
                    articlesList.appendChild(articleCard);
                });

            } catch (error) {
                console.error("Error loading student tatame content: ", error);
                articlesList.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar os conteúdos.</p>';
            }
        }
    });
}

function createArticleCard(article, articleId) {
    const card = document.createElement('div');
    card.className = 'article-card';

    const contentText = (article.content && article.content.ops)
        ? article.content.ops.map(op => op.insert).join('').trim().substring(0, 150) + '...'
        : 'Nenhum conteúdo.';

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
                <span>Por ${article.author}</span> | <span>Em ${article.createdAt ? article.createdAt.toDate().toLocaleDateString() : ''}</span>
            </div>
            <a href="conteudo-viewer.html?id=${articleId}" class="bg-gray-700 hover:bg-yellow-500 hover:text-black text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 w-full text-center block">
                Visualizar
            </a>
        </div>
    `;
    return card;
}
