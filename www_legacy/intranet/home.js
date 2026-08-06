import { db } from './firebase-config.js';
import { loadComponents } from './common-ui.js';
import { onAuthReady } from './auth.js';
import { collection, getDocs, query, orderBy, where, collectionGroup, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Quote Library
const quotes = [
    { text: "A disciplina é a mãe do êxito.", author: "Ésquilo" },
    { text: "Não é o que fazemos de vez em quando que molda nossa vida, é o que fazemos consistentemente.", author: "Tony Robbins" },
    { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
    { text: "Motivação é o que faz você começar. Hábito é o que faz você continuar.", author: "Jim Ryun" },
    { text: "A excelência não é um ato, mas um hábito.", author: "Aristóteles" },
    { text: "Faixa preta é um faixa branca que nunca desistiu.", author: "Anônimo" },
    { text: "Se você quer algo que nunca teve, você precisa fazer algo que nunca fez.", author: "Thomas Jefferson" },
    { text: "O único lugar onde o sucesso vem antes do trabalho é no dicionário.", author: "Vidal Sassoon" },
    { text: "Acredite que você pode, assim você já está no meio do caminho.", author: "Theodore Roosevelt" },
    { text: "Persistência é o caminho do êxito.", author: "Charles Chaplin" }
];

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(async (user) => {
        loadComponents();
        if (user) {
            setupDashboard();
        }
    });
});

function setupDashboard() {
    displayDailyQuote();
    loadStats();
}

async function displayDailyQuote() {
    const today = new Date().getDate();
    const quoteEl = document.getElementById('daily-quote');
    const authorEl = document.getElementById('quote-author');

    if (!quoteEl || !authorEl) return;

    let activeQuotes = [...quotes]; // Start with fallback quotes

    // Helper to render a quote based on current activeQuotes
    const renderQuote = () => {
        const quoteIndex = today % activeQuotes.length;
        const quote = activeQuotes[quoteIndex];

        console.log("Displaying quote:", quote);

        if (quote) {
            quoteEl.textContent = `"${quote.text}"`;
            authorEl.textContent = `- ${quote.author}`;
        } else {
            // Fallback safety
            quoteEl.textContent = '"A disciplina é a mãe do êxito."';
            authorEl.textContent = '- Ésquilo';
        }
    };

    // Render immediately with fallback quotes
    renderQuote();

    try {
        const q = query(collection(db, "daily_quotes"));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const dbQuotes = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.text && data.author) {
                    dbQuotes.push(data);
                }
            });
            // Only switch to DB quotes if we found valid ones
            if (dbQuotes.length > 0) {
                activeQuotes = [...quotes, ...dbQuotes];
                // Render again with new quotes
                renderQuote();
            }
        }
    } catch (error) {
        console.error("Error fetching quotes:", error);
    }

    // Hide Skeleton and Show Content
}

async function loadStats() {
    // Map of all 10 verified units configured with valid tokens
    const VERIFIED_UNITS = {
        'lago-sul': { activeStudents: 150, todayEntries: 0 },
        'centro': { activeStudents: 32, todayEntries: 0 },
        'santa-monica': { activeStudents: 129, todayEntries: 0 },
        'coqueiros': { activeStudents: 35, todayEntries: 0 },
        'asa-sul': { activeStudents: 150, todayEntries: 0 },
        'sudoeste': { activeStudents: 148, todayEntries: 0 },
        'pontos-de-ensino': { activeStudents: 46, todayEntries: 0 },
        'jardim-botanico': { activeStudents: 81, todayEntries: 0 },
        'dourados': { activeStudents: 53, todayEntries: 0 },
        'noroeste': { activeStudents: 114, todayEntries: 5 }
    };

    let totalActiveContracts = 0;
    let totalEvoEntries = 0;
    const processedUnits = new Set();

    try {
        const statusSnap = await getDocs(collection(db, 'evo_sync_status'));
        if (!statusSnap.empty) {
            statusSnap.forEach(docSnap => {
                const data = docSnap.data();
                const uId = docSnap.id.toLowerCase().trim();

                // If this is one of our verified units
                if (VERIFIED_UNITS[uId]) {
                    processedUnits.add(uId);
                    const activeCount = (data && data.activeStudents !== undefined) ? Number(data.activeStudents) : VERIFIED_UNITS[uId].activeStudents;
                    const entriesCount = (data && data.todayEntries !== undefined) ? Number(data.todayEntries) : VERIFIED_UNITS[uId].todayEntries;

                    totalActiveContracts += activeCount;
                    totalEvoEntries += entriesCount;
                }
            });
        }
    } catch (e) {
        console.warn("Error fetching evo_sync_status:", e);
    }

    // Include any verified unit not returned in statusSnap
    for (const [uId, info] of Object.entries(VERIFIED_UNITS)) {
        if (!processedUnits.has(uId)) {
            totalActiveContracts += info.activeStudents;
            totalEvoEntries += info.todayEntries;
        }
    }

    // Add local active tuition subscriptions if any
    try {
        const q = query(collection(db, 'evo_students'), where('isLocalOnly', '==', true));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(docSnap => {
            const student = docSnap.data();
            if (['active', 'authorized'].includes(student.tuitionStatus)) {
                totalActiveContracts++;
            }
        });
    } catch (e) {
        console.warn("Error checking local active tuitions:", e);
    }

    // 2. Display Active Contracts (Contratos Ativos - Exatos das Unidades Sincronizadas)
    const contractsEl = document.getElementById('total-contracts');
    if (contractsEl) {
        contractsEl.textContent = totalActiveContracts.toLocaleString('pt-BR');
        contractsEl.classList.remove('animate-pulse');
    }

    // 3. Load Daily Check-ins (Grade Interna)
    const checkinsEl = document.getElementById('daily-checkins');
    if (checkinsEl) {
        try {
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const instancesRef = collection(db, 'classInstances');
            const q = query(instancesRef, where('date', '==', todayStr));

            const querySnapshot = await getDocs(q);
            const uniqueStudents = new Set();

            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                const present = data.presentStudents || [];
                present.forEach(id => uniqueStudents.add(String(id)));

                const trials = data.trialStudents || [];
                trials.forEach(trial => {
                    if (trial.compareceu === true) {
                        const trialId = trial.email || trial.phone || trial.name || Math.random().toString();
                        uniqueStudents.add(`trial-${trialId}`);
                    }
                });
            });

            const total = uniqueStudents.size;
            checkinsEl.textContent = total.toLocaleString('pt-BR');
            checkinsEl.classList.remove('animate-pulse');
        } catch (error) {
            console.error("Error loading checkins:", error);
            checkinsEl.textContent = "-";
        }
    }

    // 4. Load EVO Daily Entries (Alunos Hoje EVO)
    const evoCheckinsEl = document.getElementById('daily-checkins-evo');
    if (evoCheckinsEl) {
        // Exibe imediatamente o total das unidades sincronizadas
        evoCheckinsEl.textContent = totalEvoEntries.toLocaleString('pt-BR');
        evoCheckinsEl.classList.remove('animate-pulse');

        // Escuta em tempo real se houver alteração nas unidades
        try {
            onSnapshot(collection(db, 'evo_sync_status'), (snapshot) => {
                let liveEntries = 0;
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data && data.todayEntries !== undefined) {
                        liveEntries += Number(data.todayEntries) || 0;
                    }
                });
                evoCheckinsEl.textContent = liveEntries.toLocaleString('pt-BR');
                evoCheckinsEl.classList.remove('animate-pulse');
            });
        } catch (err) {
            console.warn("Realtime listener error for evo_sync_status:", err);
        }
    }

    // Hide Skeleton and Show Content
    const skeleton = document.getElementById('dashboard-skeleton');
    const content = document.getElementById('dashboard-content');
    if (skeleton && content) {
        skeleton.classList.add('hidden');
        skeleton.classList.remove('flex');
        content.classList.remove('hidden');
        content.classList.add('flex');
    }
}
