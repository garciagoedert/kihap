import { onAuthReady } from './auth.js';
import { db, storage } from './firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

export function setupGerenciarEmblemasPage() {
    onAuthReady(user => {
        if (user) {
            const addBadgeForm = document.getElementById('add-badge-form');
            addBadgeForm.addEventListener('submit', handleAddBadge);

            const container = document.getElementById('badges-list-container');
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-badge-btn')) {
                    const badgeId = e.target.dataset.id;
                    const imageUrl = e.target.dataset.imageUrl;
                    handleDeleteBadge(badgeId, imageUrl);
                }
            });

            loadBadges();
        }
    });
}

async function loadBadges() {
    const container = document.getElementById('badges-list-container');
    container.innerHTML = '<p class="col-span-full text-center text-gray-500">Carregando emblemas...</p>';

    try {
        const q = query(collection(db, "badges"), orderBy("name"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhum emblema cadastrado ainda.</p>';
            return;
        }

        let badgesHtml = '';
        querySnapshot.forEach(doc => {
            const badge = doc.data();
            const badgeId = doc.id;
            badgesHtml += `
                <div class="bg-gray-800 p-4 rounded-lg flex flex-col items-center text-center badge-card relative">
                    <img src="${badge.imageUrl}" alt="${badge.name}" class="w-24 h-24 rounded-full object-cover mb-4 border-2 border-gray-600">
                    <h3 class="font-bold text-lg text-yellow-400">${badge.name}</h3>
                    <p class="text-sm text-gray-400 mt-2 flex-grow">${badge.description}</p>
                    <button data-id="${badgeId}" data-image-url="${badge.imageUrl}" class="delete-badge-btn mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-xs">
                        Excluir
                    </button>
                </div>
            `;
        });
        container.innerHTML = badgesHtml;

    } catch (error) {
        console.error("Erro ao carregar emblemas: ", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Ocorreu um erro ao carregar os emblemas.</p>';
    }
}

async function handleAddBadge(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-badge-btn');
    const form = e.target;
    const badgeName = document.getElementById('badge-name').value;
    const badgeDescription = document.getElementById('badge-description').value;
    const badgeImageFile = document.getElementById('badge-image').files[0];

    if (!badgeName || !badgeDescription || !badgeImageFile) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
        // 1. Fazer upload da imagem para o Firebase Storage
        const imageRef = ref(storage, `badges/${Date.now()}_${badgeImageFile.name}`);
        const snapshot = await uploadBytes(imageRef, badgeImageFile);
        const imageUrl = await getDownloadURL(snapshot.ref);

        // 2. Salvar os dados do emblema no Firestore
        await addDoc(collection(db, "badges"), {
            name: badgeName,
            description: badgeDescription,
            imageUrl: imageUrl,
            createdAt: serverTimestamp()
        });

        alert("Emblema adicionado com sucesso!");
        form.reset();
        loadBadges(); // Recarrega a lista de emblemas

    } catch (error) {
        console.error("Erro ao adicionar emblema: ", error);
        alert(`Ocorreu um erro ao salvar o emblema: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Emblema';
    }
}

async function handleDeleteBadge(badgeId, imageUrl) {
    if (!confirm("Tem certeza que deseja excluir este emblema? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        // 1. Deletar o documento do Firestore
        await deleteDoc(doc(db, "badges", badgeId));

        // 2. Deletar a imagem do Storage
        if (imageUrl) {
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef);
        }

        alert("Emblema excluído com sucesso!");
        loadBadges(); // Recarrega a lista

    } catch (error) {
        console.error("Erro ao excluir emblema: ", error);
        alert(`Ocorreu um erro ao excluir o emblema: ${error.message}`);
    }
}
