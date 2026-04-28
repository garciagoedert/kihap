import { db } from '../../intranet/firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    limit 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let allUsers = [];
let filteredUsers = [];
let currentFilter = 'all';

export async function initSearch() {
    setupListeners();
    await loadAllUsers();
}

async function loadAllUsers() {
    const list = document.getElementById('results-list');
    
    try {
        // Inicialmente carregamos apenas os 100 mais recentes ou personagens
        const q = query(collection(db, 'users'), limit(100)); 
        const snap = await getDocs(q);
        
        allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Estado Inicial: Mostrar apenas Personagens (Kobe e outros mascotes futuros)
        filteredUsers = allUsers.filter(u => 
            u.isCharacter === true || 
            (u.name && u.name.includes('Kobe'))
        );
        renderResults();

    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        list.innerHTML = `<p class="text-center text-red-500 py-10">Não foi possível carregar os membros.</p>`;
    }
}

function setupListeners() {
    const input = document.getElementById('search-input');
    const tags = document.querySelectorAll('.filter-tag');

    input.oninput = (e) => {
        const term = e.target.value.toLowerCase().trim();
        applyFilters(term, currentFilter);
    };

    tags.forEach(tag => {
        tag.onclick = () => {
            tags.forEach(t => {
                t.classList.remove('active', 'bg-blue-600', 'text-white');
                t.classList.add('bg-white/5', 'text-gray-500', 'dark:text-gray-400');
            });
            tag.classList.add('active', 'bg-blue-600', 'text-white');
            tag.classList.remove('bg-white/5', 'text-gray-500', 'dark:text-gray-400');
            
            currentFilter = tag.dataset.filter;
            applyFilters(input.value.toLowerCase().trim(), currentFilter);
        };
    });
}

function applyFilters(term, filter) {
    // Se não há termo de busca e é o filtro "Todos", mostrar apenas personagens Sugeridos
    if (!term && filter === 'all') {
        filteredUsers = allUsers.filter(u => 
            u.isCharacter === true || 
            (u.name && u.name.includes('Kobe'))
        );
        renderResults();
        return;
    }

    filteredUsers = allUsers.filter(u => {
        const name = (u.name || u.displayName || "").toLowerCase();
        const unit = (u.unidade || u.unit || "").toLowerCase();
        const belt = (u.belt || "").toLowerCase();
        
        const matchesTerm = name.includes(term) || unit.includes(term) || belt.includes(term);
        
        // Se houver busca, ignoramos se é instrutor ou não para o filtro "Todos"
        if (filter === 'all') return matchesTerm;
        
        // Filtros específicos (Instrutores, Faixas Pretas, etc)
        if (filter === 'Instrutor') return matchesTerm && (u.isInstructor === true || u.isAdmin === true);
        return matchesTerm && (belt.includes(filter.toLowerCase()) || unit.includes(filter.toLowerCase()));
    });
    
    renderResults();
}

function renderResults() {
    const list = document.getElementById('results-list');
    
    if (filteredUsers.length === 0) {
        list.innerHTML = `
            <div class="text-center py-20 px-4">
                <i class="fas fa-search text-4xl text-gray-800 mb-4"></i>
                <p class="text-gray-500 font-medium">Nenhum membro encontrado.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filteredUsers.map(u => {
        const isStaff = u.isInstructor === true || u.isAdmin === true;
        
        return `
            <div class="glass-card p-4 rounded-2xl flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                 onclick="window.location.href='perfil-publico.html?id=${u.id}'">
                <div class="relative">
                    <img src="${u.profilePicture || u.photoURL || '/imgs/kobe.png'}" 
                        class="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-white/10 group-hover:scale-105 transition-transform">
                    <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full"></div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                        <h3 class="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">${u.name || u.displayName || 'Usuário Kihap'}</h3>
                        ${isStaff ? '<span class="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase rounded border border-blue-500/20">Instrutor</span>' : ''}
                        ${u.isCharacter ? '<span class="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[8px] font-black uppercase rounded border border-yellow-500/20">Personagem</span>' : ''}
                    </div>
                    <div class="flex items-center gap-2 overflow-hidden">
                        <span class="text-[10px] text-gray-500 uppercase tracking-widest font-black whitespace-nowrap">${u.belt || 'Membro'}</span>
                        <span class="text-[10px] text-gray-400 dark:text-gray-700">•</span>
                        <span class="text-[10px] text-gray-500 truncate">${u.unit || u.unidade || 'Kihap Unit'}</span>
                    </div>
                </div>
                <i class="fas fa-chevron-right text-gray-400 dark:text-gray-800 text-xs group-hover:translate-x-1 transition-transform"></i>
            </div>
        `;
    }).join('');
}
