/**
 * LÓGICA DA PÁGINA DO CONVIDADO (MOBILE) - TORCIDA KIHAP
 */

document.addEventListener('DOMContentLoaded', () => {
    const alunos = window.obterListaAlunos();
    let alunoSelecionado = alunos[0] || null;
    let reacaoSelecionada = 'fogo';
    let pontosReacao = 50;
    let comboCount = 0;
    let comboResetTimer = null;

    // Elementos da UI
    const cardBib = document.getElementById('card-bib');
    const cardNome = document.getElementById('card-nome');
    const cardMeta = document.getElementById('card-meta');
    const btnTrocarAluno = document.getElementById('btn-trocar-aluno');
    const buscaContainer = document.getElementById('busca-alunos-container');
    const inputBusca = document.getElementById('input-busca-aluno');
    const listaAlunosDropdown = document.getElementById('lista-alunos-dropdown');
    const btnTorcerGeral = document.getElementById('btn-torcer-geral');
    const btnEnviar = document.getElementById('btn-enviar-torcida');
    const inputAutor = document.getElementById('input-autor');
    const inputMensagem = document.getElementById('input-mensagem');
    const feedbackToast = document.getElementById('feedback-toast');
    const comboDisplay = document.getElementById('combo-display');
    const comboNum = document.getElementById('combo-num');

    // Recupera autor salvo anteriormente
    try {
        const autorSalvo = localStorage.getItem('kihap_torcida_autor');
        if (autorSalvo && inputAutor) inputAutor.value = autorSalvo;
    } catch (e) {}

    // 1. Atualizar Card do Aluno Selecionado
    function atualizarCardAluno() {
        if (!alunoSelecionado) {
            if (cardBib) cardBib.textContent = 'ALL';
            if (cardNome) cardNome.textContent = 'Guerreiros Kihap (Geral)';
            if (cardMeta) cardMeta.textContent = 'Torcida para todos os alunos do evento';
            return;
        }
        if (cardBib) cardBib.textContent = alunoSelecionado.numero || String(alunoSelecionado.id).padStart(3, '0');
        if (cardNome) cardNome.textContent = alunoSelecionado.nome;
        if (cardMeta) cardMeta.textContent = `${alunoSelecionado.faixa} • ${alunoSelecionado.unidade || 'Kihap'}`;
    }
    atualizarCardAluno();

    // 2. Renderizar Lista de Alunos para Busca
    function renderizarListaBusca(termo = '') {
        if (!listaAlunosDropdown) return;
        listaAlunosDropdown.innerHTML = '';

        const termoLower = termo.toLowerCase().trim();
        const filtrados = alunos.filter(a => {
            return a.nome.toLowerCase().includes(termoLower) || 
                   (a.numero && a.numero.includes(termoLower)) ||
                   (a.unidade && a.unidade.toLowerCase().includes(termoLower));
        });

        if (filtrados.length === 0) {
            listaAlunosDropdown.innerHTML = '<div class="text-xs text-gray-500 py-3 text-center">Nenhum aluno encontrado.</div>';
            return;
        }

        filtrados.forEach(aluno => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 hover:bg-white/10 rounded-lg cursor-pointer border-b border-white/5 transition';
            item.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono font-bold text-amber-400">#${aluno.numero || aluno.id}</span>
                    <div>
                        <div class="text-xs font-bold text-white">${aluno.nome}</div>
                        <div class="text-[10px] text-gray-400">${aluno.faixa} • ${aluno.unidade}</div>
                    </div>
                </div>
                <i class="fas fa-chevron-right text-gray-500 text-xs"></i>
            `;
            item.addEventListener('click', () => {
                alunoSelecionado = aluno;
                atualizarCardAluno();
                buscaContainer.classList.add('hidden');
                // Vibração suave
                if (navigator.vibrate) navigator.vibrate(20);
            });
            listaAlunosDropdown.appendChild(item);
        });
    }

    // Toggle da busca
    btnTrocarAluno?.addEventListener('click', () => {
        buscaContainer.classList.toggle('hidden');
        if (!buscaContainer.classList.contains('hidden')) {
            renderizarListaBusca('');
            inputBusca?.focus();
        }
    });

    inputBusca?.addEventListener('input', (e) => {
        renderizarListaBusca(e.target.value);
    });

    btnTorcerGeral?.addEventListener('click', () => {
        alunoSelecionado = null;
        atualizarCardAluno();
        buscaContainer.classList.add('hidden');
    });

    // 3. Seleção de Reações
    const btnsReacao = document.querySelectorAll('.btn-reaction');
    btnsReacao.forEach(btn => {
        btn.addEventListener('click', () => {
            btnsReacao.forEach(b => {
                b.classList.remove('border-amber-400', 'bg-[#1a1a24]');
                b.classList.add('border-white/10');
            });
            btn.classList.remove('border-white/10');
            btn.classList.add('border-amber-400', 'bg-[#1a1a24]');

            reacaoSelecionada = btn.getAttribute('data-reacao') || 'fogo';
            pontosReacao = parseInt(btn.getAttribute('data-pontos') || '50', 10);

            if (navigator.vibrate) navigator.vibrate(25);
            if (window.KihapSync) window.KihapSync.tocarSom(reacaoSelecionada);
        });
    });

    // 4. Disparo de Torcida
    btnEnviar?.addEventListener('click', () => {
        // Haptic feedback forte
        if (navigator.vibrate) navigator.vibrate([40, 20, 60]);

        // Combo system
        comboCount++;
        clearTimeout(comboResetTimer);
        comboResetTimer = setTimeout(() => {
            comboCount = 0;
            if (comboDisplay) comboDisplay.classList.add('hidden');
        }, 3000);

        if (comboCount > 1 && comboDisplay && comboNum) {
            comboNum.textContent = comboCount;
            comboDisplay.classList.remove('hidden');
        }

        const autor = (inputAutor?.value || '').trim() || 'Convidado';
        const mensagem = (inputMensagem?.value || '').trim();

        // Salvar nome do autor para os próximos disparos
        try {
            if (autor) localStorage.setItem('kihap_torcida_autor', autor);
        } catch (e) {}

        const pontosTotais = pontosReacao * (comboCount > 2 ? 2 : 1);

        const evento = {
            tipo: 'TORCIDA_ALUNO',
            alunoId: alunoSelecionado ? alunoSelecionado.id : null,
            alunoNome: alunoSelecionado ? alunoSelecionado.nome : 'Todos os Alunos',
            reacao: reacaoSelecionada,
            autor: autor,
            mensagem: mensagem,
            pontos: pontosTotais,
            combo: comboCount
        };

        // Enviar via Sync Engine
        if (window.KihapSync) {
            window.KihapSync.enviar(evento);
            window.KihapSync.tocarSom(reacaoSelecionada);
        }

        // Limpar mensagem após envio para incentivar novos gritos
        if (inputMensagem) inputMensagem.value = '';

        // Exibir toast
        exibirToast();
    });

    function exibirToast() {
        if (!feedbackToast) return;
        feedbackToast.classList.remove('hidden');
        setTimeout(() => {
            feedbackToast.classList.add('hidden');
        }, 2200);
    }
});
