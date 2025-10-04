import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from '../../intranet/firebase-config.js';

// Função para obter dados do usuário do Firestore
export async function getUserData(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            // Aqui podemos adicionar a lógica para buscar o ID do membro na API EVO no futuro
            return { uid, ...userSnap.data() };
        } else {
            console.log("No such user document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
}

// Função para verificar o estado de autenticação
export function checkAuth() {
    onAuthStateChanged(auth, user => {
        if (!user) {
            // Usuário não está logado, redireciona para a página de login central.
            window.location.href = '../intranet/login.html';
        }
    });
}

// Função de logout
window.logout = function() {
    signOut(auth).then(() => {
        sessionStorage.clear();
        window.location.href = '../intranet/login.html';
    }).catch((error) => {
        console.error('Erro ao fazer logout:', error);
    });
}

// Função para ser chamada quando a autenticação estiver pronta
export function onAuthReady(callback) {
    return onAuthStateChanged(auth, callback);
}
