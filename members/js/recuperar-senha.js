import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { auth, functions } from '../../intranet/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../../intranet/firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('reset-form');
    const emailStep = document.getElementById('email-step');
    const passwordStep = document.getElementById('password-step');
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    
    const verifyEmailBtn = document.getElementById('verify-email-btn');
    const setPasswordBtn = document.getElementById('set-password-btn');
    
    const messageContainer = document.getElementById('message-container');

    const getStudentDataByEmail = httpsCallable(functions, 'getStudentDataByEmail');
    const setStudentPassword = httpsCallable(functions, 'setStudentPassword');

    let studentData = null; // Armazena os dados do aluno após a verificação

    // O botão de verificação agora tem seu próprio evento de clique
    verifyEmailBtn.addEventListener('click', handleEmailVerification);

    // O formulário só será submetido na etapa de definir a senha
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordSet();
    });

    async function handleEmailVerification() {
        const email = emailInput.value.trim();
        if (!email) {
            messageContainer.innerHTML = `<p class="text-red-400">Por favor, insira um e-mail.</p>`;
            return;
        }

        verifyEmailBtn.disabled = true;
        verifyEmailBtn.textContent = 'Verificando...';
        messageContainer.innerHTML = '';

        try {
            const result = await getStudentDataByEmail({ email: email });
            if (result.data.exists) {
                studentData = result.data; // Armazena os dados do aluno
                // E-mail válido, avança para a próxima etapa
                emailStep.classList.add('hidden');
                passwordStep.classList.remove('hidden');
                emailInput.disabled = true; // Trava o campo de e-mail
                messageContainer.innerHTML = `<p class="text-green-400">E-mail verificado! Agora, crie sua nova senha.</p>`;
            } else {
                messageContainer.innerHTML = `<p class="text-red-400">O e-mail não foi encontrado em nosso sistema.</p>`;
            }
        } catch (error) {
            console.error("Erro ao verificar e-mail:", error);
            messageContainer.innerHTML = `<p class="text-red-400">Ocorreu um erro ao verificar o e-mail. Tente novamente.</p>`;
        } finally {
            verifyEmailBtn.disabled = false;
            verifyEmailBtn.textContent = 'Verificar E-mail';
        }
    }

    async function handlePasswordSet() {
        const newPassword = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (newPassword.length < 6) {
            messageContainer.innerHTML = `<p class="text-red-400">A senha deve ter no mínimo 6 caracteres.</p>`;
            return;
        }

        if (newPassword !== confirmPassword) {
            messageContainer.innerHTML = `<p class="text-red-400">As senhas não coincidem.</p>`;
            return;
        }

        setPasswordBtn.disabled = true;
        setPasswordBtn.textContent = 'Definindo senha...';
        messageContainer.innerHTML = '';

        try {
            if (!studentData) {
                throw new Error("Dados do aluno não encontrados. Verifique o e-mail novamente.");
            }

            // DEBUG: Log para verificar os dados que serão enviados para a Cloud Function
            console.log("Dados enviados para setStudentPassword:", { ...studentData, newPassword: newPassword });
            
            // Envia todos os dados do aluno para a função de definir senha
            await setStudentPassword({ ...studentData, newPassword: newPassword });

            // Senha definida com sucesso, agora tenta fazer o login
            const email = emailInput.value.trim();
            messageContainer.innerHTML = `<p class="text-green-400">Senha definida com sucesso! Fazendo login...</p>`;
            
            const userCredential = await signInWithEmailAndPassword(auth, email, newPassword);
            const user = userCredential.user;

            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('currentUser', JSON.stringify({ ...userData, uid: user.uid, email: user.email }));
                window.location.href = 'index.html'; // Redireciona para o painel
            } else {
                throw new Error("Dados do usuário não encontrados após o login.");
            }

        } catch (error) {
            console.error("Erro ao definir senha ou fazer login:", error);
            messageContainer.innerHTML = `<p class="text-red-400">Ocorreu um erro. Tente novamente.</p>`;
            setPasswordBtn.disabled = false;
            setPasswordBtn.textContent = 'Definir Senha e Acessar';
        }
    }
});
