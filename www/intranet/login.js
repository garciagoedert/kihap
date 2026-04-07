import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Buscar dados do usuário no Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', JSON.stringify({ ...userData, uid: user.uid, email: user.email }));
            sessionStorage.setItem('userName', userData.name);
            sessionStorage.setItem('isAdmin', userData.isAdmin || false);
            errorEl.classList.add('hidden');

            // --- LOGGING START ---
            try {
                const userType = userData.evoMemberId ? "Aluno" : "Funcionário";
                await addDoc(collection(db, "login_logs"), {
                    timestamp: new Date().toISOString(),
                    uid: user.uid,
                    email: user.email,
                    name: userData.name || "Unknown",
                    userType: userType
                });
            } catch (logError) {
                console.error("Failed to log login event:", logError);
            }
            // --- LOGGING END ---

            if (userData.evoMemberId) {
                window.location.href = '../members/index.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            // Se o documento não existe (comum em ambiente local), permite o login como admin básico
            console.warn("Documento do usuário não encontrado. Criando sessão básica.");
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', JSON.stringify({ uid: user.uid, email: user.email, isAdmin: true }));
            sessionStorage.setItem('userName', user.email.split('@')[0]);
            sessionStorage.setItem('isAdmin', 'true');

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
