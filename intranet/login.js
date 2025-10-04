import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

            // Lógica de redirecionamento inteligente
            if (userData.evoMemberId) {
                // É um aluno, redireciona para a área de membros
                window.location.href = '../members/index.html';
            } else {
                // É um usuário da intranet (admin, professor, etc.)
                window.location.href = 'analysis.html';
            }
        } else {
            throw new Error("Dados do usuário não encontrados no Firestore.");
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
