import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from '../../intranet/firebase-config.js';

// Função para obter dados do usuário do Firestore
export async function getUserData(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return { id: uid, uid: uid, ...userSnap.data() };
        } else {
            console.log("No such user document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
}

// Função para verificar se o usuário é admin
export async function checkAdminStatus(user) {
    if (!user) return false;
    return user.isAdmin === true;
}

// Função para obter o usuário atualmente logado e seus dados
export function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // Para de ouvir após obter o primeiro resultado
            if (user) {
                const userData = await getUserData(user.uid);
                resolve(userData);
            } else {
                resolve(null);
            }
        }, reject);
    });
}

// Função para buscar todos os usuários (necessário para o chat)
export async function getAllUsers() {
    const users = [];
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
    }
    return users;
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
    return onAuthStateChanged(auth, async user => {
        if (user) {
            const userData = await getUserData(user.uid);
            callback(userData);
        } else {
            callback(null);
        }
    });
}
