// Importa as funções necessárias do SDK do Firebase
import { db } from '../intranet/firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Lógica do Formulário ---
const leadForm = document.getElementById('lead-form');
const formStatus = document.getElementById('form-status');

leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = leadForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    submitBtn.classList.add('opacity-50');
    formStatus.textContent = '';

    const data = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        telefone: document.getElementById('telefone').value,
        unidade: document.getElementById('unidade').value,
        status: 'Novo',
        createdAt: serverTimestamp()
    };

    try {
        const leadsCollectionRef = collection(db, 'leads');
        await addDoc(leadsCollectionRef, data);

        formStatus.textContent = 'Inscrição enviada com sucesso! Entraremos em contato em breve.';
        formStatus.className = 'text-green-800 text-center mt-4';
        leadForm.reset();

        setTimeout(() => {
            formStatus.textContent = '';
        }, 5000);

    } catch (error) {
        console.error("Erro ao salvar o lead:", error);
        formStatus.textContent = 'Ocorreu um erro ao enviar sua inscrição. Tente novamente.';
        formStatus.className = 'text-red-800 text-center mt-4';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'AGENDAR AULA EXPERIMENTAL';
        submitBtn.classList.remove('opacity-50');
    }
});
