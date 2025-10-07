import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, setDoc, getDocs, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadComponents, showConfirm } from './common-ui.js';
import { getCurrentUser, getAllUsers, checkAdminStatus } from './auth.js';

// Elementos do DOM
const groupList = document.getElementById('group-list');
const directMessageList = document.getElementById('direct-message-list');
const chatTitle = document.getElementById('chat-title');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
const newGroupBtn = document.getElementById('newGroupBtn');
const newGroupModal = document.getElementById('newGroupModal');
const closeGroupModalBtn = document.getElementById('closeGroupModalBtn');
const cancelGroupBtn = document.getElementById('cancelGroupBtn');
const createGroupBtn = document.getElementById('createGroupBtn');
const groupNameInput = document.getElementById('groupName');
const groupMembersContainer = document.getElementById('group-members');
const userSearchInput = document.getElementById('user-search-input');
const searchResultsContainer = document.getElementById('search-results');
const viewAsBtn = document.getElementById('viewAsBtn');
const viewAsModal = document.getElementById('viewAsModal');
const closeViewAsModalBtn = document.getElementById('closeViewAsModalBtn');
const viewAsUserSearchInput = document.getElementById('viewAs-user-search-input');
const viewAsSearchResultsContainer = document.getElementById('viewAs-search-results');
const viewAsBanner = document.getElementById('viewAsBanner');
const viewAsBannerText = document.getElementById('viewAsBannerText');
const exitViewAsBtn = document.getElementById('exitViewAsBtn');
const emojiButton = document.getElementById('emoji-button');
const emojiPickerContainer = document.getElementById('emoji-picker-container');
const reactionEmojiPickerContainer = document.getElementById('reaction-emoji-picker-container');

// Variáveis de estado
let currentChatId = null;
let currentReactionMessageId = null;
let isViewingAs = false;
let viewingAsUser = null;
let allUsers = [];
const userCache = new Map();
let currentUser = null;
let unsubscribeMessages = null;

async function initializeChat() {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        console.log("Nenhum usuário autenticado, redirecionando...");
        // A função onAuthReady em auth.js já deve cuidar do redirecionamento
        return;
    }
    console.log("CHAT_LOG: Usuário inicializado:", JSON.stringify(currentUser));

    const isAdmin = await checkAdminStatus(currentUser);
    if (isAdmin) {
        viewAsBtn.classList.remove('hidden');
        newGroupBtn.classList.remove('hidden');
    }

    await fetchAllUsersForModal();
    populateConversationsList(currentUser.id);

    // Recupera o chat ativo da sessão
    const activeChatId = sessionStorage.getItem('activeChatId');
    if (activeChatId) {
        loadChatFromId(activeChatId);
    }
}

async function fetchAllUsersForModal() {
    allUsers = await getAllUsers();
    allUsers.forEach(user => {
        if (!userCache.has(user.id)) {
            userCache.set(user.id, user);
        }
    });
    populateGroupMembers();
}

function populateConversationsList(userId) {
    const chatsCollection = collection(db, 'chats');
    const q = query(chatsCollection, where('members', 'array-contains', userId));

    onSnapshot(q, (snapshot) => {
        const groups = [];
        const directMessages = [];
        snapshot.forEach(doc => {
            const chatData = { id: doc.id, ...doc.data() };
            if (chatData.isGroup) {
                groups.push(chatData);
            } else {
                directMessages.push(chatData);
            }
        });

        // Ordena as listas pela última mensagem
        const sortChats = (a, b) => (b.lastMessage?.timestamp?.toMillis() || 0) - (a.lastMessage?.timestamp?.toMillis() || 0);
        groups.sort(sortChats);
        directMessages.sort(sortChats);

        renderChatLists(groups, directMessages, userId);
    });
}

async function renderChatLists(groups, directMessages, currentUserId) {
    groupList.innerHTML = '';
    groups.forEach(group => renderGroupItem(group, group.id, currentUserId));

    directMessageList.innerHTML = '';
    for (const dm of directMessages) {
        await renderUserItem(dm, dm.id, currentUserId);
    }
}

function renderGroupItem(chat, chatId, currentUserId) {
    const groupElement = document.createElement('div');
    groupElement.className = 'group flex items-center justify-between p-2 hover:bg-gray-700 cursor-pointer rounded-lg transition-colors duration-150';
    groupElement.setAttribute('data-chat-id', chatId);
    
    const safeUserKey = currentUserId.replace(/\./g, '_');
    const unreadCount = chat.unreadCount?.[safeUserKey] || 0;
    if (unreadCount > 0) {
        groupElement.classList.add('bg-gray-700', 'font-bold');
    }
    if (chatId === currentChatId) {
        groupElement.classList.add('bg-primary-dark');
    }

    groupElement.innerHTML = `
        <div class="truncate font-bold flex-1">${chat.name}</div>
        ${unreadCount > 0 ? `<div class="bg-primary text-black text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2">${unreadCount}</div>` : ''}
        <button class="delete-chat-btn text-gray-500 hover:text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    groupElement.querySelector('.truncate').onclick = () => selectChat(chat, true);
    groupElement.querySelector('.delete-chat-btn').onclick = (e) => {
        e.stopPropagation(); // Prevent chat selection
        deleteChat(chat.id, chat.name);
    };
    groupList.appendChild(groupElement);
}

async function renderUserItem(chat, chatId, currentUserId) {
    const otherUserId = chat.members.find(id => id !== currentUserId);
    if (!otherUserId) return;

    let otherUserData = userCache.get(otherUserId);
    if (!otherUserData) {
        otherUserData = await getUserData(otherUserId);
        if (otherUserData) userCache.set(otherUserId, otherUserData);
    }

    if (otherUserData) {
        const userElement = document.createElement('div');
        userElement.className = 'group flex items-center justify-between p-2 hover:bg-gray-700 cursor-pointer rounded-lg transition-colors duration-150';
        userElement.setAttribute('data-chat-id', chatId);

        const safeUserKey = currentUserId.replace(/\./g, '_');
        const unreadCount = chat.unreadCount?.[safeUserKey] || 0;
        if (unreadCount > 0) {
            userElement.classList.add('bg-gray-700', 'font-bold');
        }
        if (chatId === currentChatId) {
            userElement.classList.add('bg-primary-dark');
        }

        const avatarHtml = otherUserData.profilePicture
            ? `<img src="${otherUserData.profilePicture}" alt="Foto de perfil" class="w-10 h-10 rounded-full mr-3 flex-shrink-0 object-cover">`
            : `<div class="w-10 h-10 rounded-full mr-3 flex-shrink-0 bg-gray-700 flex items-center justify-center"><i class="fas fa-user-circle text-gray-400 text-2xl"></i></div>`;

        userElement.innerHTML = `
            <div class="flex items-center overflow-hidden flex-1">
                ${avatarHtml}
                <div class="overflow-hidden">
                    <div class="truncate">${otherUserData.name || 'Usuário'}</div>
                    <div class="text-sm text-gray-400 truncate">${otherUserData.email}</div>
                </div>
            </div>
            ${unreadCount > 0 ? `<div class="bg-primary text-black text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2">${unreadCount}</div>` : ''}
            <button class="delete-chat-btn text-gray-500 hover:text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        userElement.querySelector('.flex-1').onclick = () => selectChat({ ...chat, otherUser: otherUserData }, false);
        userElement.querySelector('.delete-chat-btn').onclick = (e) => {
            e.stopPropagation(); // Prevent chat selection
            deleteChat(chat.id, otherUserData.name || otherUserData.email);
        };
        directMessageList.appendChild(userElement);
    }
}

function selectChat(chatData, isGroup) {
    const headerAvatar = document.getElementById('chat-header-avatar');
    currentChatId = chatData.id;
    sessionStorage.setItem('activeChatId', currentChatId);
    
    if (isGroup) {
        chatTitle.textContent = chatData.name;
        headerAvatar.classList.add('hidden');
    } else {
        const otherUser = chatData.otherUser;
        chatTitle.textContent = otherUser.name || otherUser.email;
        if (otherUser.profilePicture) {
            headerAvatar.src = otherUser.profilePicture;
            headerAvatar.alt = otherUser.name;
            headerAvatar.classList.remove('hidden');
        } else {
            headerAvatar.classList.add('hidden');
        }
    }

    loadMessages(chatData.id, isGroup);
    enableChatInput();
}

async function loadChatFromId(chatId) {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
        const chatData = { id: chatSnap.id, ...chatSnap.data() };
        if (chatData.isGroup) {
            selectChat(chatData, true);
        } else {
            const otherUserId = chatData.members.find(id => id !== currentUser.id);
            const otherUserData = userCache.get(otherUserId) || await getUserData(otherUserId);
            if (otherUserData) {
                selectChat({ ...chatData, otherUser: otherUserData }, false);
            }
        }
    } else {
        console.error("Chat não encontrado:", chatId);
        sessionStorage.removeItem('activeChatId');
    }
}

async function searchUser() {
    const searchTerm = userSearchInput.value.trim().toLowerCase();
    if (!searchTerm) {
        searchResultsContainer.innerHTML = '';
        searchResultsContainer.classList.add('hidden');
        return;
    }

    const foundUsers = allUsers.filter(u =>
        u.id !== currentUser.id &&
        (u.name?.toLowerCase().includes(searchTerm) || u.email?.toLowerCase().includes(searchTerm))
    );

    searchResultsContainer.innerHTML = '';
    if (foundUsers.length === 0) {
        searchResultsContainer.innerHTML = '<div class="p-2 text-gray-500">Nenhum usuário encontrado.</div>';
    } else {
        foundUsers.forEach(foundUser => {
            const userElement = document.createElement('div');
            userElement.className = 'flex items-center p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer rounded-lg';
            const avatarHtml = foundUser.profilePicture ? `<img src="${foundUser.profilePicture}" alt="Foto" class="w-10 h-10 rounded-full mr-3">` : `<div class="w-10 h-10 rounded-full mr-3 bg-gray-300 flex items-center justify-center"><i class="fas fa-user-circle text-2xl"></i></div>`;
            userElement.innerHTML = `${avatarHtml}<div><div class="font-bold">${foundUser.name || 'Usuário'}</div><div class="text-sm">${foundUser.email}</div></div>`;
            userElement.onclick = () => {
                startChat(foundUser.id, foundUser.name || foundUser.email);
                userSearchInput.value = '';
                searchResultsContainer.classList.add('hidden');
            };
            searchResultsContainer.appendChild(userElement);
        });
    }
    searchResultsContainer.classList.remove('hidden');
}

function populateGroupMembers() {
    if (!currentUser) return;
    groupMembersContainer.innerHTML = '';
    allUsers.forEach(u => {
        if (u.id !== currentUser.id) {
            const memberElement = document.createElement('div');
            memberElement.className = 'flex items-center';
            memberElement.innerHTML = `
                <input type="checkbox" id="user-${u.id}" value="${u.id}" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-gray-700">
                <label for="user-${u.id}" class="ml-2 block text-sm">${u.name || u.email}</label>
            `;
            groupMembersContainer.appendChild(memberElement);
        }
    });
}

async function startChat(otherUserId, otherUserName) {
    if (!currentUser) return;
    console.log(`CHAT_LOG: Iniciando chat. De: ${currentUser.id} Para: ${otherUserId}`);
    const chatId = [currentUser.id, otherUserId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
        const unreadCount = {};
        unreadCount[currentUser.id.replace(/\./g, '_')] = 0;
        unreadCount[otherUserId.replace(/\./g, '_')] = 0;
        await setDoc(chatRef, {
            members: [currentUser.id, otherUserId],
            isGroup: false,
            createdAt: serverTimestamp(),
            unreadCount: unreadCount
        });
    }
    const newChatData = { id: chatId, members: [currentUser.id, otherUserId], otherUser: { id: otherUserId, name: otherUserName } };
    selectChat(newChatData, false);
}

async function loadMessages(chatId, isGroup) {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    const messagesCollection = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesCollection, orderBy('timestamp'));

    let isInitialLoad = true;
    unsubscribeMessages = onSnapshot(q, async (snapshot) => {
        const placeholder = chatMessages.querySelector('.flex.flex-col.items-center.justify-center');
        if (snapshot.empty && placeholder) {
            placeholder.classList.remove('hidden');
        } else if (!snapshot.empty) {
            chatMessages.innerHTML = ''; // Clear placeholder if messages exist
        }

        for (const messageDoc of snapshot.docs) {
            const message = messageDoc.data();
            const messageId = messageDoc.id;
            const isSender = message.senderId === currentUser.id;

            let senderInfoHtml = '';
            if (isGroup && !isSender) {
                const senderData = userCache.get(message.senderId) || await getUserData(message.senderId);
                if (senderData) {
                    const avatarHtml = senderData.profilePicture ? `<img src="${senderData.profilePicture}" class="w-6 h-6 rounded-full mr-2 object-cover">` : `<div class="w-6 h-6 rounded-full mr-2 bg-gray-700 flex items-center justify-center"><i class="fas fa-user-circle text-sm"></i></div>`;
                    senderInfoHtml = `<div class="flex items-center mb-1"><span class="text-sm font-bold text-gray-400">${senderData.name || 'Usuário'}</span></div>`;
                }
            }

            const messageTime = message.timestamp ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const messageElement = document.createElement('div');
            messageElement.className = `message-container group relative flex flex-col mb-2 max-w-md ${isSender ? 'items-end self-end' : 'items-start self-start'}`;
            messageElement.setAttribute('data-message-id', messageId);

            const bubbleClass = isSender ? 'bg-primary text-black' : 'bg-gray-700 text-gray-200';
            messageElement.innerHTML = `
                ${senderInfoHtml}
                <div class="message-bubble relative p-3 rounded-lg ${bubbleClass}">
                    ${message.text}
                </div>
                <div class="text-xs text-gray-500 mt-1">${messageTime}</div>
            `;
            chatMessages.appendChild(messageElement);
        }

        if (isInitialLoad) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
            isInitialLoad = false;
        }

        // Marcar mensagens como lidas
        const chatRef = doc(db, 'chats', chatId);
        const safeUserKey = currentUser.id.replace(/\./g, '_');
        await updateDoc(chatRef, { [`unreadCount.${safeUserKey}`]: 0 });
    });
}

async function sendMessage() {
    if (isViewingAs) return;
    const user = await getCurrentUser(); // Fetch the latest user state
    if (!user) {
        console.error("User not authenticated. Cannot send message.");
        return;
    }
    console.log(`CHAT_LOG: Enviando mensagem como: ${user.id} (${user.email})`);

    const text = messageInput.value.trim();
    if (text && currentChatId) {
        const messagesCollection = collection(db, 'chats', currentChatId, 'messages');
        await addDoc(messagesCollection, {
            text: text,
            senderId: user.id, // Use the freshly fetched user's ID
            timestamp: serverTimestamp(),
            status: 'enviado'
        });

        const chatRef = doc(db, 'chats', currentChatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
            const chatData = chatSnap.data();
            const unreadCountUpdate = {};
            chatData.members.forEach(memberId => {
                if (memberId !== user.id) { // Use the freshly fetched user
                    const safeMemberKey = memberId.replace(/\./g, '_');
                    unreadCountUpdate[`unreadCount.${safeMemberKey}`] = (chatData.unreadCount?.[safeMemberKey] || 0) + 1;
                }
            });

            await updateDoc(chatRef, {
                lastMessage: { text, senderId: user.id, timestamp: serverTimestamp() }, // Use the freshly fetched user
                ...unreadCountUpdate
            });
        }
        messageInput.value = '';
    }
}

async function createGroup() {
    if (!currentUser) return;
    const groupName = groupNameInput.value.trim();
    const selectedMembers = Array.from(groupMembersContainer.querySelectorAll('input:checked')).map(input => input.value);
    if (groupName && selectedMembers.length > 0) {
        selectedMembers.push(currentUser.id);
        const chatsCollection = collection(db, 'chats');
        const unreadCount = {};
        selectedMembers.forEach(id => { unreadCount[id.replace(/\./g, '_')] = 0; });

        const newGroupRef = await addDoc(chatsCollection, {
            name: groupName,
            members: selectedMembers,
            isGroup: true,
            createdAt: serverTimestamp(),
            unreadCount: unreadCount
        });
        const newGroupData = { id: newGroupRef.id, name: groupName };
        selectChat(newGroupData, true);
        newGroupModal.classList.add('hidden');
        groupNameInput.value = '';
        groupMembersContainer.querySelectorAll('input:checked').forEach(input => input.checked = false);
    }
}

function enableChatInput() {
    if (isViewingAs) {
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = "Visualizando como outro usuário (somente leitura)";
    } else {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = "Digite sua mensagem...";
    }
}

// --- Lógica do "Ver como" ---
async function searchUserForViewAs() {
    const searchTerm = viewAsUserSearchInput.value.trim().toLowerCase();
    if (!searchTerm) {
        viewAsSearchResultsContainer.innerHTML = '';
        return;
    }
    const foundUsers = allUsers.filter(u =>
        u.id !== currentUser.id &&
        (u.name?.toLowerCase().includes(searchTerm) || u.email?.toLowerCase().includes(searchTerm))
    );
    viewAsSearchResultsContainer.innerHTML = '';
    if (foundUsers.length === 0) {
        viewAsSearchResultsContainer.innerHTML = '<div class="p-2">Nenhum usuário encontrado.</div>';
    } else {
        foundUsers.forEach(foundUser => {
            const userElement = document.createElement('div');
            userElement.className = 'flex items-center p-2 hover:bg-gray-700 cursor-pointer rounded-lg';
            const avatarHtml = foundUser.profilePicture ? `<img src="${foundUser.profilePicture}" alt="Foto" class="w-10 h-10 rounded-full mr-3">` : `<div class="w-10 h-10 rounded-full mr-3 bg-gray-700 flex items-center justify-center"><i class="fas fa-user-circle text-2xl"></i></div>`;
            userElement.innerHTML = `${avatarHtml}<div><div class="font-bold">${foundUser.name || 'Usuário'}</div><div class="text-sm">${foundUser.email}</div></div>`;
            userElement.onclick = () => startViewingAs(foundUser);
            viewAsSearchResultsContainer.appendChild(userElement);
        });
    }
}

function startViewingAs(user) {
    isViewingAs = true;
    viewingAsUser = user;
    viewAsBannerText.textContent = `Visualizando como ${user.name}`;
    viewAsBanner.classList.remove('hidden');
    viewAsBanner.classList.add('flex');
    groupList.innerHTML = '';
    directMessageList.innerHTML = '';
    chatMessages.innerHTML = '';
    chatTitle.textContent = `Visualizando como ${user.name}`;
    enableChatInput();
    populateConversationsList(user.id);
    viewAsModal.classList.add('hidden');
}

function exitViewingAs() {
    isViewingAs = false;
    viewingAsUser = null;
    viewAsBanner.classList.add('hidden');
    viewAsBanner.classList.remove('flex');
    chatTitle.textContent = 'Selecione uma conversa';
    enableChatInput();
    populateConversationsList(currentUser.id);
}

// Event Listeners
userSearchInput.addEventListener('input', searchUser);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
newGroupBtn.addEventListener('click', () => newGroupModal.classList.remove('hidden'));
closeGroupModalBtn.addEventListener('click', () => newGroupModal.classList.add('hidden'));
cancelGroupBtn.addEventListener('click', () => newGroupModal.classList.add('hidden'));
createGroupBtn.addEventListener('click', createGroup);
viewAsBtn.addEventListener('click', () => viewAsModal.classList.remove('hidden'));
closeViewAsModalBtn.addEventListener('click', () => viewAsModal.classList.add('hidden'));
viewAsUserSearchInput.addEventListener('input', searchUserForViewAs);
exitViewAsBtn.addEventListener('click', exitViewingAs);

document.addEventListener('click', (event) => {
    if (!event.target.closest('#search-results') && event.target !== userSearchInput) {
        searchResultsContainer.classList.add('hidden');
    }
});

chatMessages.addEventListener('scroll', () => {
    if (chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop > 200) {
        scrollToBottomBtn.classList.remove('opacity-0');
    } else {
        scrollToBottomBtn.classList.add('opacity-0');
    }
});

scrollToBottomBtn.addEventListener('click', () => {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
});

window.addEventListener('beforeunload', () => {
    if (currentChatId) {
        sessionStorage.setItem('activeChatId', currentChatId);
    } else {
        sessionStorage.removeItem('activeChatId');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadComponents(initializeChat);
});

// Função para deletar um chat
function deleteChat(chatId, chatName) {
    showConfirm(`Tem certeza que deseja apagar o chat "${chatName}"? Esta ação não pode ser desfeita e apagará todas as mensagens.`, async () => {
        try {
            const chatRef = doc(db, 'chats', chatId);
            
            // Firestore não apaga subcoleções automaticamente no client-side.
            // É preciso deletar as mensagens primeiro.
            const messagesRef = collection(db, 'chats', chatId, 'messages');
            const messagesSnap = await getDocs(messagesRef);
            const batch = writeBatch(db);
            messagesSnap.forEach(messageDoc => {
                batch.delete(messageDoc.ref);
            });
            await batch.commit();

            // Agora, deletar o documento do chat
            await deleteDoc(chatRef);
            
            console.log(`Chat ${chatId} deletado.`);
            if (currentChatId === chatId) {
                currentChatId = null;
                sessionStorage.removeItem('activeChatId');
                chatTitle.textContent = 'Selecione uma conversa';
                chatMessages.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-500">
                                            <i class="fas fa-comments text-5xl mb-4"></i>
                                            <p>Suas mensagens aparecerão aqui</p>
                                          </div>`;
                enableChatInput();
            }
        } catch (error) {
            console.error("Erro ao deletar chat:", error);
            alert("Erro ao deletar chat. Verifique as permissões do Firestore.");
        }
    });
}
