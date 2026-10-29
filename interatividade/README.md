# 🥋 Interatividade do Espetáculo Kihap

Este módulo foi criado dentro da pasta isolada `/interatividade` para não interferir em nenhuma outra funcionalidade do site/sistema Kihap, funcionando de forma independente dentro do mesmo domínio (`kihap.com.br`).

---

## 📌 Links de Acesso

1. **Telão do Evento (Painel de LED / Monitor Principal):**
   - URL: `https://kihap.com.br/interatividade` (ou `/interatividade/index.html`)
   - No computador local de testes: `http://localhost:8000/interatividade/`

2. **Página dos Convidados (Mobile / Celular da Plateia):**
   - URL: `https://kihap.com.br/interatividade/torcida` (ou `/interatividade/torcida.html`)
   - O Telão já exibe um **QR Code dinâmico** na lateral direita para que qualquer pessoa na plateia aponte a câmera e caia direto nessa página!

---

## 🌟 Funcionalidades do Telão (Estilo Maratona / Corrida)

- **Quadro de Atletas**: Lista todos os alunos participantes com seus números dorsais estilo corrida (№ 001, 002...), nome completo, faixa e unidade.
- **Scroll Automático Suave**: Rola continuamente para cima e para baixo para garantir que todos os atletas passem na tela de LED repetidamente.
- **Spotlight Dinâmico**: No momento exato em que um parente/amigo torce pelo aluno no celular, o card do aluno brilha em dourado e um banner de reconhecimento salta no centro do telão com a mensagem!
- **Super Medidor de Energia Coletiva**: Barra de progresso com animação de fogo no topo que acumula os pontos de todos os gritos de torcida em tempo real.
- **Feed Lateral de Torcida**: Ticker com as mensagens e reações recém-enviadas.
- **Efeitos de Partículas & Sons**: Sons marciais sintetizados nativamente pelo navegador (sem depender de download de MP3) e fogos de confete digitais no canvas.

---

## 🛠️ Controles para a Equipe de Produção (no topo do Telão)

- **Tela Cheia**: Ativa o modo Fullscreen para remover barras do navegador no painel de LED.
- **Som Ativado/Mudo**: Permite mutar ou liberar os efeitos sonoros de aplausos, fogo e impacto marcial.
- **Simular**: Permite disparar torcidas de teste aleatórias sem precisar de outro celular.
- **Alunos**: Abre um modal rápido para colar a lista real de alunos (`Nome, Faixa, Unidade`).

---

## 👥 Como Atualizar a Lista de Alunos

Você tem duas formas muito simples:
1. **Pela própria tela:** Clique no botão **"Alunos"** no topo do telão, cole os nomes (um por linha no formato `Nome, Faixa, Unidade`) e clique em **Salvar**.
2. **Pelo código:** Edite o arquivo `interatividade/dados-alunos.js`.
