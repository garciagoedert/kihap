import { createUserWithEmailAndPassword, onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { auth, db } from './firebase-config.js';

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

            // Inicializa mensagens push (FCM)
            setupMessaging(user.uid);

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
    console.log('[DEBUG-AUTH] Solicitando getCurrentUser...');
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.error('[DEBUG-AUTH] Timeout ao tentar obter estado de autenticação (5s).');
            resolve(null);
        }, 5000);

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            clearTimeout(timeout);
            unsubscribe(); // Para de ouvir após obter o primeiro resultado
            if (user) {
                console.log('[DEBUG-AUTH] Firebase Auth detectou usuário:', user.uid);
                const userData = await getUserData(user.uid);
                if (userData) {
                    console.log('[DEBUG-AUTH] Documento Firestore carregado com sucesso para:', user.uid);
                } else {
                    console.warn('[DEBUG-AUTH] Usuário logado no Auth, mas documento no Firestore NÃO encontrado.');
                }
                resolve(userData);
            } else {
                console.warn('[DEBUG-AUTH] Firebase Auth reportou usuário como NULL.');
                resolve(null);
            }
        }, (error) => {
            clearTimeout(timeout);
            console.error('[DEBUG-AUTH] Erro no onAuthStateChanged:', error);
            reject(error);
        });
    });
}

// Função de logout
window.logout = function () {
    signOut(auth).then(() => {
        sessionStorage.clear();
        localStorage.clear();
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
        const { password, ...firestoreData } = userData;
        await setDoc(doc(db, "users", user.uid), firestoreData);
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

async function setupMessaging(userId) {
    if (!('Notification' in window)) {
        console.log("Este navegador não suporta notificações desktop");
        return;
    }

    try {
        const messaging = getMessaging();
        
        // Verifica se já temos permissão
        if (Notification.permission === 'default') {
            // Não pedimos permissão imediatamente em todas as páginas para não ser irritante, 
            // mas para o Kihap faz sentido garantir que o usuário receba avisos.
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
        } else if (Notification.permission !== 'granted') {
            return;
        }

        // Obtém o token FCM
        // Nota: A VAPID KEY deve ser configurada aqui quando disponível
        const vapidKey = window.KIHAP_VAPID_KEY || ''; 
        if (!vapidKey) {
            console.warn("VAPID Key não configurada. Push notifications desativadas.");
            return;
        }

        const token = await getToken(messaging, { vapidKey });
        
        if (token) {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                const tokens = data.fcmTokens || [];
                if (!tokens.includes(token)) {
                    await updateDoc(userRef, {
                        fcmTokens: [...tokens, token]
                    });
                    console.log("Token FCM registrado com sucesso.");
                }
            }
        }
    } catch (error) {
        console.error("Erro ao configurar mensagens push:", error);
    }
}

/**
 * Garante que o usuário logado é um administrador.
 * Caso contrário, retorna falso. Atualiza o localStorage se necessário.
 */
export async function ensureAdmin() {
    console.log('[DEBUG-AUTH] Iniciando ensureAdmin...');
    try {
        const user = await getCurrentUser();
        if (!user) {
            console.warn('[DEBUG-AUTH] Nenhum usuário logado encontrado em getCurrentUser.');
            return false;
        }
        
        console.log('[DEBUG-AUTH] Usuário carregado no ensureAdmin:', user.uid, 'isAdmin:', user.isAdmin);
        
        if (user.isAdmin === true) {
            localStorage.setItem('isAdmin', 'true');
            return true;
        } else {
            console.warn('[DEBUG-AUTH] O campo isAdmin no Firestore NÃO é true para este usuário.');
            localStorage.setItem('isAdmin', 'false');
            return false;
        }
    } catch (error) {
        console.error("[DEBUG-AUTH] Erro crítico no ensureAdmin:", error);
        return false;
    }
}

export { setupMessaging };
