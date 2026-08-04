import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, arrayUnion, Timestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { loadComponents, setupUIListeners } from './common-ui.js';

let db;
let auth;
let allArchivedLeads = [];

// Função para inicializar o Firebase e a página
export function initializeAppWithFirebase(firebaseConfig) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (localStorage.getItem('isLoggedIn') === 'true') {
                loadComponents(() => {
                    setupUIListeners({}); // Setup sidebar interactivity
                    loadArchivedLeads();
                    
                    const searchInput = document.getElementById('search-input');
                    const sectorFilter = document.getElementById('sector-filter');
                    const priorityFilter = document.getElementById('priority-filter');
                    const refreshBtn = document.getElementById('refresh-archived-btn');

                    if (searchInput) searchInput.addEventListener('input', applyFilters);
                    if (sectorFilter) sectorFilter.addEventListener('change', applyFilters);
                    if (priorityFilter) priorityFilter.addEventListener('change', applyFilters);
                    if (refreshBtn) refreshBtn.addEventListener('click', () => loadArchivedLeads());
                    
                    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
                    document.getElementById('cancelEditFormBtn').addEventListener('click', closeEditModal);
                    document.getElementById('editClientForm').addEventListener('submit', saveLeadChanges);
                    document.getElementById('openEditMapBtn').addEventListener('click', () => {
                        const address = document.getElementById('editClientEndereco').value;
                        if (address) {
                            const encodedAddress = encodeURIComponent(address);
                            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                            window.open(mapUrl, '_blank');
                        } else {
                            alert('Por favor, insira um endereço.');
                        }
                    });
                });
            } else {
                window.location.href = 'login.html';
            }
        } else {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Authentication Error:", error);
                document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 font-bold">Erro de autenticação. Tente novamente mais tarde.</div>`;
            }
        }
    });
}

// Função para carregar os leads arquivados
async function loadArchivedLeads() {
    const container = document.getElementById('archived-leads-container');
    container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
            <i class="fas fa-spinner fa-spin text-3xl text-amber-500 mb-3"></i>
            <p class="text-sm font-semibold">Carregando leads arquivados...</p>
        </div>
    `;

    try {
        const leadsRef = collection(db, 'prospects');
        const q = query(leadsRef, where('pagina', '==', 'Arquivo'));
        const querySnapshot = await getDocs(q);

        allArchivedLeads = [];
        querySnapshot.forEach(doc => {
            allArchivedLeads.push({ id: doc.id, ...doc.data() });
        });

        populateFilterDropdowns(allArchivedLeads);
        applyFilters();

    } catch (error) {
        console.error("Erro ao carregar leads arquivados: ", error);
        container.innerHTML = `
            <div class="col-span-full bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center text-red-400">
                <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                <p class="font-bold">Erro ao carregar os leads arquivados.</p>
            </div>
        `;
    }
}

function populateFilterDropdowns(leads) {
    const sectorFilter = document.getElementById('sector-filter');
    if (!sectorFilter) return;

    const sectors = [...new Set(leads.map(l => l.setor).filter(Boolean))].sort();
    const currentSelection = sectorFilter.value;

    sectorFilter.innerHTML = '<option value="">Todos os Setores</option>';
    sectors.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = s;
        if (s === currentSelection) option.selected = true;
        sectorFilter.appendChild(option);
    });
}

function applyFilters() {
    const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const selectedSector = document.getElementById('sector-filter')?.value || '';
    const selectedPriority = document.getElementById('priority-filter')?.value || '';

    const filtered = allArchivedLeads.filter(lead => {
        const matchesSearch = !searchVal || (
            (lead.empresa && lead.empresa.toLowerCase().includes(searchVal)) ||
            (lead.responsavel && lead.responsavel.toLowerCase().includes(searchVal)) ||
            (lead.setor && lead.setor.toLowerCase().includes(searchVal)) ||
            (lead.telefone && lead.telefone.toLowerCase().includes(searchVal)) ||
            (lead.email && lead.email.toLowerCase().includes(searchVal))
        );

        const matchesSector = !selectedSector || lead.setor === selectedSector;
        const matchesPriority = !selectedPriority || String(lead.prioridade) === String(selectedPriority);

        return matchesSearch && matchesSector && matchesPriority;
    });

    updateKPIs(filtered);
    renderLeadsGrid(filtered);
}

function updateKPIs(leads) {
    const totalArchived = leads.length;
    const totalTicket = leads.reduce((acc, l) => acc + (parseFloat(l.ticketEstimado) || 0), 0);
    const totalContacts = leads.reduce((acc, l) => acc + (Array.isArray(l.contactLog) ? l.contactLog.length : 0), 0);
    const uniqueSectors = new Set(leads.map(l => l.setor).filter(Boolean)).size;

    const kpiTotal = document.getElementById('kpi-total-archived');
    const kpiValue = document.getElementById('kpi-total-value');
    const kpiContacts = document.getElementById('kpi-total-contacts');
    const kpiSectors = document.getElementById('kpi-total-sectors');

    if (kpiTotal) kpiTotal.textContent = totalArchived;
    if (kpiValue) kpiValue.textContent = totalTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (kpiContacts) kpiContacts.textContent = totalContacts;
    if (kpiSectors) kpiSectors.textContent = uniqueSectors;
}

function renderLeadsGrid(leads) {
    const container = document.getElementById('archived-leads-container');
    container.innerHTML = '';

    if (leads.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-gray-800 p-12 text-center text-gray-400 space-y-3">
                <div class="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 text-2xl mx-auto border border-amber-500/20">
                    <i class="fas fa-box-open"></i>
                </div>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Nenhum lead arquivado encontrado</h3>
                <p class="text-xs text-gray-500">Tente ajustar seus termos de busca ou filtros aplicados.</p>
            </div>
        `;
        return;
    }

    leads.forEach(lead => {
        const title = lead.responsavel || lead.empresa || 'Lead sem nome';
        const subtitle = lead.empresa && lead.responsavel ? lead.empresa : (lead.setor || 'Setor não informado');
        const rawPhone = lead.telefone ? lead.telefone.replace(/\D/g, '') : '';
        const waUrl = rawPhone ? `https://wa.me/55${rawPhone}` : '#';
        const ticketFmt = lead.ticketEstimado ? (parseFloat(lead.ticketEstimado)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;
        const logCount = Array.isArray(lead.contactLog) ? lead.contactLog.length : 0;

        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-gray-800/80 p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-amber-500/30 flex flex-col justify-between group space-y-5';
        
        card.innerHTML = `
            <div class="space-y-4">
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-base border border-amber-500/20 shrink-0">
                            ${title.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-amber-500 transition-colors line-clamp-1">${title}</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-1">${subtitle}</p>
                        </div>
                    </div>
                    
                    ${lead.setor ? `
                        <span class="px-2.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                            ${lead.setor}
                        </span>
                    ` : ''}
                </div>

                <!-- Info Badges Grid -->
                <div class="grid grid-cols-2 gap-2 text-xs">
                    ${ticketFmt ? `
                        <div class="bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span class="text-[10px] text-gray-400 uppercase font-bold block">Ticket</span>
                            <span class="font-extrabold text-emerald-500">${ticketFmt}</span>
                        </div>
                    ` : `
                        <div class="bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span class="text-[10px] text-gray-400 uppercase font-bold block">Prioridade</span>
                            <span class="font-bold text-amber-500">⭐ ${lead.prioridade || '3'}/5</span>
                        </div>
                    `}
                    
                    <div class="bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <span class="text-[10px] text-gray-400 uppercase font-bold block">Contatos</span>
                        <span class="font-bold text-blue-500"><i class="fas fa-comments text-[10px] mr-1"></i>${logCount} reg.</span>
                    </div>
                </div>

                <!-- Contact Info Details -->
                <div class="space-y-1.5 pt-1 text-xs text-gray-600 dark:text-gray-400">
                    ${lead.telefone ? `
                        <div class="flex items-center gap-2">
                            <i class="fas fa-phone text-gray-400 text-xs w-4"></i>
                            <a href="tel:${lead.telefone}" class="hover:text-amber-500 transition-colors font-medium">${lead.telefone}</a>
                        </div>
                    ` : ''}
                    
                    ${lead.email ? `
                        <div class="flex items-center gap-2">
                            <i class="fas fa-envelope text-gray-400 text-xs w-4"></i>
                            <a href="mailto:${lead.email}" class="hover:text-amber-500 transition-colors font-medium truncate">${lead.email}</a>
                        </div>
                    ` : ''}

                    ${lead.createdBy ? `
                        <div class="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
                            <i class="fas fa-user-plus text-gray-400 text-xs w-4"></i>
                            <span>Criado por: <strong class="text-gray-400">${lead.createdBy}</strong></span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Card Bottom Quick Actions -->
            <div class="pt-4 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    ${rawPhone ? `
                        <a href="${waUrl}" target="_blank" class="w-9 h-9 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl flex items-center justify-center text-sm transition-all border border-emerald-500/20" title="Conversar no WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </a>
                    ` : ''}
                    <button data-id="${lead.id}" class="unarchive-quick-btn w-9 h-9 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl flex items-center justify-center text-sm transition-all border border-emerald-500/20" title="Desarquivar para CRM">
                        <i class="fas fa-box-open"></i>
                    </button>
                </div>

                <button data-id="${lead.id}" class="edit-btn px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-amber-500 text-gray-700 dark:text-gray-200 hover:text-black font-extrabold text-xs rounded-xl transition-all border border-gray-200 dark:border-gray-700/80 flex items-center gap-1.5">
                    <i class="fas fa-pen text-[10px]"></i> Ver / Editar
                </button>
            </div>
        `;

        container.appendChild(card);
    });

    // Attach card event listeners
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const leadId = e.currentTarget.dataset.id;
            const leadData = allArchivedLeads.find(l => l.id === leadId);
            if (leadData) openEditModal(leadData);
        });
    });

    document.querySelectorAll('.unarchive-quick-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const leadId = e.currentTarget.dataset.id;
            unarchiveLead(leadId);
        });
    });
}

function renderContactLog(logs = []) {
    const logContainer = document.getElementById('contactLogContainer');
    if (!logContainer) return;

    if (!logs || logs.length === 0) {
        logContainer.innerHTML = '<p class="text-gray-500 text-xs italic">Nenhum registro de contato adicionado.</p>';
        return;
    }

    logContainer.innerHTML = logs
        .slice()
        .sort((a, b) => {
            const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime()) : 0;
            const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime()) : 0;
            return timeB - timeA;
        })
        .map(log => {
            let dateStr = 'Data pendente';
            if (log.timestamp) {
                if (log.timestamp.toDate) dateStr = log.timestamp.toDate().toLocaleString('pt-BR');
                else dateStr = new Date(log.timestamp).toLocaleString('pt-BR');
            }
            const author = log.author || 'Sistema';
            return `
                <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                    <p class="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-medium">${log.description}</p>
                    <p class="text-[10px] text-gray-400 text-right mt-1 font-semibold">${author} • ${dateStr}</p>
                </div>
            `;
        }).join('');
}

function openEditModal(lead) {
    document.getElementById('editClientId').value = lead.id;
    document.getElementById('editClientEmpresa').value = lead.empresa || '';
    document.getElementById('editClientSetor').value = lead.setor || '';
    document.getElementById('editClientPrioridade').value = lead.prioridade || '';
    document.getElementById('editClientTicket').value = lead.ticketEstimado || '';
    document.getElementById('editOrigemLead').value = lead.origemLead || '';
    document.getElementById('editResponsavel').value = lead.responsavel || '';
    document.getElementById('editClientTelefone').value = lead.telefone || '';
    document.getElementById('editClientEmail').value = lead.email || '';
    document.getElementById('editClientCpf').value = lead.cpf || '';
    document.getElementById('editClientCnpj').value = lead.cnpj || '';
    document.getElementById('editClientEndereco').value = lead.endereco || '';
    document.getElementById('editClientRedesSociais').value = lead.redesSociais || '';
    document.getElementById('editClientSiteAtual').value = lead.siteAtual || '';
    document.getElementById('editClientObservacoes').value = lead.observacoes || '';

    renderContactLog(lead.contactLog);

    const createdByContainer = document.getElementById('createdByContainer');
    const createdByInfo = document.getElementById('createdByInfo');
    if (lead.createdBy) {
        createdByInfo.textContent = lead.createdBy;
        createdByContainer.classList.remove('hidden');
    } else {
        createdByContainer.classList.add('hidden');
    }

    const fields = document.getElementById('editClientForm').querySelectorAll('input, select, textarea');
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelEditFormBtn = document.getElementById('cancelEditFormBtn');
    const addContactLogBtn = document.getElementById('addContactLogBtn');
    const newContactLogTextarea = document.getElementById('newContactLog');
    const contactLogSection = newContactLogTextarea.parentElement;

    const setFormEditable = (isEditable) => {
        fields.forEach(field => {
            if (field.id !== 'editClientId') field.disabled = !isEditable;
        });
        contactLogSection.style.display = isEditable ? 'flex' : 'none';
        editBtn.classList.toggle('hidden', isEditable);
        saveBtn.classList.toggle('hidden', !isEditable);
        cancelEditFormBtn.classList.toggle('hidden', !isEditable);
    };

    const newAddContactBtn = addContactLogBtn.cloneNode(true);
    addContactLogBtn.parentNode.replaceChild(newAddContactBtn, addContactLogBtn);
    newAddContactBtn.addEventListener('click', async () => {
        const description = newContactLogTextarea.value.trim();
        if (!description) return alert('Por favor, adicione uma descrição para o contato.');
        
        try {
            const clientRef = doc(db, 'prospects', lead.id);
            await updateDoc(clientRef, {
                contactLog: arrayUnion({
                    author: auth.currentUser ? auth.currentUser.email || 'anonymous' : 'anonymous',
                    description: description,
                    timestamp: Timestamp.now()
                })
            });
            newContactLogTextarea.value = '';
            // Refresh lead contact logs
            lead.contactLog = lead.contactLog || [];
            lead.contactLog.push({
                author: auth.currentUser ? auth.currentUser.email || 'anonymous' : 'anonymous',
                description: description,
                timestamp: Timestamp.now()
            });
            renderContactLog(lead.contactLog);
        } catch (error) {
            console.error("Error adding contact log:", error);
            alert("Erro ao adicionar o registro de contato.");
        }
    });

    setFormEditable(false);
    editBtn.onclick = () => setFormEditable(true);
    cancelEditFormBtn.onclick = () => openEditModal(lead);

    const unarchiveBtn = document.getElementById('unarchiveBtn');
    unarchiveBtn.onclick = () => unarchiveLead(lead.id);

    const deleteBtn = document.getElementById('deleteBtn');
    deleteBtn.onclick = () => deleteLead(lead.id);

    const modal = document.getElementById('editClientModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    const modal = document.getElementById('editClientModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

async function unarchiveLead(leadId) {
    if (!confirm('Tem certeza que deseja desarquivar este lead e enviá-lo de volta ao CRM?')) return;

    try {
        const leadRef = doc(db, 'prospects', leadId);
        await updateDoc(leadRef, {
            pagina: 'Prospecção',
            status: 'Pendente'
        });
        closeEditModal();
        await loadArchivedLeads();
    } catch (error) {
        console.error("Error unarchiving lead:", error);
        alert("Erro ao desarquivar o lead.");
    }
}

async function deleteLead(leadId) {
    if (!confirm('Tem certeza que deseja excluir este lead permanentemente? Esta ação não pode ser desfeita.')) return;

    try {
        const leadRef = doc(db, 'prospects', leadId);
        await deleteDoc(leadRef);
        closeEditModal();
        await loadArchivedLeads();
    } catch (error) {
        console.error("Error deleting lead:", error);
        alert("Erro ao excluir o lead.");
    }
}

async function saveLeadChanges(e) {
    e.preventDefault();
    const leadId = document.getElementById('editClientId').value;
    const data = {
        empresa: document.getElementById('editClientEmpresa').value,
        setor: document.getElementById('editClientSetor').value,
        prioridade: parseInt(document.getElementById('editClientPrioridade').value, 10),
        ticketEstimado: parseFloat(document.getElementById('editClientTicket').value) || 0,
        origemLead: document.getElementById('editOrigemLead').value,
        responsavel: document.getElementById('editResponsavel').value,
        telefone: document.getElementById('editClientTelefone').value,
        email: document.getElementById('editClientEmail').value,
        cpf: document.getElementById('editClientCpf').value,
        cnpj: document.getElementById('editClientCnpj').value,
        endereco: document.getElementById('editClientEndereco').value,
        redesSociais: document.getElementById('editClientRedesSociais').value,
        siteAtual: document.getElementById('editClientSiteAtual').value,
        observacoes: document.getElementById('editClientObservacoes').value,
        updatedAt: Timestamp.now()
    };

    try {
        const leadRef = doc(db, 'prospects', leadId);
        await updateDoc(leadRef, data);
        closeEditModal();
        await loadArchivedLeads();
    } catch (error) {
        console.error("Error updating lead:", error);
        alert("Erro ao salvar as alterações.");
    }
}

