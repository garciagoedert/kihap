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
            'origem do lead': 'Site',
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


// --- Lógica do Formulário do Curso Mente Faixa Preta ---
const cursoLeadForm = document.getElementById('curso-lead-form');
const cursoFormStatus = document.getElementById('curso-form-status');

if (cursoLeadForm) {
    cursoLeadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = cursoLeadForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        submitBtn.classList.add('opacity-50');
        cursoFormStatus.textContent = '';

        const data = {
            nome: document.getElementById('curso-nome').value,
            email: document.getElementById('curso-email').value,
            telefone: document.getElementById('curso-telefone').value,
            'origem do lead': 'Curso Mente Faixa Preta',
            tags: ['Mente Faixa Preta'],
            status: 'Novo',
            createdAt: serverTimestamp()
        };

        try {
            const leadsCollectionRef = collection(db, 'leads');
            await addDoc(leadsCollectionRef, data);

            cursoFormStatus.textContent = 'Inscrição enviada com sucesso! Verifique seu e-mail.';
            cursoFormStatus.className = 'text-green-800 text-center mt-4';
            cursoLeadForm.reset();

            setTimeout(() => {
                cursoFormStatus.textContent = '';
            }, 5000);

        } catch (error) {
            console.error("Erro ao salvar o lead do curso:", error);
            cursoFormStatus.textContent = 'Ocorreu um erro ao enviar sua inscrição. Tente novamente.';
            cursoFormStatus.className = 'text-red-800 text-center mt-4';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'INSCREVA-SE AGORA';
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
            'origem do lead': 'Academy',
            debug_source: 'Academy Form',
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
