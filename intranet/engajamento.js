import { auth, db, functions } from './firebase-config.js';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

const DEFAULT_SEED_REWARDS = [
    {
        id: 'streak_shield',
        title: 'Escudo de Chama',
        description: 'Protege sua ofensiva caso você fique até 10 dias sem conseguir treinar.',
        cost: 50,
        type: 'streak_shield',
        category: 'digital',
        icon: '🛡️',
        active: true,
    },
    {
        id: 'frame_gold',
        title: 'Moldura Dourada Kihap',
        description: 'Borda dourada exclusiva no seu avatar no Perfil e no Ranking.',
        cost: 80,
        type: 'avatar_frame',
        category: 'digital',
        frameId: 'gold',
        icon: '👑',
        active: true,
    },
    {
        id: 'frame_flame',
        title: 'Moldura Chama Suprema',
        description: 'Aura em chamas no seu avatar para destacar sua constância no tatame.',
        cost: 120,
        type: 'avatar_frame',
        category: 'digital',
        frameId: 'flame',
        icon: '🔥',
        active: true,
    },
    {
        id: 'littles_pack',
        title: 'Figurinha Surpresa Littles',
        description: 'Desbloqueia uma figurinha especial da turma Kihap Littles no seu álbum.',
        cost: 60,
        type: 'littles_pack',
        category: 'digital',
        icon: '🐼',
        active: true,
    },
    {
        id: 'coupon_10',
        title: 'Cupom 10% na Loja Oficial',
        description: 'Cupom de uso único de 10% de desconto na Loja Oficial Kihap.',
        cost: 150,
        type: 'coupon',
        category: 'store',
        discountPercent: 10,
        icon: '🎟️',
        active: true,
    },
    {
        id: 'chaveiro_kihap',
        title: 'Chaveiro / Adesivo Kihap',
        description: 'Brinde exclusivo para retirar na recepção da sua unidade.',
        cost: 100,
        type: 'physical',
        category: 'store',
        icon: '🥋',
        active: true,
    },
    {
        id: 'vip_friend_pass',
        title: 'Passe VIP Aula Experimental',
        description: 'Convite para trazer um amigo ou familiar para treinar junto com você.',
        cost: 80,
        type: 'experience',
        category: 'store',
        icon: '🤝',
        active: true,
    },
];

export function setupEngajamentoPage() {
    const tabBtns = document.querySelectorAll('.eng-tab-btn');
    const tabPanels = document.querySelectorAll('.eng-tab-panel');

    const switchTab = (tabId) => {
        tabBtns.forEach((btn) => {
            const active = btn.getAttribute('data-eng-tab') === tabId;
            if (active) {
                btn.classList.add('bg-black', 'text-white', 'dark:bg-yellow-500', 'dark:text-black');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.remove('bg-black', 'text-white', 'dark:bg-yellow-500', 'dark:text-black');
                btn.classList.add('text-gray-500');
            }
        });
        tabPanels.forEach((panel) => {
            panel.classList.toggle('hidden', panel.id !== `tab-${tabId}`);
        });

        if (tabId === 'coins') {
            loadRedemptions();
            loadRewards();
        } else if (tabId === 'copa') {
            loadCopa(false);
        } else if (tabId === 'termometro') {
            loadFeedback();
        } else if (tabId === 'config') {
            loadSocialSettings();
            loadPendingStories();
        }
    };

    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-eng-tab')));
    });

    // =====================================================
    // TAB 1: QUIZ SEMANAL
    // =====================================================
    const quizzesList = document.getElementById('quizzes-list');
    const quizForm = document.getElementById('quiz-form');

    const loadQuizzes = async () => {
        if (!quizzesList) return;
        quizzesList.innerHTML = 'Carregando perguntas...';
        try {
            const snap = await getDocs(collection(db, 'weekly_quizzes'));
            if (snap.empty) {
                quizzesList.innerHTML = '<div class="text-xs text-gray-400">Nenhuma pergunta customizada ainda. O app usa automaticamente a rotação de 8 perguntas padrão da Kihap.</div>';
                return;
            }
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            quizzesList.innerHTML = '';
            items.forEach((qItem) => {
                const div = document.createElement('div');
                div.className = 'p-4 rounded-2xl bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3';
                div.innerHTML = `
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${qItem.active !== false ? 'bg-emerald-500/15 text-emerald-600' : 'bg-gray-300 text-gray-700'}">
                                ${qItem.active !== false ? 'Ativo' : 'Pausado'}
                            </span>
                            <span class="text-[11px] font-bold text-yellow-600">+${qItem.rewardCoins || 15} Coins</span>
                        </div>
                        <div class="font-bold text-gray-900 dark:text-white text-sm">${qItem.question}</div>
                        <div class="text-xs text-gray-500 mt-1">Correta: <strong>${(qItem.options || [])[qItem.correctIndex] || '-'}</strong></div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" class="toggle-quiz-btn px-3 py-1.5 rounded-xl bg-white dark:bg-[#333] border border-gray-200 dark:border-gray-700 text-xs font-bold">
                            ${qItem.active !== false ? 'Pausar' : 'Ativar'}
                        </button>
                        <button type="button" class="del-quiz-btn px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold">
                            Excluir
                        </button>
                    </div>
                `;
                div.querySelector('.toggle-quiz-btn').addEventListener('click', async () => {
                    await updateDoc(doc(db, 'weekly_quizzes', qItem.id), { active: !(qItem.active !== false), updatedAt: serverTimestamp() });
                    loadQuizzes();
                });
                div.querySelector('.del-quiz-btn').addEventListener('click', async () => {
                    if (confirm('Excluir esta pergunta do Quiz?')) {
                        await deleteDoc(doc(db, 'weekly_quizzes', qItem.id));
                        loadQuizzes();
                    }
                });
                quizzesList.appendChild(div);
            });
        } catch (err) {
            console.error('Erro ao listar quizzes:', err);
            quizzesList.innerHTML = '<div class="text-red-500 text-xs">Erro ao carregar perguntas.</div>';
        }
    };

    quizForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        const question = document.getElementById('quiz-question').value.trim();
        const options = ['quiz-opt-0', 'quiz-opt-1', 'quiz-opt-2', 'quiz-opt-3']
            .map((id) => document.getElementById(id).value.trim())
            .filter(Boolean);
        const correctIndex = parseInt(document.getElementById('quiz-correct-index').value, 10) || 0;
        const rewardCoins = Math.min(50, Math.max(5, parseInt(document.getElementById('quiz-reward').value, 10) || 15));
        const explanation = document.getElementById('quiz-explanation').value.trim();

        if (options.length < 2) {
            alert('Preencha pelo menos 2 opções!');
            return;
        }
        if (correctIndex >= options.length) {
            alert('A opção correta selecionada não foi preenchida.');
            return;
        }

        try {
            await addDoc(collection(db, 'weekly_quizzes'), {
                question,
                options,
                correctIndex,
                rewardCoins,
                explanation,
                active: true,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            });
            quizForm.reset();
            loadQuizzes();
        } catch (err) {
            console.error('Erro ao salvar quiz:', err);
            alert('Erro ao salvar pergunta: ' + (err.message || err));
        }
    });

    // =====================================================
    // TAB 2: CLUBE DE COINS & RESGATES
    // =====================================================
    const redemptionsList = document.getElementById('redemptions-list');
    const redemptionsFilter = document.getElementById('redemptions-filter');
    const rewardsList = document.getElementById('rewards-list');
    const rewardForm = document.getElementById('reward-form');
    const seedRewardsBtn = document.getElementById('seed-rewards-btn');

    const loadRedemptions = async () => {
        if (!redemptionsList) return;
        redemptionsList.innerHTML = 'Carregando resgates...';
        try {
            const filterVal = redemptionsFilter?.value || 'pending';
            const snap = await getDocs(query(collection(db, 'coin_redemptions'), orderBy('createdAt', 'desc'), limit(100)));
            let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (filterVal !== 'all') {
                items = items.filter((r) => r.status === filterVal);
            }
            if (items.length === 0) {
                redemptionsList.innerHTML = '<div class="text-xs text-gray-400">Nenhum resgate neste filtro.</div>';
                return;
            }
            redemptionsList.innerHTML = '';
            items.forEach((r) => {
                const div = document.createElement('div');
                div.className = 'p-4 rounded-2xl bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
                div.innerHTML = `
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-gray-900 dark:text-white">${r.userName || 'Aluno'}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-[#333] uppercase font-bold">${r.unitId || 'kihap'}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${r.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'}">
                                ${r.status === 'delivered' ? 'Entregue / Ativo' : 'Pendente'}
                            </span>
                        </div>
                        <div class="text-xs text-gray-600 dark:text-gray-300">
                            ${r.rewardTitle} • <strong>${r.cost} Coins</strong> ${r.voucherCode ? `• Voucher: <code class="px-1.5 py-0.5 bg-black text-yellow-400 rounded font-bold">${r.voucherCode}</code>` : ''}
                        </div>
                    </div>
                    ${r.status !== 'delivered' ? `
                        <button type="button" class="deliver-btn px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase">
                            Marcar como Entregue
                        </button>
                    ` : ''}
                `;
                const deliverBtn = div.querySelector('.deliver-btn');
                if (deliverBtn) {
                    deliverBtn.addEventListener('click', async () => {
                        const user = auth.currentUser;
                        if (!user) return;
                        await updateDoc(doc(db, 'coin_redemptions', r.id), {
                            status: 'delivered',
                            deliveredAt: serverTimestamp(),
                            deliveredBy: user.uid,
                        });
                        loadRedemptions();
                    });
                }
                redemptionsList.appendChild(div);
            });
        } catch (err) {
            console.error('Erro ao carregar resgates:', err);
            redemptionsList.innerHTML = '<div class="text-red-500 text-xs">Erro ao carregar resgates.</div>';
        }
    };

    redemptionsFilter?.addEventListener('change', loadRedemptions);

    const loadRewards = async () => {
        if (!rewardsList) return;
        rewardsList.innerHTML = 'Carregando catálogo...';
        try {
            const snap = await getDocs(collection(db, 'coin_rewards'));
            if (snap.empty) {
                rewardsList.innerHTML = '<div class="col-span-full text-xs text-gray-400">Nenhum item customizado em <code>coin_rewards</code> (clique em Popular Catálogo Padrão para editar os itens padrão).</div>';
                return;
            }
            rewardsList.innerHTML = '';
            snap.docs.forEach((docSnap) => {
                const rw = { id: docSnap.id, ...docSnap.data() };
                const div = document.createElement('div');
                div.className = 'p-4 rounded-2xl bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3';
                div.innerHTML = `
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="text-2xl">${rw.icon || '🎁'}</span>
                        <div class="min-w-0">
                            <div class="font-bold text-gray-900 dark:text-white text-sm truncate">${rw.title}</div>
                            <div class="text-xs text-yellow-600 font-bold">${rw.cost} Coins • ${rw.type}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" class="toggle-rw-btn px-2.5 py-1 rounded-lg bg-white dark:bg-[#333] border border-gray-200 dark:border-gray-700 text-[11px] font-bold">
                            ${rw.active !== false ? 'Ativo' : 'Inativo'}
                        </button>
                        <button type="button" class="del-rw-btn px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 text-[11px] font-bold">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                div.querySelector('.toggle-rw-btn').addEventListener('click', async () => {
                    await updateDoc(doc(db, 'coin_rewards', rw.id), { active: !(rw.active !== false), updatedAt: serverTimestamp() });
                    loadRewards();
                });
                div.querySelector('.del-rw-btn').addEventListener('click', async () => {
                    if (confirm(`Remover "${rw.title}" do catálogo?`)) {
                        await deleteDoc(doc(db, 'coin_rewards', rw.id));
                        loadRewards();
                    }
                });
                rewardsList.appendChild(div);
            });
        } catch (err) {
            console.error('Erro ao carregar recompensas:', err);
            rewardsList.innerHTML = '<div class="text-red-500 text-xs">Erro ao carregar catálogo.</div>';
        }
    };

    seedRewardsBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        seedRewardsBtn.disabled = true;
        try {
            await Promise.all(
                DEFAULT_SEED_REWARDS.map((r) =>
                    setDoc(doc(db, 'coin_rewards', r.id), {
                        ...r,
                        createdBy: user.uid,
                        createdAt: serverTimestamp(),
                    }, { merge: true })
                )
            );
            loadRewards();
        } catch (err) {
            alert('Erro ao popular catálogo: ' + (err.message || err));
        } finally {
            seedRewardsBtn.disabled = false;
        }
    });

    rewardForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        const title = document.getElementById('reward-title').value.trim();
        const cost = parseInt(document.getElementById('reward-cost').value, 10);
        const type = document.getElementById('reward-type').value;
        const description = document.getElementById('reward-description').value.trim();
        const icon = document.getElementById('reward-icon').value.trim() || '🎁';
        const category = ['streak_shield', 'avatar_frame', 'littles_pack'].includes(type) ? 'digital' : 'store';

        if (!title || !cost || cost <= 0) return;

        try {
            await addDoc(collection(db, 'coin_rewards'), {
                title,
                description,
                cost,
                type,
                category,
                icon,
                active: true,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            });
            rewardForm.reset();
            loadRewards();
        } catch (err) {
            alert('Erro ao adicionar recompensa: ' + (err.message || err));
        }
    });

    // =====================================================
    // TAB 3: COPA DAS UNIDADES
    // =====================================================
    const copaList = document.getElementById('copa-standings-list');
    const refreshCopaBtn = document.getElementById('refresh-copa-btn');

    const loadCopa = async (forceRefresh = false) => {
        if (!copaList) return;
        copaList.innerHTML = '<div class="text-xs text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Calculando placar...</div>';
        try {
            const getCopaFn = httpsCallable(functions, 'getCopaUnidades');
            const res = await getCopaFn({ forceRefresh });
            const standings = res?.data?.standings || [];
            if (standings.length === 0) {
                copaList.innerHTML = '<div class="text-xs text-gray-400">Sem dados neste mês.</div>';
                return;
            }
            const maxScore = Math.max(1, ...standings.map((s) => s.score || 0));
            const medals = ['🥇', '🥈', '🥉'];
            copaList.innerHTML = '';
            standings.forEach((u, idx) => {
                const pct = Math.round(((u.score || 0) / maxScore) * 100);
                const row = document.createElement('div');
                row.className = 'p-4 rounded-2xl bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-800';
                row.innerHTML = `
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <span class="text-lg font-bold">${idx < 3 ? medals[idx] : `#${idx + 1}`}</span>
                            <span class="font-bold text-gray-900 dark:text-white">${u.unitName}</span>
                        </div>
                        <div class="text-right">
                            <span class="font-extrabold text-yellow-600 dark:text-yellow-400">${u.score} pts</span>
                            <span class="text-xs text-gray-400 ml-2">(${u.totalCheckins} check-ins • ${u.participatingStudents} alunos)</span>
                        </div>
                    </div>
                    <div class="w-full h-2 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
                        <div class="h-full bg-yellow-500 rounded-full" style="width: ${pct}%"></div>
                    </div>
                `;
                copaList.appendChild(row);
            });
        } catch (err) {
            console.error('Erro Copa:', err);
            copaList.innerHTML = '<div class="text-red-500 text-xs">Erro ao calcular Copa das Unidades.</div>';
        }
    };

    refreshCopaBtn?.addEventListener('click', () => loadCopa(true));

    // =====================================================
    // TAB 4: TERMÔMETRO DE TREINOS
    // =====================================================
    const feedbackList = document.getElementById('feedback-list');
    const feedbackUnitFilter = document.getElementById('feedback-unit-filter');

    const loadFeedback = async () => {
        if (!feedbackList) return;
        feedbackList.innerHTML = 'Carregando avaliações...';
        try {
            const snap = await getDocs(query(collection(db, 'workout_feedback'), orderBy('createdAt', 'desc'), limit(150)));
            let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const unitFilter = feedbackUnitFilter?.value || 'all';
            if (unitFilter !== 'all') {
                items = items.filter((f) => f.unitId === unitFilter);
            }

            const total = items.length || 1;
            const incrivel = items.filter((f) => f.mood === 'incrivel').length;
            const desafiador = items.filter((f) => f.mood === 'desafiador').length;
            const tranquilo = items.filter((f) => f.mood === 'tranquilo').length;

            document.getElementById('stat-incrivel').textContent = `${Math.round((incrivel / total) * 100)}% (${incrivel})`;
            document.getElementById('stat-desafiador').textContent = `${Math.round((desafiador / total) * 100)}% (${desafiador})`;
            document.getElementById('stat-tranquilo').textContent = `${Math.round((tranquilo / total) * 100)}% (${tranquilo})`;

            if (items.length === 0) {
                feedbackList.innerHTML = '<div class="text-xs text-gray-400">Nenhuma avaliação registrada neste filtro ainda.</div>';
                return;
            }
            const moodLabels = {
                incrivel: '🔥 Incrível',
                desafiador: '💪 Desafiador',
                tranquilo: '😊 Tranquilo',
            };
            feedbackList.innerHTML = '';
            items.slice(0, 50).forEach((f) => {
                const div = document.createElement('div');
                div.className = 'p-3.5 rounded-xl bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3';
                div.innerHTML = `
                    <div>
                        <div class="font-bold text-xs text-gray-900 dark:text-white">${f.userName || 'Aluno'} <span class="text-gray-400 font-normal">• ${f.unitId || 'kihap'} • ${f.dateStr || ''}</span></div>
                        ${Array.isArray(f.focusTags) && f.focusTags.length > 0 ? `<div class="text-[11px] text-gray-500 mt-0.5">Foco: ${f.focusTags.join(', ')}</div>` : ''}
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-white dark:bg-[#333] border border-gray-200 dark:border-gray-700 text-xs font-bold">${moodLabels[f.mood] || f.mood}</span>
                `;
                feedbackList.appendChild(div);
            });
        } catch (err) {
            console.error('Erro feedback:', err);
            feedbackList.innerHTML = '<div class="text-red-500 text-xs">Erro ao carregar termômetro.</div>';
        }
    };

    feedbackUnitFilter?.addEventListener('change', loadFeedback);

    // =====================================================
    // TAB 5: STORIES & SEGURANÇA SOCIAL
    // =====================================================
    const socialSettingsForm = document.getElementById('social-settings-form');
    const pendingStoriesList = document.getElementById('pending-stories-list');

    const loadSocialSettings = async () => {
        try {
            const snap = await getDoc(doc(db, 'config', 'social_settings'));
            const data = snap.exists() ? snap.data() : {};
            const allowChk = document.getElementById('cfg-allow-student-stories');
            const modChk = document.getElementById('cfg-require-moderation');
            if (allowChk) allowChk.checked = Boolean(data.allowStudentStories);
            if (modChk) modChk.checked = data.requireStoryModeration !== false;
        } catch (err) {
            console.error('Erro config social:', err);
        }
    };

    socialSettingsForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        const allowStudentStories = Boolean(document.getElementById('cfg-allow-student-stories')?.checked);
        const requireStoryModeration = Boolean(document.getElementById('cfg-require-moderation')?.checked);
        try {
            await setDoc(doc(db, 'config', 'social_settings'), {
                allowStudentStories,
                requireStoryModeration,
                updatedAt: serverTimestamp(),
                updatedBy: user.uid,
            }, { merge: true });
            alert('Configurações sociais salvas com sucesso!');
        } catch (err) {
            alert('Erro ao salvar configurações: ' + (err.message || err));
        }
    });

    const loadPendingStories = async () => {
        if (!pendingStoriesList) return;
        try {
            const snap = await getDocs(query(collection(db, 'stories'), where('moderationStatus', '==', 'pending')));
            if (snap.empty) {
                pendingStoriesList.innerHTML = '<div class="text-xs text-gray-400">Nenhum story aguardando moderação.</div>';
                return;
            }
            pendingStoriesList.innerHTML = '';
            snap.docs.forEach((d) => {
                const st = { id: d.id, ...d.data() };
                const row = document.createElement('div');
                row.className = 'p-3.5 rounded-2xl bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3';
                row.innerHTML = `
                    <div>
                        <div class="font-bold text-xs text-gray-900 dark:text-white">${st.authorName || 'Aluno'}</div>
                        <a href="${st.mediaUrl}" target="_blank" class="text-[11px] text-blue-500 underline">Visualizar mídia</a>
                    </div>
                    <div class="flex gap-2">
                        <button type="button" class="approve-st-btn px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold">Aprovar</button>
                        <button type="button" class="reject-st-btn px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold">Rejeitar</button>
                    </div>
                `;
                row.querySelector('.approve-st-btn').addEventListener('click', async () => {
                    await updateDoc(doc(db, 'stories', st.id), { moderationStatus: 'approved' });
                    loadPendingStories();
                });
                row.querySelector('.reject-st-btn').addEventListener('click', async () => {
                    await updateDoc(doc(db, 'stories', st.id), { moderationStatus: 'rejected' });
                    loadPendingStories();
                });
                pendingStoriesList.appendChild(row);
            });
        } catch (err) {
            console.error('Erro fila stories:', err);
            pendingStoriesList.innerHTML = '<div class="text-red-500 text-xs">Erro ao carregar fila de moderação.</div>';
        }
    };

    loadQuizzes();
}
