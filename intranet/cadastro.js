import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

async function handleCadastro(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('cadastro-error');

    if (!email.endsWith('@kihap.com.br')) {
        errorEl.textContent = 'O email precisa ser um email da Kihap (@kihap.com.br).';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            isAdmin: false 
        });

        alert('Usuário cadastrado com sucesso! Você será redirecionado para a página de login.');
        window.location.href = 'login.html';

    } catch (error) {
        console.error("Erro de cadastro:", error);
        if (error.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'Este email já está em uso.';
        } else {
            errorEl.textContent = 'Erro ao cadastrar. Tente novamente.';
        }
        errorEl.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cadastroForm = document.getElementById('cadastro-form');
    if (cadastroForm) {
        cadastroForm.addEventListener('submit', handleCadastro);
    }
});
