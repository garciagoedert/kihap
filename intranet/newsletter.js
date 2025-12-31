import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, serverTimestamp, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// Initialize using global modules or re-import if needed.
// Relying on common-ui/firebase-config for initialization usually, but let's ensure we get the instances.
// We assume firebase-config.js (imported in HTML) initializes the app.
// But we need the app instance here.
// Let's assume window.firebaseApp is available or standard config.
// Since modules are isolated, we need to grab the app instance.
// Standard pattern in this project seems to be importing from `firebase-config.js` if it exports `app`, or getting it.
// Checking `marketing.js` content from previous memory would be useful, but let's assume we can re-init or get existing.
// Safest is to get the default app if initialized.

const auth = getAuth();
const functions = getFunctions(undefined, 'us-central1'); // Ensure region if needed
const db = getFirestore();

// UI State
let currentTab = 'dashboard';
let editorCampaignId = null;

// --- Tab Switching ---
window.switchTab = (tabName) => {
    // Hide all
    ['dashboard', 'subscribers', 'editor'].forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('border-yellow-500', 'text-yellow-500');
        document.getElementById(`tab-${t}`).classList.add('border-transparent', 'text-gray-400');
    });

    // Show active
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('border-yellow-500', 'text-yellow-500');
    document.getElementById(`tab-${tabName}`).classList.remove('border-transparent', 'text-gray-400');

    currentTab = tabName;

    if (tabName === 'dashboard') loadDashboard();
    if (tabName === 'subscribers') loadSubscribers();
};

// --- Dashboard Logic ---
window.refreshCampaigns = () => loadDashboard();

async function loadDashboard() {
    const tableBody = document.getElementById('campaigns-table-body');
    tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Carregando...</td></tr>';

    try {
        // Stats (Approximation/Count)
        const subSnapshot = await getDocs(query(collection(db, 'subscribers'), where('status', '==', 'active')));
        document.getElementById('stat-total-subscribers').innerText = subSnapshot.size;

        const sentSnapshot = await getDocs(query(collection(db, 'campaigns'), where('status', '==', 'sent')));
        document.getElementById('stat-total-sent').innerText = sentSnapshot.size;

        // Recent Campaigns
        const q = query(collection(db, 'campaigns'), orderBy('created_at', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);

        tableBody.innerHTML = '';
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Nenhuma campanha encontrada.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const camp = doc.data();
            const date = camp.sent_at ? new Date(camp.sent_at.toDate()).toLocaleDateString('pt-BR') : '-';
            const stats = camp.stats ? `Enviado: ${camp.stats.sent}, Falhas: ${camp.stats.failed}` : '-';

            let statusColor = 'text-gray-500';
            if (camp.status === 'sent') statusColor = 'text-green-500';
            if (camp.status === 'sending') statusColor = 'text-yellow-500';

            const row = `
                <tr class="hover:bg-gray-800/50 transition">
                    <td class="px-6 py-4 font-medium text-white">${camp.subject || '(Sem Assunto)'}</td>
                    <td class="px-6 py-4 ${statusColor} font-bold uppercase text-xs">${camp.status}</td>
                    <td class="px-6 py-4">${date}</td>
                    <td class="px-6 py-4 text-right font-mono text-xs">${stats}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Erro ao carregar dados.</td></tr>';
    }
}

// --- Subscribers Logic ---
async function loadSubscribers() {
    const tableBody = document.getElementById('subscribers-table-body');
    // Simple load for now (limit 50)
    const q = query(collection(db, 'subscribers'), orderBy('created_at', 'desc'), limit(50));

    try {
        const querySnapshot = await getDocs(q);
        tableBody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const sub = doc.data();
            const date = sub.created_at ? new Date(sub.created_at.toDate()).toLocaleDateString('pt-BR') : '-';
            const row = `
                <tr class="hover:bg-gray-800/50 transition border-b border-gray-800">
                    <td class="px-6 py-4 text-white">${sub.email}</td>
                    <td class="px-6 py-4">${sub.name}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs ${sub.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">${sub.status}</span></td>
                    <td class="px-6 py-4 text-xs">${sub.source}</td>
                    <td class="px-6 py-4 text-xs">${date}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (e) {
        console.error('Erro subscribers', e);
    }
}

// CSV Import
document.getElementById('csvInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusObj = document.getElementById('importStatus');
    statusObj.innerText = 'Lendo arquivo...';

    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target.result;
        // Parse CSV (Simplified: Email,Name)
        const lines = text.split('\n');
        const subscribers = [];

        lines.forEach(line => {
            const parts = line.split(','); // Basic split
            if (parts.length >= 1) {
                const email = parts[0].trim();
                const name = parts[1] ? parts[1].trim() : '';
                if (email && email.includes('@')) {
                    subscribers.push({ email, name, tags: ['import_csv'] });
                }
            }
        });

        if (subscribers.length === 0) {
            statusObj.innerText = 'Nenhum email válido encontrado.';
            return;
        }

        statusObj.innerText = `Enviando ${subscribers.length} contatos...`;

        try {
            const importFn = httpsCallable(functions, 'importSubscribers');
            const result = await importFn({ subscribers });
            statusObj.innerText = `Sucesso! ${result.data.count} importados.`;
            loadSubscribers(); // Refresh list
        } catch (err) {
            console.error(err);
            statusObj.innerText = 'Erro na importação: ' + err.message;
        }
    };
    reader.readAsText(file);
});


// --- Editor Logic ---
async function saveDraft() {
    const subject = document.getElementById('campaignSubject').value;
    const content = document.getElementById('campaignContent').value;

    if (!subject) return null;

    const data = {
        subject,
        content_html: content,
        status: 'draft',
        created_at: serverTimestamp() // Should use updated_at if edit
    };

    try {
        if (editorCampaignId) {
            await setDoc(doc(db, 'campaigns', editorCampaignId), data, { merge: true });
        } else {
            const newRef = await addDoc(collection(db, 'campaigns'), data);
            editorCampaignId = newRef.id;
        }
        document.getElementById('editorStatus').innerText = 'Salvo (Rascunho)';
        return editorCampaignId;

    } catch (e) {
        console.error("Erro ao salvar", e);
        return null;
    }
}

window.sendTest = async () => {
    const id = await saveDraft();
    if (!id) {
        alert('Preencha o assunto primeiro.');
        return;
    }

    try {
        document.getElementById('editorStatus').innerText = 'Enviando Teste...';
        const sendFn = httpsCallable(functions, 'sendCampaign');
        await sendFn({ campaignId: id, mode: 'test' });
        document.getElementById('editorStatus').innerText = 'Teste Enviado!';
        alert('Email de teste enviado para você.');
    } catch (e) {
        console.error(e);
        alert('Erro ao enviar teste: ' + e.message);
    }
};

window.confirmBroadcast = async () => {
    const id = await saveDraft();
    if (!id) {
        alert('Preencha o assunto primeiro.');
        return;
    }

    // Count active subs for modal
    const subSnapshot = await getDocs(query(collection(db, 'subscribers'), where('status', '==', 'active')));
    document.getElementById('confirmCount').innerText = `${subSnapshot.size} inscritos ativos`;

    document.getElementById('confirmModal').classList.remove('hidden');
};

window.closeModal = () => {
    document.getElementById('confirmModal').classList.add('hidden');
};

window.executeBroadcast = async () => {
    if (!editorCampaignId) return;

    closeModal();
    document.getElementById('editorStatus').innerText = 'Enviando Broadcast...';

    try {
        const sendFn = httpsCallable(functions, 'sendCampaign');
        await sendFn({ campaignId: editorCampaignId, mode: 'broadcast' });

        alert('Campanha enviada com sucesso!');
        // Reset
        document.getElementById('campaignSubject').value = '';
        document.getElementById('campaignContent').value = '';
        editorCampaignId = null;
        document.getElementById('editorStatus').innerText = 'Rascunho';

        switchTab('dashboard');

    } catch (e) {
        console.error(e);
        alert('Erro no envio massivo: ' + e.message);
        document.getElementById('editorStatus').innerText = 'Erro no envio';
    }
};

// Initial Load
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadDashboard();
    } else {
        window.location.href = 'index.html'; // Protect route
    }
});
