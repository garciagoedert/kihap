import { createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Função para obter dados do usuário do Firestore
export async function getUserData(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
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

// Função para verificar se o usuário é admin
export async function checkAdminStatus(user) {
    if (!user) return false;
    const userData = await getUserData(user.uid);
    return userData?.isAdmin === true;
}

// Função para verificar o estado de autenticação e executar um callback
export function onAuthReady(callback) {
    onAuthStateChanged(auth, user => {
        if (user) {
            // Usuário está logado.
            console.log('Usuário logado:', user.uid);
            callback(user);
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

// Função de logout
window.logout = function() {
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

window.addUser = async function(userData) {
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

window.updateUser = async function(uid, updatedData) {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, updatedData);
        alert('Usuário atualizado com sucesso!');
        return { success: true };
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        alert(`Erro ao atualizar usuário: ${error.message}`);
        return { success: false, error: error.message };
    }
}

window.deleteUser = async function(uid) {
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
