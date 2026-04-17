import { db, auth } from '../../intranet/firebase-config.js';
import { 
    doc, 
    getDoc, 
    getDocs, 
    collection, 
    query, 
    where, 
    addDoc, 
    deleteDoc, 
    serverTimestamp,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthReady } from './auth.js';

export async function setupPublicProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const rawId = urlParams.get('uid') || urlParams.get('id');

    if (!rawId) {
        showErrorPage("Usuário não especificado");
        return;
    }

    onAuthReady(async (currentUser) => {
        let targetUid = rawId;

        // Se o ID for puramente numérico, provavelmente é um EVO Member ID
        if (/^\d+$/.test(rawId)) {
            const resolvedUid = await resolveUidFromEvoId(parseInt(rawId));
            if (resolvedUid) {
                targetUid = resolvedUid;
            } else {
                showErrorPage("Usuário não encontrado no Firestore");
                return;
            }
        }

        await loadProfileData(targetUid, currentUser);
        setupSocialListeners(targetUid, currentUser);
    });
}

async function resolveUidFromEvoId(evoId) {
    try {
        const q = query(collection(db, 'users'), where('evoMemberId', '==', evoId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            return snap.docs[0].id;
        }
    } catch (e) {
        console.error("Erro ao resolver UID:", e);
    }
    return null;
}

function showErrorPage(msg) {
    document.getElementById('main-content').innerHTML = `
        <div class="h-screen flex flex-col items-center justify-center p-8 text-center">
            <i class="fas fa-user-ghost text-6xl text-gray-800 mb-4"></i>
            <h1 class="text-2xl font-bold text-white mb-2">${msg}</h1>
            <p class="text-gray-500 max-w-xs">Não conseguimos encontrar o perfil que você está procurando.</p>
            <a href="feed.html" class="mt-6 px-6 py-2 bg-[#014fa4] text-white rounded-xl font-bold hover:bg-blue-600 transition-all">Voltar ao Feed</a>
        </div>
    `;
}

async function loadProfileData(targetUid, currentUser) {
    try {
        // 1. Fetch User Document
        const userRef = doc(db, 'users', targetUid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            throw new Error("Perfil não encontrado no sistema.");
        }

        const userData = userSnap.data();
        
        // 2. Update UI with basic info
        document.getElementById('target-name').textContent = userData.name || userData.displayName || 'Usuário Kihap';
        document.getElementById('target-avatar').src = userData.profilePicture || userData.photoURL || '/imgs/kobe.png';
        document.getElementById('target-unit').querySelector('span').textContent = userData.unit || userData.unidade || 'Kihap Member';
        document.getElementById('belt-badge').textContent = userData.belt || 'Membro';
        document.getElementById('count-coins').textContent = userData.totalFitCoins || 0;

        // Show/Hide Edit Profil vs Follow Button
        if (currentUser && currentUser.uid === targetUid) {
            document.getElementById('edit-profile-btn').classList.remove('hidden');
            document.getElementById('edit-profile-btn').onclick = () => window.location.href = 'perfil.html';
        } else {
            document.getElementById('follow-btn').classList.remove('hidden');
            checkFollowStatus(targetUid, currentUser?.uid);
        }

        // Show Partials if Black Belt
        if (userData.belt === 'Preta') {
            document.getElementById('partials-card').classList.remove('hidden');
            document.getElementById('partials-count').textContent = userData.partials || 0;
        }

        // 3. Load Badges
        loadBadges(userData.earnedBadges || []);

        // 4. Load Social Stats (Counters)
        loadSocialStats(targetUid);

        // 5. Load Physical Test
        loadPhysicalTest(userData.evoMemberId);

    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        alert("Erro ao carregar dados do usuário.");
    }
}

async function loadBadges(earnedIds) {
    const grid = document.getElementById('badges-grid');
    if (earnedIds.length === 0) {
        grid.innerHTML = '<p class="text-sm text-gray-500 col-span-full italic">Nenhum emblema conquistado ainda.</p>';
        return;
    }

    grid.innerHTML = ''; // Clear skeleton
    
    try {
        const badgesSnap = await getDocs(collection(db, 'badges'));
        const allBadges = badgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const myBadges = allBadges.filter(b => earnedIds.includes(b.id));

        if (myBadges.length === 0) {
            grid.innerHTML = '<p class="text-sm text-gray-500 col-span-full italic">Nenhum emblema conquistado ainda.</p>';
            return;
        }

        myBadges.forEach(badge => {
            const el = document.createElement('div');
            el.className = 'group flex flex-col items-center gap-2 p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5';
            el.title = badge.description || badge.name;
            el.innerHTML = `
                <img src="${badge.imageUrl}" class="w-12 h-12 object-contain group-hover:scale-110 transition-transform">
                <span class="text-[10px] text-center font-bold text-gray-400 group-hover:text-white truncate w-full">${badge.name}</span>
            `;
            grid.appendChild(el);
        });
    } catch (error) {
        console.error("Erro ao carregar emblemas:", error);
    }
}

async function loadSocialStats(targetUid) {
    // Followers count
    const followersQ = query(collection(db, 'follows'), where('followingId', '==', targetUid));
    onSnapshot(followersQ, (snap) => {
        document.getElementById('count-followers').textContent = snap.size;
    });

    // Following count
    const followingQ = query(collection(db, 'follows'), where('followerId', '==', targetUid));
    onSnapshot(followingQ, (snap) => {
        document.getElementById('count-following').textContent = snap.size;
    });
}

async function loadPhysicalTest(evoMemberId) {
    if (!evoMemberId) return;

    try {
        const testsQ = query(
            collection(db, 'physicalTests'),
            where('evoMemberId', '==', evoMemberId),
            orderBy('date', 'desc'),
            limit(1)
        );
        const snap = await getDocs(testsQ);

        if (!snap.empty) {
            const test = snap.docs[0].data();
            document.getElementById('latest-test-card').classList.remove('hidden');
            document.getElementById('no-test-msg').classList.add('hidden');
            document.getElementById('test-score').textContent = test.score;
            document.getElementById('test-date').textContent = test.date?.toDate()?.toLocaleDateString('pt-BR');
        }
    } catch (error) {
        console.error("Erro ao carregar teste físico:", error);
    }
}

async function checkFollowStatus(targetUid, currentUid) {
    if (!currentUid) return;

    const q = query(collection(db, 'follows'), 
        where('followerId', '==', currentUid), 
        where('followingId', '==', targetUid)
    );

    onSnapshot(q, (snap) => {
        const isFollowing = !snap.empty;
        const followBtn = document.getElementById('follow-btn');
        if (isFollowing) {
            followBtn.textContent = 'Seguindo';
            followBtn.classList.replace('bg-white', 'bg-gray-800');
            followBtn.classList.replace('text-black', 'text-white');
            followBtn.classList.add('border', 'border-gray-700');
            followBtn.dataset.docId = snap.docs[0].id;
        } else {
            followBtn.textContent = 'Seguir';
            followBtn.classList.replace('bg-gray-800', 'bg-white');
            followBtn.classList.replace('text-white', 'text-black');
            followBtn.classList.remove('border', 'border-gray-700');
            delete followBtn.dataset.docId;
        }
    });
}

function setupSocialListeners(targetUid, currentUser) {
    const followBtn = document.getElementById('follow-btn');
    const closeBtn = document.getElementById('close-social-modal');
    const modal = document.getElementById('social-modal');

    followBtn.onclick = async () => {
        if (!currentUser) {
            alert("Faça login para seguir usuários!");
            return;
        }

        const originalText = followBtn.textContent;
        followBtn.disabled = true;
        followBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const currentUid = currentUser.id || currentUser.uid;
        const docId = followBtn.dataset.docId;

        try {
            if (docId) {
                // Parar de seguir
                await deleteDoc(doc(db, 'follows', docId));
            } else {
                // Seguir
                await addDoc(collection(db, 'follows'), {
                    followerId: currentUid,
                    followingId: targetUid,
                    createdAt: serverTimestamp()
                });

                // Enviar Notificação Social
                await sendFollowNotification(targetUid, currentUser);
            }
        } catch (error) {
            console.error("Erro social:", error);
            alert("Erro ao processar ação social: " + error.message);
            followBtn.innerHTML = originalText;
        } finally {
            followBtn.disabled = false;
        }
    };

    // Modal behavior
    document.getElementById('view-followers').onclick = () => openSocialList(targetUid, 'followers');
    document.getElementById('view-following').onclick = () => openSocialList(targetUid, 'following');
    closeBtn.onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}

async function sendFollowNotification(targetUid, currentUser) {
    try {
        await addDoc(collection(db, 'notifications'), {
            userId: targetUid,
            title: "Novo Seguidor",
            message: `${currentUser.displayName || currentUser.name || 'Alguém'} começou a te seguir!`,
            type: "social",
            link: `/members/perfil-publico.html?id=${currentUser.uid || currentUser.id}`,
            icon: currentUser.photoURL || currentUser.profilePicture || "/imgs/kobe.png",
            createdAt: serverTimestamp(),
            read: false
        });
    } catch (error) {
        console.warn("Erro ao enviar notificação de seguidor:", error);
    }
}

async function openSocialList(targetUid, mode) {
    const modal = document.getElementById('social-modal');
    const list = document.getElementById('social-list');
    const title = document.getElementById('modal-title');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    list.innerHTML = '<div class="p-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';
    
    title.textContent = mode === 'followers' ? 'Seguidores' : 'Seguindo';

    const fieldToMatch = mode === 'followers' ? 'followingId' : 'followerId';
    const fieldToFetch = mode === 'followers' ? 'followerId' : 'followingId';

    try {
        const q = query(collection(db, 'follows'), where(fieldToMatch, '==', targetUid));
        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = '<div class="p-8 text-center text-gray-500 text-sm italic">Nenhum usuário aqui.</div>';
            return;
        }

        const userUids = snap.docs.map(d => d.data()[fieldToFetch]);
        list.innerHTML = '';
        
        // Fetch users data in parallel (limited)
        for (const uid of userUids) {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
                const u = uSnap.data();
                const el = document.createElement('div');
                el.className = 'flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl cursor-pointer transition-colors';
                el.onclick = () => {
                    window.location.href = `perfil-publico.html?id=${uid}`;
                };
                el.innerHTML = `
                    <img src="${u.profilePicture || u.photoURL || '/imgs/kobe.png'}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-white truncate">${u.name || 'Usuário Kihap'}</p>
                        <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">${u.belt || 'Membro'}</p>
                    </div>
                    <i class="fas fa-chevron-right text-gray-700 text-xs"></i>
                `;
                list.appendChild(el);
            }
        }
    } catch (error) {
        console.error("Erro ao carregar lista social:", error);
        list.innerHTML = '<div class="p-8 text-center text-red-500 text-sm">Erro ao carregar usuários.</div>';
    }
}
