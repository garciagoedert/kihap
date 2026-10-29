/**
 * LÓGICA DO TELÃO OFICIAL DO ESPETÁCULO KIHAP (BACKDROP COM ROLAGEM INFINITA SUAVE)
 * - 155 nomes rodando continuamente de forma suave e infinita (sem cortes)
 * - Ao receber torcida, o telão pausa por 4 segundos, o nome acende com brilho dourado e fogos
 * - Em seguida, o telão retoma a rolagem suave automaticamente
 */

document.addEventListener('DOMContentLoaded', () => {
    const block1 = document.getElementById('backdrop-text-block-1');
    const block2 = document.getElementById('backdrop-text-block-2');
    const crawlTrack = document.getElementById('backdrop-crawl-track');
    const torcidaToast = document.getElementById('torcida-toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastName = document.getElementById('toast-name');
    const toastMsg = document.getElementById('toast-msg');

    let alunos = window.obterListaAlunos();
    let toastTimeout = null;
    let pauseTimeout = null;

    // 1. Renderizar os 155 Nomes nos Blocos 1 e 2 para Loop Infinito Contínuo
    function preencherBloco(container, blocoId) {
        if (!container) return;
        container.innerHTML = '';

        alunos.forEach((aluno, index) => {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'backdrop-name-item';
            nameSpan.id = `aluno-node-${blocoId}-${aluno.id}`;
            nameSpan.textContent = aluno.nome;
            nameSpan.setAttribute('data-id', aluno.id);
            container.appendChild(nameSpan);

            // Espaço entre os nomes para permitir quebra de linha e alinhamento justificado perfeito
            if (index < alunos.length - 1) {
                container.appendChild(document.createTextNode(' '));
            }
        });
    }

    preencherBloco(block1, 'b1');
    preencherBloco(block2, 'b2');

    // 2. Canvas de Partículas e Fogos Digitais
    const canvas = document.getElementById('particles-canvas');
    let ctx = null;
    let particles = [];

    if (canvas) {
        ctx = canvas.getContext('2d');
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 8 + 2;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed - 2.5;
                this.alpha = 1;
                this.decay = Math.random() * 0.02 + 0.015;
                this.size = Math.random() * 6 + 2;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vy += 0.14;
                this.alpha -= this.decay;
            }
            draw() {
                ctx.save();
                ctx.globalAlpha = Math.max(0, this.alpha);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        window.explodirParticulas = function(x, y) {
            const cores = ['#fbbf24', '#f59e0b', '#ef4444', '#ffffff', '#fef08a'];
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(x, y, cores[Math.floor(Math.random() * cores.length)]));
            }
        };

        function loopParticulas() {
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = particles.length - 1; i >= 0; i--) {
                    const p = particles[i];
                    p.update();
                    p.draw();
                    if (p.alpha <= 0) {
                        particles.splice(i, 1);
                    }
                }
            }
            requestAnimationFrame(loopParticulas);
        }
        loopParticulas();
    }

    // 3. Processar Evento de Torcida em Tempo Real
    window.processarEventoTorcida = function(evento) {
        console.log('Torcida recebida no telão contínuo:', evento);

        if (window.KihapSync) {
            window.KihapSync.tocarSom(evento.reacao || 'fogo');
        }

        // Localizar Aluno
        const aluno = alunos.find(a => a.id === evento.alunoId) || 
                      alunos.find(a => a.nome.toLowerCase() === (evento.alunoNome || '').toLowerCase());

        let alvoX = window.innerWidth / 2;
        let alvoY = window.innerHeight / 2;

        if (aluno) {
            // Localiza todas as instâncias do nome na tela (bloco 1 e bloco 2)
            const nameEls = document.querySelectorAll(`[data-id="${aluno.id}"]`);
            
            // Pausa a rolagem por 4 segundos para focar no atleta
            if (crawlTrack) {
                crawlTrack.classList.add('paused');
            }

            nameEls.forEach(el => {
                el.classList.add('cheer-active');
                const rect = el.getBoundingClientRect();
                // Se estiver visível no viewport, pega as coordenadas para as partículas
                if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                    alvoX = rect.left + rect.width / 2;
                    alvoY = rect.top + rect.height / 2;
                }
            });

            // Após 4 segundos: apaga a luz e retoma a rolagem suave
            clearTimeout(pauseTimeout);
            pauseTimeout = setTimeout(() => {
                nameEls.forEach(el => el.classList.remove('cheer-active'));
                if (crawlTrack) {
                    crawlTrack.classList.remove('paused');
                }
            }, 4000);
        }

        // Partículas sobre o nome
        if (window.explodirParticulas) {
            window.explodirParticulas(alvoX, alvoY);
        }

        // Exibir Toast de Celebração
        exibirToastTorcida(evento, aluno);
    };

    function exibirToastTorcida(evento, aluno) {
        if (!torcidaToast) return;

        const nome = aluno ? aluno.nome : (evento.alunoNome || 'Guerreiros Kihap');
        const autor = evento.autor ? `Enviado por: ${evento.autor}` : 'Família e Amigos';
        const msg = evento.mensagem ? `"${evento.mensagem}"` : `${autor} mandou energia máxima! (+${evento.pontos || 50} pts)`;

        const emojiMap = {
            fogo: '🔥',
            palmas: '👏',
            raio: '⚡',
            trofeu: '🏆'
        };

        if (toastIcon) toastIcon.textContent = emojiMap[evento.reacao] || '🔥';
        if (toastName) toastName.textContent = nome;
        if (toastMsg) toastMsg.textContent = msg;

        torcidaToast.classList.add('active');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            torcidaToast.classList.remove('active');
        }, 3800);
    }

    // 4. Sincronia
    if (window.KihapSync) {
        window.KihapSync.isHost = true;
        window.KihapSync.onEvento((evento) => {
            window.processarEventoTorcida(evento);
        });
    }

    // 5. Botão e Atalho Simular
    function dispararSimulacao() {
        const alunoAleatorio = alunos[Math.floor(Math.random() * alunos.length)];
        const reacoes = ['fogo', 'palmas', 'raio', 'trofeu'];
        const autores = ['Mãe e Pai', 'Irmão', 'Família Silva', 'Vovó', 'Torcida'];
        const frases = ['Arrasa no espetáculo!', 'Muito orgulho!', 'Força total!', 'Kihap com garra!', 'Sensacional!'];

        window.processarEventoTorcida({
            tipo: 'TORCIDA_ALUNO',
            alunoId: alunoAleatorio.id,
            alunoNome: alunoAleatorio.nome,
            reacao: reacoes[Math.floor(Math.random() * reacoes.length)],
            autor: autores[Math.floor(Math.random() * autores.length)],
            mensagem: frases[Math.floor(Math.random() * frases.length)],
            pontos: 50
        });
    }

    const btnSimular = document.getElementById('btn-simular');
    btnSimular?.addEventListener('click', dispararSimulacao);

    // 6. Fullscreen
    function alternarFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    }

    const btnFullscreen = document.getElementById('btn-fullscreen');
    btnFullscreen?.addEventListener('click', alternarFullscreen);
    document.addEventListener('dblclick', alternarFullscreen);

    // 7. Som
    const btnSom = document.getElementById('btn-som');
    function alternarSom() {
        if (!window.KihapSync) return;
        window.KihapSync.audioEnabled = !window.KihapSync.audioEnabled;
        if (btnSom) {
            btnSom.innerHTML = window.KihapSync.audioEnabled ? 
                '<i class="fas fa-volume-high"></i> Som' : 
                '<i class="fas fa-volume-xmark"></i> Mudo';
        }
        if (window.KihapSync.audioEnabled) {
            window.KihapSync.tocarSom('combo');
        }
    }
    btnSom?.addEventListener('click', alternarSom);

    // 8. Atalhos de Teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 't' || e.key === 'T') {
            e.preventDefault();
            dispararSimulacao();
        } else if (e.key === 'f' || e.key === 'F') {
            alternarFullscreen();
        } else if (e.key === 's' || e.key === 'S') {
            alternarSom();
        }
    });
});
