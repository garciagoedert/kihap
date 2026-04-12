import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getCurrentUser } from './auth.js';
import { loadComponents, showAlert, showConfirm } from './common-ui.js';

const functions = getFunctions(undefined, 'us-central1');

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    
    const user = await getCurrentUser();
    if (!user || user.isAdmin !== true) {
        window.location.href = 'index.html';
        return;
    }

    initEventListeners();
    loadUnits();
    loadHistory();
});

function initEventListeners() {
    const recipientType = document.getElementById('recipient-type');
    const unitSelector = document.getElementById('unit-selector');
    const studentSelector = document.getElementById('student-selector');
    const form = document.getElementById('notification-form');
    
    // Toggle selectors based on recipient type
    recipientType.addEventListener('change', () => {
        unitSelector.classList.add('hidden');
        studentSelector.classList.add('hidden');
        
        if (recipientType.value === 'unit') unitSelector.classList.remove('hidden');
        if (recipientType.value === 'individual') studentSelector.classList.remove('hidden');
    });

    // Live Preview Update
    const titleInput = document.getElementById('notif-title');
    const messageInput = document.getElementById('notif-message');
    const typeSelect = document.getElementById('notif-type');
    
    const updatePreview = () => {
        document.getElementById('preview-title').textContent = titleInput.value || 'Título do Aviso';
        document.getElementById('preview-message').textContent = messageInput.value || 'Sua mensagem aparecerá aqui...';
        
        const type = typeSelect.value;
        const iconEl = document.getElementById('preview-icon');
        const iconBg = document.getElementById('preview-icon-bg');
        
        if (type === 'chat') {
            iconEl.className = 'fas fa-comments text-black';
            iconBg.className = 'w-10 h-10 rounded-full bg-green-500 flex items-center justify-center';
        } else if (type === 'trello') {
            iconEl.className = 'fas fa-tasks text-black';
            iconBg.className = 'w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center';
        } else {
            iconEl.className = 'fas fa-bullhorn text-black';
            iconBg.className = 'w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center';
        }
    };

    titleInput.addEventListener('input', updatePreview);
    messageInput.addEventListener('input', updatePreview);
    typeSelect.addEventListener('change', updatePreview);

    // Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const recipientType = document.getElementById('recipient-type').value;
        const title = titleInput.value;
        const message = messageInput.value;
        const type = typeSelect.value;
        const link = document.getElementById('notif-link').value;
        
        let targetValue = '';
        if (recipientType === 'unit') targetValue = document.getElementById('target-unit').value;
        if (recipientType === 'individual') targetValue = document.getElementById('target-student').value;

        showConfirm(`Deseja enviar este comunicado para ${recipientType === 'all' ? 'TODOS os usuários' : 'os destinatários selecionados'}?`, async () => {
            try {
                const submitBtn = document.getElementById('submit-notif');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

                const sendNotification = httpsCallable(functions, 'sendNotification');
                const result = await sendNotification({
                    target: recipientType,
                    targetValue,
                    title,
                    message,
                    type,
                    link
                });

                showAlert(`Sucesso! Notificação enviada para ${result.data.recipientsCount} destinatários.`, "Comunicado Enviado");
                form.reset();
                updatePreview();
                loadHistory();
            } catch (error) {
                console.error("Erro ao enviar comunicado:", error);
                showAlert("Erro ao enviar comunicado: " + error.message, "Erro");
            } finally {
                const submitBtn = document.getElementById('submit-notif');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Notificação';
            }
        });
    });

    document.getElementById('refresh-history').addEventListener('click', loadHistory);
}

async function loadUnits() {
    const unitSelect = document.getElementById('target-unit');
    try {
        const querySnapshot = await getDocs(collection(db, 'units'));
        unitSelect.innerHTML = querySnapshot.docs.map(doc => `<option value="${doc.id}">${doc.data().name}</option>`).join('');
    } catch (error) {
        console.error("Error loading units:", error);
    }
}

async function loadHistory() {
    const historyList = document.getElementById('notifications-history');
    try {
        // We will fetch the last 15 notifications from the 'notifications' collection
        // But since they are per-user, it's hard to see "broadcasts" in a unified list 
        // unless we log broadcasts separately. 
        // For now, I'll just show the latest notifications regardless of user.
        const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(15));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            historyList.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Nenhum comunicado recente.</div>';
            return;
        }

        historyList.innerHTML = querySnapshot.docs.map(doc => {
            const n = doc.data();
            const date = n.createdAt?.toDate()?.toLocaleString('pt-BR') || 'Recent';
            return `
                <div class="p-4 hover:bg-gray-800/30 transition-colors">
                    <div class="flex justify-between items-start mb-1">
                        <p class="text-sm font-bold text-white">${n.title}</p>
                        <span class="text-[10px] text-gray-500">${date}</span>
                    </div>
                    <p class="text-xs text-gray-400 line-clamp-1">${n.message}</p>
                    <p class="text-[9px] text-gray-600 mt-1 uppercase font-bold tracking-tighter">Para UID: ${n.userId}</p>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Error loading history:", error);
    }
}
