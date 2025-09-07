// Importa as funções necessárias do SDK do Firebase
import { db } from '../intranet/firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Lógica do Formulário ---
const leadForm = document.getElementById('lead-form');
const formStatus = document.getElementById('form-status');

if (leadForm) {
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
            source: 'Site',
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
}


// --- Lógica do Formulário do Modal Academy ---
const academyLeadForm = document.getElementById('academy-lead-form');
const academyFormStatus = document.getElementById('academy-form-status');

if (academyLeadForm) {
    academyLeadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = academyLeadForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        submitBtn.classList.add('opacity-50');
        academyFormStatus.textContent = '';

        const data = {
            nome: document.getElementById('academy-nome').value,
            email: document.getElementById('academy-email').value,
            telefone: document.getElementById('academy-telefone').value,
            source: 'Academy',
            details: 'Lead from Kihap Academy form',
            status: 'Novo',
            createdAt: serverTimestamp()
        };

        try {
            const leadsCollectionRef = collection(db, 'leads');
            await addDoc(leadsCollectionRef, data);

            academyFormStatus.textContent = 'Inscrição enviada com sucesso! Entraremos em contato em breve.';
            academyFormStatus.className = 'text-green-400 text-center mt-4';
            academyLeadForm.reset();

            setTimeout(() => {
                academyFormStatus.textContent = '';
                // Opcional: fechar o modal após o sucesso
                document.getElementById('academy-modal').classList.add('hidden');
                document.body.classList.remove('no-scroll');
            }, 3000);

        } catch (error) {
            console.error("Erro ao salvar o lead do Academy:", error);
            academyFormStatus.textContent = 'Ocorreu um erro ao enviar sua inscrição. Tente novamente.';
            academyFormStatus.className = 'text-red-400 text-center mt-4';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ENVIAR INTERESSE';
            submitBtn.classList.remove('opacity-50');
        }
    });
}
