// Importa as funções necessárias do SDK do Firebase
import { db, functions } from '../intranet/firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');

document.addEventListener('DOMContentLoaded', () => {
    populateUnitsDropdown();
});

async function populateUnitsDropdown() {
    const unidadeSelect = document.getElementById('unidade');
    if (!unidadeSelect) return;

    // Mapeamento de unidades por cidade para organizar o dropdown
    const cityGroups = {
        'Brasília': ['asa-sul', 'lago-sul', 'sudoeste', 'noroeste', 'jardim-botanico', 'pontos-de-ensino'],
        'Florianópolis': ['centro', 'coqueiros', 'santa-monica'],
        'Mato Grosso do Sul': ['dourados'],
    };

    try {
        const result = await getPublicEvoUnits();
        const evoUnits = new Set(result.data);

        unidadeSelect.innerHTML = '<option value="" disabled selected>Selecione a unidade de interesse</option>';

        for (const [city, units] of Object.entries(cityGroups)) {
            const group = document.createElement('optgroup');
            group.label = city;

            units.forEach(unitId => {
                if (evoUnits.has(unitId)) {
                    const option = document.createElement('option');
                    const displayName = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    option.value = displayName;
                    option.textContent = displayName;
                    group.appendChild(option);
                }
            });

            if (group.children.length > 0) {
                unidadeSelect.appendChild(group);
            }
        }
    } catch (error) {
        console.error("Erro ao buscar unidades do EVO:", error);
        // Fallback estático caso a API falhe
        unidadeSelect.innerHTML = `
            <option value="" disabled selected>Selecione a unidade de interesse</option>
            <optgroup label="Brasília">
                <option value="Asa Sul">Asa Sul</option>
                <option value="Lago Sul">Lago Sul</option>
                <option value="Sudoeste">Sudoeste</option>
                <option value="Noroeste">Noroeste</option>
                <option value="Jardim Botânico">Jardim Botânico</option>
                <option value="Pontos de Ensino">Pontos de Ensino</option>
            </optgroup>
            <optgroup label="Florianópolis">
                <option value="Centro">Centro</option>
                <option value="Coqueiros">Coqueiros</option>
                <option value="Santa Mônica">Santa Mônica</option>
            </optgroup>
            <optgroup label="Mato Grosso do Sul">
                <option value="Dourados">Dourados</option>
            </optgroup>
        `;
    }
}

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

            formStatus.textContent = 'Inscrição enviada com sucesso! Redirecionando para o WhatsApp...';
            formStatus.className = 'text-green-800 text-center mt-4';
            leadForm.reset();

            const unidadeSelecionada = data.unidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let whatsappUrl = '';

            if (unidadeSelecionada.includes('asa sul')) whatsappUrl = 'https://wa.me/556183007146';
            else if (unidadeSelecionada.includes('sudoeste')) whatsappUrl = 'https://wa.me/556182107146';
            else if (unidadeSelecionada.includes('lago sul')) whatsappUrl = 'https://wa.me/556192028980';
            else if (unidadeSelecionada.includes('noroeste')) whatsappUrl = 'https://wa.me/556184170472';
            else if (unidadeSelecionada.includes('jardim botanico')) whatsappUrl = 'https://wa.me/556184171059';
            else if (unidadeSelecionada.includes('pontos de ensino')) whatsappUrl = 'https://wa.me/556182823380';
            else if (unidadeSelecionada.includes('centro')) whatsappUrl = 'https://wa.me/554892182423';
            else if (unidadeSelecionada.includes('coqueiros')) whatsappUrl = 'https://wa.me/554896296941';
            else if (unidadeSelecionada.includes('santa monica')) whatsappUrl = 'https://wa.me/554892172423';
            else if (unidadeSelecionada.includes('dourados')) whatsappUrl = 'https://wa.me/556799597001';

            if (whatsappUrl) {
                setTimeout(() => {
                    window.location.href = whatsappUrl;
                }, 1500);
            } else {
                setTimeout(() => {
                    formStatus.textContent = '';
                }, 5000);
            }

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

// --- Lógica do Formulário de Newsletter ---
const newsletterForm = document.getElementById('newsletter-form');
const newsletterStatus = document.getElementById('newsletter-status');

if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = newsletterForm.querySelector('button[type="submit"]');
        const emailInput = document.getElementById('newsletter-email');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        submitBtn.classList.add('opacity-50');
        newsletterStatus.textContent = '';
        newsletterStatus.className = 'mt-4 text-sm'; // Reset classes

        const email = emailInput.value;

        try {
            // Chama a função Cloud Function 'subscribeUser'
            // Nota: subscribeUser foi exportada em functions/index.js
            const subscribeFn = httpsCallable(functions, 'subscribeUser');
            await subscribeFn({ email: email, source: 'landing_page_footer' });

            newsletterStatus.textContent = 'Inscrição realizada com sucesso! Bem-vindo(a) à família Kihap.';
            newsletterStatus.classList.add('text-green-500');
            newsletterForm.reset();

        } catch (error) {
            console.error("Erro ao inscrever na newsletter:", error);
            newsletterStatus.textContent = 'Erro ao processar inscrição. Tente novamente.';
            newsletterStatus.classList.add('text-red-500');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'INSCREVER-SE';
            submitBtn.classList.remove('opacity-50');
        }
    });
}
