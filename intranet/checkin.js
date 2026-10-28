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
    const restartBtn = document.getElementById('btn-restart-scanner');
    const cameraBadge = document.getElementById('camera-badge');

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const setCameraBadge = (active, label) => {
        if (!cameraBadge) return;
        if (active) {
            cameraBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
            cameraBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ' + (label || 'Ativa');
        } else {
            cameraBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700';
            cameraBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> ' + (label || 'Pausada');
        }
    };

    const displayResult = (html, status) => {
        resultContainer.innerHTML = html;
        resultContainer.className = 'p-6 border-2 rounded-2xl transition-all duration-300';
        switch (status) {
            case 'success':
                resultContainer.classList.add('border-emerald-500', 'bg-emerald-50/70', 'dark:bg-emerald-950/20', 'text-left');
                break;
            case 'warning':
                resultContainer.classList.add('border-amber-500', 'bg-amber-50/70', 'dark:bg-amber-950/20', 'text-left');
                break;
            case 'error':
                resultContainer.classList.add('border-rose-500', 'bg-rose-50/70', 'dark:bg-rose-950/20', 'text-center');
                break;
            default:
                resultContainer.classList.add('border-gray-200', 'dark:border-gray-800', 'border-dashed', 'bg-gray-50/50', 'dark:bg-gray-900/20', 'text-left');
        }
    };

    const processSale = async (saleId) => {
        if (!saleId) {
            displayResult('<p class="text-rose-600 dark:text-rose-400 font-bold">ID da venda inválido.</p>', 'error');
            return;
        }

        try {
            const saleRef = doc(db, 'inscricoesFaixaPreta', saleId);
            const saleSnap = await getDoc(saleRef);

            if (!saleSnap.exists()) {
                displayResult(`
                    <div class="py-4">
                        <div class="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                            <i class="fas fa-times text-xl"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Ingresso Não Encontrado</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Nenhuma compra encontrada com o ID: <span class="font-mono text-xs">${saleId}</span></p>
                        <button type="button" class="btn-scan-next mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold uppercase rounded-xl">Tentar Novamente</button>
                    </div>
                `, 'error');
                return;
            }

            const saleData = saleSnap.data();

            let resultHtml = `
                <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700/60">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <span class="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Dados do Participante</span>
                        <span class="text-xs font-mono text-gray-400 dark:text-gray-500">#${saleId.slice(0, 8)}</span>
                    </div>
                    <h3 class="text-xl font-black text-gray-900 dark:text-white leading-tight">${saleData.userName || saleData.payerName || 'N/A'}</h3>
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">${saleData.productName || 'N/A'}</p>
                    ${saleData.userSize ? `<span class="inline-block mt-2 px-2.5 py-0.5 rounded-md text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">Tamanho: ${saleData.userSize}</span>` : ''}
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">Comprado em: ${saleData.created ? new Date(saleData.created.toDate()).toLocaleString('pt-BR') : 'N/A'}</p>
                </div>
            `;

            // Processar e exibir assentos marcados se existirem
            const seatList = [];
            if (saleData.seatId) seatList.push(saleData.seatId);
            if (Array.isArray(saleData.selectedSeats)) {
                saleData.selectedSeats.forEach(s => { if (s && !seatList.includes(s)) seatList.push(s); });
            } else if (typeof saleData.selectedSeats === 'string' && saleData.selectedSeats) {
                if (!seatList.includes(saleData.selectedSeats)) seatList.push(saleData.selectedSeats);
            }
            const seatDisplay = seatList.length > 0 ? seatList.join(', ') : null;

            if (seatDisplay || saleData.sessionLabel || saleData.locationName) {
                resultHtml += `
                    <div class="mb-4 p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500 rounded-2xl text-center shadow-sm">
                        <span class="text-amber-800 dark:text-amber-300 block uppercase text-[11px] font-black tracking-widest mb-1">🪑 Assento Marcado / Cadeira</span>
                        <div class="text-gray-900 dark:text-white font-black text-3xl tracking-tight">${seatDisplay ? `CADEIRA ${seatDisplay}` : 'Sem Cadeira Marcada'}</div>
                        ${saleData.locationName ? `<p class="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-2">📍 <strong>Local:</strong> ${saleData.locationName}${saleData.locationVenue ? ` - ${saleData.locationVenue}` : ''}</p>` : ''}
                        ${saleData.locationAddress ? `<p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">${saleData.locationAddress}</p>` : ''}
                        ${saleData.sessionLabel ? `<p class="text-xs font-bold text-blue-700 dark:text-blue-300 mt-2">🕒 <strong>Sessão:</strong> ${saleData.sessionLabel}</p>` : ''}
                    </div>
                `;
            }

            // Mostrar detalhes do evento se existirem
            if (saleData.isEvent || saleData.attendeeNumber || saleData.eventRing || saleData.eventDay) {
                resultHtml += `
                    <div class="mb-4 p-4 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl grid grid-cols-2 gap-3 text-left">
                        <div>
                            <span class="text-gray-400 block uppercase text-[10px] font-bold tracking-widest">Número</span>
                            <span class="text-amber-600 dark:text-amber-400 font-black text-2xl">#${saleData.attendeeNumber || '---'}</span>
                        </div>
                        <div>
                            <span class="text-gray-400 block uppercase text-[10px] font-bold tracking-widest">Ringue</span>
                            <span class="text-gray-900 dark:text-white font-black text-2xl">${saleData.eventRing || 'TBD'}</span>
                        </div>
                        <div>
                            <span class="text-gray-400 block uppercase text-[10px] font-bold tracking-widest">Dia</span>
                            <span class="text-gray-800 dark:text-gray-200 font-bold text-sm">${saleData.eventDay || 'TBD'}</span>
                        </div>
                        <div>
                            <span class="text-gray-400 block uppercase text-[10px] font-bold tracking-widest">Horário</span>
                            <span class="text-gray-800 dark:text-gray-200 font-bold text-sm">${saleData.eventTime || 'TBD'}</span>
                        </div>
                    </div>
                `;
            }

            if (saleData.checkinStatus === 'realizado') {
                resultHtml += `
                    <div class="mt-4 p-4 bg-amber-500/15 border border-amber-500/30 rounded-xl text-center">
                        <div class="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wide">
                            <i class="fas fa-exclamation-triangle"></i> Check-in Já Realizado
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Efetuado em ${saleData.checkinTimestamp ? new Date(saleData.checkinTimestamp.toDate()).toLocaleString('pt-BR') : 'data desconhecida'}
                        </p>
                    </div>
                    <button type="button" class="btn-scan-next mt-3 w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-redo-alt text-xs"></i> Ler Próximo Ingresso
                    </button>
                `;
                displayResult(resultHtml, 'warning');
            } else {
                resultHtml += `
                    <button id="confirm-checkin-btn" data-id="${saleId}" class="mt-4 w-full py-3.5 px-6 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                        <i class="fas fa-check-circle"></i> Confirmar Entrada / Check-in
                    </button>
                    <button type="button" class="btn-scan-next mt-2 w-full py-2 px-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 text-xs font-semibold">
                        Cancelar e ler próximo
                    </button>
                `;
                displayResult(resultHtml, 'success');
            }

        } catch (error) {
            console.error("Erro ao processar venda:", error);
            displayResult('<p class="text-rose-600 dark:text-rose-400">Ocorreu um erro ao verificar o ingresso. Tente novamente.</p>', 'error');
        }
    };

    const handleManualSearch = async (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) return;

        displayResult(`
            <div class="py-6 text-center">
                <i class="fas fa-spinner fa-spin text-2xl text-blue-600 mb-2"></i>
                <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Buscando registro...</p>
            </div>
        `, null);

        try {
            // Se tiver tamanho de ID do Firestore, tenta direto
            if (searchTerm.length === 20) {
                const saleRef = doc(db, 'inscricoesFaixaPreta', searchTerm);
                const saleSnap = await getDoc(saleRef);
                if (saleSnap.exists()) {
                    await processSale(searchTerm);
                    return;
                }
            }

            // Busca geral
            const salesRef = collection(db, 'inscricoesFaixaPreta');
            const querySnapshot = await getDocs(salesRef);
            const allSales = [];
            querySnapshot.forEach(doc => allSales.push({ id: doc.id, ...doc.data() }));

            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const matchingSales = allSales.filter(sale =>
                (sale.userName && sale.userName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (sale.payerName && sale.payerName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (sale.userEmail && sale.userEmail.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (sale.userCpf && sale.userCpf.replace(/\D/g, '').includes(lowerCaseSearchTerm.replace(/\D/g, '')))
            );

            // Filtrar para incluir ingressos, eventos ou produtos com mapa de assentos
            const results = [];
            for (const sale of matchingSales) {
                if (sale.productId) {
                    const productRef = doc(db, 'products', sale.productId);
                    const productSnap = await getDoc(productRef);
                    if (productSnap.exists()) {
                        const pData = productSnap.data();
                        if (pData.isTicket || pData.isEvent || pData.hasSeatMap || sale.seatId || (Array.isArray(sale.selectedSeats) && sale.selectedSeats.length > 0)) {
                            results.push(sale);
                        }
                    } else {
                        results.push(sale);
                    }
                }
            }

            if (results.length === 0) {
                displayResult(`
                    <div class="py-4 text-center">
                        <i class="fas fa-search text-gray-400 text-xl mb-2"></i>
                        <p class="text-sm font-bold text-gray-700 dark:text-gray-300">Nenhum ingresso encontrado</p>
                        <p class="text-xs text-gray-400 mt-1">Verifique o nome, CPF ou ID digitado.</p>
                    </div>
                `, 'error');
            } else if (results.length === 1) {
                await processSale(results[0].id);
            } else {
                let resultHtml = '<p class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3">Múltiplos ingressos encontrados. Selecione:</p><ul class="space-y-2 text-left">';
                results.forEach(sale => {
                    resultHtml += `
                        <li class="p-3 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 hover:shadow-sm transition-all">
                            <button class="select-sale-btn w-full text-left" data-id="${sale.id}">
                                <strong class="text-gray-900 dark:text-white font-bold">${sale.userName || sale.payerName}</strong> 
                                <span class="text-xs text-blue-600 dark:text-blue-400 font-semibold ml-1">(${sale.productName})</span><br>
                                <span class="text-xs text-gray-500 dark:text-gray-400">${sale.userEmail || ''}</span>
                            </button>
                        </li>
                    `;
                });
                resultHtml += '</ul>';
                displayResult(resultHtml, null);
            }

        } catch (error) {
            console.error("Erro na busca manual:", error);
            displayResult('<p class="text-rose-600 dark:text-rose-400">Ocorreu um erro na busca. Tente novamente.</p>', 'error');
        }
    };

    const handleConfirmCheckin = async (e) => {
        const saleId = e.target.closest('#confirm-checkin-btn')?.dataset?.id;
        if (!saleId) return;

        const btn = e.target.closest('#confirm-checkin-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmando...';

        try {
            const saleRef = doc(db, 'inscricoesFaixaPreta', saleId);
            await updateDoc(saleRef, {
                checkinStatus: 'realizado',
                checkinTimestamp: serverTimestamp()
            });
            await processSale(saleId);
        } catch (error) {
            console.error("Erro ao confirmar check-in:", error);
            displayResult('<p class="text-rose-600 dark:text-rose-400">Ocorreu um erro ao confirmar o check-in.</p>', 'error');
        }
    };

    // Inicialização do QR Scanner
    let qrScanner = null;
    const startScanner = () => {
        if (!qrScanner) {
            qrScanner = new QrScanner(
                videoElem,
                result => {
                    console.log('decoded qr code:', result);
                    qrScanner.stop();
                    setCameraBadge(false, 'Leitura Feita');
                    statusElem.textContent = `QR Code detectado! Verificando...`;
                    processSale(result.data);
                },
                {
                    highlightScanRegion: true,
                    onDecodeError: error => {}
                }
            );
        }
        qrScanner.start().then(() => {
            setCameraBadge(true, 'Ativa');
            statusElem.textContent = 'Aponte a câmera para o QR Code do ingresso';
        }).catch(err => {
            setCameraBadge(false, 'Erro');
            statusElem.textContent = 'Erro ao iniciar câmera. Verifique as permissões de vídeo.';
            console.error(err);
        });
    };

    startScanner();

    // Event Listeners
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            startScanner();
        });
    }

    searchForm.addEventListener('submit', handleManualSearch);
    resultContainer.addEventListener('click', e => {
        if (e.target && e.target.closest('#confirm-checkin-btn')) {
            handleConfirmCheckin(e);
        }
        if (e.target && e.target.closest('.select-sale-btn')) {
            const saleId = e.target.closest('.select-sale-btn').dataset.id;
            processSale(saleId);
        }
        if (e.target && e.target.closest('.btn-scan-next')) {
            startScanner();
        }
    });
}
