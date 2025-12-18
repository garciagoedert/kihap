import { createUserWithEmailAndPassword, onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { auth, db } from './firebase-config.js';

// Função para obter dados do usuário do Firestore
export async function getUserData(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return { id: uid, ...userSnap.data() };
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
    // Verifica a propriedade 'isAdmin' no objeto de dados do usuário vindo do Firestore.
    if (!user) return false;
    return user.isAdmin === true;
}

// Função para forçar a atualização do token de ID do usuário
export async function forceTokenRefresh() {
    const user = auth.currentUser;
    if (user) {
        try {
            // Passar `true` para `getIdToken` força a atualização do token.
            await user.getIdToken(true);
            console.log("Token de usuário atualizado com sucesso.");
        } catch (error) {
            console.error("Erro ao forçar a atualização do token:", error);
        }
    }
}

// Função para verificar o estado de autenticação e executar um callback
export function onAuthReady(callback) {
    onAuthStateChanged(auth, async user => {
        if (user) {
            // Usuário está logado. Força a atualização do token para obter as claims mais recentes.
            await forceTokenRefresh();
            console.log('Usuário logado e token atualizado:', user.uid);
            const userData = await getUserData(user.uid);

            // Se o documento do usuário não existir no Firestore, retornamos um objeto básico
            // para permitir que a página inicialize e o usuário possa usar funções administrativas (se tiver claims)
            const fallbackUserData = userData || {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                isAdmin: false // Por segurança, assume que não é admin se o doc não existe
            };

            callback(fallbackUserData);
        } else {
            // Usuário está deslogado.
            // Redireciona para a página de login se não estiver nela.
            if (window.location.pathname !== '/intranet/login.html' && window.location.pathname !== '/intranet/recuperacao.html') {
                window.location.href = 'login.html';
            }
            callback(null);
        }
    });
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

// Função de logout
window.logout = function () {
    signOut(auth).then(() => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Erro ao fazer logout:', error);
    });
}

// Funções de gerenciamento de usuário (a serem implementadas/adaptadas)
// Por enquanto, elas podem ser mantidas vazias ou removidas se não forem usadas em nenhum outro lugar.

async function findUser(email, password) {
    // Esta função não é mais necessária e será removida.
    return null;
}

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

export async function addUser(userData) {
    try {
        // 1. Criar o usuário no Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;

        // 2. Salvar os dados adicionais no Firestore
        await setDoc(doc(db, "users", user.uid), {
            name: userData.name,
            email: userData.email,
            isAdmin: userData.isAdmin
        });
        alert('Usuário adicionado com sucesso!');
        return { success: true, uid: user.uid };
    } catch (error) {
        console.error("Erro ao adicionar usuário:", error);
        alert(`Erro ao adicionar usuário: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export async function updateUser(uid, updatedData) {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, updatedData);
        // alert('Usuário atualizado com sucesso!'); // Let's remove the alert for a better UX
        return { success: true };
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        alert(`Erro ao atualizar usuário: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export async function deleteUser(uid) {
    try {
        // ATENÇÃO: Esta função deleta apenas o documento do Firestore.
        // Deletar um usuário do Firebase Authentication pelo client-side
        // não é recomendado por questões de segurança.
        // A exclusão completa deve ser feita por um backend com o Admin SDK.
        await deleteDoc(doc(db, "users", uid));
        alert('Usuário removido do banco de dados com sucesso!');
        return { success: true };
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        alert(`Erro ao deletar usuário: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export async function updateUserPassword(userId, newPassword) {
    const functions = getFunctions();
    const updateUserPasswordCallable = httpsCallable(functions, 'updateUserPassword');
    try {
        const result = await updateUserPasswordCallable({ userId, password: newPassword });
        return result.data;
    } catch (error) {
        console.error("Erro ao chamar a função para atualizar a senha:", error);
        throw error;
    }
}
