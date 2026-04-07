const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            checkAdminAndLoadData(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });
});

async function checkAdminAndLoadData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data().isAdmin) {
            loadConnectedAccounts();
            setupLinkButton();
            checkUrlMessages();
        } else {
            alert('Acesso negado.');
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Erro ao verificar admin:", error);
    }
}

function checkUrlMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const statusDiv = document.getElementById('oauth-status');
    
    if (urlParams.get('success') === 'true') {
        statusDiv.textContent = `Conta vinculada com sucesso! (ID: ${urlParams.get('accountId')})`;
        statusDiv.className = "mt-4 text-sm font-semibold text-green-500 block";
    } else if (urlParams.get('error') === 'true') {
        statusDiv.textContent = "Erro ao vincular a conta do Mercado Pago.";
        statusDiv.className = "mt-4 text-sm font-semibold text-red-500 block";
    }
    
    // Clear URL to prevent showing message on refresh
    if (urlParams.has('success') || urlParams.has('error')) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function setupLinkButton() {
    const btnVincular = document.getElementById('btn-vincular');
    btnVincular.addEventListener('click', () => {
        const labelInput = document.getElementById('account-label').value.trim();
        if (!labelInput) {
            alert('Por favor, informe um nome ou apelido para essa conta (ex: Unidade Sul).');
            return;
        }
        
        // Redireciona para o Cloud Function que constrói a URL e manda pro MP
        const cloudFunctionUrl = 'https://us-central1-intranet-kihap.cloudfunctions.net/mpOAuthRedirect';
        window.location.href = `${cloudFunctionUrl}?state=${encodeURIComponent(labelInput)}`;
    });
}

function loadConnectedAccounts() {
    db.collection('mercadopagoAccounts').onSnapshot(snapshot => {
        const tbody = document.getElementById('accounts-table-body');
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-400">Nenhuma conta vinculada ainda.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const acc = doc.data();
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-750";
            
            const dateStr = acc.updatedAt ? acc.updatedAt.toDate().toLocaleDateString('pt-BR') : 'Desconhecido';
            
            tr.innerHTML = `
                <td class="py-3 px-4 text-white font-medium">${acc.label || 'Sem Nome'}</td>
                <td class="py-3 px-4 text-gray-300">${acc.userId}</td>
                <td class="py-3 px-4 text-gray-400 text-sm">${dateStr}</td>
                <td class="py-3 px-4 text-right">
                    <button onclick="deleteAccount('${doc.id}')" class="text-red-500 hover:text-red-400 transition" title="Remover Vínculo">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

window.deleteAccount = async function(docId) {
    if (confirm('Tem certeza que deseja remover esta conta Mercado Pago? Produtos que dependem dela usarão a conta Matriz.')) {
        try {
            await db.collection('mercadopagoAccounts').doc(docId).delete();
            alert('Conta removida com sucesso.');
        } catch (error) {
            console.error('Erro ao deletar conta:', error);
            alert('Erro ao remover conta.');
        }
    }
}
