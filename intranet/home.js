import { functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady } from './auth.js';
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Callables
const getActiveContractsCount = httpsCallable(functions, 'getActiveContractsCount');
const getTodaysTotalEntries = httpsCallable(functions, 'getTodaysTotalEntries');

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
                activeQuotes = dbQuotes;
            }
        }
    } catch (error) {
        console.error("Error fetching quotes:", error);
    }

    // Safety check
    if (activeQuotes.length === 0) {
        activeQuotes = quotes;
    }

    // Use the day of the month to pick a deterministic quote for the day
    const quoteIndex = today % activeQuotes.length;
    const quote = activeQuotes[quoteIndex];

    console.log("Displaying quote:", quote);

    if (quote) {
        quoteEl.textContent = `"${quote.text}"`;
        authorEl.textContent = `- ${quote.author}`;
    } else {
        quoteEl.textContent = '"A disciplina é a mãe do êxito."';
        authorEl.textContent = '- Ésquilo';
    }
}

async function loadStats() {
    // Load Contracts
    const contractsEl = document.getElementById('total-contracts');
    if (contractsEl) {
        try {
            const result = await getActiveContractsCount({ unitId: 'geral' }); // Default to 'geral' for total overview
            const total = result.data.totalGeral || 0;
            contractsEl.textContent = total.toLocaleString('pt-BR');
            contractsEl.classList.remove('animate-pulse');
        } catch (error) {
            console.error("Error loading contracts:", error);
            contractsEl.textContent = "-";
        }
    }

    // Load Daily Entries (Checkins)
    const checkinsEl = document.getElementById('daily-checkins');
    if (checkinsEl) {
        try {
            const result = await getTodaysTotalEntries({ unitId: 'geral' });
            const total = result.data.totalEntries || 0;
            checkinsEl.textContent = total.toLocaleString('pt-BR');
            checkinsEl.classList.remove('animate-pulse');
        } catch (error) {
            console.error("Error loading checkins:", error);
            checkinsEl.textContent = "-";
        }
    }
}
