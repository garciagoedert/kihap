// Kihap CRM - Content Script para WhatsApp Web
(function () {
    let currentRawPhone = null;
    let currentContactName = null;
    let currentActivePhotoUrl = null;
    let sidebarOpen = false;
    let crmBaseUrl = 'http://localhost:9000/intranet';
    let currentActiveLead = null;
    let isQuerying = false;
    const syncedPhotosCache = new Set();

    // Carrega configuração de URL salva
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['crmBaseUrl'], (res) => {
            if (res.crmBaseUrl) crmBaseUrl = res.crmBaseUrl;
        });
    }

    // Inicialização quando a página do WhatsApp Web estiver pronta
    function init() {
        if (document.getElementById('kihap-crm-floating-btn')) return;

        createFloatingButton();
        createSidebar();
        observeWhatsAppChat();
    }

    // Cria o botão flutuante
    function createFloatingButton() {
        const btn = document.createElement('div');
        btn.id = 'kihap-crm-floating-btn';
        btn.innerHTML = `
            <span style="font-size: 16px;">🥋</span>
            <span>Kihap CRM</span>
        `;
        btn.title = 'Abrir Barra Lateral do Kihap CRM';
        btn.addEventListener('click', () => toggleSidebar());
        document.body.appendChild(btn);
    }

    // Cria a barra lateral
    function createSidebar() {
        const sidebar = document.createElement('aside');
        sidebar.id = 'kihap-crm-sidebar';
        sidebar.innerHTML = `
            <div class="kihap-header">
                <div class="kihap-title">
                    <span style="font-size: 18px;">🥋</span>
                    <span>Kihap CRM</span>
                </div>
                <button id="kihap-close-btn" class="kihap-close-btn" title="Fechar">&times;</button>
            </div>
            <div class="kihap-content" id="kihap-sidebar-content">
                <div class="kihap-card" style="text-align: center; padding: 28px 16px;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🥋</div>
                    <p style="font-weight: 700; margin-bottom: 6px; font-size: 14px;">Selecione uma conversa</p>
                    <p style="font-size: 11px; opacity: 0.7; line-height: 1.4;">
                        Abra qualquer conversa no WhatsApp Web para sincronizar automaticamente com o funil do CRM Kihap.
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(sidebar);

        document.getElementById('kihap-close-btn').addEventListener('click', () => {
            toggleSidebar(false);
        });
    }

    function toggleSidebar(forceState) {
        const sidebar = document.getElementById('kihap-crm-sidebar');
        if (!sidebar) return;

        sidebarOpen = typeof forceState === 'boolean' ? forceState : !sidebarOpen;
        sidebar.classList.toggle('open', sidebarOpen);

        if (sidebarOpen) {
            checkAndSyncActiveChat(true);
        }
    }

    // Monitora alterações de chat ativo no WhatsApp Web
    function observeWhatsAppChat() {
        // Interval de verificação contínua
        setInterval(() => {
            checkAndSyncActiveChat(false);
        }, 800);

        // Observer para mudanças rápidas no DOM do #main
        const observer = new MutationObserver(() => {
            checkAndSyncActiveChat(false);
        });

        const target = document.querySelector('#app') || document.body;
        observer.observe(target, { childList: true, subtree: true });
    }

    // Extrai o contato ativo no WhatsApp Web
    function extractActiveChatContact() {
        // Encontra o container principal do chat
        const main = document.querySelector('#main') ||
                     document.querySelector('div[id="main"]') ||
                     document.querySelector('[data-testid="conversation-panel-wrapper"]');
        
        if (!main) return null;

        // Encontra o header específico da conversa ativa (evita o header da lista de conversas)
        const header = main.querySelector('header') || document.querySelector('[data-testid="conversation-header"]');
        if (!header) return null;

        let contactName = '';
        let rawPhone = '';
        let photoUrl = null;

        // 1. Título do contato ou número de telefone
        const titleSpan = header.querySelector('[data-testid="conversation-info-header"] span[title]') ||
                          header.querySelector('span[title]') ||
                          header.querySelector('[data-testid="conversation-title"]') ||
                          header.querySelector('h2');

        if (titleSpan) {
            contactName = titleSpan.getAttribute('title') || titleSpan.textContent || '';
        }

        // 2. Subtítulo (onde pode ter número ou status)
        const subEls = header.querySelectorAll('span');
        for (const span of subEls) {
            const txt = (span.getAttribute('title') || span.textContent || '').trim();
            if (txt.includes('+') || /\d{8,}/.test(txt.replace(/\D/g, ''))) {
                rawPhone = txt;
                break;
            }
        }

        // Se o título for o próprio número de telefone
        if (!rawPhone && contactName) {
            const clean = contactName.replace(/\D/g, '');
            if (clean.length >= 8) {
                rawPhone = contactName;
            }
        }

        // 3. Extrai foto de perfil do contato a partir do header do WhatsApp Web
        try {
            const avatarImg = header.querySelector('img[src*="blob:"], img[src*="whatsapp.net"], [data-testid="avatar"] img, img');
            if (avatarImg && (avatarImg.naturalWidth > 16 || avatarImg.width > 16)) {
                try {
                    const canvas = document.createElement('canvas');
                    const size = Math.min(96, Math.max(avatarImg.naturalWidth || 64, 48));
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(avatarImg, 0, 0, size, size);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                    if (dataUrl && dataUrl.length > 50) {
                        photoUrl = dataUrl;
                    }
                } catch (e) {
                    if (avatarImg.src && avatarImg.src.startsWith('http')) {
                        photoUrl = avatarImg.src;
                    }
                }
            }
        } catch (e) {
            console.warn("[Kihap CRM] Erro ao extrair foto de perfil:", e);
        }

        if (!contactName && !rawPhone) return null;

        return {
            name: contactName.trim(),
            phone: rawPhone.trim(),
            photoUrl: photoUrl
        };
    }

    // Sincroniza foto de perfil diretamente com a coleção whatsapp_chats no Firestore
    async function syncChatPhotoToFirestore(cleanPhone, photoUrl, contactName) {
        if (!cleanPhone || !photoUrl) return;
        const cacheKey = `${cleanPhone}_${photoUrl.slice(0, 40)}`;
        if (syncedPhotosCache.has(cacheKey)) return;
        syncedPhotosCache.add(cacheKey);

        try {
            const url = `https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents/whatsapp_chats/${cleanPhone}?updateMask.fieldPaths=photoUrl&updateMask.fieldPaths=customerName`;
            await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        photoUrl: { stringValue: photoUrl },
                        customerName: { stringValue: contactName || '' }
                    }
                })
            });
            console.log(`[Kihap CRM] Foto de perfil sincronizada para whatsapp_chats/${cleanPhone}`);
        } catch (e) {
            console.warn("[Kihap CRM] Erro ao sincronizar foto de perfil:", e);
        }
    }

    // Sincroniza foto de perfil com o lead/prospect no CRM se ainda não possuir
    async function syncLeadPhotoToFirestore(lead, photoUrl) {
        if (!lead || !lead.fullPath || !photoUrl) return;
        if (lead.photoURL === photoUrl) return;
        try {
            const url = `https://firestore.googleapis.com/v1/${lead.fullPath}?updateMask.fieldPaths=photoURL`;
            await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        photoURL: { stringValue: photoUrl }
                    }
                })
            });
            lead.photoURL = photoUrl;
            console.log(`[Kihap CRM] Foto de perfil sincronizada para ${lead.collection}/${lead.id}`);
        } catch (e) {
            console.warn("[Kihap CRM] Erro ao sincronizar foto com o lead:", e);
        }
    }

    // Verifica e sincroniza o chat ativo
    function checkAndSyncActiveChat(forceReload = false) {
        const contact = extractActiveChatContact();
        if (!contact) {
            if (currentRawPhone !== null || currentContactName !== null) {
                currentRawPhone = null;
                currentContactName = null;
                currentActivePhotoUrl = null;
                currentActiveLead = null;
                renderEmptyState();
            }
            return;
        }

        const isDifferent = contact.phone !== currentRawPhone || contact.name !== currentContactName;
        if (isDifferent || forceReload) {
            currentRawPhone = contact.phone;
            currentContactName = contact.name;
            currentActivePhotoUrl = contact.photoUrl;
            if (sidebarOpen) {
                loadLeadData(currentRawPhone, currentContactName);
            }
        }

        // Se detectou foto de perfil, sincroniza em segundo plano
        if (contact.photoUrl && contact.phone) {
            currentActivePhotoUrl = contact.photoUrl;
            const digits = contact.phone.replace(/\D/g, '');
            let cleanPhone = digits;
            if (cleanPhone.length >= 10 && cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;
            syncChatPhotoToFirestore(cleanPhone, contact.photoUrl, contact.name);

            if (currentActiveLead) {
                syncLeadPhotoToFirestore(currentActiveLead, contact.photoUrl);
            }
        }
    }

    function renderEmptyState() {
        const content = document.getElementById('kihap-sidebar-content');
        if (!content) return;
        content.innerHTML = `
            <div class="kihap-card" style="text-align: center; padding: 28px 16px;">
                <div style="font-size: 32px; margin-bottom: 8px;">🥋</div>
                <p style="font-weight: 700; margin-bottom: 6px; font-size: 14px;">Selecione uma conversa</p>
                <p style="font-size: 11px; opacity: 0.7; line-height: 1.4;">
                    Abra qualquer conversa no WhatsApp Web para sincronizar automaticamente com o funil do CRM Kihap.
                </p>
            </div>
        `;
    }

    // Gera variações de números de telefone para match com CRM no Brasil
    function getPhoneVariations(phone) {
        if (!phone) return [];
        const digits = String(phone).replace(/\D/g, '');
        if (!digits) return [];

        const variations = new Set();
        variations.add(digits);

        let sans55 = digits;
        if (digits.startsWith('55') && digits.length >= 12) {
            sans55 = digits.slice(2);
            variations.add(sans55);
        } else {
            variations.add('55' + digits);
        }

        if (sans55.length === 10) {
            const with9 = sans55.slice(0, 2) + '9' + sans55.slice(2);
            variations.add(with9);
            variations.add('55' + with9);
        } else if (sans55.length === 11) {
            const without9 = sans55.slice(0, 2) + sans55.slice(3);
            variations.add(without9);
            variations.add('55' + without9);
        }

        return Array.from(variations);
    }

    // Consulta Firestore REST API diretamente
    async function searchLeadInFirestore(phone, name) {
        const variations = getPhoneVariations(phone);

        // 1. Busca na coleção 'leads' por telefone
        if (variations.length > 0) {
            try {
                const res = await fetch('https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        structuredQuery: {
                            from: [{ collectionId: 'leads' }],
                            where: {
                                fieldFilter: {
                                    field: { fieldPath: 'telefone' },
                                    op: 'IN',
                                    value: {
                                        arrayValue: {
                                            values: variations.map(v => ({ stringValue: v }))
                                        }
                                    }
                                }
                            },
                            limit: 1
                        }
                    })
                });

                const data = await res.json();
                if (Array.isArray(data) && data[0] && data[0].document) {
                    return parseFirestoreDoc(data[0].document, 'leads');
                }
            } catch (e) {
                console.warn("[Kihap CRM] Erro ao buscar em leads por telefone:", e);
            }

            // 2. Busca na coleção 'prospects' por telefone
            try {
                const resP = await fetch('https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        structuredQuery: {
                            from: [{ collectionId: 'prospects' }],
                            where: {
                                fieldFilter: {
                                    field: { fieldPath: 'telefone' },
                                    op: 'IN',
                                    value: {
                                        arrayValue: {
                                            values: variations.map(v => ({ stringValue: v }))
                                        }
                                    }
                                }
                            },
                            limit: 1
                        }
                    })
                });

                const dataP = await resP.json();
                if (Array.isArray(dataP) && dataP[0] && dataP[0].document) {
                    return parseFirestoreDoc(dataP[0].document, 'prospects');
                }
            } catch (e) {
                console.warn("[Kihap CRM] Erro ao buscar em prospects por telefone:", e);
            }
        }

        // 3. Se não achou por telefone, tenta por Nome
        if (name && name.length >= 3 && !/^\+?\d+$/.test(name.trim())) {
            try {
                const resN = await fetch('https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        structuredQuery: {
                            from: [{ collectionId: 'leads' }],
                            where: {
                                fieldFilter: {
                                    field: { fieldPath: 'nome' },
                                    op: 'EQUAL',
                                    value: { stringValue: name.trim() }
                                }
                            },
                            limit: 1
                        }
                    })
                });

                const dataN = await resN.json();
                if (Array.isArray(dataN) && dataN[0] && dataN[0].document) {
                    return parseFirestoreDoc(dataN[0].document, 'leads');
                }
            } catch (e) {
                console.warn("[Kihap CRM] Erro ao buscar por nome:", e);
            }
        }

        return null;
    }

    function parseFirestoreDoc(doc, collection) {
        const fields = doc.fields || {};
        const parsed = {
            id: doc.name.split('/').pop(),
            fullPath: doc.name,
            collection: collection
        };

        for (const key of Object.keys(fields)) {
            const valObj = fields[key];
            if (valObj.stringValue !== undefined) parsed[key] = valObj.stringValue;
            else if (valObj.integerValue !== undefined) parsed[key] = parseInt(valObj.integerValue, 10);
            else if (valObj.doubleValue !== undefined) parsed[key] = parseFloat(valObj.doubleValue);
            else if (valObj.booleanValue !== undefined) parsed[key] = valObj.booleanValue;
            else if (valObj.timestampValue !== undefined) parsed[key] = valObj.timestampValue;
            else if (valObj.arrayValue !== undefined) {
                const arr = valObj.arrayValue.values || [];
                parsed[key] = arr.map(item => {
                    if (item.mapValue) {
                        const m = {};
                        for (const mk of Object.keys(item.mapValue.fields || {})) {
                            const sub = item.mapValue.fields[mk];
                            m[mk] = sub.stringValue || sub.integerValue || sub.booleanValue || '';
                        }
                        return m;
                    }
                    return item.stringValue || item;
                });
            }
        }

        return parsed;
    }

    // Carrega dados do lead no painel
    async function loadLeadData(rawPhone, rawName) {
        const content = document.getElementById('kihap-sidebar-content');
        if (!content) return;

        if (isQuerying) return;
        isQuerying = true;

        content.innerHTML = `
            <div class="kihap-card" style="text-align: center; padding: 24px 16px;">
                <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
                <div style="font-size: 13px; font-weight: 600;">Sincronizando com Kihap CRM...</div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">Buscando dados de ${escapeHtml(rawName || rawPhone || 'contato')}</div>
            </div>
        `;

        const lead = await searchLeadInFirestore(rawPhone, rawName);
        isQuerying = false;
        currentActiveLead = lead;

        if (lead) {
            renderLeadFoundCard(lead);
        } else {
            renderLeadNotFoundCard(rawPhone, rawName);
        }
    }

    // Renderiza card quando o lead foi encontrado no CRM
    function renderLeadFoundCard(lead) {
        const content = document.getElementById('kihap-sidebar-content');
        if (!content) return;

        const displayName = lead.nome || lead.responsavel || currentContactName || 'Lead Kihap';
        const displayPhone = lead.telefone ? formatPhone(lead.telefone) : (currentRawPhone ? formatPhone(currentRawPhone) : 'Sem telefone');
        const unit = lead.unidade || 'Sem Unidade';
        const stage = lead.status || 'Novo';
        const origin = lead['origem do lead'] || lead.origem || 'CRM';
        const contactLogs = lead.contactLog || [];
        const photoUrl = lead.photoURL || lead.photoUrl || currentActivePhotoUrl || null;

        const stageBadges = {
            'Novo': 'badge-novo',
            'Contactado': 'badge-contactado',
            'Aula experimental': 'badge-aula',
            'Matrícula': 'badge-matricula',
            'Perdido': 'badge-perdido'
        };

        const currentBadgeClass = stageBadges[stage] || 'badge-novo';

        content.innerHTML = `
            <!-- Lead Info Card -->
            <div class="kihap-card">
                <div style="display: flex; items-center; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: #00a884; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; overflow: hidden; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            ${photoUrl ? `
                                <img src="${escapeHtml(photoUrl)}" 
                                     alt="${escapeHtml(displayName)}"
                                     style="width: 100%; height: 100%; object-fit: cover;" 
                                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: white;">
                                    ${getInitials(displayName)}
                                </div>
                            ` : `
                                <span>${getInitials(displayName)}</span>
                            `}
                        </div>
                        <div style="min-width: 0;">
                            <div class="kihap-lead-name" style="margin: 0; line-height: 1.2; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(displayName)}
                            </div>
                            <div style="font-size: 11px; opacity: 0.75;">${displayPhone}</div>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; margin-top: 10px;">
                    <span class="kihap-badge ${currentBadgeClass}" id="kihap-lead-status-badge">${escapeHtml(stage)}</span>
                    <span style="font-size: 11px; font-weight: 600; background: rgba(0,0,0,0.06); padding: 2px 7px; border-radius: 6px;" id="kihap-lead-unit">
                        📍 ${escapeHtml(unit)}
                    </span>
                    <span style="font-size: 10px; opacity: 0.7; margin-left: auto;">
                        ${escapeHtml(origin)}
                    </span>
                </div>

                <!-- Stage Buttons -->
                <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">
                    Fase no Kanban:
                </div>
                <div class="kihap-stages-grid">
                    <button class="kihap-stage-btn ${stage === 'Novo' ? 'active' : ''}" data-stage="Novo">Novo</button>
                    <button class="kihap-stage-btn ${stage === 'Contactado' ? 'active' : ''}" data-stage="Contactado">Contactado</button>
                    <button class="kihap-stage-btn ${stage === 'Aula experimental' ? 'active' : ''}" data-stage="Aula experimental">Aula Exp.</button>
                    <button class="kihap-stage-btn ${stage === 'Matrícula' ? 'active' : ''}" data-stage="Matrícula">Matrícula</button>
                </div>
            </div>

            <!-- Notes Section -->
            <div class="kihap-card">
                <div style="font-weight: 700; margin-bottom: 6px; font-size: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <span>📝 Adicionar Nota:</span>
                    <span id="kihap-note-status" style="font-size: 10px; color: #00a884; display: none;">Salvo! ✓</span>
                </div>
                <textarea id="kihap-quick-note" class="kihap-input" rows="2" placeholder="Ex: Lead quer agendar aula para sábado às 10h..."></textarea>
                <button id="kihap-save-note-btn" class="kihap-btn-primary" style="margin-top: 8px;">
                    Salvar na Timeline
                </button>

                <!-- Recent Notes List -->
                <div id="kihap-recent-notes" style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto;">
                    ${renderContactLogsHtml(contactLogs)}
                </div>
            </div>

            <!-- Action Links -->
            <div class="kihap-card" style="display: flex; flex-direction: column; gap: 8px;">
                <a href="${crmBaseUrl}/prospeccao.html?prospectId=${lead.id}" target="_blank" class="kihap-btn-secondary">
                    Abrir no Kanban do CRM ↗
                </a>
                <a href="${crmBaseUrl}/whatsapp.html?phone=${encodeURIComponent(lead.telefone || currentRawPhone || '')}" target="_blank" class="kihap-btn-secondary">
                    Abrir na Central WhatsApp ↗
                </a>
            </div>
        `;

        // Eventos dos botões de fase
        content.querySelectorAll('.kihap-stage-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const newStage = btn.dataset.stage;
                content.querySelectorAll('.kihap-stage-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const badge = document.getElementById('kihap-lead-status-badge');
                if (badge) {
                    badge.textContent = newStage;
                    badge.className = `kihap-badge ${stageBadges[newStage] || 'badge-novo'}`;
                }

                await updateLeadStageInFirestore(lead, newStage);
            });
        });

        // Evento de salvar nota
        const saveBtn = document.getElementById('kihap-save-note-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const noteInput = document.getElementById('kihap-quick-note');
                const text = noteInput ? noteInput.value.trim() : '';
                if (!text) return;

                saveBtn.disabled = true;
                saveBtn.innerHTML = 'Salvando...';

                await addNoteToLeadInFirestore(lead, text);

                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Salvar na Timeline';
                if (noteInput) noteInput.value = '';

                const statusEl = document.getElementById('kihap-note-status');
                if (statusEl) {
                    statusEl.style.display = 'inline';
                    setTimeout(() => { statusEl.style.display = 'none'; }, 2500);
                }
            });
        }
    }

    // Renderiza card quando contato ainda não existe no CRM
    function renderLeadNotFoundCard(rawPhone, rawName) {
        const content = document.getElementById('kihap-sidebar-content');
        if (!content) return;

        const displayName = rawName || 'Contato WhatsApp';
        const displayPhone = rawPhone ? formatPhone(rawPhone) : 'Telefone não identificado';

        content.innerHTML = `
            <div class="kihap-card" style="text-align: center; padding: 18px 14px;">
                <div style="margin-bottom: 8px; display: flex; justify-content: center;">
                    ${currentActivePhotoUrl ? `
                        <img src="${escapeHtml(currentActivePhotoUrl)}" style="width: 46px; height: 46px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 5px rgba(0,0,0,0.15);" />
                    ` : `
                        <div style="font-size: 26px;">🔎</div>
                    `}
                </div>
                <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">Contato Não Cadastrado</div>
                <div style="font-size: 12px; font-weight: 600; color: #111827; margin-bottom: 2px;">${escapeHtml(displayName)}</div>
                <div style="font-size: 11px; opacity: 0.7; margin-bottom: 12px;">${displayPhone}</div>
                <p style="font-size: 11px; opacity: 0.8; line-height: 1.35; margin-bottom: 14px;">
                    Deseja cadastrar este contato diretamente no funil de prospecção do Kihap CRM?
                </p>

                <div style="text-align: left; margin-bottom: 10px;">
                    <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Selecione a Unidade:</label>
                    <select id="kihap-new-lead-unit" class="kihap-input" style="padding: 7px;">
                        <option value="Centro">Centro</option>
                        <option value="Coqueiros">Coqueiros</option>
                        <option value="Santa Mônica">Santa Mônica</option>
                        <option value="Asa Sul">Asa Sul</option>
                        <option value="Sudoeste">Sudoeste</option>
                        <option value="Noroeste">Noroeste</option>
                        <option value="Lago Sul">Lago Sul</option>
                        <option value="Dourados">Dourados</option>
                        <option value="Sem Unidade">Sem Unidade</option>
                    </select>
                </div>

                <button id="kihap-create-lead-btn" class="kihap-btn-primary">
                    + Cadastrar Lead no CRM
                </button>
            </div>

            <div class="kihap-card" style="display: flex; flex-direction: column; gap: 8px;">
                <a href="${crmBaseUrl}/prospeccao.html" target="_blank" class="kihap-btn-secondary">
                    Abrir Kanban do CRM ↗
                </a>
            </div>
        `;

        document.getElementById('kihap-create-lead-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('kihap-create-lead-btn');
            const unitSelect = document.getElementById('kihap-new-lead-unit');
            const unit = unitSelect ? unitSelect.value : 'Centro';

            btn.disabled = true;
            btn.innerHTML = 'Cadastrando...';

            await createLeadInFirestore(displayName, rawPhone, unit);
        });
    }

    // Atualiza a fase no Firestore via REST
    async function updateLeadStageInFirestore(lead, newStage) {
        try {
            const url = `https://firestore.googleapis.com/v1/${lead.fullPath}?updateMask.fieldPaths=status`;
            await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        status: { stringValue: newStage }
                    }
                })
            });
            lead.status = newStage;
        } catch (e) {
            console.error("[Kihap CRM] Erro ao atualizar fase:", e);
            alert("Erro ao sincronizar fase com o servidor: " + e.message);
        }
    }

    // Salva nota no contactLog do lead via REST
    async function addNoteToLeadInFirestore(lead, noteText) {
        try {
            const currentLogs = lead.contactLog || [];
            const newEntry = {
                mapValue: {
                    fields: {
                        date: { stringValue: new Date().toISOString() },
                        description: { stringValue: noteText },
                        type: { stringValue: 'WhatsApp' },
                        user: { stringValue: 'Extensão Web' }
                    }
                }
            };

            const existingMapped = currentLogs.map(log => ({
                mapValue: {
                    fields: {
                        date: { stringValue: log.date || new Date().toISOString() },
                        description: { stringValue: log.description || '' },
                        type: { stringValue: log.type || 'Nota' },
                        user: { stringValue: log.user || 'Kihap' }
                    }
                }
            }));

            const updatedLogs = [newEntry, ...existingMapped];

            const url = `https://firestore.googleapis.com/v1/${lead.fullPath}?updateMask.fieldPaths=contactLog`;
            await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        contactLog: {
                            arrayValue: {
                                values: updatedLogs
                            }
                        }
                    }
                })
            });

            lead.contactLog = [{
                date: new Date().toISOString(),
                description: noteText,
                type: 'WhatsApp',
                user: 'Extensão Web'
            }, ...currentLogs];

            const notesListEl = document.getElementById('kihap-recent-notes');
            if (notesListEl) {
                notesListEl.innerHTML = renderContactLogsHtml(lead.contactLog);
            }
        } catch (e) {
            console.error("[Kihap CRM] Erro ao salvar nota:", e);
            alert("Erro ao salvar nota: " + e.message);
        }
    }

    // Cria novo lead no Firestore via REST
    async function createLeadInFirestore(name, phone, unit) {
        try {
            const clean = (phone || '').replace(/\D/g, '');
            const finalPhone = clean.length <= 11 && !clean.startsWith('55') ? clean : (clean.startsWith('55') ? clean.slice(2) : clean);

            const leadFields = {
                nome: { stringValue: name },
                telefone: { stringValue: finalPhone },
                unidade: { stringValue: unit },
                status: { stringValue: 'Novo' },
                'origem do lead': { stringValue: 'WhatsApp Web' },
                createdAt: { timestampValue: new Date().toISOString() }
            };
            if (currentActivePhotoUrl) {
                leadFields.photoURL = { stringValue: currentActivePhotoUrl };
            }

            const res = await fetch('https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: leadFields })
            });

            const data = await res.json();
            if (data && data.name) {
                const newLead = parseFirestoreDoc(data, 'leads');
                currentActiveLead = newLead;
                renderLeadFoundCard(newLead);

                if (currentActivePhotoUrl) {
                    const fullPhone = clean.startsWith('55') ? clean : ('55' + clean);
                    syncChatPhotoToFirestore(fullPhone, currentActivePhotoUrl, name);
                }
            } else {
                throw new Error(data.error?.message || 'Falha ao criar documento');
            }
        } catch (e) {
            console.error("[Kihap CRM] Erro ao cadastrar lead:", e);
            alert("Erro ao cadastrar lead: " + e.message);
            const btn = document.getElementById('kihap-create-lead-btn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '+ Cadastrar Lead no CRM';
            }
        }
    }

    function renderContactLogsHtml(logs) {
        if (!logs || logs.length === 0) {
            return '<div style="font-size: 11px; opacity: 0.5; text-align: center; padding: 6px;">Nenhuma nota interna anterior.</div>';
        }

        return logs.slice(0, 5).map(log => {
            const timeStr = log.date ? new Date(log.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div style="background: rgba(0,0,0,0.03); border-radius: 6px; padding: 6px 8px; font-size: 11px; border-left: 2px solid #00a884;">
                    <div style="font-weight: 600; margin-bottom: 2px; color: #111827;">${escapeHtml(log.description || '')}</div>
                    <div style="font-size: 9px; opacity: 0.6; display: flex; justify-content: space-between;">
                        <span>${escapeHtml(log.user || 'Kihap')}</span>
                        <span>${timeStr}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function formatPhone(phone) {
        const clean = (phone || '').replace(/\D/g, '');
        if (clean.length === 13 && clean.startsWith('55')) {
            return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
        }
        if (clean.length === 12 && clean.startsWith('55')) {
            return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
        }
        if (clean.length === 11) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
        }
        if (clean.length === 10) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
        }
        return phone;
    }

    function getInitials(name) {
        if (!name) return 'KH';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // Executa ao carregar
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();
