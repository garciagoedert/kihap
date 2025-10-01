import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, serverTimestamp, query, where, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, app } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';

// --- INITIALIZATION ---
const auth = getAuth(app);

// --- UI ELEMENTS ---
const createProjectBtn = document.getElementById('create-project-btn');
const projectsGrid = document.getElementById('projects-grid');

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (sessionStorage.getItem('isLoggedIn') === 'true') {
            document.getElementById('app-container').classList.remove('hidden');
            setupProjectsListener(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// --- DATA HANDLING (FIRESTORE) ---
function setupProjectsListener(userId) {
    const projectsCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects');
    // Query only by owner to avoid needing a composite index
    const q = query(projectsCollection, where("owner", "==", userId));

    onSnapshot(q, (snapshot) => {
        const allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activeProjects = allProjects.filter(project => !project.isArchived);

        projectsGrid.innerHTML = ''; // Clear existing projects
        if (activeProjects.length === 0) {
            projectsGrid.innerHTML = `<p class="text-gray-500 col-span-full text-center">Nenhum projeto encontrado. Crie um novo para começar!</p>`;
            return;
        }
        activeProjects.forEach(project => {
            const projectCard = createProjectCard(project);
            projectsGrid.appendChild(projectCard);
        });
    }, (error) => {
        console.error("Error fetching projects:", error);
        projectsGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">Não foi possível carregar os projetos.</p>`;
    });
}

// --- RENDERING ---
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'bg-gray-800 p-4 rounded-lg shadow-md flex flex-col justify-between hover:bg-gray-700 transition-colors cursor-pointer';
    
    const updatedDate = project.updatedAt ? project.updatedAt.toDate().toLocaleDateString('pt-BR') : 'Data indisponível';

    card.innerHTML = `
        <div class="flex-grow">
            <h3 class="font-bold text-lg mb-2">${project.name}</h3>
            <p class="text-sm text-gray-400">Atualizado em: ${updatedDate}</p>
        </div>
        <div class="mt-4 flex justify-between items-center">
            <a href="projeto-editor.html?projectId=${project.id}" class="text-blue-400 hover:text-blue-300 font-semibold">Abrir</a>
            <div class="flex gap-2">
                <button data-action="edit" title="Editar Nome" class="text-gray-400 hover:text-blue-500"><i class="fas fa-pen"></i></button>
                <button data-action="archive" title="Arquivar" class="text-gray-400 hover:text-yellow-500"><i class="fas fa-archive"></i></button>
                <button data-action="delete" title="Excluir" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;

    card.addEventListener('click', (e) => {
        const action = e.target.closest('button')?.dataset.action;
        if (action === 'edit') {
            editProjectName(project.id, project.name);
        } else if (action === 'archive') {
            archiveProject(project.id);
        } else if (action === 'delete') {
            deleteProject(project.id, project.name);
        } else if (!action) {
            // Navigate only if not clicking a button
            window.location.href = `projeto-editor.html?projectId=${project.id}`;
        }
    });

    return card;
}

// --- EVENT LISTENERS ---
createProjectBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
        alert("Você precisa estar logado para criar um projeto.");
        return;
    }

    const projectName = prompt("Qual o nome do novo projeto?");
    if (projectName && projectName.trim() !== '') {
        try {
            const projectsCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects');
            const newProject = {
                name: projectName,
                owner: user.uid,
                isArchived: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            const docRef = await addDoc(projectsCollection, newProject);
            window.location.href = `projeto-editor.html?projectId=${docRef.id}`;
        } catch (error) {
            console.error("Error creating new project:", error);
            alert("Não foi possível criar o novo projeto.");
        }
    }
});

// --- PROJECT ACTIONS ---
async function editProjectName(projectId, currentName) {
    const newName = prompt("Digite o novo nome para o projeto:", currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
            const projectRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId);
            await updateDoc(projectRef, {
                name: newName,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating project name:", error);
            alert("Não foi possível atualizar o nome do projeto.");
        }
    }
}

async function archiveProject(projectId) {
    if (!confirm("Tem certeza que deseja arquivar este projeto?")) return;
    try {
        const projectRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId);
        await updateDoc(projectRef, {
            isArchived: true,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error archiving project:", error);
        alert("Não foi possível arquivar o projeto.");
    }
}

async function deleteProject(projectId, projectName) {
    if (!confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o projeto "${projectName}"? Esta ação não pode ser desfeita.`)) return;
    try {
        // Note: Deleting subcollections (nodes, connections) should be handled by a Cloud Function for robustness.
        // This client-side deletion is a simplification.
        const projectRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId);
        await deleteDoc(projectRef);
    } catch (error) {
        console.error("Error deleting project:", error);
        alert("Não foi possível excluir o projeto.");
    }
}

// A inicialização agora é tratada no arquivo HTML principal.
