
import { db } from '../intranet/firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById('rh-application-form');
    const submitBtn = document.getElementById('submit-btn');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('error-message');

    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');

            try {
                // Gather form data
                const formData = {
                    responsavel: document.getElementById('nome').value, // Matches 'responsavel' in CRM
                    dataNascimento: document.getElementById('idade').value, // Date of birth
                    telefone: document.getElementById('telefone').value,
                    email: document.getElementById('email').value,
                    endereco: document.getElementById('cidade').value, // 'Cidade e bairro'
                    vaga: document.querySelector('input[name="vaga"]:checked')?.value || document.getElementById('vaga_outro_text').value || "",

                    // Experience - Atendimento
                    expAtendimento: document.querySelector('input[name="exp_atendimento"]:checked')?.value || "",
                    obsAtendimento: document.getElementById('exp_atendimento_desc').value || "",

                    // Experience - Administrativo
                    expAdm: document.querySelector('input[name="exp_adm"]:checked')?.value || "",
                    obsAdm: document.getElementById('exp_adm_desc').value || "",

                    // Experience - Criança
                    expCrianca: document.querySelector('input[name="exp_crianca"]:checked')?.value || "",
                    obsCrianca: document.getElementById('exp_crianca_desc').value || "",

                    // Availability
                    disponibilidade: document.querySelector('input[name="disponibilidade"]:checked')?.value || "",
                    inicio: document.querySelector('input[name="inicio"]:checked')?.value || "",

                    // Professional Profile
                    motivo: document.getElementById('motivo').value || "",
                    pontosFortes: document.getElementById('pontos_fortes').value || "",

                    // Martial Arts
                    arteMarcial: document.querySelector('input[name="arte_marcial"]:checked')?.value || "",
                    obsArteMarcial: document.getElementById('arte_marcial_desc').value || "",

                    // Metadata
                    status: 'Novo', // Column in CRM
                    dataCriacao: serverTimestamp(),
                    origem: 'Site - Trabalhe Conosco',
                    pagina: 'RH', // Ensures it appears in RH CRM
                    prioridade: '3' // Default priority
                };

                // Validate required fields (basic validation, most handled by HTML required)
                if (!formData.responsavel || !formData.telefone || !formData.email) {
                    throw new Error("Por favor, preencha os campos obrigatórios.");
                }

                // Verify inputs dependent on "Outro" or "Sim" logic if strict validation needed
                // For now, relying on what's captured.

                // Save to Firestore
                await addDoc(collection(db, "rh_prospects"), formData);

                // Show success
                form.reset();
                successMessage.classList.remove('hidden');

                // Hide success message after a few seconds
                setTimeout(() => {
                    successMessage.classList.add('hidden');
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'ENVIAR CANDIDATURA';
                }, 5000);

            } catch (error) {
                console.error("Erro ao enviar formulário:", error);
                errorMessage.textContent = "Erro ao enviar: " + (error.message || "Tente novamente mais tarde.");
                errorMessage.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.innerText = 'ENVIAR CANDIDATURA';
            }
        });

        // Helper for "Outro" radio buttons to enable text input
        const vagaRadios = document.querySelectorAll('input[name="vaga"]');
        const vagaOutroText = document.getElementById('vaga_outro_text');

        vagaRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'Outro') {
                    vagaOutroText.disabled = false;
                    vagaOutroText.focus();
                } else {
                    vagaOutroText.disabled = true;
                    vagaOutroText.value = '';
                }
            });
        });

        // Helper for "Sim" conditional textareas
        const toggleTextarea = (radioName, textareaId) => {
            const radios = document.querySelectorAll(`input[name="${radioName}"]`);
            const textarea = document.getElementById(textareaId);

            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.value === 'Sim') {
                        textarea.disabled = false;
                        textarea.parentElement.classList.remove('opacity-50');
                    } else {
                        textarea.disabled = true;
                        textarea.value = '';
                        textarea.parentElement.classList.add('opacity-50');
                    }
                });
            });
        };

        toggleTextarea('exp_atendimento', 'exp_atendimento_desc');
        toggleTextarea('exp_adm', 'exp_adm_desc');
        toggleTextarea('exp_crianca', 'exp_crianca_desc');
        toggleTextarea('arte_marcial', 'arte_marcial_desc');
    }
});
