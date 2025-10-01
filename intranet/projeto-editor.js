import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, collection, onSnapshot, addDoc, updateDoc, serverTimestamp, deleteDoc, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { db, app } from './firebase-config.js';
import { loadComponents, setupUIListeners } from './common-ui.js';
import HistoryManager from './history-manager.js';

// --- INITIALIZATION ---
const auth = getAuth(app);
const storage = getStorage(app);
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('projectId');
if (!projectId) {
    alert("ID do projeto não fornecido!");
    window.location.href = 'projetos.html';
}

// --- UI ELEMENTS ---
const canvas = document.getElementById('canvas');
const addNodeBtn = document.getElementById('add-node-btn');
const deleteNodeBtn = document.getElementById('delete-node-btn');
const colorPicker = document.getElementById('color-picker');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const uploadPdfBtn = document.getElementById('upload-pdf-btn');
const pdfInput = document.getElementById('pdf-input');
const uploadImageBtn = document.getElementById('upload-image-btn');
const imageInput = document.getElementById('image-input');
const linkNodesBtn = document.getElementById('link-nodes-btn');
const drawModeBtn = document.getElementById('draw-mode-btn');
const drawingCanvas = document.getElementById('drawing-canvas');
const nodeModal = document.getElementById('node-modal');
const nodeModalTitle = document.getElementById('node-modal-title');
const closeNodeModalBtn = document.getElementById('close-node-modal-btn');

// --- GLOBAL STATE ---
let nodes = {};
let lines = {};
let selectedNodes = [];
let linkingMode = { active: false, startNode: null };
let drawMode = { active: false, drawing: false, ctx: null, lastPos: null };
const historyManager = new HistoryManager();
let debounceTimer = null;
let users = [];

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (sessionStorage.getItem('isLoggedIn') === 'true') {
            loadComponents(() => setupUIListeners());
            loadUsers();
            setupNodeListener();
            setupLinkListener();

            addNodeBtn.addEventListener('click', () => {
                console.log("Botão Adicionar Nó clicado!");
                // Adiciona o nó no centro da tela visível
                const centerX = canvas.offsetWidth / 2;
                const centerY = canvas.offsetHeight / 2;
                createNewNode(centerX, centerY);
            });
        } else {
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// --- DATA HANDLING & HISTORY ---
function setupNodeListener() {
    const nodesCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes');
    onSnapshot(nodesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const nodeData = { id: change.doc.id, ...change.doc.data() };
            if (change.type === "added") {
                if (!nodes[nodeData.id]) createNodeElement(nodeData);
            }
            if (change.type === "modified") {
                updateNodeElement(nodeData);
            }
            if (change.type === "removed") {
                removeNodeElement(nodeData.id);
            }
        });
        // Redesenha as linhas quando os nós são carregados/modificados
        Object.values(lines).forEach(line => line.position());
    });
}

function setupLinkListener() {
    const linksCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'links');
    onSnapshot(linksCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const linkData = { id: change.doc.id, ...change.doc.data() };
            if (change.type === "added") {
                if (!lines[linkData.id]) drawLine(linkData);
            }
            if (change.type === "removed") {
                if (lines[linkData.id]) {
                    lines[linkData.id].remove();
                    delete lines[linkData.id];
                }
            }
        });
    });
}

async function loadUsers() {
    try {
        const usersCollection = collection(db, 'users');
        const snapshot = await getDocs(usersCollection);
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

// --- UI & CANVAS ---
function createNodeElement(nodeData) {
    const nodeEl = document.createElement('div');
    nodeEl.id = nodeData.id;
    nodeEl.className = 'node';
    nodeEl.style.left = `${nodeData.position.x}px`;
    nodeEl.style.top = `${nodeData.position.y}px`;
    if (nodeData.color) nodeEl.style.backgroundColor = nodeData.color;

    const titleEl = document.createElement('div');
    titleEl.className = 'node-title';
    titleEl.textContent = nodeData.text;
    nodeEl.appendChild(titleEl);

    if (nodeData.attachment) {
        createAttachmentElement(nodeData.attachment).then(attachmentEl => {
            nodeEl.appendChild(attachmentEl);
        });
    }

    canvas.appendChild(nodeEl);
    nodes[nodeData.id] = { el: nodeEl, data: nodeData };

    makeDraggable(nodeEl, nodeData);
    nodeEl.addEventListener('dblclick', () => openNodeModal(nodeData));
}

function updateNodeElement(nodeData) {
    const existing = nodes[nodeData.id];
    if (existing) {
        existing.el.style.left = `${nodeData.position.x}px`;
        existing.el.style.top = `${nodeData.position.y}px`;
        if (nodeData.color) existing.el.style.backgroundColor = nodeData.color;
        
        // Atualiza a posição das linhas conectadas
        Object.values(lines).forEach(line => {
            if (line.start.id === nodeData.id || line.end.id === nodeData.id) {
                line.position();
            }
        });

        const titleEl = existing.el.querySelector('.node-title');
        if (titleEl.textContent !== nodeData.text) {
            titleEl.textContent = nodeData.text;
        }

        const existingAttachment = existing.el.querySelector('.attachment');
        if (nodeData.attachment) {
            if (existingAttachment) {
                const link = existingAttachment.querySelector('a, img, canvas');
                const oldUrl = link.src || (link.onclick ? link.onclick.toString().match(/'([^']+)'/)[1] : null);

                if (oldUrl !== nodeData.attachment.url) {
                    existingAttachment.remove();
                    createAttachmentElement(nodeData.attachment).then(newAttachmentEl => {
                        existing.el.appendChild(newAttachmentEl);
                    });
                }
            } else {
                 createAttachmentElement(nodeData.attachment).then(newAttachmentEl => {
                    existing.el.appendChild(newAttachmentEl);
                });
            }
        } else if (existingAttachment) {
            existingAttachment.remove();
        }

        existing.data = nodeData;
    }
}

function removeNodeElement(nodeId) {
    if (nodes[nodeId]) {
        nodes[nodeId].el.remove();
        delete nodes[nodeId];
    }
}

async function createAttachmentElement(attachment) {
    const attachmentEl = document.createElement('div');
    attachmentEl.className = 'attachment mt-2';

    if (attachment.type === 'image') {
        attachmentEl.innerHTML = `<img src="${attachment.url}" alt="Anexo" class="max-w-full h-auto rounded cursor-pointer" onclick="window.open('${attachment.url}', '_blank')">`;
    } else if (attachment.type === 'pdf') {
        const pdfCanvas = document.createElement('canvas');
        pdfCanvas.className = 'max-w-full h-auto rounded cursor-pointer';
        attachmentEl.appendChild(pdfCanvas);
        
        pdfCanvas.onclick = () => window.open(attachment.url, '_blank');

        try {
            // Configura o worker para a pdf.js
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

            const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
            const loadingTask = pdfjsLib.getDocument(proxyUrl + attachment.url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1); // Pega a primeira página

            const viewport = page.getViewport({ scale: 1.5 });
            const context = pdfCanvas.getContext('2d');
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
        } catch (error) {
            console.error('Erro ao renderizar PDF:', error);
            attachmentEl.innerHTML = `
                <a href="${attachment.url}" target="_blank" class="flex items-center gap-2 text-red-400 hover:underline">
                    <i class="fas fa-file-pdf"></i>
                    <span>Erro ao carregar preview. Clique para abrir.</span>
                </a>`;
        }
    }
    return attachmentEl;
}

function makeDraggable(element, nodeData) {
    let startX = 0, startY = 0;
    let startPos = {};
    let hasDragged = false;
    const dragThreshold = 5; // pixels

    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startPos = { x: element.offsetLeft, y: element.offsetTop };
        hasDragged = false;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        if (!hasDragged && (Math.sqrt(deltaX*deltaX + deltaY*deltaY) > dragThreshold)) {
            hasDragged = true;
        }
        
        if (hasDragged) {
            const newLeft = startPos.x + deltaX;
            const newTop = startPos.y + deltaY;
            element.style.top = `${newTop}px`;
            element.style.left = `${newLeft}px`;
        }
    }

    function closeDragElement(e) {
        document.onmouseup = null;
        document.onmousemove = null;

        if (hasDragged) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const newPos = { x: startPos.x + deltaX, y: startPos.y + deltaY };
            updateNodePosition(element.id, startPos, newPos);

            // Atualiza a posição das linhas conectadas ao nó
            Object.values(lines).forEach(line => {
                if (line.start.id === element.id || line.end.id === element.id) {
                    line.position();
                }
            });
        } else {
            // Se não arrastou, trata como um clique
            handleNodeClick(e, nodeData);
        }
    }
}

// --- DATABASE INTERACTIONS ---
async function createNewNode(x, y) {
    if (!auth.currentUser) {
        console.error("Não é possível criar o nó: usuário não autenticado.");
        alert("Você precisa estar logado para criar uma nova tarefa.");
        return;
    }
    const nodeData = { 
        text: "Nova Tarefa", 
        description: "",
        position: { x, y }, 
        color: "#334155", 
        createdAt: serverTimestamp(),
        status: "Pendente",
        assignee: auth.currentUser.uid,
        priority: "Normal",
        subtasks: []
    };
    try {
        const nodesCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes');
        await addDoc(nodesCollection, nodeData);
    } catch (error) {
        console.error("Erro ao criar novo nó:", error);
        alert("Ocorreu um erro ao criar a nova tarefa. Verifique as permissões do Firestore.");
    }
}

async function updateNodePosition(nodeId, oldPos, newPos) {
    const nodeRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes', nodeId);
    await updateDoc(nodeRef, { position: newPos });
}

// --- MODAL FUNCTIONS ---
function getStatusBadge(status) {
    let colorClass = 'bg-gray-500';
    if (status === 'Pendente') colorClass = 'bg-yellow-500';
    if (status === 'Em Progresso') colorClass = 'bg-orange-500';
    if (status === 'Concluída') colorClass = 'bg-green-500';
    return `<span class="status-badge px-2 py-1 text-sm rounded-full ${colorClass} text-black">${status}</span>`;
}

function openNodeModal(nodeData) {
    const freshNodeData = nodes[nodeData.id].data;
    nodeModalTitle.textContent = freshNodeData.text;
    const modalContent = document.getElementById('node-modal-content');
    const modalFooter = document.getElementById('node-modal-footer');

    const assigneeName = users.find(u => u.id === freshNodeData.assignee)?.name || 'Ninguém';
    const subtasksHTML = (freshNodeData.subtasks || []).map((task, index) => `
        <div class="flex items-center">
            <input type="checkbox" id="subtask-${index}" data-index="${index}" ${task.done ? 'checked' : ''} class="h-4 w-4 rounded border-gray-600 bg-gray-700 text-yellow-600">
            <label for="subtask-${index}" class="ml-2 text-sm ${task.done ? 'line-through text-gray-500' : ''}">${task.text}</label>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <div class="md:col-span-2 space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-700 pb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-400">Status</label>
                    ${getStatusBadge(freshNodeData.status || 'Pendente')}
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-400">Responsável</label>
                    <span class="text-white">${assigneeName}</span>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-400">Prazo</label>
                    <span class="text-white">${freshNodeData.dueDate || 'N/A'}</span>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-400">Prioridade</label>
                    <span class="text-green-400">${freshNodeData.priority || 'Baixa'}</span>
                </div>
            </div>
            <div>
                <h3 class="font-semibold text-lg mb-2">Descrição</h3>
                <p>${freshNodeData.description || 'Nenhuma descrição.'}</p>
            </div>
            <div>
                <h3 class="font-semibold text-lg mb-2">Subtarefas</h3>
                <div id="subtasks-container" class="space-y-2">${subtasksHTML || '<p class="text-gray-400">Nenhuma subtarefa.</p>'}</div>
            </div>
        </div>
        <div class="md:col-span-1 space-y-4 border-l border-gray-700 pl-6">
            <div>
                <label class="block text-sm font-medium text-gray-400">Ações</label>
                <button id="edit-node-btn" class="w-full bg-gray-600 hover:bg-gray-500 font-semibold py-2 px-4 rounded-lg mt-1">Editar Tarefa</button>
            </div>
        </div>
    `;

    modalFooter.innerHTML = `<button id="close-node-modal-footer-btn" class="bg-gray-600 hover:bg-gray-500 font-semibold py-2 px-4 rounded-lg">Fechar</button>`;

    nodeModal.classList.remove('hidden');
    nodeModal.classList.add('flex');

    document.getElementById('close-node-modal-footer-btn').addEventListener('click', closeNodeModal);
    document.getElementById('edit-node-btn').addEventListener('click', () => showEditView(freshNodeData));
    document.getElementById('subtasks-container').addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            toggleSubtask(freshNodeData.id, e.target.dataset.index);
        }
    });
}

function closeNodeModal() {
    nodeModal.classList.add('hidden');
    nodeModal.classList.remove('flex');
}

function showEditView(nodeData) {
    const modalContent = document.getElementById('node-modal-content');
    const modalFooter = document.getElementById('node-modal-footer');
    const userOptions = users.map(u => `<option value="${u.id}" ${nodeData.assignee === u.id ? 'selected' : ''}>${u.name}</option>`).join('');

    modalContent.innerHTML = `
        <div class="md:col-span-3 space-y-4">
            <form id="node-edit-form">
                <input type="hidden" id="edit-node-id" value="${nodeData.id}">
                <div>
                    <label for="edit-node-title" class="block text-sm font-medium text-gray-300 mb-1">Título</label>
                    <input type="text" id="edit-node-title" value="${nodeData.text}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                </div>
                <div>
                    <label for="edit-node-description" class="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
                    <textarea id="edit-node-description" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">${nodeData.description || ''}</textarea>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label for="edit-node-assignee" class="block text-sm font-medium text-gray-300 mb-1">Responsável</label>
                        <select id="edit-node-assignee" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                            <option value="">Ninguém</option>
                            ${userOptions}
                        </select>
                    </div>
                    <div>
                        <label for="edit-node-status" class="block text-sm font-medium text-gray-300 mb-1">Status</label>
                        <select id="edit-node-status" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                            <option value="Pendente" ${nodeData.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Em Progresso" ${nodeData.status === 'Em Progresso' ? 'selected' : ''}>Em Progresso</option>
                            <option value="Concluída" ${nodeData.status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                        </select>
                    </div>
                    <div>
                        <label for="edit-node-priority" class="block text-sm font-medium text-gray-300 mb-1">Prioridade</label>
                        <select id="edit-node-priority" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                            <option value="Baixa" ${nodeData.priority === 'Baixa' ? 'selected' : ''}>Baixa</option>
                            <option value="Normal" ${nodeData.priority === 'Normal' ? 'selected' : ''}>Normal</option>
                            <option value="Alta" ${nodeData.priority === 'Alta' ? 'selected' : ''}>Alta</option>
                            <option value="Urgente" ${nodeData.priority === 'Urgente' ? 'selected' : ''}>Urgente</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label for="new-subtask" class="block text-sm font-medium text-gray-300 mb-1">Nova Subtarefa</label>
                    <div class="flex gap-2">
                        <input type="text" id="new-subtask" placeholder="Adicionar item..." class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                        <button type="button" id="add-subtask-btn" class="bg-gray-600 hover:bg-gray-500 font-semibold py-2 px-4 rounded-lg">Add</button>
                    </div>
                </div>
            </form>
        </div>
    `;

    modalFooter.innerHTML = `
        <button id="cancel-edit-btn" class="bg-gray-600 hover:bg-gray-500 font-semibold py-2 px-4 rounded-lg">Cancelar</button>
        <button id="save-changes-btn" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg">Salvar Alterações</button>
    `;

    document.getElementById('cancel-edit-btn').addEventListener('click', () => openNodeModal(nodeData));
    document.getElementById('save-changes-btn').addEventListener('click', saveNodeDetails);
    document.getElementById('add-subtask-btn').addEventListener('click', () => {
        const newSubtaskInput = document.getElementById('new-subtask');
        const text = newSubtaskInput.value.trim();
        if (text) {
            const currentSubtasks = nodes[nodeData.id].data.subtasks || [];
            const newSubtasks = [...currentSubtasks, { text, done: false }];
            nodes[nodeData.id].data.subtasks = newSubtasks;
            showEditView(nodes[nodeData.id].data);
        }
    });
}

async function saveNodeDetails() {
    const nodeId = document.getElementById('edit-node-id').value;
    if (!nodeId) return;

    const updatedData = {
        text: document.getElementById('edit-node-title').value,
        description: document.getElementById('edit-node-description').value,
        status: document.getElementById('edit-node-status').value,
        priority: document.getElementById('edit-node-priority').value,
        assignee: document.getElementById('edit-node-assignee').value,
        dueDate: document.getElementById('edit-node-dueDate')?.value || null,
        subtasks: nodes[nodeId].data.subtasks || [],
        updatedAt: serverTimestamp()
    };

    const nodeRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes', nodeId);
    await updateDoc(nodeRef, updatedData);
    
    closeNodeModal();
}

async function toggleSubtask(nodeId, index) {
    const nodeData = nodes[nodeId].data;
    const subtasks = [...(nodeData.subtasks || [])];
    subtasks[index].done = !subtasks[index].done;
    const nodeRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes', nodeId);
    await updateDoc(nodeRef, { subtasks });
}

closeNodeModalBtn.addEventListener('click', closeNodeModal);
nodeModal.addEventListener('click', (e) => {
    if (e.target === nodeModal) {
        closeNodeModal();
    }
});

canvas.addEventListener('mousedown', (e) => {
    // Limpa a seleção se clicar no canvas vazio
    if (e.target === canvas) {
        clearNodeSelection();
    }
});

deleteNodeBtn.addEventListener('click', deleteSelectedNodes);

function clearNodeSelection() {
    selectedNodes.forEach(nodeId => {
        if (nodes[nodeId]) {
            nodes[nodeId].el.classList.remove('selected');
        }
    });
    selectedNodes = [];
    updateDeleteButtonState();
}

function updateDeleteButtonState() {
    deleteNodeBtn.disabled = selectedNodes.length === 0;
}

async function deleteSelectedNodes() {
    if (selectedNodes.length === 0 || !confirm(`Tem certeza que deseja excluir ${selectedNodes.length} item(s)?`)) {
        return;
    }

    const batch = writeBatch(db);
    selectedNodes.forEach(nodeId => {
        const nodeRef = doc(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes', nodeId);
        batch.delete(nodeRef);
    });

    try {
        await batch.commit();
        // A remoção dos elementos da UI será tratada pelo listener 'onSnapshot'
        clearNodeSelection();
    } catch (error) {
        console.error("Erro ao deletar nós:", error);
        alert("Ocorreu um erro ao deletar os itens.");
    }
}

drawModeBtn.addEventListener('click', toggleDrawMode);
linkNodesBtn.addEventListener('click', toggleLinkingMode);

function setupDrawingCanvas() {
    drawingCanvas.width = canvas.offsetWidth;
    drawingCanvas.height = canvas.offsetHeight;
    drawMode.ctx = drawingCanvas.getContext('2d');
    drawMode.ctx.strokeStyle = '#fde047'; // Amarelo
    drawMode.ctx.lineWidth = 3;
    drawMode.ctx.lineCap = 'round';
    drawMode.ctx.lineJoin = 'round';
}

function toggleDrawMode() {
    drawMode.active = !drawMode.active;
    if (drawMode.active) {
        setupDrawingCanvas();
        drawModeBtn.classList.add('bg-yellow-500');
        drawingCanvas.style.pointerEvents = 'auto';
        canvas.style.cursor = 'crosshair';
    } else {
        drawModeBtn.classList.remove('bg-yellow-500');
        drawingCanvas.style.pointerEvents = 'none';
        canvas.style.cursor = 'default';
    }
}

function getMousePos(evt) {
    const rect = drawingCanvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function draw(e) {
    if (!drawMode.drawing) return;
    const pos = getMousePos(e);
    drawMode.ctx.beginPath();
    drawMode.ctx.moveTo(drawMode.lastPos.x, drawMode.lastPos.y);
    drawMode.ctx.lineTo(pos.x, pos.y);
    drawMode.ctx.stroke();
    drawMode.lastPos = pos;
}

drawingCanvas.addEventListener('mousedown', (e) => {
    if (!drawMode.active) return;
    drawMode.drawing = true;
    drawMode.lastPos = getMousePos(e);
});

drawingCanvas.addEventListener('mouseup', () => {
    drawMode.drawing = false;
});

drawingCanvas.addEventListener('mousemove', draw);

drawingCanvas.addEventListener('mouseleave', () => {
    drawMode.drawing = false;
});


function toggleLinkingMode() {
    linkingMode.active = !linkingMode.active;
    if (linkingMode.active) {
        linkNodesBtn.classList.add('bg-blue-600');
        canvas.style.cursor = 'crosshair';
    } else {
        linkNodesBtn.classList.remove('bg-blue-600');
        canvas.style.cursor = 'default';
        if (linkingMode.startNode) {
            linkingMode.startNode.el.classList.remove('selected');
        }
        linkingMode.startNode = null;
    }
}

function handleNodeClick(event, nodeData) {
    if (linkingMode.active) {
        const clickedNode = nodes[nodeData.id];
        if (!linkingMode.startNode) {
            linkingMode.startNode = clickedNode;
            clickedNode.el.classList.add('selected');
        } else {
            if (linkingMode.startNode.el.id !== clickedNode.el.id) {
                createLink(linkingMode.startNode.el.id, clickedNode.el.id);
            }
            toggleLinkingMode();
        }
        return; // Impede que a lógica de seleção normal seja executada
    }

    const nodeEl = nodes[nodeData.id].el;
    const nodeId = nodeData.id;
    const isSelected = selectedNodes.includes(nodeId);

    if (!event.shiftKey) {
        // Limpa a seleção anterior, a menos que Shift esteja pressionado
        clearNodeSelection();
    }

    if (isSelected && event.shiftKey) {
        // Remove da seleção com Shift + Click
        nodeEl.classList.remove('selected');
        selectedNodes = selectedNodes.filter(id => id !== nodeId);
    } else if (!isSelected) {
        // Adiciona à seleção
        nodeEl.classList.add('selected');
        selectedNodes.push(nodeId);
    }
    
    updateDeleteButtonState();
}

async function createLink(startNodeId, endNodeId) {
    const linkData = {
        start: startNodeId,
        end: endNodeId
    };
    const linksCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'links');
    await addDoc(linksCollection, linkData);
}

function drawLine(linkData) {
    const startNode = document.getElementById(linkData.start);
    const endNode = document.getElementById(linkData.end);

    if (startNode && endNode) {
        const line = new LeaderLine(
            startNode,
            endNode,
            {
                color: '#94a3b8',
                size: 3,
                path: 'fluid',
                endPlug: 'arrow1'
            }
        );
        lines[linkData.id] = line;
    }
}

uploadPdfBtn.addEventListener('click', () => pdfInput.click());
uploadImageBtn.addEventListener('click', () => imageInput.click());

pdfInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0], 'pdf'));
imageInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0], 'image'));

async function handleFileUpload(file, type) {
    if (!file) return;

    const storageRef = ref(storage, `projects/${projectId}/${Date.now()}_${file.name}`);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        const attachmentData = {
            name: file.name,
            url: downloadURL,
            type: type
        };

        const nodeData = {
            text: file.name,
            position: { x: 200, y: 200 }, // Posição inicial padrão
            createdAt: serverTimestamp(),
            attachment: attachmentData
        };
        
        const nodesCollection = collection(db, 'artifacts', db.app.options.appId, 'public', 'data', 'projects', projectId, 'nodes');
        await addDoc(nodesCollection, nodeData);

    } catch (error) {
        console.error("Upload failed:", error);
        alert("Ocorreu um erro ao enviar o arquivo.");
    } finally {
        // Limpa o valor do input para permitir o upload do mesmo arquivo novamente
        pdfInput.value = '';
        imageInput.value = '';
    }
}
