import { onAuthReady, checkAdminStatus } from './auth.js';
import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirm, showAlert } from './common-ui.js';

let activeSnapshotUnsubscribe = null;

export function setupContasMpPage() {
    onAuthReady(async (user) => {
        if (!user) return;
        const isAdmin = await checkAdminStatus(user);
        if (!isAdmin) {
            alert('Acesso negado. Apenas administradores podem gerenciar contas Mercado Pago.');
            window.location.href = 'index.html';
            return;
        }

        console.log("👤 Administrador autenticado em Contas MP:", user.email);
        
        setupLinkButton();
        checkUrlMessages();
        loadConnectedAccounts();
    });
}

function checkUrlMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const statusDiv = document.getElementById('oauth-status');
    if (!statusDiv) return;
    
    if (urlParams.get('success') === 'true') {
        statusDiv.textContent = `Conta vinculada com sucesso! (ID: ${urlParams.get('accountId')})`;
        statusDiv.className = "mt-4 p-3 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 block";
    } else if (urlParams.get('error') === 'true') {
        statusDiv.textContent = "Erro ao vincular a conta do Mercado Pago.";
        statusDiv.className = "mt-4 p-3 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 block";
    }
    
    // Limpa a URL sem dar refresh na página
    if (urlParams.has('success') || urlParams.has('error')) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function setupLinkButton() {
    const btnVincular = document.getElementById('btn-vincular');
    if (!btnVincular) return;
    
    btnVincular.addEventListener('click', () => {
        const labelInput = document.getElementById('account-label').value.trim();
        if (!labelInput) {
            showAlert('Por favor, informe o apelido da conta (ex: centro, coqueiros, asa-sul).', 'Atenção');
            return;
        }
        
        // Redireciona para o Cloud Function que inicia o OAuth do Mercado Pago
        const cloudFunctionUrl = 'https://us-central1-intranet-kihap.cloudfunctions.net/mpOAuthRedirect';
        window.location.href = `${cloudFunctionUrl}?state=${encodeURIComponent(labelInput)}`;
    });
}

function loadConnectedAccounts() {
    if (activeSnapshotUnsubscribe) {
        activeSnapshotUnsubscribe();
    }
    
    const tbody = document.getElementById('accounts-table-body');
    if (!tbody) return;

    const mpCollection = collection(db, 'mercadopagoAccounts');
    activeSnapshotUnsubscribe = onSnapshot(mpCollection, (snapshot) => {
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-400">Nenhuma conta vinculada ainda.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const acc = docSnap.data();
            const dateStr = acc.updatedAt ? acc.updatedAt.toDate().toLocaleDateString('pt-BR') : 'Desconhecido';
            
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group";
            
            tr.innerHTML = `
                <td class="p-4 font-semibold text-gray-900 dark:text-white font-mono">${acc.label || 'Sem Nome'}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 font-mono text-sm">${acc.userId || '—'}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 text-sm">${dateStr}</td>
                <td class="p-4 text-right">
                    <button class="delete-account-btn text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors text-sm"
                        data-id="${docSnap.id}" title="Remover Vínculo">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Configura ouvintes dos botões de exclusão usando showConfirm
        tbody.querySelectorAll('.delete-account-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const docId = btn.dataset.id;
                showConfirm(
                    'Tem certeza que deseja remover esta conta Mercado Pago? Produtos que dependem dela usarão a conta Matriz.',
                    async () => {
                        try {
                            await deleteDoc(doc(db, 'mercadopagoAccounts', docId));
                            showAlert('Vínculo da conta removido com sucesso.', 'Sucesso');
                        } catch (error) {
                            console.error('Erro ao deletar conta:', error);
                            showAlert('Erro ao remover conta: ' + error.message, 'Erro');
                        }
                    },
                    'Remover Vínculo'
                );
            });
        });
    }, (error) => {
        console.error("Erro ao carregar contas MP:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-red-500">Erro ao carregar as contas vinculadas.</td></tr>';
    });
}
