document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const form = document.getElementById('matricula-form');
    const unitCards = document.querySelectorAll('.unit-card');
    const selectedUnitInput = document.getElementById('selected-unit-input');
    const cityFilterBtns = document.querySelectorAll('.city-filter-btn');
    const unitCityHint = document.getElementById('unitCityHint') || document.getElementById('unit-city-hint');
    
    const programCards = document.querySelectorAll('.program-card');
    const selectedProgramInput = document.getElementById('selected-program-input');

    const enrollmentTypeRadios = document.querySelectorAll('input[name="enrollment_type"]');
    const parentNameGroup = document.getElementById('parent-name-group');
    const typeChildLabel = document.getElementById('type-child-label');
    const typeSelfLabel = document.getElementById('type-self-label');

    const alunoNomeInput = document.getElementById('aluno-nome');
    const responsavelNomeInput = document.getElementById('responsavel-nome');
    const telefoneInput = document.getElementById('responsavel-telefone');
    const cpfInput = document.getElementById('responsavel-cpf');

    const summaryUnit = document.getElementById('summary-unit');
    const summaryStudent = document.getElementById('summary-student');
    const summaryProgram = document.getElementById('summary-program');
    const summaryPrice = document.getElementById('summary-price');
    const installmentText = document.getElementById('installment-text');

    const submitBtn = document.getElementById('submit-matricula-btn');
    const formErrorMsg = document.getElementById('form-error-msg');

    let currentPriceCents = 67700;
    let selectedUnitName = '';

    // --- MÁSCARAS DE INPUT ---
    telefoneInput?.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.substring(0, 11);
        if (v.length > 6) {
            e.target.value = `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
        } else if (v.length > 2) {
            e.target.value = `(${v.substring(0, 2)}) ${v.substring(2)}`;
        } else if (v.length > 0) {
            e.target.value = `(${v}`;
        }
    });

    cpfInput?.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.substring(0, 11);
        if (v.length > 9) {
            e.target.value = `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6, 9)}-${v.substring(9)}`;
        } else if (v.length > 6) {
            e.target.value = `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6)}`;
        } else if (v.length > 3) {
            e.target.value = `${v.substring(0, 3)}.${v.substring(3)}`;
        }
    });

    alunoNomeInput?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        summaryStudent.textContent = val || 'Preencha os dados';
    });

    // --- FILTRO DE CIDADES ---
    cityFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const city = btn.dataset.city;
            
            // Estilo do botão ativo
            cityFilterBtns.forEach(b => {
                b.classList.remove('bg-yellow-500', 'text-black');
                b.classList.add('bg-white/5', 'text-gray-300');
            });
            btn.classList.add('bg-yellow-500', 'text-black');
            btn.classList.remove('bg-white/5', 'text-gray-300');

            // Filtra os cards
            unitCards.forEach(card => {
                if (city === 'all' || card.dataset.city === city) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

    // --- SELEÇÃO DE UNIDADE ---
    function selectUnit(card) {
        unitCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        selectedUnitName = card.dataset.unit;
        selectedUnitInput.value = selectedUnitName;
        currentPriceCents = parseInt(card.dataset.price, 10) || 67700;

        const cityLabel = card.dataset.city === 'brasilia' 
            ? 'Brasília (DF)' 
            : (card.dataset.city === 'florianopolis' ? 'Florianópolis (SC)' : 'Dourados (MS)');

        summaryUnit.innerHTML = `<span class="text-white">${selectedUnitName}</span> <span class="text-[10px] text-gray-400 block">${cityLabel}</span>`;
        
        const formattedPrice = (currentPriceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        summaryPrice.textContent = formattedPrice;

        if (unitCityHint) {
            unitCityHint.textContent = `✓ ${selectedUnitName} Selecionada`;
        }

        formErrorMsg?.classList.add('hidden');
    }

    unitCards.forEach(card => {
        card.addEventListener('click', () => selectUnit(card));
    });

    // Pré-seleciona a primeira unidade por padrão (Jardim Botânico)
    if (unitCards.length > 0) {
        selectUnit(unitCards[0]);
    }

    // --- SELEÇÃO DE PROGRAMA ---
    programCards.forEach(card => {
        card.addEventListener('click', () => {
            programCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const prog = card.dataset.program;
            selectedProgramInput.value = prog;
            summaryProgram.textContent = prog;
        });
    });

    // --- TOGGLE MENOR / ADULTO ---
    enrollmentTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'child') {
                parentNameGroup.classList.remove('hidden');
                responsavelNomeInput.setAttribute('required', 'true');
                typeChildLabel.classList.add('border-yellow-500/50', 'bg-yellow-500/10');
                typeChildLabel.classList.remove('border-[#2a2a2a]', 'bg-[#1a1a1a]');
                typeSelfLabel.classList.remove('border-yellow-500/50', 'bg-yellow-500/10');
                typeSelfLabel.classList.add('border-[#2a2a2a]', 'bg-[#1a1a1a]');
            } else {
                parentNameGroup.classList.add('hidden');
                responsavelNomeInput.removeAttribute('required');
                typeSelfLabel.classList.add('border-yellow-500/50', 'bg-yellow-500/10');
                typeSelfLabel.classList.remove('border-[#2a2a2a]', 'bg-[#1a1a1a]');
                typeChildLabel.classList.remove('border-yellow-500/50', 'bg-yellow-500/10');
                typeChildLabel.classList.add('border-[#2a2a2a]', 'bg-[#1a1a1a]');
            }
        });
    });

    // --- SELEÇÃO DE MÉTODO DE PAGAMENTO (STYLE TOGGLE) ---
    const methodAllLabel = document.getElementById('method-all-label');
    const methodPixLabel = document.getElementById('method-pix-label');
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');

    paymentRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'all') {
                methodAllLabel.classList.add('border-yellow-500', 'bg-yellow-500/10', 'text-white');
                methodAllLabel.classList.remove('border-[#2a2a2a]', 'bg-[#1a1a1a]', 'text-gray-300');
                methodPixLabel.classList.remove('border-yellow-500', 'bg-yellow-500/10', 'text-white');
                methodPixLabel.classList.add('border-[#2a2a2a]', 'bg-[#1a1a1a]', 'text-gray-300');
            } else {
                methodPixLabel.classList.add('border-yellow-500', 'bg-yellow-500/10', 'text-white');
                methodPixLabel.classList.remove('border-[#2a2a2a]', 'bg-[#1a1a1a]', 'text-gray-300');
                methodAllLabel.classList.remove('border-yellow-500', 'bg-yellow-500/10', 'text-white');
                methodAllLabel.classList.add('border-[#2a2a2a]', 'bg-[#1a1a1a]', 'text-gray-300');
            }
        });
    });

    // --- SUBMIT DO FORMULÁRIO ---
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        formErrorMsg.classList.add('hidden');
        formErrorMsg.textContent = '';

        if (!selectedUnitInput.value) {
            formErrorMsg.textContent = 'Por favor, selecione sua unidade de preferência no Passo 1.';
            formErrorMsg.classList.remove('hidden');
            window.scrollTo({ top: 250, behavior: 'smooth' });
            return;
        }

        const isChild = document.querySelector('input[name="enrollment_type"]:checked')?.value === 'child';
        const alunoNome = alunoNomeInput.value.trim();
        const responsavelNome = isChild ? responsavelNomeInput.value.trim() : alunoNome;
        const responsavelTelefone = telefoneInput.value.trim();
        const responsavelEmail = document.getElementById('responsavel-email').value.trim();
        const responsavelCpf = cpfInput.value.trim();
        const alunoPrograma = selectedProgramInput.value;
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'all';

        if (!alunoNome || !responsavelEmail || !responsavelTelefone || !responsavelCpf) {
            formErrorMsg.textContent = 'Preencha todos os campos obrigatórios (*).';
            formErrorMsg.classList.remove('hidden');
            return;
        }

        // Estado de Carregamento
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Gerando matrícula e checkout seguro...</span>';

        try {
            const payload = {
                alunoNome,
                isMenor: isChild,
                responsavelNome,
                responsavelEmail,
                responsavelTelefone,
                responsavelCpf,
                unidade: selectedUnitInput.value,
                alunoPrograma,
                paymentMethod
            };

            const endpoint = 'https://us-central1-intranet-kihap.cloudfunctions.net/createMatriculaCheckoutSession';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Erro ao gerar sessão de pagamento da matrícula.');
            }

            if (data.checkoutUrl) {
                // Redireciona diretamente para o checkout seguro do Mercado Pago
                window.location.href = data.checkoutUrl;
            } else {
                throw new Error('URL de pagamento não retornada pelo servidor.');
            }

        } catch (error) {
            console.error('[Matrícula] Erro:', error);
            formErrorMsg.textContent = error.message || 'Não foi possível concluir. Tente novamente ou fale no WhatsApp.';
            formErrorMsg.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });
});
