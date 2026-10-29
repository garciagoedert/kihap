/**
 * SYNC & AUDIO ENGINE - ESPETÁCULO KIHAP
 * 
 * Gerencia a comunicação em tempo real entre o Telão (LED) e as páginas dos convidados (Mobile).
 * Suporta BroadcastChannel (tempo real instantâneo no mesmo navegador/rede),
 * Firestore (via internet no evento) e Web Audio API (sons sintetizados sem depender de arquivos externos).
 */

class KihapSyncEngine {
    constructor(isHost = false) {
        this.isHost = isHost;
        this.listeners = [];
        this.channel = null;
        this.firestore = null;
        this.firestoreUnsub = null;
        this.audioCtx = null;
        this.audioEnabled = true;

        this.initBroadcastChannel();
        this.initStorageFallback();
        this.initAudioContext();
    }

    // Inicializa Web Audio API sintetizado
    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        } catch (e) {
            console.log('Áudio não suportado neste dispositivo');
        }
    }

    // Toca efeitos sonoros gerados por sintetizador (não precisa baixar MP3!)
    tocarSom(tipo) {
        if (!this.audioEnabled || !this.audioCtx) return;
        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            if (tipo === 'kihap' || tipo === 'fogo') {
                // Efeito de impacto marcial potente com sub-bass
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (tipo === 'palmas' || tipo === 'aplauso') {
                // Efeito sonoro de aplauso / estalo estéreo
                const bufferSize = ctx.sampleRate * 0.15;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                noise.connect(gain);
                gain.connect(ctx.destination);
                noise.start(now);
            } else if (tipo === 'energia' || tipo === 'raio') {
                // Efeito sci-fi/laser de energia subindo
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (tipo === 'combo') {
                // Triplo acorde brilhante
                [523.25, 659.25, 783.99].forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                    gain.gain.setValueAtTime(0.2, now + idx * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.3);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + idx * 0.05);
                    osc.stop(now + idx * 0.05 + 0.3);
                });
            }
        } catch (e) {
            console.warn('Erro ao tocar som:', e);
        }
    }

    // BroadcastChannel para sincronia ultrarrápida local
    initBroadcastChannel() {
        if ('BroadcastChannel' in window) {
            try {
                this.channel = new BroadcastChannel('kihap_espetaculo_sync');
                this.channel.onmessage = (event) => {
                    if (event.data) {
                        this.notify(event.data);
                    }
                };
            } catch (e) {
                console.warn('BroadcastChannel não disponível:', e);
            }
        }
    }

    // Fallback de sincronia via Storage Event
    initStorageFallback() {
        window.addEventListener('storage', (event) => {
            if (event.key === 'kihap_evento_sync_trigger' && event.newValue) {
                try {
                    const dados = JSON.parse(event.newValue);
                    this.notify(dados);
                } catch (e) {}
            }
        });
    }

    // Conectar com Firestore se disponível
    conectarFirestore(db, onSnapshot, collection, query, orderBy, limit) {
        if (!db || !this.isHost) return;
        try {
            const q = query(collection(db, "espetaculo_interacoes"), orderBy("timestamp", "desc"), limit(25));
            this.firestoreUnsub = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const dados = change.doc.data();
                        // Evita duplicar se já recebido por BroadcastChannel
                        this.notify(dados, true);
                    }
                });
            }, (error) => {
                console.log("Firestore sync em modo autônomo:", error.message);
            });
        } catch (e) {
            console.log("Firestore listener em espera.");
        }
    }

    // Enviar evento de interação (chamado pela página de torcida)
    enviar(evento) {
        evento.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        evento.timestamp = Date.now();

        // 1. BroadcastChannel
        if (this.channel) {
            try {
                this.channel.postMessage(evento);
            } catch (e) {}
        }

        // 2. Storage Event (para abas diferentes)
        try {
            localStorage.setItem('kihap_evento_sync_trigger', JSON.stringify(evento));
        } catch (e) {}

        // 3. Notifica localmente se for o mesmo cliente
        this.notify(evento);

        return evento;
    }

    // Registrar observadores
    onEvento(callback) {
        this.listeners.push(callback);
    }

    notify(evento, fromFirestore = false) {
        // Evita loop de eventos recentes idênticos
        if (this._ultimoId === evento.id) return;
        this._ultimoId = evento.id;

        this.listeners.forEach(cb => {
            try {
                cb(evento, fromFirestore);
            } catch (err) {
                console.error('Erro no handler do evento:', err);
            }
        });
    }
}

window.KihapSync = new KihapSyncEngine(false);
