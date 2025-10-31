import { db } from './firebase-config.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser, checkAdminStatus } from './auth.js';

const faixas = [
    "Branca Recomendada", "Branca Decidida", "Laranja Recomendada", "Laranja Decidida",
    "Amarela Recomendada", "Amarela Decidida", "Camuflada Recomendada", "Camuflada Decidida",
    "Verde Recomendada", "Verde Decidida", "Roxa Recomendada", "Roxa Decidida",
    "Azul Recomendada", "Azul Decidida", "Marrom Recomendada", "Marrom Decidida",
    "Vermelha Recomendada", "Vermelha Decidida", "Vermelha e Preta",
    "Panda", "Leão", "Girafa", "Borboleta", "Jacaré", "Coruja", "Arara", "Macaco", "Fênix"
];

const tamanhos = ["PP", "P", "M", "G", "GG"];

let itensPedido = [];
let currentEditingPedidoId = null;
let currentEditingPretaPedidoId = null;

// --- Funções do Modal de Novo Pedido ---

function openModal() {
    document.getElementById('pedido-modal-title').textContent = 'Novo Pedido de Faixas';
    currentEditingPedidoId = null;
    const modal = document.getElementById('pedido-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModal() {
    const modal = document.getElementById('pedido-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    itensPedido = [];
    renderItensPedido();
    document.getElementById('unidade-select').value = '';
}

async function fetchEvoUnits() {
    try {
        const functions = getFunctions();
        const getEvoUnits = httpsCallable(functions, 'getEvoUnits');
        const result = await getEvoUnits();
        return result.data;
    } catch (error) {
        console.error("Erro ao buscar unidades do EVO:", error);
        alert("Não foi possível carregar as unidades. Usando lista de fallback.");
        return ['centro', 'coqueiros', 'asa-sul', 'sudoeste', 'lago-sul', 'Central'];
    }
}

async function loadUnidades() {
    const unidadeSelects = [
        document.getElementById('unidade-select'),
        document.getElementById('unidade-preta-select')
    ];

    try {
        const unidades = await fetchEvoUnits();
        unidades.sort();

        unidadeSelects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Selecione uma unidade</option>';
                unidades.forEach(unidade => {
                    const option = document.createElement('option');
                    option.value = unidade;
                    option.textContent = unidade.charAt(0).toUpperCase() + unidade.slice(1).replace(/-/g, ' ');
                    select.appendChild(option.cloneNode(true));
                });
            }
        });
    } catch (error) {
        console.error("Erro ao carregar unidades:", error);
        unidadeSelects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        });
    }
}

function populateSelects() {
    const faixaSelect = document.getElementById('faixa-select');
    const tamanhoSelect = document.getElementById('tamanho-select');

    if (faixaSelect) {
        faixas.forEach(faixa => {
            const option = document.createElement('option');
            option.value = faixa;
            option.textContent = faixa;
            faixaSelect.appendChild(option);
        });
    }

    if (tamanhoSelect) {
        tamanhos.forEach(tamanho => {
            const option = document.createElement('option');
            option.value = tamanho;
            option.textContent = tamanho;
            tamanhoSelect.appendChild(option);
        });
    }
}

function renderItensPedido() {
    const container = document.getElementById('itens-pedido-container');
    const submitBtn = document.getElementById('submit-pedido-btn');
    if (!container || !submitBtn) return;

    if (itensPedido.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Nenhum item adicionado ainda.</p>';
        submitBtn.disabled = true;
    } else {
        container.innerHTML = itensPedido.map((item, index) => `
            <div class="flex justify-between items-center bg-gray-800 p-2 rounded">
                <span>${item.quantidade}x ${item.faixa} (${item.tamanho})</span>
                <button data-index="${index}" class="remove-item-btn text-red-500 hover:text-red-700">&times;</button>
            </div>
        `).join('');
        submitBtn.disabled = false;
    }
}

function handleAddItem(event) {
    event.preventDefault();
    const faixa = document.getElementById('faixa-select').value;
    const tamanho = document.getElementById('tamanho-select').value;
    const quantidade = parseInt(document.getElementById('quantidade-input').value, 10);

    if (faixa && tamanho && quantidade > 0) {
        const existingItem = itensPedido.find(item => item.faixa === faixa && item.tamanho === tamanho);
        if (existingItem) {
            existingItem.quantidade += quantidade;
        } else {
            itensPedido.push({ faixa, tamanho, quantidade });
        }
        renderItensPedido();
        document.getElementById('quantidade-input').value = 1;
    }
}

function handleRemoveItem(event) {
    if (event.target.classList.contains('remove-item-btn')) {
        const index = parseInt(event.target.dataset.index, 10);
        itensPedido.splice(index, 1);
        renderItensPedido();
    }
}

async function handleSubmitPedido() {
    const user = await getCurrentUser();
    if (!user) {
        alert("Você precisa estar logado para fazer um pedido.");
        return;
    }

    const unidadeSelecionada = document.getElementById('unidade-select').value;
    if (!unidadeSelecionada) {
        alert("Por favor, selecione a unidade que está fazendo o pedido.");
        return;
    }

    if (itensPedido.length === 0) {
        alert("Nenhum item foi adicionado ao pedido.");
        return;
    }

    try {
        if (currentEditingPedidoId) {
            // Lógica de Edição
            const pedidoRef = doc(db, "pedidosFaixas", currentEditingPedidoId);
            await updateDoc(pedidoRef, {
                unidade: unidadeSelecionada,
                itens: itensPedido,
                status: document.getElementById('status-select').value, // Assume que o status pode ser editado
                lastUpdatedBy: { uid: user.id, nome: user.name || user.email },
                lastUpdatedAt: serverTimestamp()
            });
            alert("Pedido atualizado com sucesso!");
        } else {
            // Lógica de Criação
            await addDoc(collection(db, "pedidosFaixas"), {
                unidade: unidadeSelecionada,
                itens: itensPedido,
                data: serverTimestamp(),
                status: "Pendente",
                solicitante: { uid: user.id, nome: user.name || user.email }
            });
            alert("Pedido enviado com sucesso!");
        }
        
        closeModal();
        loadPedidos();
    } catch (error) {
        console.error("Erro ao salvar pedido: ", error);
        alert("Ocorreu um erro ao salvar o pedido. Tente novamente.");
    }
}

// --- Funções da Tabela Principal e Modal de Detalhes ---

async function loadPedidos() {
    const tableBody = document.getElementById('pedidos-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Carregando histórico...</td></tr>';

    try {
        const q = query(collection(db, "pedidosFaixas"), orderBy("data", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Nenhum pedido encontrado.</td></tr>';
            return;
        }

        const user = await getCurrentUser();
        const isAdmin = user ? await checkAdminStatus(user) : false;

        let html = '';
        querySnapshot.forEach(doc => {
            const pedido = doc.data();
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
            const itensResumo = pedido.itens.length > 2 
                ? `${pedido.itens.slice(0, 2).map(item => `${item.quantidade}x ${item.faixa}`).join(', ')}...`
                : pedido.itens.map(item => `${item.quantidade}x ${item.faixa} (${item.tamanho})`).join('<br>');
            
            html += `
                <tr class="cursor-pointer hover:bg-gray-800" data-id="${doc.id}">
                    <td class="p-4">${data}</td>
                    <td class="p-4">${pedido.unidade}</td>
                    <td class="p-4">${itensResumo}</td>
                    <td class="p-4">
                        <span class="px-2 py-1 text-sm rounded-full bg-yellow-900 text-yellow-300">${pedido.status}</span>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } catch (error) {
        console.error("Erro ao carregar pedidos: ", error);
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Erro ao carregar o histórico.</td></tr>';
    }
}

async function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.id) {
        openDetailsModal(row.dataset.id);
    }
}

async function openDetailsModal(pedidoId) {
    const modal = document.getElementById('details-modal');
    if (!modal) return;

    try {
        const pedidoRef = doc(db, "pedidosFaixas", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);

        if (!pedidoSnap.exists()) {
            alert("Pedido não encontrado.");
            return;
        }

        const pedido = pedidoSnap.data();
        const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleString('pt-BR') : 'N/A';
        
        document.getElementById('details-unidade').textContent = pedido.unidade;
        document.getElementById('details-data').textContent = data;
        document.getElementById('details-status').textContent = pedido.status;
        document.getElementById('details-solicitante').textContent = pedido.solicitante?.nome || 'Não informado';
        document.getElementById('details-itens').innerHTML = pedido.itens.map(item => `<li>${item.quantidade}x ${item.faixa} (${item.tamanho})</li>`).join('');

        const user = await getCurrentUser();
        const isAdmin = user ? await checkAdminStatus(user) : false;
        
        const adminActions = document.getElementById('details-admin-actions');
        if (isAdmin) {
            adminActions.classList.remove('hidden');
            document.getElementById('edit-pedido-btn').dataset.id = pedidoId;
            document.getElementById('delete-pedido-btn').dataset.id = pedidoId;
        } else {
            adminActions.classList.add('hidden');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');

    } catch (error) {
        console.error("Erro ao abrir detalhes do pedido:", error);
        alert("Não foi possível carregar os detalhes do pedido.");
    }
}

function closeDetailsModal() {
    const modal = document.getElementById('details-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleEditPedido(event) {
    const pedidoId = event.target.dataset.id;
    if (!pedidoId) return;

    closeDetailsModal();
    
    const pedidoRef = doc(db, "pedidosFaixas", pedidoId);
    const pedidoSnap = await getDoc(pedidoRef);
    if (pedidoSnap.exists()) {
        const pedido = pedidoSnap.data();
        currentEditingPedidoId = pedidoId;
        
        document.getElementById('pedido-modal-title').textContent = 'Editar Pedido';
        document.getElementById('unidade-select').value = pedido.unidade;
        // Adicionar campo de status no modal de edição
        const statusSelect = document.getElementById('status-select');
        if (statusSelect) statusSelect.value = pedido.status;

        itensPedido = [...pedido.itens];
        renderItensPedido();
        openModal();
    }
}

async function handleDeletePedido(event) {
    const pedidoId = event.target.dataset.id;
    if (!pedidoId) return;

    if (confirm("Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.")) {
        try {
            await deleteDoc(doc(db, "pedidosFaixas", pedidoId));
            alert("Pedido excluído com sucesso.");
            closeDetailsModal();
            loadPedidos();
        } catch (error) {
            console.error("Erro ao excluir pedido:", error);
            alert("Não foi possível excluir o pedido.");
        }
    }
}

// --- Setup da Página ---

export function setupPedidosFaixasPage() {
    loadPedidos();
    populateSelects();
    loadUnidades();

    // Listeners do Modal de Novo/Edição de Pedido
    document.getElementById('open-pedido-modal-btn')?.addEventListener('click', openModal);
    document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('add-item-form')?.addEventListener('submit', handleAddItem);
    document.getElementById('itens-pedido-container')?.addEventListener('click', handleRemoveItem);
    document.getElementById('submit-pedido-btn')?.addEventListener('click', handleSubmitPedido);
    
    // Listeners da Tabela Principal e Modal de Detalhes
    document.getElementById('refresh-pedidos')?.addEventListener('click', loadPedidos);
    document.getElementById('pedidos-table-body')?.addEventListener('click', handleTableClick);
    document.getElementById('close-details-modal-btn')?.addEventListener('click', closeDetailsModal);
    document.getElementById('edit-pedido-btn')?.addEventListener('click', handleEditPedido);
    document.getElementById('delete-pedido-btn')?.addEventListener('click', handleDeletePedido);

    // --- Funções e Listeners da Aba de Faixas Pretas ---

    function openFaixaPretaModal() {
        const modal = document.getElementById('faixa-preta-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeFaixaPretaModal() {
        const modal = document.getElementById('faixa-preta-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.getElementById('aluno-preta-input').value = '';
            document.getElementById('unidade-preta-select').value = '';
            document.getElementById('faixa-preta-select').value = '1º Dan';
        }
    }

    async function handleSubmitFaixaPretaPedido() {
        const user = await getCurrentUser();
        if (!user) {
            alert("Você precisa estar logado para fazer um pedido.");
            return;
        }

        const unidade = document.getElementById('unidade-preta-select').value;
        const status = document.getElementById('status-preta-select').value;
        const aluno = document.getElementById('aluno-preta-input').value.trim();
        const faixa = document.getElementById('faixa-preta-select').value;

        if (!unidade || !aluno) {
            alert("Por favor, preencha a unidade e o nome do aluno.");
            return;
        }

        try {
            if (currentEditingPretaPedidoId) {
                const pedidoRef = doc(db, "pedidosFaixasPretas", currentEditingPretaPedidoId);
                await updateDoc(pedidoRef, {
                    unidade,
                    aluno,
                    faixa,
                    status,
                    lastUpdatedBy: { uid: user.id, nome: user.name || user.email },
                    lastUpdatedAt: serverTimestamp()
                });
                alert("Pedido de faixa preta atualizado com sucesso!");
                currentEditingPretaPedidoId = null;
            } else {
                await addDoc(collection(db, "pedidosFaixasPretas"), {
                    unidade,
                    aluno,
                    faixa,
                    status,
                    data: serverTimestamp(),
                    solicitante: { uid: user.id, nome: user.name || user.email }
                });
                alert("Pedido de faixa preta enviado com sucesso!");
            }
            closeFaixaPretaModal();
            loadPedidosPretas();
        } catch (error) {
            console.error("Erro ao salvar pedido de faixa preta: ", error);
            alert("Ocorreu um erro ao salvar o pedido. Tente novamente.");
        }
    }

    async function loadPedidosPretas() {
        const tableBody = document.getElementById('pedidos-pretas-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Carregando...</td></tr>';

        try {
            const q = query(collection(db, "pedidosFaixasPretas"), orderBy("data", "desc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum pedido de faixa preta encontrado.</td></tr>';
                return;
            }

            let html = '';
            querySnapshot.forEach(doc => {
                const pedido = doc.data();
                const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
                html += `
                    <tr class="cursor-pointer hover:bg-gray-800" data-id="${doc.id}">
                        <td class="p-4">${data}</td>
                        <td class="p-4">${pedido.unidade}</td>
                        <td class="p-4">${pedido.aluno}</td>
                        <td class="p-4">${pedido.faixa}</td>
                        <td class="p-4">
                            <span class="px-2 py-1 text-sm rounded-full bg-yellow-900 text-yellow-300">${pedido.status}</span>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } catch (error) {
            console.error("Erro ao carregar pedidos de faixas pretas: ", error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Erro ao carregar pedidos.</td></tr>';
        }
    }

    function setupTabs() {
        const tabColoridas = document.getElementById('tab-coloridas');
        const tabPretas = document.getElementById('tab-pretas');
        const contentColoridas = document.getElementById('tab-content-coloridas');
        const contentPretas = document.getElementById('tab-content-pretas');
        const btnNovoColorida = document.getElementById('open-pedido-modal-btn');
        const btnNovoPreta = document.getElementById('open-faixa-preta-modal-btn');

        tabColoridas.addEventListener('click', () => {
            tabColoridas.classList.add('text-yellow-400', 'border-yellow-400');
            tabColoridas.classList.remove('text-gray-400', 'hover:text-white');
            tabPretas.classList.remove('text-yellow-400', 'border-yellow-400');
            tabPretas.classList.add('text-gray-400', 'hover:text-white');
            
            contentColoridas.classList.remove('hidden');
            contentPretas.classList.add('hidden');
            btnNovoColorida.classList.remove('hidden');
            btnNovoPreta.classList.add('hidden');
        });

        tabPretas.addEventListener('click', () => {
            tabPretas.classList.add('text-yellow-400', 'border-yellow-400');
            tabPretas.classList.remove('text-gray-400', 'hover:text-white');
            tabColoridas.classList.remove('text-yellow-400', 'border-yellow-400');
            tabColoridas.classList.add('text-gray-400', 'hover:text-white');

            contentPretas.classList.remove('hidden');
            contentColoridas.classList.add('hidden');
            btnNovoPreta.classList.remove('hidden');
            btnNovoColorida.classList.add('hidden');
            loadPedidosPretas(); // Carrega os pedidos ao ativar a aba
        });
    }
    
    // Setup da nova funcionalidade
    setupTabs();
    loadPedidosPretas();
    document.getElementById('open-faixa-preta-modal-btn')?.addEventListener('click', openFaixaPretaModal);
    document.getElementById('close-faixa-preta-modal-btn')?.addEventListener('click', closeFaixaPretaModal);
    document.getElementById('submit-faixa-preta-btn')?.addEventListener('click', handleSubmitFaixaPretaPedido);
    document.getElementById('pedidos-pretas-table-body')?.addEventListener('click', handlePretasTableClick);
    document.getElementById('close-details-preta-modal-btn')?.addEventListener('click', closeDetailsPretaModal);
    document.getElementById('edit-preta-pedido-btn')?.addEventListener('click', handleEditPretaPedido);
    document.getElementById('delete-preta-pedido-btn')?.addEventListener('click', handleDeletePretaPedido);

    function handlePretasTableClick(event) {
        const row = event.target.closest('tr');
        if (row && row.dataset.id) {
            openDetailsPretaModal(row.dataset.id);
        }
    }

    async function openDetailsPretaModal(pedidoId) {
        const modal = document.getElementById('details-preta-modal');
        if (!modal) return;

        try {
            const pedidoRef = doc(db, "pedidosFaixasPretas", pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);

            if (!pedidoSnap.exists()) {
                alert("Pedido não encontrado.");
                return;
            }

            const pedido = pedidoSnap.data();
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleString('pt-BR') : 'N/A';
            
            document.getElementById('details-preta-unidade').textContent = pedido.unidade;
            document.getElementById('details-preta-data').textContent = data;
            document.getElementById('details-preta-status').textContent = pedido.status;
            document.getElementById('details-preta-solicitante').textContent = pedido.solicitante?.nome || 'Não informado';
            document.getElementById('details-preta-aluno').textContent = pedido.aluno;
            document.getElementById('details-preta-faixa').textContent = pedido.faixa;

            const user = await getCurrentUser();
            const isAdmin = user ? await checkAdminStatus(user) : false;
            
            const adminActions = document.getElementById('details-preta-admin-actions');
            if (isAdmin) {
                adminActions.classList.remove('hidden');
                document.getElementById('edit-preta-pedido-btn').dataset.id = pedidoId;
                document.getElementById('delete-preta-pedido-btn').dataset.id = pedidoId;
            } else {
                adminActions.classList.add('hidden');
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');

        } catch (error) {
            console.error("Erro ao abrir detalhes do pedido:", error);
            alert("Não foi possível carregar os detalhes do pedido.");
        }
    }

    function closeDetailsPretaModal() {
        const modal = document.getElementById('details-preta-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async function handleEditPretaPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        closeDetailsPretaModal();
        
        const pedidoRef = doc(db, "pedidosFaixasPretas", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);
        if (pedidoSnap.exists()) {
            const pedido = pedidoSnap.data();
            currentEditingPretaPedidoId = pedidoId;
            
            document.getElementById('unidade-preta-select').value = pedido.unidade;
            document.getElementById('status-preta-select').value = pedido.status;
            document.getElementById('aluno-preta-input').value = pedido.aluno;
            document.getElementById('faixa-preta-select').value = pedido.faixa;
            
            openFaixaPretaModal();
        }
    }

    async function handleDeletePretaPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        if (confirm("Tem certeza que deseja excluir este pedido de faixa preta?")) {
            try {
                await deleteDoc(doc(db, "pedidosFaixasPretas", pedidoId));
                alert("Pedido excluído com sucesso.");
                closeDetailsPretaModal();
                loadPedidosPretas();
            } catch (error) {
                console.error("Erro ao excluir pedido:", error);
                alert("Não foi possível excluir o pedido.");
            }
        }
    }
}
