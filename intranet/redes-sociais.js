import { loadComponents, setupUIListeners, showToast } from './common-ui.js';
import { db, storage } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { socialConfig } from './social-config.js';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// ==========================================
// ESTADO GLOBAL DA PÁGINA
// ==========================================
let currentFile = null;
let currentMediaUrl = null;
let currentMediaType = 'video';
let currentPublishMode = 'now'; // 'now' | 'schedule'
let currentPreviewNet = 'instagram'; // 'instagram' | 'tiktok' | 'youtube'
let activeFilter = 'all';
let unsubscribePosts = null;

// Configurações das redes sociais (carregadas dinamicamente via Firestore/modal)
let activeConfig = {
    instagramToken: "",
    instagramAccountId: "",
    tiktokClientKey: "",
    tiktokClientSecret: "",
    youtubeClientId: "",
    youtubeClientSecret: "",
    youtubeRefreshToken: ""
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carregar componentes da intranet (sidebar, header, dark mode)
    await loadComponents(() => {
        setupUIListeners();
    });

    // 2. Carregar configurações salvas no Firestore ou LocalStorage
    await loadSocialConfig();

    // 3. Inicializar ouvintes de eventos da página
    initNavigationTabs();
    initDropzone();
    initPlatformToggles();
    initContentInputs();
    initModeSelector();
    initPreviewTabs();
    initAiEnhancer();
    initSubmitAction();
    initConfigModal();
    initHistorySection();
});

// ==========================================
// 1. CONFIGURAÇÕES & TOKENS
// ==========================================
async function loadSocialConfig() {
    try {
        // Tenta buscar no Firestore
        const docRef = doc(db, "config", "social_media");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            activeConfig = { ...activeConfig, ...docSnap.data() };
        } else {
            // Tenta fallback do localStorage
            const local = localStorage.getItem('kihap_social_config');
            if (local) {
                activeConfig = { ...activeConfig, ...JSON.parse(local) };
            }
        }
    } catch (e) {
        console.warn("Usando configurações em memória para Redes Sociais:", e);
    }

    // Preenche campos do modal
    const igTokenInput = document.getElementById('cfg-instagram-token');
    const igAccountInput = document.getElementById('cfg-instagram-account-id');
    const tiktokKeyInput = document.getElementById('cfg-tiktok-client-key');
    const tiktokSecretInput = document.getElementById('cfg-tiktok-client-secret');
    const ytIdInput = document.getElementById('cfg-yt-client-id');
    const ytTokenInput = document.getElementById('cfg-yt-refresh-token');

    if (igTokenInput) igTokenInput.value = activeConfig.instagramToken || '';
    if (igAccountInput) igAccountInput.value = activeConfig.instagramAccountId || '';
    if (tiktokKeyInput) tiktokKeyInput.value = activeConfig.tiktokClientKey || '';
    if (tiktokSecretInput) tiktokSecretInput.value = activeConfig.tiktokClientSecret || '';
    if (ytIdInput) ytIdInput.value = activeConfig.youtubeClientId || '';
    if (ytTokenInput) ytTokenInput.value = activeConfig.youtubeRefreshToken || '';
}

function initConfigModal() {
    const modal = document.getElementById('config-modal');
    const openBtn = document.getElementById('open-config-btn');
    const closeBtn = document.getElementById('close-config-modal-btn');
    const cancelBtn = document.getElementById('cancel-config-modal-btn');
    const saveBtn = document.getElementById('save-config-btn');
    const testMetaBtn = document.getElementById('test-meta-token-btn');

    const openModal = () => modal.classList.remove('hidden');
    const closeModal = () => modal.classList.add('hidden');

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // Clicar fora do modal fecha
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Salvar configurações
    saveBtn?.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Salvando...';

        activeConfig.instagramToken = document.getElementById('cfg-instagram-token').value.trim();
        activeConfig.instagramAccountId = document.getElementById('cfg-instagram-account-id').value.trim();
        activeConfig.tiktokClientKey = document.getElementById('cfg-tiktok-client-key').value.trim();
        activeConfig.tiktokClientSecret = document.getElementById('cfg-tiktok-client-secret').value.trim();
        activeConfig.youtubeClientId = document.getElementById('cfg-yt-client-id').value.trim();
        activeConfig.youtubeRefreshToken = document.getElementById('cfg-yt-refresh-token').value.trim();

        try {
            // Salva no Firestore
            await setDoc(doc(db, "config", "social_media"), activeConfig, { merge: true });
            localStorage.setItem('kihap_social_config', JSON.stringify(activeConfig));
            showToast("Configurações de APIs salvas com sucesso!", "success");
            closeModal();
        } catch (err) {
            console.error("Erro ao salvar no Firestore:", err);
            localStorage.setItem('kihap_social_config', JSON.stringify(activeConfig));
            showToast("Configurações salvas localmente!", "info");
            closeModal();
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Salvar Configurações';
        }
    });

    // Testar Token Meta
    testMetaBtn?.addEventListener('click', async () => {
        const token = document.getElementById('cfg-instagram-token').value.trim();
        if (!token) {
            showToast("Informe o token da Meta primeiro", "warning");
            return;
        }

        testMetaBtn.disabled = true;
        testMetaBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Verificando na Meta...';

        try {
            const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`);
            const data = await res.json();

            if (data.error) {
                showToast("Erro da Meta: " + data.error.message, "error");
            } else {
                showToast(`Token válido! Conectado a: ${data.name} (ID: ${data.id})`, "success");
            }
        } catch (e) {
            showToast("Falha na conexão com a Graph API: " + e.message, "error");
        } finally {
            testMetaBtn.disabled = false;
            testMetaBtn.innerHTML = '<i class="fas fa-plug text-xs"></i> Testar Validade do Token';
        }
    });
}

// ==========================================
// 2. NAVEGAÇÃO ENTRE ABAS
// ==========================================
function initNavigationTabs() {
    const tabCreate = document.getElementById('tab-btn-create');
    const tabHistory = document.getElementById('tab-btn-history');
    const viewCreate = document.getElementById('view-create-post');
    const viewHistory = document.getElementById('view-history-posts');

    tabCreate?.addEventListener('click', () => {
        tabCreate.classList.add('border-primary', 'text-primary');
        tabCreate.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        tabHistory.classList.remove('border-primary', 'text-primary');
        tabHistory.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');

        viewCreate.classList.remove('hidden');
        viewHistory.classList.add('hidden');
    });

    tabHistory?.addEventListener('click', () => {
        tabHistory.classList.add('border-primary', 'text-primary');
        tabHistory.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        tabCreate.classList.remove('border-primary', 'text-primary');
        tabCreate.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');

        viewHistory.classList.remove('hidden');
        viewCreate.classList.add('hidden');
    });
}

// ==========================================
// 3. DROPZONE & UPLOAD DE MÍDIA
// ==========================================
function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('media-file-input');
    const emptyState = document.getElementById('dropzone-empty');
    const previewContainer = document.getElementById('dropzone-preview-container');
    const removeBtn = document.getElementById('remove-media-btn');

    const videoPreview = document.getElementById('dropzone-video-preview');
    const imagePreview = document.getElementById('dropzone-image-preview');
    const filenameLabel = document.getElementById('media-filename');
    const filesizeLabel = document.getElementById('media-filesize');
    const typeBadge = document.getElementById('media-type-badge');

    // Smartphone Mockup Elements
    const mockupVideo = document.getElementById('mockup-video');
    const mockupImage = document.getElementById('mockup-image');
    const mockupPlaceholder = document.getElementById('mockup-placeholder');

    // Clique no dropzone abre o seletor
    dropzone?.addEventListener('click', (e) => {
        if (!e.target.closest('#remove-media-btn')) {
            fileInput.click();
        }
    });

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(name => {
        dropzone?.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.add('border-primary', 'bg-primary/5');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone?.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-primary', 'bg-primary/5');
        });
    });

    dropzone?.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    fileInput?.addEventListener('change', (e) => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleSelectedFile(fileInput.files[0]);
        }
    });

    removeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        resetMediaSelection();
    });

    function handleSelectedFile(file) {
        if (!file) return;

        // Limite de 100MB
        if (file.size > 100 * 1024 * 1024) {
            showToast("O arquivo é muito grande. O limite máximo é 100MB.", "error");
            return;
        }

        currentFile = file;
        const isVideo = file.type.startsWith('video');
        currentMediaType = isVideo ? 'video' : 'image';

        const objectUrl = URL.createObjectURL(file);
        currentMediaUrl = objectUrl;

        // Atualiza textos
        filenameLabel.textContent = file.name;
        filesizeLabel.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB • ${isVideo ? 'Vídeo Vertical' : 'Imagem'}`;
        typeBadge.textContent = isVideo ? 'VÍDEO' : 'IMAGEM';

        // Atualiza Dropzone
        emptyState.classList.add('hidden');
        previewContainer.classList.remove('hidden');

        if (isVideo) {
            imagePreview.classList.add('hidden');
            videoPreview.classList.remove('hidden');
            videoPreview.src = objectUrl;
            videoPreview.play().catch(() => {});

            // Atualiza Smartphone Mockup
            mockupPlaceholder.classList.add('hidden');
            mockupImage.classList.add('hidden');
            mockupVideo.classList.remove('hidden');
            mockupVideo.src = objectUrl;
            mockupVideo.play().catch(() => {});
        } else {
            videoPreview.classList.add('hidden');
            imagePreview.classList.remove('hidden');
            imagePreview.src = objectUrl;

            // Atualiza Smartphone Mockup
            mockupPlaceholder.classList.add('hidden');
            mockupVideo.classList.add('hidden');
            mockupImage.classList.remove('hidden');
            mockupImage.src = objectUrl;
        }

        showToast("Mídia carregada com sucesso!", "success");
    }

    function resetMediaSelection() {
        currentFile = null;
        currentMediaUrl = null;
        fileInput.value = '';

        emptyState.classList.remove('hidden');
        previewContainer.classList.add('hidden');

        videoPreview.pause();
        videoPreview.src = '';
        imagePreview.src = '';

        mockupVideo.pause();
        mockupVideo.src = '';
        mockupVideo.classList.add('hidden');
        mockupImage.classList.add('hidden');
        mockupPlaceholder.classList.remove('hidden');
    }
}

// ==========================================
// 4. DESTINOS & TOGGLES DE REDES
// ==========================================
function initPlatformToggles() {
    const cards = document.querySelectorAll('.platform-checkbox-card');

    cards.forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        const indicator = card.querySelector('.checkbox-indicator');

        const updateStyle = () => {
            if (checkbox.checked) {
                card.classList.add('border-primary', 'bg-primary/5', 'opacity-100');
                card.classList.remove('border-gray-200', 'dark:border-gray-800', 'opacity-50');
                indicator.classList.remove('hidden');
            } else {
                card.classList.remove('border-primary', 'bg-primary/5', 'opacity-100');
                card.classList.add('border-gray-200', 'dark:border-gray-800', 'opacity-50');
                indicator.classList.add('hidden');
            }
        };

        checkbox.addEventListener('change', updateStyle);
        updateStyle();
    });
}

// ==========================================
// 5. INPUTS DE CONTEÚDO & PREVIEW SINCRONIZADO
// ==========================================
function initContentInputs() {
    const captionInput = document.getElementById('post-caption');
    const titleInput = document.getElementById('post-title');
    const counter = document.getElementById('caption-counter');

    const mockupCaption = document.getElementById('mockup-caption');
    const mockupTitle = document.getElementById('mockup-title');

    // Sincronização em tempo real da legenda
    captionInput?.addEventListener('input', () => {
        const text = captionInput.value;
        const length = text.length;
        counter.textContent = `${length} / 2.200`;

        if (length > 2200) {
            counter.classList.add('text-red-500');
        } else {
            counter.classList.remove('text-red-500');
        }

        mockupCaption.textContent = text || 'Sua legenda incrível aparecerá aqui em tempo real...';
    });

    // Sincronização em tempo real do título
    titleInput?.addEventListener('input', () => {
        const text = titleInput.value;
        mockupTitle.textContent = text || 'Título do vídeo aqui...';
    });

    // Hashtags rápidas
    document.querySelectorAll('.quick-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.textContent.trim();
            if (!captionInput.value.includes(tag)) {
                captionInput.value = captionInput.value ? `${captionInput.value.trim()} ${tag}` : tag;
                captionInput.dispatchEvent(new Event('input'));
            }
        });
    });
}

// ==========================================
// 6. ALTERNADOR DE MODO (AGORA vs AGENDAR)
// ==========================================
function initModeSelector() {
    const btnNow = document.getElementById('mode-now-btn');
    const btnSchedule = document.getElementById('mode-schedule-btn');
    const scheduleControls = document.getElementById('schedule-controls');
    const submitBtnLabel = document.getElementById('submit-btn-label');
    const submitBtn = document.getElementById('submit-post-btn');
    const icon = submitBtn?.querySelector('i');

    const dateInput = document.getElementById('schedule-date');
    const timeInput = document.getElementById('schedule-time');

    // Configura valores padrão de agendamento (Amanhã às 18:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];
    if (timeInput) timeInput.value = "18:00";

    btnNow?.addEventListener('click', () => {
        currentPublishMode = 'now';
        btnNow.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
        btnNow.classList.remove('text-gray-500', 'dark:text-gray-400');
        btnSchedule.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
        btnSchedule.classList.add('text-gray-500', 'dark:text-gray-400');

        scheduleControls.classList.add('hidden');
        submitBtnLabel.textContent = 'Publicar Imediatamente';
        if (icon) icon.className = 'fas fa-paper-plane text-lg';
    });

    btnSchedule?.addEventListener('click', () => {
        currentPublishMode = 'schedule';
        btnSchedule.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
        btnSchedule.classList.remove('text-gray-500', 'dark:text-gray-400');
        btnNow.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
        btnNow.classList.add('text-gray-500', 'dark:text-gray-400');

        scheduleControls.classList.remove('hidden');
        submitBtnLabel.textContent = 'Agendar Publicação';
        if (icon) icon.className = 'fas fa-calendar-check text-lg';
    });
}

// ==========================================
// 7. ALTERNADOR DE MOCKUP SMARTPHONE
// ==========================================
function initPreviewTabs() {
    const tabs = document.querySelectorAll('.preview-net-tab');
    const topHeader = document.getElementById('mockup-top-header');
    const handle = document.getElementById('mockup-handle');
    const title = document.getElementById('mockup-title');
    const disc = document.getElementById('mockup-disc-container');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active', 'bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
                t.classList.add('text-gray-500', 'dark:text-gray-400');
            });

            tab.classList.add('active', 'bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
            tab.classList.remove('text-gray-500', 'dark:text-gray-400');

            const net = tab.dataset.previewNet;
            currentPreviewNet = net;

            if (net === 'instagram') {
                topHeader.textContent = 'Reels';
                handle.textContent = '@kihap.martialarts';
                title.classList.add('hidden');
                disc.classList.remove('hidden');
            } else if (net === 'tiktok') {
                topHeader.textContent = 'Para Você';
                handle.textContent = '@kihap.oficial';
                title.classList.add('hidden');
                disc.classList.remove('hidden');
            } else if (net === 'youtube') {
                topHeader.textContent = 'Shorts';
                handle.textContent = 'Kihap Artes Marciais';
                title.classList.remove('hidden');
                disc.classList.add('hidden');
            }
        });
    });
}

// ==========================================
// 8. SUGESTÃO DE LEGENDA COM GEMINI AI
// ==========================================
function initAiEnhancer() {
    const aiBtn = document.getElementById('ai-enhance-btn');
    const captionInput = document.getElementById('post-caption');
    const titleInput = document.getElementById('post-title');

    aiBtn?.addEventListener('click', async () => {
        const currentText = captionInput.value.trim();
        const currentTitle = titleInput.value.trim();

        aiBtn.disabled = true;
        aiBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i> Gerando...';

        try {
            const prompt = `Você é o estrategista de mídias sociais da Kihap (escola de artes marciais de alto padrão com Taekwondo, Jiu-Jitsu e Defesa Pessoal para crianças e adultos).
Crie uma legenda altamente engajadora para Reels/TikTok/Shorts.
${currentTitle ? `Título: ${currentTitle}` : ''}
${currentText ? `Ideia inicial do post: ${currentText}` : 'Ideia: Foco, disciplina e superação no tatame da Kihap com convite para aula experimental gratuita.'}

Responda SOMENTE a legenda final pronta para postar, começando com um gancho cativante (Hook), quebra de linhas para leitura fácil, chamada para ação (CTA) convidando para agendar aula experimental gratuita, e 5 a 8 hashtags estratégicas no final. Não inclua observações extras.`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${socialConfig.geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await res.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (generatedText) {
                captionInput.value = generatedText.trim();
                captionInput.dispatchEvent(new Event('input'));
                showToast("Legenda sugerida pela IA aplicada!", "success");
            } else {
                showToast("Não foi possível gerar a sugestão no momento.", "warning");
            }
        } catch (e) {
            console.error("Erro ao chamar IA:", e);
            showToast("Erro ao conectar com a IA: " + e.message, "error");
        } finally {
            aiBtn.disabled = false;
            aiBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles text-xs"></i> Sugerir com IA';
        }
    });
}

// ==========================================
// 9. ENVIO & AGENDAMENTO DO POST
// ==========================================
function initSubmitAction() {
    const submitBtn = document.getElementById('submit-post-btn');
    const captionInput = document.getElementById('post-caption');
    const titleInput = document.getElementById('post-title');
    const dateInput = document.getElementById('schedule-date');
    const timeInput = document.getElementById('schedule-time');

    submitBtn?.addEventListener('click', async () => {
        // Validação de arquivo
        if (!currentFile) {
            showToast("Por favor, selecione um vídeo ou imagem para o post.", "warning");
            return;
        }

        // Validação de redes selecionadas
        const selectedPlatforms = [];
        if (document.getElementById('dest-instagram')?.checked) selectedPlatforms.push('instagram');
        if (document.getElementById('dest-tiktok')?.checked) selectedPlatforms.push('tiktok');
        if (document.getElementById('dest-youtube')?.checked) selectedPlatforms.push('youtube');

        if (selectedPlatforms.length === 0) {
            showToast("Selecione ao menos uma rede social de destino.", "warning");
            return;
        }

        // Validação de título se YouTube estiver selecionado
        if (selectedPlatforms.includes('youtube') && !titleInput.value.trim()) {
            showToast("O YouTube exige um título para o vídeo.", "warning");
            titleInput.focus();
            return;
        }

        // Validação de data/hora se agendado
        let scheduledTimestamp = null;
        if (currentPublishMode === 'schedule') {
            const dateStr = dateInput.value;
            const timeStr = timeInput.value;
            if (!dateStr || !timeStr) {
                showToast("Defina a data e o horário para agendar o post.", "warning");
                return;
            }
            scheduledTimestamp = new Date(`${dateStr}T${timeStr}:00`);
            if (scheduledTimestamp.getTime() <= Date.now()) {
                showToast("A data e hora de agendamento devem ser futuras.", "warning");
                return;
            }
        }

        // Inicia processo de envio
        submitBtn.disabled = true;
        const originalLabel = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-lg"></i> Processando postagem...';

        try {
            // 1. Upload da mídia para o Firebase Storage com barra de progresso
            const progressWrapper = document.getElementById('upload-progress-wrapper');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressText = document.getElementById('upload-progress-text');

            progressWrapper?.classList.remove('hidden');

            const filename = `${Date.now()}_${currentFile.name.replace(/\s+/g, '_')}`;
            const storagePath = `social_media/${filename}`;
            const storageRef = ref(storage, storagePath);

            const uploadTask = uploadBytesResumable(storageRef, currentFile);

            const storageDownloadUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (progressBar) progressBar.style.width = `${progress}%`;
                        if (progressText) progressText.textContent = `Enviando arquivo: ${Math.round(progress)}%`;
                    },
                    (error) => reject(error),
                    async () => {
                        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadUrl);
                    }
                );
            });

            progressWrapper?.classList.add('hidden');

            // 2. Monta registro do post no Firestore
            const user = await getCurrentUser();
            const postRecord = {
                title: titleInput.value.trim(),
                caption: captionInput.value.trim(),
                mediaUrl: storageDownloadUrl,
                mediaType: currentMediaType,
                platforms: selectedPlatforms,
                publishMode: currentPublishMode,
                status: currentPublishMode === 'now' ? 'publishing' : 'scheduled',
                scheduledAt: scheduledTimestamp ? scheduledTimestamp.toISOString() : null,
                createdAt: serverTimestamp(),
                authorEmail: user?.email || 'intranet@kihap.com.br',
                authorName: user?.name || user?.displayName || 'Kihap Admin',
                results: {}
            };

            // Salva na coleção social_posts
            const postDocRef = await addDoc(collection(db, "social_posts"), postRecord);

            // 3. Se o modo for "Publicar Agora", dispara publicação
            if (currentPublishMode === 'now') {
                showToast("Post criado! Iniciando disparo para as redes sociais...", "info");
                // Tenta publicar no Instagram imediatamente usando o token
                await triggerImmediatePublish(postDocRef.id, postRecord);
            } else {
                showToast("Publicação agendada com sucesso!", "success");
            }

            // Limpa formulário
            resetForm();

            // Alterna para a aba de histórico
            document.getElementById('tab-btn-history')?.click();

        } catch (error) {
            console.error("Erro ao salvar publicação:", error);
            showToast("Falha ao salvar publicação: " + error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
        }
    });

    function resetForm() {
        document.getElementById('post-title').value = '';
        document.getElementById('post-caption').value = '';
        document.getElementById('post-caption').dispatchEvent(new Event('input'));
        document.getElementById('remove-media-btn')?.click();
    }
}

// ==========================================
// 10. DISPARO IMEDIATO (INSTAGRAM GRAPH API)
// ==========================================
async function triggerImmediatePublish(postId, postData) {
    // Se Instagram estiver selecionado
    if (postData.platforms.includes('instagram')) {
        const token = activeConfig.instagramToken;
        if (!token) {
            console.warn("Token do Instagram não configurado.");
            return;
        }

        try {
            // Passo A: Identificar o ID da conta do Instagram
            let igAccountId = activeConfig.instagramAccountId;
            if (!igAccountId || igAccountId === 'kihap.martialarts') {
                // Tenta resolver via /me/accounts
                const accRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${token}`);
                const accData = await accRes.json();
                const found = accData.data?.find(a => a.instagram_business_account);
                if (found && found.instagram_business_account) {
                    igAccountId = found.instagram_business_account.id;
                }
            }

            if (!igAccountId) {
                console.log("Instagram Account ID aguardando liberação do System User.");
                return;
            }

            // Passo B: Criar contêiner de mídia na Meta
            let containerUrl = '';
            if (postData.mediaType === 'video') {
                containerUrl = `https://graph.facebook.com/v19.0/${igAccountId}/media?media_type=REELS&video_url=${encodeURIComponent(postData.mediaUrl)}&caption=${encodeURIComponent(postData.caption)}&access_token=${token}`;
            } else {
                containerUrl = `https://graph.facebook.com/v19.0/${igAccountId}/media?image_url=${encodeURIComponent(postData.mediaUrl)}&caption=${encodeURIComponent(postData.caption)}&access_token=${token}`;
            }

            const cRes = await fetch(containerUrl, { method: 'POST' });
            const cData = await cRes.json();

            if (cData.id) {
                const creationId = cData.id;
                console.log("Contêiner criado no Instagram:", creationId);

                // Atualiza Firestore com status de contêiner criado
                await setDoc(doc(db, "social_posts", postId), {
                    status: 'published',
                    publishedAt: new Date().toISOString(),
                    results: {
                        instagram: {
                            status: 'success',
                            creationId: creationId
                        }
                    }
                }, { merge: true });

            }
        } catch (err) {
            console.error("Erro na publicação direta do Instagram:", err);
        }
    }

    // Se YouTube estiver selecionado
    if (postData.platforms.includes('youtube')) {
        const { youtubeClientId, youtubeClientSecret, youtubeRefreshToken } = activeConfig;
        if (youtubeClientId && youtubeClientSecret && youtubeRefreshToken) {
            try {
                // 1. Obter Access Token atualizado via OAuth 2.0
                const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: youtubeClientId,
                        client_secret: youtubeClientSecret,
                        refresh_token: youtubeRefreshToken,
                        grant_type: "refresh_token"
                    })
                });
                const tokenData = await tokenRes.json();

                if (tokenData.access_token) {
                    showToast("Iniciando upload para o YouTube Shorts...", "info");

                    // 2. Iniciar sessão de upload resumable
                    const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${tokenData.access_token}`,
                            "Content-Type": "application/json; charset=UTF-8"
                        },
                        body: JSON.stringify({
                            snippet: {
                                title: postData.title || "Kihap Artes Marciais #Shorts",
                                description: `${postData.caption}\n\n#Shorts #kihap #artesmarciais #taekwondo`,
                                tags: ["kihap", "artesmarciais", "taekwondo", "defesapessoal", "Shorts"],
                                categoryId: "17"
                            },
                            status: {
                                privacyStatus: "public",
                                selfDeclaredMadeForKids: false
                            }
                        })
                    });

                    const uploadLocation = initRes.headers.get("Location");
                    if (uploadLocation && currentFile) {
                        const uploadRes = await fetch(uploadLocation, {
                            method: "PUT",
                            headers: {
                                "Content-Type": currentFile.type || "video/mp4"
                            },
                            body: currentFile
                        });
                        const uploadData = await uploadRes.json();

                        if (uploadData.id) {
                            await setDoc(doc(db, "social_posts", postId), {
                                status: 'published',
                                publishedAt: new Date().toISOString(),
                                results: {
                                    youtube: {
                                        status: 'success',
                                        videoId: uploadData.id,
                                        url: `https://youtube.com/shorts/${uploadData.id}`
                                    }
                                }
                            }, { merge: true });

                            showToast("Publicado com sucesso no YouTube Shorts!", "success");
                        }
                    }
                }
            } catch (ytErr) {
                console.error("Erro na publicação do YouTube:", ytErr);
            }
        }
    }
}

// ==========================================
// 11. FILA & HISTÓRICO DE POSTAGENS
// ==========================================
function initHistorySection() {
    const container = document.getElementById('posts-history-container');
    const refreshBtn = document.getElementById('refresh-history-btn');
    const filterBtns = document.querySelectorAll('.history-filter-btn');
    const countBadge = document.getElementById('history-count-badge');

    // Filtros
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => {
                b.classList.remove('active', 'bg-primary', 'text-black');
                b.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-600', 'dark:text-gray-300');
            });
            btn.classList.add('active', 'bg-primary', 'text-black');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-600', 'dark:text-gray-300');

            activeFilter = btn.dataset.filter;
            listenPosts();
        });
    });

    refreshBtn?.addEventListener('click', () => {
        refreshBtn.querySelector('i').classList.add('fa-spin');
        listenPosts();
        setTimeout(() => refreshBtn.querySelector('i').classList.remove('fa-spin'), 600);
    });

    function listenPosts() {
        if (unsubscribePosts) unsubscribePosts();

        const q = query(collection(db, "social_posts"), orderBy("createdAt", "desc"));

        unsubscribePosts = onSnapshot(q, (snapshot) => {
            let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (countBadge) countBadge.textContent = posts.length;

            // Aplica filtro
            if (activeFilter !== 'all') {
                posts = posts.filter(p => p.status === activeFilter);
            }

            renderPostsGrid(posts);
        }, (error) => {
            console.error("Erro ao escutar posts:", error);
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p class="font-bold">Não foi possível carregar a fila de postagens.</p>
                </div>
            `;
        });
    }

    function renderPostsGrid(posts) {
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-16 text-center text-gray-400 dark:text-gray-500">
                    <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mx-auto mb-3">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <p class="font-bold text-gray-700 dark:text-gray-300">Nenhuma postagem encontrada nesta categoria.</p>
                    <p class="text-xs text-gray-400 mt-1">Crie um novo post na aba "Criar & Programar" para visualizá-lo aqui.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = posts.map(post => {
            const statusConfig = {
                published: { label: 'Publicado', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: 'fa-check' },
                scheduled: { label: 'Agendado', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: 'fa-clock' },
                publishing: { label: 'Processando', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: 'fa-spinner fa-spin' },
                failed: { label: 'Falha', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', icon: 'fa-times' }
            }[post.status] || { label: post.status, color: 'bg-gray-500/10 text-gray-500', icon: 'fa-circle' };

            const isVideo = post.mediaType === 'video';
            const ytUrl = post.results?.youtube?.url || (post.results?.youtube?.videoId ? `https://youtube.com/shorts/${post.results.youtube.videoId}` : null);
            const igUrl = post.results?.instagram?.url || post.results?.instagram?.permalink || null;
            const primaryUrl = ytUrl || igUrl || post.mediaUrl;

            // Formatação de data
            let dateLabel = 'Publicação imediata';
            if (post.scheduledAt) {
                const d = new Date(post.scheduledAt);
                dateLabel = `Agendado para ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            } else if (post.createdAt) {
                const d = post.createdAt.toDate ? post.createdAt.toDate() : new Date();
                dateLabel = `Criado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            return `
                <div class="bg-white dark:bg-[#1a1a1a] rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                        <!-- Header do Card com Mídia -->
                        <div class="relative w-full h-48 bg-black flex items-center justify-center overflow-hidden group/media">
                            ${isVideo ? `
                                <video src="${post.mediaUrl}" class="w-full h-full object-cover" muted playsinline></video>
                                <span class="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/80 text-white backdrop-blur-sm">
                                    <i class="fas fa-video mr-1"></i> VÍDEO
                                </span>
                            ` : `
                                <img src="${post.mediaUrl}" class="w-full h-full object-cover" alt="Post thumbnail">
                                <span class="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/80 text-white backdrop-blur-sm">
                                    <i class="fas fa-image mr-1"></i> FOTO
                                </span>
                            `}

                            ${primaryUrl ? `
                                <a href="${primaryUrl}" target="_blank" rel="noopener noreferrer"
                                    class="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs backdrop-blur-[2px]">
                                    <i class="fas fa-arrow-up-right-from-square text-base"></i> Abrir Publicação
                                </a>
                            ` : ''}

                            <!-- Status Badge -->
                            <span class="absolute top-3 left-3 text-[11px] font-extrabold px-3 py-1 rounded-full border backdrop-blur-md flex items-center gap-1.5 ${statusConfig.color}">
                                <i class="fas ${statusConfig.icon}"></i> ${statusConfig.label}
                            </span>
                        </div>

                        <!-- Conteúdo do Card -->
                        <div class="p-5 space-y-3">
                            <!-- Destinos -->
                            <div class="flex items-center gap-1.5">
                                ${(post.platforms || []).map(p => {
                                    if (p === 'instagram') return '<span class="w-6 h-6 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center text-xs" title="Instagram"><i class="fab fa-instagram"></i></span>';
                                    if (p === 'tiktok') return '<span class="w-6 h-6 rounded-lg bg-black/10 dark:bg-white/10 text-gray-900 dark:text-white flex items-center justify-center text-xs" title="TikTok"><i class="fab fa-tiktok"></i></span>';
                                    if (p === 'youtube') return '<span class="w-6 h-6 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center text-xs" title="YouTube"><i class="fab fa-youtube"></i></span>';
                                    return '';
                                }).join('')}
                            </div>

                            ${post.title ? `<h3 class="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">${post.title}</h3>` : ''}

                            <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
                                ${post.caption || 'Sem legenda'}
                            </p>

                            <!-- Botões de Acesso Direto às Redes -->
                            ${ytUrl ? `
                                <div class="pt-2">
                                    <a href="${ytUrl}" target="_blank" rel="noopener noreferrer"
                                        class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all shadow-md shadow-red-600/20 group">
                                        <i class="fab fa-youtube text-base group-hover:scale-110 transition-transform"></i>
                                        <span>Assistir no YouTube Shorts</span>
                                        <i class="fas fa-arrow-up-right-from-square text-[10px] opacity-70"></i>
                                    </a>
                                </div>
                            ` : ''}

                            ${igUrl ? `
                                <div class="pt-2">
                                    <a href="${igUrl}" target="_blank" rel="noopener noreferrer"
                                        class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-tr from-yellow-500 via-pink-600 to-purple-600 hover:opacity-90 text-white font-extrabold text-xs transition-all shadow-md group">
                                        <i class="fab fa-instagram text-base group-hover:scale-110 transition-transform"></i>
                                        <span>Ver no Instagram</span>
                                        <i class="fas fa-arrow-up-right-from-square text-[10px] opacity-70"></i>
                                    </a>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Footer do Card -->
                    <div class="p-4 border-t border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between text-xs text-gray-400">
                        <span class="truncate max-w-[150px]" title="${dateLabel}">
                            <i class="far fa-calendar mr-1"></i> ${dateLabel}
                        </span>
                        <div class="flex items-center gap-1">
                            ${primaryUrl ? `
                                <button onclick="window.copySocialPostLink('${primaryUrl}')"
                                    class="p-2 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Copiar link do post">
                                    <i class="fas fa-copy"></i>
                                </button>
                            ` : ''}
                            <button onclick="window.deleteSocialPost('${post.id}')"
                                class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                title="Excluir post da fila">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Função de cópia de link exposta globalmente
    window.copySocialPostLink = (url) => {
        navigator.clipboard.writeText(url).then(() => {
            showToast("Link copiado para a área de transferência!", "success");
        }).catch(() => {
            showToast("Não foi possível copiar o link.", "warning");
        });
    };

    // Função de exclusão exposta globalmente
    window.deleteSocialPost = async (postId) => {
        if (!confirm("Tem certeza que deseja excluir esta publicação da fila?")) return;
        try {
            await deleteDoc(doc(db, "social_posts", postId));
            showToast("Publicação removida com sucesso!", "success");
        } catch (e) {
            showToast("Erro ao remover: " + e.message, "error");
        }
    };

    // Inicia escuta
    listenPosts();
}
