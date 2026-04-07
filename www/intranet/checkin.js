import { db } from './firebase-config.js';
import {
    collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser, checkAdminStatus } from './auth.js';
import QrScanner from './qr-scanner.min.js';

export async function setupCheckinPage() {
    const videoElem = document.getElementById('scanner-video');
    const statusElem = document.getElementById('scanner-status');
    const resultContainer = document.getElementById('result-container');
    const searchForm = document.getElementById('manual-search-form');
    const searchInput = document.getElementById('search-input');

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const displayResult = (html, status) => {
        resultContainer.innerHTML = html;
        resultContainer.className = 'p-4 border-2 border-dashed rounded-lg'; // Reset classes
        switch (status) {
            case 'success':
                resultContainer.classList.add('border-green-500', 'bg-green-500/10');
                break;
            case 'warning':
                resultContainer.classList.add('border-yellow-500', 'bg-yellow-500/10');
                break;
            case 'error':
                resultContainer.classList.add('border-red-500', 'bg-red-500/10');
                break;
            default:
                resultContainer.classList.add('border-gray-700');
        }
    };

    const processSale = async (saleId) => {
        if (!saleId) {
            displayResult('<p>ID da venda inválido.</p>', 'error');
            return;
        }

        try {
            const saleRef = doc(db, 'inscricoesFaixaPreta', saleId);
            const saleSnap = await getDoc(saleRef);

            if (!saleSnap.exists()) {
                displayResult(`<p><strong>Ingresso Inválido</strong></p><p class="text-sm">Nenhuma compra encontrada com o ID: ${saleId}</p>`, 'error');
                return;
            }

            const saleData = saleSnap.data();

            let resultHtml = `
                <p><strong>Cliente:</strong> ${saleData.userName || 'N/A'}</p>
                <p><strong>Produto:</strong> ${saleData.productName || 'N/A'}</p>
                <p><strong>Data da Compra:</strong> ${saleData.created ? new Date(saleData.created.toDate()).toLocaleString('pt-BR') : 'N/A'}</p>
            `;

            if (saleData.checkinStatus === 'realizado') {
                resultHtml += `
                    <div class="mt-4 p-4 bg-yellow-600/20 rounded-lg">
                        <p class="font-bold text-yellow-300">CHECK-IN JÁ REALIZADO</p>
                        <p class="text-sm text-yellow-400">em ${saleData.checkinTimestamp ? new Date(saleData.checkinTimestamp.toDate()).toLocaleString('pt-BR') : 'data desconhecida'}</p>
                    </div>
                `;
                displayResult(resultHtml, 'warning');
            } else {
                resultHtml += `
                    <button id="confirm-checkin-btn" data-id="${saleId}" class="mt-4 px-6 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-500 w-full">
                        Confirmar Check-in
                    </button>
                `;
                displayResult(resultHtml, 'success');
            }

        } catch (error) {
            console.error("Erro ao processar venda:", error);
            displayResult('<p>Ocorreu um erro ao verificar o ingresso. Tente novamente.</p>', 'error');
        }
    };

    const handleManualSearch = async (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) return;

        displayResult('<p>Buscando...</p>', null);

        try {
            // Try searching by ID first
            if (searchTerm.length === 20) { // Firestore IDs are typically 20 chars
                const saleRef = doc(db, 'inscricoesFaixaPreta', searchTerm);
                const saleSnap = await getDoc(saleRef);
                if (saleSnap.exists()) {
                    await processSale(searchTerm);
                    return;
                }
            }

            // Fetch all sales and filter client-side for a case-insensitive, partial search
            const salesRef = collection(db, 'inscricoesFaixaPreta');
            const querySnapshot = await getDocs(salesRef);
            const allSales = [];
            querySnapshot.forEach(doc => allSales.push({ id: doc.id, ...doc.data() }));

            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const matchingSales = allSales.filter(sale =>
                (sale.userName && sale.userName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (sale.userEmail && sale.userEmail.toLowerCase().includes(lowerCaseSearchTerm))
            );

            // Further filter to only include sales that are actual tickets
            const results = [];
            for (const sale of matchingSales) {
                if (sale.productId) {
                    const productRef = doc(db, 'products', sale.productId);
                    const productSnap = await getDoc(productRef);
                    if (productSnap.exists() && productSnap.data().isTicket) {
                        results.push(sale);
                    }
                }
            }

            if (results.length === 0) {
                displayResult('<p>Nenhum ingresso encontrado para o termo buscado.</p>', 'error');
            } else if (results.length === 1) {
                await processSale(results[0].id);
            } else {
                let resultHtml = '<p>Múltiplos resultados encontrados. Selecione o correto:</p><ul class="mt-2 space-y-2 text-left">';
                results.forEach(sale => {
                    resultHtml += `
                        <li class="p-2 bg-gray-800 rounded">
                            <button class="select-sale-btn w-full text-left" data-id="${sale.id}">
                                <strong>${sale.userName}</strong> (${sale.productName})<br>
                                <span class="text-sm text-gray-400">${sale.userEmail}</span>
                            </button>
                        </li>
                    `;
                });
                resultHtml += '</ul>';
                displayResult(resultHtml, null);
            }

        } catch (error) {
            console.error("Erro na busca manual:", error);
            displayResult('<p>Ocorreu um erro na busca. Tente novamente.</p>', 'error');
        }
    };

    const handleConfirmCheckin = async (e) => {
        const saleId = e.target.dataset.id;
        if (!saleId) return;

        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Confirmando...';

        try {
            const saleRef = doc(db, 'inscricoesFaixaPreta', saleId);
            await updateDoc(saleRef, {
                checkinStatus: 'realizado',
                checkinTimestamp: serverTimestamp()
            });
            await processSale(saleId); // Re-process to show the updated status
        } catch (error) {
            console.error("Erro ao confirmar check-in:", error);
            displayResult('<p>Ocorreu um erro ao confirmar o check-in.</p>', 'error');
        }
    };

    // QR Scanner Initialization
    const qrScanner = new QrScanner(
        videoElem,
        result => {
            console.log('decoded qr code:', result);
            qrScanner.stop();
            statusElem.textContent = `QR Code detectado! Verificando...`;
            processSale(result.data);
        },
        {
            highlightScanRegion: true,
            onDecodeError: error => {
                // This can be noisy, so we might not want to log every error
                // statusElem.textContent = error;
            },
        }
    );

    qrScanner.start().then(() => {
        statusElem.textContent = 'Aponte a câmera para o QR Code';
    }).catch(err => {
        statusElem.textContent = 'Erro ao iniciar a câmera. Verifique as permissões.';
        console.error(err);
    });

    // Event Listeners
    searchForm.addEventListener('submit', handleManualSearch);
    resultContainer.addEventListener('click', e => {
        if (e.target && e.target.id === 'confirm-checkin-btn') {
            handleConfirmCheckin(e);
        }
        if (e.target && e.target.closest('.select-sale-btn')) {
            const saleId = e.target.closest('.select-sale-btn').dataset.id;
            processSale(saleId);
        }
    });
}
