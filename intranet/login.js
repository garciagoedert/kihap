import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// --- AUTO-REDIRECT LOGIC ---
// Verifica se o usuário já está logado para evitar que ele veja a tela de login
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Usuário já autenticado detectado, redirecionando...");
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            updateLocalStorage(user, userData);
            if (userData.evoMemberId) {
                window.location.href = '../members/feed.html';
            } else {
                window.location.href = 'index.html';
            }
        }
    }
});

function updateLocalStorage(user, userData) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify({ ...userData, uid: user.uid, email: user.email }));
    localStorage.setItem('userName', userData.name || user.email.split('@')[0]);
    localStorage.setItem('isAdmin', userData.isAdmin || false);
}

async function handleLogin(e) {
    console.log("Iniciando tentativa de login no app...");
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    try {
        console.log("Chamando signInWithEmailAndPassword para: ", email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("signIn funcionou! UID:", userCredential.user.uid);
        const user = userCredential.user;

        // Buscar dados do usuário no Firestore
        console.log("Chamando getDoc no Firestore...");
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        console.log("getDoc finalizado!");

        if (userDoc.exists()) {
            const userData = userDoc.data();
            updateLocalStorage(user, userData);
            errorEl.classList.add('hidden');

            // --- LOGGING ---
            try {
                const userType = userData.evoMemberId ? "Aluno" : "Funcionário";
                await addDoc(collection(db, "login_logs"), {
                    timestamp: new Date().toISOString(),
                    uid: user.uid,
                    email: user.email,
                    name: userData.name || "Unknown",
                    userType: userType
                });
            } catch (logError) { console.error(logError); }

            if (userData.evoMemberId) {
                window.location.href = '../members/feed.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            console.warn("Documento do usuário não encontrado. Criando sessão básica.");
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('currentUser', JSON.stringify({ uid: user.uid, email: user.email, isAdmin: true }));
            localStorage.setItem('userName', user.email.split('@')[0]);
            localStorage.setItem('isAdmin', 'true');
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Erro de login:", error);
        errorEl.textContent = 'Email ou senha inválidos.';
        errorEl.classList.remove('hidden');
    }
}

// --- UI LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});
