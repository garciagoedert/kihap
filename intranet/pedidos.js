import { db } from './firebase-config.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
const tamanhosDobok = ["1", "2", "PP", "P", "0", "00", "M0", "M1", "M2", "M3", "A0", "A1", "A2", "A3", "A4", "A5"];


let itensPedido = [];
let currentEditingPedidoId = null;
let currentEditingPretaPedidoId = null;
let currentEditingDobokPedidoId = null;

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
        document.getElementById('unidade-preta-select'),
        document.getElementById('unidade-dobok-select'),
        document.getElementById('filter-unidade-dobok') // Assuming this is the correct ID for Dobok unit filter
    ];

    try {
        const unidades = await fetchEvoUnits();
        unidades.sort();

        unidadeSelects.forEach(select => {
            if (select) {
                // Preserva a primeira opção se for o filtro
                const isFilter = select.id === 'filter-unidade-dobok';
                const firstOptionText = isFilter ? 'Todas' : 'Selecione uma unidade';
                select.innerHTML = `<option value="">${firstOptionText}</option>`;

                unidades.forEach(unidade => {
                    const option = document.createElement('option');
                    option.value = unidade;
                    option.textContent = unidade.charAt(0).toUpperCase() + unidade.slice(1).replace(/-/g, ' ');
                    select.appendChild(option);
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
    const tamanhoDobokSelect = document.getElementById('tamanho-dobok-select');

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

    if (tamanhoDobokSelect) {
        tamanhosDobok.forEach(tamanho => {
            const option = document.createElement('option');
            option.value = tamanho;
            option.textContent = tamanho;
            tamanhoDobokSelect.appendChild(option);
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
        // Get filter values
        const filterUnidade = document.getElementById('filter-unidade')?.value;
        const filterFaixaPreta = document.getElementById('filter-faixa-preta')?.checked;
        const filterTradicional = document.getElementById('filter-tradicional')?.checked;

        let constraints = [orderBy("data", "desc")];
        if (filterUnidade) {
            constraints.push(where("unidade", "==", filterUnidade));
        }

        const q = query(collection(db, "pedidosFaixas"), ...constraints);
        const querySnapshot = await getDocs(q);

        let pedidos = [];
        querySnapshot.forEach(doc => {
            pedidos.push({ id: doc.id, ...doc.data() });
        });

        // Client-side filtering for Faixas Coloridas
        if (filterFaixaPreta) {
            pedidos = pedidos.filter(pedido => {
                return pedido.itens.some(item =>
                    item.faixa === "Vermelha e Preta" ||
                    faixas.slice(18).includes(item.faixa) // Dan levels start from index 18
                );
            });
        }
        if (filterTradicional) {
            pedidos = pedidos.filter(pedido => {
                return pedido.itens.some(item =>
                    item.faixa !== "Vermelha e Preta" &&
                    !faixas.slice(18).includes(item.faixa)
                );
            });
        }

        if (pedidos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Nenhum pedido encontrado com os filtros aplicados.</td></tr>';
            return;
        }

        const user = await getCurrentUser();
        const isAdmin = user ? await checkAdminStatus(user) : false;

        let html = '';
        pedidos.forEach(pedido => {
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
            const itensResumo = pedido.itens.length > 2
                ? `${pedido.itens.slice(0, 2).map(item => `${item.quantidade}x ${item.faixa}`).join(', ')}...`
                : pedido.itens.map(item => `${item.quantidade}x ${item.faixa} (${item.tamanho})`).join('<br>');

            html += `
                <tr class="cursor-pointer hover:bg-gray-800" data-id="${pedido.id}">
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
        const adminActions = document.getElementById('details-admin-actions');
        const editBtn = document.getElementById('edit-pedido-btn');
        const deleteBtn = document.getElementById('delete-pedido-btn');

        if (user) {
            const isAdmin = await checkAdminStatus(user);
            adminActions.classList.remove('hidden');

            editBtn.classList.remove('hidden');
            editBtn.dataset.id = pedidoId;

            if (isAdmin) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.dataset.id = pedidoId;
            } else {
                deleteBtn.classList.add('hidden');
            }
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

// --- Função de Exportação ---
async function exportPedidosPendentes() {
    try {
        const q = query(collection(db, "pedidosFaixas"), where("status", "==", "Pendente"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Nenhum pedido pendente para exportar.");
            return;
        }

        const faixasAgregadas = {};

        querySnapshot.forEach(doc => {
            const pedido = doc.data();
            if (pedido.itens && Array.isArray(pedido.itens)) {
                pedido.itens.forEach(item => {
                    const chave = `${item.faixa} | ${item.tamanho}`;
                    if (faixasAgregadas[chave]) {
                        faixasAgregadas[chave] += item.quantidade;
                    } else {
                        faixasAgregadas[chave] = item.quantidade;
                    }
                });
            }
        });

        const dataParaPlanilha = [
            ["Faixa", "Tamanho", "Quantidade Total"]
        ];

        // Converte o objeto agregado em array e ordena
        const sortedItems = Object.keys(faixasAgregadas).map(chave => {
            const [faixa, tamanho] = chave.split(' | ');
            return [faixa, tamanho, faixasAgregadas[chave]];
        }).sort((a, b) => {
            // Ordena por nome da faixa
            if (a[0] < b[0]) return -1;
            if (a[0] > b[0]) return 1;
            // Se as faixas forem iguais, ordena por tamanho
            if (a[1] < b[1]) return -1;
            if (a[1] > b[1]) return 1;
            return 0;
        });

        // Adiciona os itens ordenados à planilha
        sortedItems.forEach(item => {
            dataParaPlanilha.push(item);
        });

        const ws = XLSX.utils.aoa_to_sheet(dataParaPlanilha);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pedidos Pendentes");

        const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        XLSX.writeFile(wb, `Pedidos_Faixas_Pendentes_${today}.xlsx`);

    } catch (error) {
        console.error("Erro ao exportar pedidos: ", error);
        alert("Ocorreu um erro ao exportar os pedidos. Verifique o console para mais detalhes.");
    }
}

// --- Setup da Página ---

export function setupPedidosPage() {
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
    document.getElementById('export-pedidos-btn')?.addEventListener('click', exportPedidosPendentes);

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
            document.getElementById('tamanho-preta-input').value = '';
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
        const tamanho = document.getElementById('tamanho-preta-input').value;

        if (!unidade || !aluno || !tamanho) {
            alert("Por favor, preencha todos os campos, incluindo o tamanho da faixa.");
            return;
        }

        try {
            if (currentEditingPretaPedidoId) {
                const pedidoRef = doc(db, "pedidosFaixasPretas", currentEditingPretaPedidoId);
                await updateDoc(pedidoRef, {
                    unidade,
                    aluno,
                    faixa,
                    tamanho,
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
                    tamanho,
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
            // Get filter values
            const filterUnidade = document.getElementById('filter-unidade')?.value; // Assuming same filter ID for unit
            const filterFaixaPreta = document.getElementById('filter-faixa-preta')?.checked; // Assuming same filter ID for faixa preta
            // 'filter-tradicional' is less relevant for Faixas Pretas, so we might ignore it or adapt it.
            // For now, we'll focus on unit and faixa preta.

            let constraints = [orderBy("data", "desc")];
            if (filterUnidade) {
                constraints.push(where("unidade", "==", filterUnidade));
            }

            const q = query(collection(db, "pedidosFaixasPretas"), ...constraints);
            const querySnapshot = await getDocs(q);

            let pedidos = [];
            querySnapshot.forEach(doc => {
                pedidos.push({ id: doc.id, ...doc.data() });
            });

            // Client-side filtering for Faixas Pretas
            if (filterFaixaPreta) {
                pedidos = pedidos.filter(pedido => {
                    // Assuming "Faixa Preta" filter means any of the Dan levels
                    // The 'faixas' array has Dan levels starting from index 18.
                    // We need to check if the pedido.faixa is one of these.
                    return faixas.slice(18).includes(pedido.faixa);
                });
            }
            // If filterTradicional was meant for Faixas Pretas, its logic would be complex and unclear.
            // For now, we'll assume it's not applicable or handled differently.

            if (pedidos.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum pedido de faixa preta encontrado com os filtros aplicados.</td></tr>';
                return;
            }

            let html = '';
            pedidos.forEach(pedido => {
                const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
                html += `
                    <tr class="cursor-pointer hover:bg-gray-800" data-id="${pedido.id}">
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
        const tabDoboks = document.getElementById('tab-doboks');
        const contentColoridas = document.getElementById('tab-content-coloridas');
        const contentPretas = document.getElementById('tab-content-pretas');
        const contentDoboks = document.getElementById('tab-content-doboks');
        const btnNovoColorida = document.getElementById('open-pedido-modal-btn');
        const btnNovoPreta = document.getElementById('open-faixa-preta-modal-btn');
        const btnNovoDobok = document.getElementById('open-dobok-modal-btn');

        const tabs = [tabColoridas, tabPretas, tabDoboks];
        const contents = [contentColoridas, contentPretas, contentDoboks];

        tabs.forEach((tab, index) => {
            if (tab) {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('text-yellow-400', 'border-yellow-400'));
                    contents.forEach(c => c.classList.add('hidden'));

                    tab.classList.add('text-yellow-400', 'border-yellow-400');
                    if (contents[index]) {
                        contents[index].classList.remove('hidden');
                    }

                    // Lógica para exibir os botões corretos
                    btnNovoColorida.classList.add('hidden');
                    btnNovoPreta.classList.add('hidden');
                    if (btnNovoDobok) btnNovoDobok.classList.add('hidden');

                    if (index === 0) { // Faixas Coloridas
                        btnNovoColorida.classList.remove('hidden');
                        // Reload data when tab is clicked
                        loadPedidos();
                    } else if (index === 1) { // Faixas Pretas
                        btnNovoPreta.classList.remove('hidden');
                        loadPedidosPretas();
                    } else if (index === 2) { // Doboks
                        if (btnNovoDobok) btnNovoDobok.classList.remove('hidden');
                        loadPedidosDoboks();
                    }
                });
            }
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
            document.getElementById('details-preta-tamanho').textContent = pedido.tamanho || 'N/A';

            const user = await getCurrentUser();
            const adminActions = document.getElementById('details-preta-admin-actions');
            const editBtn = document.getElementById('edit-preta-pedido-btn');
            const deleteBtn = document.getElementById('delete-preta-pedido-btn');

            if (user) {
                const isAdmin = await checkAdminStatus(user);
                adminActions.classList.remove('hidden');

                editBtn.classList.remove('hidden');
                editBtn.dataset.id = pedidoId;

                if (isAdmin) {
                    deleteBtn.classList.remove('hidden');
                    deleteBtn.dataset.id = pedidoId;
                } else {
                    deleteBtn.classList.add('hidden');
                }
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
            document.getElementById('tamanho-preta-input').value = pedido.tamanho || '';

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

    // --- Funções e Listeners da Aba de Doboks ---

    function openDobokModal(isEditing = false) {
        const modal = document.getElementById('dobok-modal');
        if (modal) {
            if (!isEditing) {
                document.getElementById('dobok-modal-title').textContent = 'Novo Pedido de Dobok';
                currentEditingDobokPedidoId = null;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeDobokModal() {
        const modal = document.getElementById('dobok-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.getElementById('aluno-dobok-input').value = '';
            document.getElementById('unidade-dobok-select').value = '';
            document.getElementById('tamanho-dobok-select').value = '';
            document.getElementById('colarinho-dobok-select').value = '';
            document.getElementById('faixa-preta-dobok-checkbox').checked = false;
        }
    }

    async function handleSubmitDobokPedido() {
        const user = await getCurrentUser();
        if (!user) {
            alert("Você precisa estar logado para fazer um pedido.");
            return;
        }

        const unidade = document.getElementById('unidade-dobok-select').value;
        const status = document.getElementById('status-dobok-select').value;
        const aluno = document.getElementById('aluno-dobok-input').value.trim();
        const tamanho = document.getElementById('tamanho-dobok-select').value;
        const isFaixaPreta = document.getElementById('faixa-preta-dobok-checkbox').checked;
        const colarinho = document.getElementById('colarinho-dobok-select').value;

        if (!unidade || !tamanho) {
            alert("Por favor, preencha a unidade e o tamanho.");
            return;
        }

        try {
            if (currentEditingDobokPedidoId) {
                const pedidoRef = doc(db, "pedidosDoboks", currentEditingDobokPedidoId);
                await updateDoc(pedidoRef, {
                    unidade,
                    aluno: aluno || null,
                    tamanho,
                    status,
                    isFaixaPreta,
                    colarinho: colarinho || null,
                    lastUpdatedBy: { uid: user.id, nome: user.name || user.email },
                    lastUpdatedAt: serverTimestamp()
                });
                alert("Pedido de dobok atualizado com sucesso!");
                currentEditingDobokPedidoId = null;
            } else {
                await addDoc(collection(db, "pedidosDoboks"), {
                    unidade,
                    aluno: aluno || null,
                    tamanho,
                    status,
                    isFaixaPreta,
                    colarinho: colarinho || null,
                    data: serverTimestamp(),
                    solicitante: { uid: user.id, nome: user.name || user.email }
                });
                alert("Pedido de dobok enviado com sucesso!");
            }
            closeDobokModal();
            loadPedidosDoboks();
        } catch (error) {
            console.error("Erro ao salvar pedido de dobok: ", error);
            alert("Ocorreu um erro ao salvar o pedido. Tente novamente.");
        }
    }

    async function loadPedidosDoboks() {
        const tableBody = document.getElementById('pedidos-doboks-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Carregando...</td></tr>';

        try {
            const filterUnidade = document.getElementById('filter-unidade-dobok').value;
            const filterFaixaPreta = document.getElementById('filter-faixa-preta-dobok').checked;
            const filterTradicional = document.getElementById('filter-tradicional-dobok').checked;

            let constraints = [orderBy("data", "desc")];
            if (filterUnidade) {
                constraints.unshift(where("unidade", "==", filterUnidade));
            }

            const q = query(collection(db, "pedidosDoboks"), ...constraints);
            const querySnapshot = await getDocs(q);

            let pedidos = [];
            querySnapshot.forEach(doc => {
                pedidos.push({ id: doc.id, ...doc.data() });
            });

            // Filtragem no lado do cliente
            if (filterFaixaPreta) {
                pedidos = pedidos.filter(p => p.isFaixaPreta === true);
            }
            if (filterTradicional) {
                pedidos = pedidos.filter(p => p.isFaixaPreta === false);
            }

            if (pedidos.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum pedido de dobok encontrado com os filtros aplicados.</td></tr>';
                return;
            }

            let html = '';
            pedidos.forEach(pedido => {
                const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
                const faixaPretaIndicator = pedido.isFaixaPreta ? '<span class="ml-2 px-2 py-1 text-xs font-semibold text-white bg-black rounded-full">Faixa Preta</span>' : '';
                const colarinhoInfo = pedido.colarinho ? ` (${pedido.colarinho})` : '';
                html += `
                    <tr class="cursor-pointer hover:bg-gray-800" data-id="${pedido.id}">
                        <td class="p-4">${data}</td>
                        <td class="p-4">${pedido.unidade}</td>
                        <td class="p-4">${pedido.aluno || 'N/A'} ${faixaPretaIndicator}</td>
                        <td class="p-4">${pedido.tamanho}${colarinhoInfo}</td>
                        <td class="p-4">
                            <span class="px-2 py-1 text-sm rounded-full bg-yellow-900 text-yellow-300">${pedido.status}</span>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } catch (error) {
            console.error("Erro ao carregar pedidos de doboks: ", error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Erro ao carregar pedidos.</td></tr>';
        }
    }

    document.getElementById('open-dobok-modal-btn')?.addEventListener('click', openDobokModal);
    document.getElementById('close-dobok-modal-btn')?.addEventListener('click', closeDobokModal);
    document.getElementById('submit-dobok-btn')?.addEventListener('click', handleSubmitDobokPedido);
    document.getElementById('pedidos-doboks-table-body')?.addEventListener('click', handleDoboksTableClick);
    document.getElementById('close-details-dobok-modal-btn')?.addEventListener('click', closeDetailsDobokModal);
    document.getElementById('filter-unidade-dobok')?.addEventListener('change', loadPedidosDoboks);

    const faixaPretaCheckbox = document.getElementById('filter-faixa-preta-dobok');
    const tradicionalCheckbox = document.getElementById('filter-tradicional-dobok');

    faixaPretaCheckbox?.addEventListener('change', () => {
        if (faixaPretaCheckbox.checked) {
            tradicionalCheckbox.checked = false;
        }
        loadPedidosDoboks();
    });

    tradicionalCheckbox?.addEventListener('change', () => {
        if (tradicionalCheckbox.checked) {
            faixaPretaCheckbox.checked = false;
        }
        loadPedidosDoboks();
    });

    document.getElementById('edit-dobok-pedido-btn')?.addEventListener('click', handleEditDobokPedido);
    document.getElementById('delete-dobok-pedido-btn')?.addEventListener('click', handleDeleteDobokPedido);


    function handleDoboksTableClick(event) {
        const row = event.target.closest('tr');
        if (row && row.dataset.id) {
            openDetailsDobokModal(row.dataset.id);
        }
    }

    async function openDetailsDobokModal(pedidoId) {
        const modal = document.getElementById('details-dobok-modal');
        if (!modal) return;

        try {
            const pedidoRef = doc(db, "pedidosDoboks", pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);

            if (!pedidoSnap.exists()) {
                alert("Pedido de Dobok não encontrado.");
                return;
            }

            const pedido = pedidoSnap.data();
            const data = pedido.data ? new Date(pedido.data.seconds * 1000).toLocaleString('pt-BR') : 'N/A';

            document.getElementById('details-dobok-unidade').textContent = pedido.unidade;
            document.getElementById('details-dobok-data').textContent = data;
            document.getElementById('details-dobok-status').textContent = pedido.status;
            document.getElementById('details-dobok-solicitante').textContent = pedido.solicitante?.nome || 'Não informado';
            document.getElementById('details-dobok-aluno').textContent = pedido.aluno || 'N/A';
            document.getElementById('details-dobok-tamanho').textContent = pedido.tamanho;
            document.getElementById('details-dobok-colarinho').textContent = pedido.colarinho || 'Padrão';
            document.getElementById('details-dobok-tipo').textContent = pedido.isFaixaPreta ? 'Faixa Preta' : 'Comum';

            const user = await getCurrentUser();
            const adminActions = document.getElementById('details-dobok-admin-actions');
            const editBtn = document.getElementById('edit-dobok-pedido-btn');
            const deleteBtn = document.getElementById('delete-dobok-pedido-btn');

            if (user) {
                const isAdmin = await checkAdminStatus(user);
                adminActions.classList.remove('hidden');

                editBtn.classList.remove('hidden');
                editBtn.dataset.id = pedidoId;

                if (isAdmin) {
                    deleteBtn.classList.remove('hidden');
                    deleteBtn.dataset.id = pedidoId;
                } else {
                    deleteBtn.classList.add('hidden');
                }
            } else {
                adminActions.classList.add('hidden');
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');

        } catch (error) {
            console.error("Erro ao abrir detalhes do pedido de dobok:", error);
            alert("Não foi possível carregar os detalhes do pedido.");
        }
    }

    function closeDetailsDobokModal() {
        const modal = document.getElementById('details-dobok-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async function handleEditDobokPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        closeDetailsDobokModal();

        const pedidoRef = doc(db, "pedidosDoboks", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);
        if (pedidoSnap.exists()) {
            const pedido = pedidoSnap.data();
            currentEditingDobokPedidoId = pedidoId;

            document.getElementById('dobok-modal-title').textContent = 'Editar Pedido de Dobok';
            document.getElementById('unidade-dobok-select').value = pedido.unidade;
            document.getElementById('status-dobok-select').value = pedido.status;
            document.getElementById('aluno-dobok-input').value = pedido.aluno || '';
            document.getElementById('tamanho-dobok-select').value = pedido.tamanho;
            document.getElementById('colarinho-dobok-select').value = pedido.colarinho || '';
            document.getElementById('faixa-preta-dobok-checkbox').checked = pedido.isFaixaPreta || false;

            openDobokModal(true);
        }
    }

    async function handleDeleteDobokPedido(event) {
        const pedidoId = event.target.dataset.id;
        if (!pedidoId) return;

        if (confirm("Tem certeza que deseja excluir este pedido de dobok?")) {
            try {
                await deleteDoc(doc(db, "pedidosDoboks", pedidoId));
                alert("Pedido de dobok excluído com sucesso.");
                closeDetailsDobokModal();
                loadPedidosDoboks();
            } catch (error) {
                console.error("Erro ao excluir pedido de dobok:", error);
                alert("Não foi possível excluir o pedido.");
            }
        }
    }
}
