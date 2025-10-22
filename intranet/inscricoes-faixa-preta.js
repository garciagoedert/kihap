import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function setupInscricoesFaixaPretaPage() {
    const inscriptionsTableBody = document.getElementById('inscriptions-table-body');
    const searchInput = document.getElementById('search-input');

    let allInscriptions = [];

    const fetchInscriptions = async () => {
        inscriptionsTableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8">Carregando inscrições...</td></tr>';
        try {
            const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'desc'));
            const querySnapshot = await getDocs(q);
            allInscriptions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayInscriptions(allInscriptions);
        } catch (error) {
            console.error('Error fetching inscriptions:', error);
            inscriptionsTableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-red-500">Erro ao carregar inscrições.</td></tr>';
        }
    };

    const displayInscriptions = (inscriptionsToDisplay) => {
        inscriptionsTableBody.innerHTML = '';
        if (inscriptionsToDisplay.length === 0) {
            inscriptionsTableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8">Nenhuma inscrição encontrada.</td></tr>';
            return;
        }

        inscriptionsToDisplay.forEach(inscription => {
            const row = inscriptionsTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700', 'hover:bg-gray-700');

            const date = inscription.created ? new Date(inscription.created.toDate()).toLocaleDateString('pt-BR') : 'N/A';
            const amount = (inscription.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: inscription.currency || 'BRL' });

            row.innerHTML = `
                <td class="p-4">${inscription.userName || 'N/A'}</td>
                <td class="p-4">${inscription.userEmail || 'N/A'}</td>
                <td class="p-4">${inscription.userPhone || 'N/A'}</td>
                <td class="p-4">${inscription.productName || 'N/A'}</td>
                <td class="p-4">${amount}</td>
                <td class="p-4">${inscription.paymentStatus || 'N/A'}</td>
                <td class="p-4">${date}</td>
            `;
        });
    };

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredInscriptions = allInscriptions.filter(inscription => 
            (inscription.userName && inscription.userName.toLowerCase().includes(searchTerm)) ||
            (inscription.userEmail && inscription.userEmail.toLowerCase().includes(searchTerm))
        );
        displayInscriptions(filteredInscriptions);
    });

    fetchInscriptions();
}
