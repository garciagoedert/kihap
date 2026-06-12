import { onAuthReady } from './auth.js';
import { db, storage } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, serverTimestamp, query, orderBy, deleteDoc, doc, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Map to store product names for fast lookups
const productsMap = new Map();
let checkinsUnsubscribe = null;

// State for search filtering in the modal
let allRegistered = [];
let allCheckins = [];

// State for editing events
let editingEventId = null;
let currentEventCoverUrl = '';

function filterAndRenderRegistered() {
    const queryStr = document.getElementById('search-registered').value.toLowerCase().trim();
    const registeredList = document.getElementById('modal-registered-list');
    const filtered = allRegistered.filter(item => item.userName.toLowerCase().includes(queryStr));
    
    if (filtered.length === 0) {
        registeredList.innerHTML = '<tr><td colspan="2" class="text-center py-8 text-gray-500">Nenhum aluno encontrado.</td></tr>';
    } else {
        registeredList.innerHTML = filtered.map(item => `
            <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100/30 dark:hover:bg-gray-800/10">
                <td class="py-2.5 font-semibold text-gray-900 dark:text-gray-100">${item.userName}</td>
                <td class="py-2.5 text-right text-gray-400 font-bold">${item.dateStr}</td>
            </tr>
        `).join('');
    }
}

function filterAndRenderCheckins() {
    const queryStr = document.getElementById('search-checkins').value.toLowerCase().trim();
    const checkinsList = document.getElementById('modal-checkins-list');
    const filtered = allCheckins.filter(item => item.userName.toLowerCase().includes(queryStr));
    
    if (filtered.length === 0) {
        checkinsList.innerHTML = '<tr><td colspan="2" class="text-center py-8 text-gray-500">Nenhum check-in encontrado.</td></tr>';
    } else {
        checkinsList.innerHTML = filtered.map(item => `
            <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100/30 dark:hover:bg-gray-800/10">
                <td class="py-2.5 font-semibold text-gray-900 dark:text-gray-100">${item.userName}</td>
                <td class="py-2.5 text-right text-emerald-500 font-bold">${item.dateStr}</td>
            </tr>
        `).join('');
    }
}

function startEditEvent(eventId, data) {
    editingEventId = eventId;
    currentEventCoverUrl = data.coverUrl;

    document.getElementById('event-form-title').textContent = 'Editar Evento';
    document.getElementById('submit-event-btn').textContent = 'Salvar Alterações';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');

    document.getElementById('event-title').value = data.title;
    document.getElementById('event-date').value = data.date;
    document.getElementById('event-time').value = data.time;
    document.getElementById('event-location').value = data.location;
    document.getElementById('event-product').value = data.productId || '';
    document.getElementById('event-description').value = data.description;

    document.getElementById('event-image').required = false;
    document.getElementById('event-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditEvent() {
    editingEventId = null;
    currentEventCoverUrl = '';

    document.getElementById('event-form-title').textContent = 'Adicionar Novo Evento';
    document.getElementById('submit-event-btn').textContent = 'Salvar Evento';
    document.getElementById('cancel-edit-btn').classList.add('hidden');

    document.getElementById('event-form').reset();
    document.getElementById('event-image').required = true;
}

export function setupCalendarioPage() {
    onAuthReady(user => {
        if (user) {
            // Setup Form Submit
            const eventForm = document.getElementById('event-form');
            eventForm.addEventListener('submit', handleAddEvent);

            // Setup List Interactions (Delete, Control and Edit buttons)
            const listContainer = document.getElementById('events-list-container');
            listContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                if (btn.classList.contains('delete-event-btn')) {
                    const eventId = btn.dataset.id;
                    const imageUrl = btn.dataset.imageUrl;
                    handleDeleteEvent(eventId, imageUrl);
                } else if (btn.classList.contains('control-event-btn')) {
                    const eventId = btn.dataset.id;
                    const productId = btn.dataset.productId;
                    const title = btn.dataset.title;
                    openControlModal(eventId, productId, title);
                } else if (btn.classList.contains('edit-event-btn')) {
                    const eventId = btn.dataset.id;
                    const eventData = {
                        title: btn.dataset.title,
                        date: btn.dataset.date,
                        time: btn.dataset.time,
                        location: btn.dataset.location,
                        productId: btn.dataset.productId,
                        description: btn.dataset.description,
                        coverUrl: btn.dataset.coverUrl
                    };
                    startEditEvent(eventId, eventData);
                }
            });

            // Setup Modal Close Handlers
            const closeModalBtn = document.getElementById('close-modal-btn');
            const controlModal = document.getElementById('control-modal');
            closeModalBtn.addEventListener('click', () => {
                controlModal.classList.add('hidden');
                if (checkinsUnsubscribe) {
                    checkinsUnsubscribe();
                    checkinsUnsubscribe = null;
                }
            });

            // Setup Search Listeners
            const searchRegistered = document.getElementById('search-registered');
            const searchCheckins = document.getElementById('search-checkins');
            searchRegistered.addEventListener('input', filterAndRenderRegistered);
            searchCheckins.addEventListener('input', filterAndRenderCheckins);

            // Setup Cancel Edit Listener
            const cancelEditBtn = document.getElementById('cancel-edit-btn');
            cancelEditBtn.addEventListener('click', cancelEditEvent);

            // Fetch products first, then load events list
            loadProductsAndEvents();
        }
    });
}

async function loadProductsAndEvents() {
    const productSelect = document.getElementById('event-product');
    try {
        // Clear select options except first
        productSelect.innerHTML = '<option value="">Nenhum produto vinculado</option>';

        // 1. Fetch store products
        const productsQuery = query(collection(db, 'products'), orderBy('name', 'asc'));
        const productsSnap = await getDocs(productsQuery);
        
        productsSnap.forEach(docSnap => {
            const prod = docSnap.data();
            productsMap.set(docSnap.id, prod.name);

            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = prod.name;
            productSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
    }

    // 2. Fetch and render events
    loadEvents();
}

async function loadEvents() {
    const container = document.getElementById('events-list-container');
    container.innerHTML = '<p class="col-span-full text-center text-gray-500 py-12">Carregando eventos...</p>';

    try {
        const q = query(collection(db, "events"), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500 py-12">Nenhum evento cadastrado ainda.</p>';
            return;
        }

        let eventsHtml = '';
        querySnapshot.forEach(docSnap => {
            const event = docSnap.data();
            const eventId = docSnap.id;
            
            // Format date for display (DD/MM/YYYY)
            let formattedDate = 'N/D';
            if (event.date) {
                const [y, m, d] = event.date.split('-');
                formattedDate = `${d}/${m}/${y}`;
            }

            // Resolve linked product name
            const linkedProductName = event.productId ? (productsMap.get(event.productId) || 'Produto não encontrado') : 'Nenhum';

            // Escape special chars for HTML attributes
            const escapedTitle = (event.title || '').replace(/"/g, '&quot;');
            const escapedLocation = (event.location || '').replace(/"/g, '&quot;');
            const escapedDescription = (event.description || '').replace(/"/g, '&quot;');

            eventsHtml += `
                <div class="bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl overflow-hidden event-card flex flex-col">
                    <div class="h-44 w-full relative bg-gray-200 dark:bg-gray-800">
                        <img src="${event.coverUrl || 'https://via.placeholder.com/400x200.png?text=Sem+Capa'}" alt="${event.title}" class="w-full h-full object-cover">
                        <div class="absolute top-4 left-4 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                            ${formattedDate}
                        </div>
                    </div>
                    <div class="p-5 flex-grow flex flex-col">
                        <h3 class="font-black text-lg text-gray-900 dark:text-white leading-tight mb-2">${event.title}</h3>
                        
                        <div class="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4">
                            <p><i class="fas fa-clock w-5"></i> <strong>Horário:</strong> ${event.time || 'N/D'}</p>
                            <p><i class="fas fa-map-marker-alt w-5"></i> <strong>Local:</strong> ${event.location || 'N/D'}</p>
                            <p><i class="fas fa-shopping-bag w-5"></i> <strong>Produto:</strong> ${linkedProductName}</p>
                        </div>

                        <p class="text-xs text-gray-650 dark:text-gray-450 leading-relaxed line-clamp-3 mb-6 flex-grow">
                            ${event.description || 'Sem descrição.'}
                        </p>

                        <div class="flex gap-2">
                            <button data-id="${eventId}" data-product-id="${event.productId || ''}" data-title="${escapedTitle}" class="control-event-btn flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5">
                                <i class="fas fa-chart-line"></i> Controle
                            </button>
                            <button data-id="${eventId}" data-title="${escapedTitle}" data-date="${event.date || ''}" data-time="${event.time || ''}" data-location="${escapedLocation}" data-product-id="${event.productId || ''}" data-description="${escapedDescription}" data-cover-url="${event.coverUrl || ''}" class="edit-event-btn bg-yellow-500/10 hover:bg-yellow-500 text-yellow-600 hover:text-white font-bold p-2 px-3.5 rounded-xl text-xs transition active:scale-95">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button data-id="${eventId}" data-image-url="${event.coverUrl || ''}" class="delete-event-btn bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white font-bold p-2 px-3.5 rounded-xl text-xs transition active:scale-95">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = eventsHtml;

    } catch (error) {
        console.error("Erro ao carregar eventos: ", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500 py-12">Ocorreu um erro ao carregar os eventos.</p>';
    }
}

async function handleAddEvent(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-event-btn');
    const form = e.target;
    
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value; // YYYY-MM-DD
    const time = document.getElementById('event-time').value.trim();
    const location = document.getElementById('event-location').value.trim();
    const productId = document.getElementById('event-product').value;
    const description = document.getElementById('event-description').value.trim();
    const imageFile = document.getElementById('event-image').files[0];

    if (!title || !date || !time || !location || !description) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    if (!editingEventId && !imageFile) {
        alert("Por favor, envie uma foto de capa.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = editingEventId ? 'Salvando Alterações...' : 'Salvando...';

    try {
        let coverUrl = currentEventCoverUrl;

        // Upload new image if chosen
        if (imageFile) {
            const fileExtension = imageFile.name.split('.').pop();
            const storageRef = ref(storage, `events/${Date.now()}_cover.${fileExtension}`);
            const snapshot = await uploadBytes(storageRef, imageFile);
            coverUrl = await getDownloadURL(snapshot.ref);

            // Delete old storage image if editing and there was one
            if (editingEventId && currentEventCoverUrl) {
                const oldImageRef = ref(storage, currentEventCoverUrl);
                await deleteObject(oldImageRef).catch(err => console.warn("Storage deletion warning (old cover):", err));
            }
        }

        const eventData = {
            title,
            date,
            time,
            location,
            productId: productId || null,
            description,
            coverUrl
        };

        if (editingEventId) {
            // Edit existing
            await updateDoc(doc(db, "events", editingEventId), eventData);
            alert("Evento atualizado com sucesso!");
        } else {
            // Add new
            await addDoc(collection(db, "events"), {
                ...eventData,
                createdAt: serverTimestamp()
            });
            alert("Evento adicionado com success!");
        }

        cancelEditEvent();
        loadEvents();

    } catch (error) {
        console.error("Erro ao salvar evento: ", error);
        alert(`Ocorreu um erro ao salvar o evento: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingEventId ? 'Salvar Alterações' : 'Salvar Evento';
    }
}

async function handleDeleteEvent(eventId, imageUrl) {
    if (!confirm("Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        // 1. Delete Firestore Document
        await deleteDoc(doc(db, "events", eventId));

        // 2. Delete Storage Image File
        if (imageUrl) {
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef).catch(err => console.warn("Storage deletion warning:", err));
        }

        alert("Evento excluído com sucesso!");
        loadEvents();

    } catch (error) {
        console.error("Erro ao excluir evento: ", error);
        alert(`Ocorreu um erro ao excluir o evento: ${error.message}`);
    }
}

async function openControlModal(eventId, productId, title) {
    const controlModal = document.getElementById('control-modal');
    const modalTitle = document.getElementById('modal-event-title');
    const modalDetails = document.getElementById('modal-event-details');
    
    const statRegistered = document.getElementById('modal-stat-registered');
    const statCheckins = document.getElementById('modal-stat-checkins');
    const statRate = document.getElementById('modal-stat-rate');
    
    const registeredList = document.getElementById('modal-registered-list');
    const checkinsList = document.getElementById('modal-checkins-list');

    // Reset search inputs
    document.getElementById('search-registered').value = '';
    document.getElementById('search-checkins').value = '';

    // Clear state
    allRegistered = [];
    allCheckins = [];

    // Display modal
    controlModal.classList.remove('hidden');
    modalTitle.textContent = `Controle: ${title}`;
    
    // Clear lists
    registeredList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-gray-500">Buscando inscritos...</td></tr>';
    checkinsList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-gray-500">Buscando presenças...</td></tr>';
    
    statRegistered.textContent = '0';
    statCheckins.textContent = '0';
    statRate.textContent = '0%';

    let registeredCount = 0;
    let checkinsCount = 0;

    // 1. Fetch Registered Students (Inscrições via Purchases)
    if (!productId) {
        modalDetails.textContent = "Sem produto de inscrição vinculado.";
        registeredList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-gray-400">Este evento não possui produto vinculado. Inscrição aberta.</td></tr>';
        statRegistered.textContent = 'N/A';
        statRate.textContent = '100%';
    } else {
        modalDetails.textContent = `Produto vinculado: ${productsMap.get(productId) || 'Carregando...'}`;
        try {
            const regQuery = query(
                collection(db, 'inscricoesFaixaPreta'),
                where('productId', '==', productId),
                where('paymentStatus', '==', 'paid')
            );
            const regSnap = await getDocs(regQuery);
            
            if (regSnap.empty) {
                registeredList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-gray-500">Nenhum aluno inscrito ainda.</td></tr>';
            } else {
                allRegistered = regSnap.docs.map(docSnap => {
                    const data = docSnap.data();
                    let dateStr = 'N/D';
                    if (data.created) {
                        const dateObj = data.created.toDate ? data.created.toDate() : new Date(data.created);
                        dateStr = dateObj.toLocaleDateString('pt-BR');
                    }
                    return {
                        id: docSnap.id,
                        userName: data.userName || 'Aluno Kihap',
                        dateStr: dateStr
                    };
                });
                registeredCount = allRegistered.length;
                statRegistered.textContent = registeredCount.toString();
                filterAndRenderRegistered();
            }

        } catch (error) {
            console.error("Erro ao buscar inscritos:", error);
            registeredList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-red-500">Erro ao carregar inscritos.</td></tr>';
        }
    }

    // 2. Listen to real-time check-ins (Presenças subcollection)
    try {
        const checkinsRef = collection(db, 'events', eventId, 'checkins');
        const checkinsQuery = query(checkinsRef, orderBy('checkedInAt', 'desc'));
        
        checkinsUnsubscribe = onSnapshot(checkinsQuery, (snap) => {
            checkinsCount = snap.size;
            statCheckins.textContent = checkinsCount.toString();

            // Calculate presence rate
            if (productId && registeredCount > 0) {
                const rate = Math.round((checkinsCount / registeredCount) * 100);
                statRate.textContent = `${rate}%`;
            } else {
                statRate.textContent = '100%';
            }

            if (snap.empty) {
                checkinsList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-gray-500">Nenhum check-in realizado ainda.</td></tr>';
                allCheckins = [];
            } else {
                allCheckins = snap.docs.map(docSnap => {
                    const checkin = docSnap.data();
                    let dateStr = 'Agora';
                    if (checkin.checkedInAt) {
                        const dateObj = checkin.checkedInAt.toDate ? checkin.checkedInAt.toDate() : new Date(checkin.checkedInAt);
                        dateStr = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }
                    return {
                        id: docSnap.id,
                        userName: checkin.userName || 'Aluno',
                        dateStr: dateStr
                    };
                });
                filterAndRenderCheckins();
            }
        }, (error) => {
            console.error("Erro ao escutar check-ins em tempo real:", error);
            checkinsList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-red-500">Erro ao escutar check-ins.</td></tr>';
        });

    } catch (error) {
        console.error("Erro ao inicializar escuta de check-ins:", error);
        checkinsList.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-red-500">Erro de inicialização.</td></tr>';
    }
}
