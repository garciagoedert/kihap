import { auth, db } from '../../intranet/firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthReady } from './auth.js';

export function initNPSCollector() {
    onAuthReady(async (userData) => {
        if (!userData) return;

        const shouldShow = await checkNPSEligibility(userData.uid || userData.id);
        if (shouldShow) {
            renderNPSModal(userData);
        }
    });
}

async function checkNPSEligibility(userId) {
    try {
        const q = query(
            collection(db, "nps_responses"),
            where("studentId", "==", userId),
            orderBy("timestamp", "desc"),
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) return true;

        const lastResponse = querySnapshot.docs[0].data();
        const lastDate = lastResponse.timestamp.toDate();
        const now = new Date();
        const diffDays = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24));

        return diffDays >= 90; // Mostra a cada 90 dias
    } catch (error) {
        console.error("Erro ao verificar elegibilidade NPS:", error);
        return false;
    }
}

async function renderNPSModal(userData) {
    // Remove if already exists
    const existing = document.getElementById('nps-modal');
    if (existing) existing.remove();

    const modalHtml = `
        <div id="nps-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div class="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-scale-up">
                <div class="p-8">
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                                <i class="fas fa-star text-yellow-500 text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-white">Sua opinião importa!</h3>
                                <p class="text-gray-500 dark:text-gray-400 text-sm">Como está sendo sua experiência na Kihap?</p>
                            </div>
                        </div>
                        <button id="close-nps" class="text-gray-500 hover:text-white transition-colors">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>

                    <form id="nps-form" class="space-y-6">
                        <!-- Step 1: Base Info & Main NPS -->
                        <div id="nps-step-1" class="space-y-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                                    Em uma escala de 0 a 10, o quanto você recomendaria a Kihap para um amigo ou familiar?
                                </label>
                                <div class="grid grid-cols-11 gap-1">
                                    ${Array.from({ length: 11 }).map((_, i) => `
                                        <button type="button" data-score="${i}" class="nps-score-btn h-10 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-yellow-500 hover:text-yellow-500 transition-all font-bold">
                                            ${i}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Unidade</label>
                                    <select id="nps-unit" required class="w-full bg-[#222] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors">
                                        <option value="${userData.unitId || ''}">${userData.branchName || 'Carregando unidade...'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Professor(a)</label>
                                    <select id="nps-professor" required class="w-full bg-[#222] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors">
                                        <option value="">Selecione o professor</option>
                                    </select>
                                </div>
                            </div>

                            <button type="button" id="nps-next-btn" disabled class="w-full bg-yellow-500 disabled:bg-gray-800 disabled:text-gray-500 text-black font-bold py-4 rounded-xl hover:bg-yellow-400 transition-all">
                                Avaliar Detalhes <i class="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>

                        <!-- Step 2: Category Ratings -->
                        <div id="nps-step-2" class="hidden space-y-4">
                            <h4 class="text-white font-bold text-center mb-2">Avalie as categorias (0 a 10)</h4>
                            
                            <div class="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                ${['Estrutura', 'Limpeza', 'Materiais', 'Atendimento', 'Professores'].map(cat => `
                                    <div>
                                        <label class="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 text-center">${cat}</label>
                                        <div class="flex gap-1">
                                            ${Array.from({length: 11}).map((_, i) => `
                                                <button type="button" data-cat="${cat.toLowerCase()}" data-val="${i}" class="cat-score-btn flex-1 h-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-800 text-[10px] text-gray-500 hover:border-yellow-500 font-bold transition-all">${i}</button>
                                            `).join('')}
                                        </div>
                                        <input type="hidden" id="nps-cat-${cat.toLowerCase()}" required>
                                    </div>
                                `).join('')}
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">O que podemos melhorar? (Opcional)</label>
                                <textarea id="nps-comment" rows="3" class="w-full bg-[#222] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors resize-none" placeholder="Conte-nos um pouco mais sobre sua nota..."></textarea>
                            </div>

                            <button type="submit" id="submit-nps" disabled class="w-full bg-yellow-500 disabled:bg-gray-800 disabled:text-gray-500 text-black font-bold py-4 rounded-xl hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20">
                                Enviar Avaliação
                            </button>
                            <button type="button" onclick="document.getElementById('nps-step-1').classList.remove('hidden'); document.getElementById('nps-step-2').classList.add('hidden');" class="w-full text-gray-500 text-xs py-2 hover:text-white transition-colors">
                                <i class="fas fa-arrow-left mr-1"></i> Voltar ao início
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Initializations
    let selectedScore = null;
    let categoryScores = { estrutura: null, limpeza: null, materiais: null, atendimento: null, professores: null };
    
    const scoreBtns = document.querySelectorAll('.nps-score-btn');
    const catBtns = document.querySelectorAll('.cat-score-btn');
    const nextBtn = document.getElementById('nps-next-btn');
    const submitBtn = document.getElementById('submit-nps');
    const professorSelect = document.getElementById('nps-professor');
    const unitSelect = document.getElementById('nps-unit');

    // Populate units if branchName is missing or generic
    if (!userData.branchName) {
        loadUnitsIntoSelect(unitSelect, userData.unitId);
    }

    // Populate instructors
    loadInstructorsIntoSelect(professorSelect);

    // Step navigation logic
    nextBtn.addEventListener('click', () => {
        if (!selectedScore || !professorSelect.value || !unitSelect.value) {
            alert('Por favor, preencha todos os campos do primeiro passo.');
            return;
        }
        document.getElementById('nps-step-1').classList.add('hidden');
        document.getElementById('nps-step-2').classList.remove('active', 'hidden');
    });

    // Score selection logic
    scoreBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scoreBtns.forEach(b => b.classList.remove('bg-yellow-500', 'text-black', 'border-yellow-500'));
            btn.classList.add('bg-yellow-500', 'text-black', 'border-yellow-500');
            selectedScore = parseInt(btn.dataset.score);
            nextBtn.disabled = false;
        });
    });

    // Category Score selection logic
    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            const val = parseInt(btn.dataset.val);
            
            // Toggle UI
            document.querySelectorAll(`.cat-score-btn[data-cat="${cat}"]`).forEach(b => {
                b.classList.remove('bg-yellow-500', 'text-black', 'border-yellow-500');
            });
            btn.classList.add('bg-yellow-500', 'text-black', 'border-yellow-500');
            
            categoryScores[cat] = val;
            document.getElementById(`nps-cat-${cat}`).value = val;
            
            // Check if all categories are rated to enable submit
            const allRated = Object.values(categoryScores).every(v => v !== null);
            if (allRated) submitBtn.disabled = false;
        });
    });

    // Close logic
    document.getElementById('close-nps').addEventListener('click', () => {
        document.getElementById('nps-modal').remove();
    });

    // Submit logic
    document.getElementById('nps-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const originalContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        const npsData = {
            score: selectedScore,
            score_estrutura: categoryScores.estrutura,
            score_limpeza: categoryScores.limpeza,
            score_materiais: categoryScores.materiais,
            score_atendimento: categoryScores.atendimento,
            score_instructor: categoryScores.professores,
            comment: document.getElementById('nps-comment').value.trim(),
            unitId: unitSelect.value,
            unitName: unitSelect.options[unitSelect.selectedIndex].text,
            professorId: professorSelect.value,
            professorName: professorSelect.options[professorSelect.selectedIndex].text,
            studentId: userData.uid || userData.id,
            studentName: userData.name || 'Aluno',
            timestamp: serverTimestamp()
        };

        try {
            await addDoc(collection(db, "nps_responses"), npsData);
            
            // Success State
            const modalContent = document.querySelector('#nps-modal .p-8');
            modalContent.innerHTML = `
                <div class="text-center py-12 animate-fade-in">
                    <div class="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-check text-green-500 text-4xl"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-white mb-2">Obrigado pelo seu feedback!</h3>
                    <p class="text-gray-500 dark:text-gray-400">Sua avaliação foi enviada com sucesso e nos ajuda a melhorar cada dia mais.</p>
                    <button onclick="this.closest('#nps-modal').remove()" class="mt-8 px-8 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors">
                        Fechar
                    </button>
                </div>
            `;
            
            setTimeout(() => {
                const modal = document.getElementById('nps-modal');
                if (modal) modal.remove();
            }, 3000);
            
        } catch (error) {
            console.error("Erro ao enviar NPS:", error);
            alert("Erro ao enviar avaliação. Por favor, tente novamente.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
        }
    });

    // CSS for animations and custom scrollbar
    if (!document.getElementById('nps-styles')) {
        const styles = `
            <style id="nps-styles">
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scale-up { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-scale-up { animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

async function loadInstructorsIntoSelect(selectElement) {
    try {
        const q = query(collection(db, 'users'), where('isInstructor', '==', true), orderBy('name'));
        const querySnapshot = await getDocs(q);
        
        selectElement.innerHTML = '<option value="">Selecione o professor</option>';
        
        // Blacklist keywords (always excluded)
        const blacklist = ['Admin', 'Financeiro', 'Suporte', 'Teste', 'Kihap', 'Unidade', 'Store'];
        // Allowed titles (strictly required for non-whitelisted names)
        const titles = ['Mr.', 'Mrs.', 'Ms.', 'Sra.', 'Srta.', 'Prof.', 'Professor', 'Master', 'Guro'];

        querySnapshot.forEach(doc => {
            const instructor = doc.data();
            const name = instructor.name || '';
            const lowerName = name.toLowerCase();
            
            // 1. Check blacklist
            if (blacklist.some(u => lowerName.includes(u.toLowerCase()))) return;
            
            // 2. Check if name contains a title
            const hasTitle = titles.some(t => name.includes(t));
            
            // 3. Only allow if it has a official title
            if (hasTitle) {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = name;
                selectElement.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Erro ao carregar instrutores para NPS:", error);
    }
}

function loadUnitsIntoSelect(selectElement, currentUnitId) {
    const UNITS = {
        'centro': 'Unidade Centro',
        'coqueiros': 'Unidade Coqueiros',
        'asa-sul': 'Unidade Asa Sul',
        'sudoeste': 'Unidade Sudoeste',
        'lago-sul': 'Unidade Lago Sul',
        'pontos-de-ensino': 'Unidade Pontos de Ensino',
        'jardim-botanico': 'Unidade Jardim Botânico',
        'dourados': 'Unidade Dourados',
        'santa-monica': 'Unidade Santa Mônica',
        'noroeste': 'Unidade Noroeste',
        'atadf': 'Unidade Store'
    };

    selectElement.innerHTML = '';
    
    // Add current unit first if valid
    if (currentUnitId && UNITS[currentUnitId]) {
        const opt = document.createElement('option');
        opt.value = currentUnitId;
        opt.textContent = UNITS[currentUnitId];
        selectElement.appendChild(opt);
    } else {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "Selecione a unidade";
        selectElement.appendChild(opt);
    }

    // Add others
    Object.entries(UNITS).forEach(([id, name]) => {
        if (id !== currentUnitId) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            selectElement.appendChild(opt);
        }
    });
}

// Global function to trigger manually
window.openNPSModal = () => {
    onAuthReady((userData) => {
        if (userData) renderNPSModal(userData);
    });
};
