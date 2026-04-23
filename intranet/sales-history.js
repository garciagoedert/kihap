import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, doc, query, orderBy, where, updateDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { loadComponents } from './common-ui.js';
import { onAuthReady } from './auth.js';

let allSales = [];
let allProducts = [];
let currentPage = 1;
const rowsPerPage = 15;

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(user => {
        loadComponents(initializeHistory);
    });
});

async function initializeHistory() {
    await fetchProducts();
    await fetchSales();
    populateFilters();
    applyFilters();

    const searchInput = document.getElementById('search-input');
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');
    const dateFilter = document.getElementById('filter-date');
    const fulfillmentFilter = document.getElementById('filter-fulfillment');
    const resendMissingTicketsBtn = document.getElementById('resend-missing-tickets-btn');
    const exportBtn = document.getElementById('export-btn');
    const exportModal = document.getElementById('export-modal');
    const closeExportModalBtn = document.getElementById('close-export-modal-btn');
    const cancelExportBtn = document.getElementById('cancel-export-btn');
    const exportForm = document.getElementById('export-form');

    // Filter Listeners
    [searchInput, unitFilter, productFilter, dateFilter, fulfillmentFilter].forEach(el => {
        if (!el) return;
        el.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
        if (el === searchInput) {
            el.addEventListener('input', () => {
                currentPage = 1;
                applyFilters();
            });
        }
    });

    // Reenviar todos logic
    if (resendMissingTicketsBtn) {
        resendMissingTicketsBtn.onclick = async () => {
            if (!confirm('Deseja reenviar TODOS os ingressos de vendas aprovadas que ainda não foram enviados?')) return;
            resendMissingTicketsBtn.disabled = true;
            const originalText = resendMissingTicketsBtn.innerHTML;
            resendMissingTicketsBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...';
            try {
                const functions = getFunctions();
                const resendAllMissingTickets = httpsCallable(functions, 'resendAllMissingTickets');
                const result = await resendAllMissingTickets();
                alert(`Sucesso! ${result.data.sentCount} ingressos foram colocados na fila de envio.`);
                fetchSales().then(() => applyFilters());
            } catch (error) {
                console.error('Erro ao reenviar ingressos:', error);
                alert('Erro ao processar reenvio: ' + error.message);
            } finally {
                resendMissingTicketsBtn.disabled = false;
                resendMissingTicketsBtn.innerHTML = originalText;
            }
        };
    }

    // Modal Details elements and close logic
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
    
    window.addEventListener('click', (e) => {
        const saleDetailsModal = document.getElementById('sale-details-modal');
        if (e.target === saleDetailsModal) closeDetailsModal();
    });

    // Export Logic
    if (exportBtn) exportBtn.addEventListener('click', openExportModal);
    if (closeExportModalBtn) closeExportModalBtn.addEventListener('click', closeExportModal);
    if (cancelExportBtn) cancelExportBtn.addEventListener('click', closeExportModal);
    if (exportForm) exportForm.addEventListener('submit', handleExport);
}

const openExportModal = () => {
    const exportModal = document.getElementById('export-modal');
    const unitFilter = document.getElementById('filter-unit');
    const fulfillmentFilter = document.getElementById('filter-fulfillment');
    const exportFilterUnit = document.getElementById('export-filter-unit');
    const exportFilterStatus = document.getElementById('export-filter-status');
    const exportFilterFulfillment = document.getElementById('export-filter-fulfillment');
    const exportFilterStartDate = document.getElementById('export-start-date');
    const exportFilterEndDate = document.getElementById('export-end-date');

    if (!allSales || allSales.length === 0) {
        alert("Não há dados de vendas carregados.");
        return;
    }
    
    if (unitFilter && exportFilterUnit) exportFilterUnit.innerHTML = unitFilter.innerHTML;
    if (exportFilterUnit) exportFilterUnit.value = unitFilter.value;
    if (exportFilterStatus) exportFilterStatus.value = '';
    if (exportFilterFulfillment) exportFilterFulfillment.value = fulfillmentFilter.value;
    if (exportFilterStartDate) exportFilterStartDate.value = '';
    if (exportFilterEndDate) exportFilterEndDate.value = '';

    exportModal.classList.remove('hidden');
};

const closeExportModal = () => {
    const exportModal = document.getElementById('export-modal');
    if (exportModal) exportModal.classList.add('hidden');
};

const handleExport = (e) => {
    e.preventDefault();
    const searchInput = document.getElementById('search-input');
    const exportFilterStartDate = document.getElementById('export-start-date');
    const exportFilterEndDate = document.getElementById('export-end-date');
    const exportFilterUnit = document.getElementById('export-filter-unit');
    const exportFilterStatus = document.getElementById('export-filter-status');
    const exportFilterFulfillment = document.getElementById('export-filter-fulfillment');
    
    const selectedStartDate = exportFilterStartDate.value;
    const selectedEndDate = exportFilterEndDate.value;
    const selectedUnit = exportFilterUnit.value;
    const selectedStatus = exportFilterStatus.value;
    const selectedFulfillment = exportFilterFulfillment.value;
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    const flatSales = allSales.flat();

    let filtered = flatSales.filter(sale => {
        const nameMatch = !searchTerm || (sale.userName && sale.userName.toLowerCase().includes(searchTerm));
        const emailMatch = !searchTerm || (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm));
        const unitMatch = !selectedUnit || sale.userUnit === selectedUnit;
        const statusMatch = !selectedStatus || sale.paymentStatus === selectedStatus;
        const fulfillmentMatch = !selectedFulfillment || sale.fulfillmentStatus === selectedFulfillment || (selectedFulfillment === 'pending' && !sale.fulfillmentStatus);

        let dateMatch = true;
        if (sale.created) {
            const saleDateObj = sale.created.toDate();
            saleDateObj.setHours(0, 0, 0, 0);
            const saleTime = saleDateObj.getTime();

            if (selectedStartDate) {
                const startStr = selectedStartDate.split('-');
                const startDateObj = new Date(startStr[0], startStr[1] - 1, startStr[2]);
                startDateObj.setHours(0, 0, 0, 0);
                if (saleTime < startDateObj.getTime()) dateMatch = false;
            }
            if (selectedEndDate) {
                const endStr = selectedEndDate.split('-');
                const endDateObj = new Date(endStr[0], endStr[1] - 1, endStr[2]);
                endDateObj.setHours(23, 59, 59, 999);
                if (saleTime > endDateObj.getTime()) dateMatch = false;
            }
        } else if (selectedStartDate || selectedEndDate) {
            dateMatch = false;
        }

        return (nameMatch || emailMatch) && unitMatch && dateMatch && statusMatch && fulfillmentMatch;
    });

    const checkboxes = document.querySelectorAll('#export-columns-container input[type="checkbox"]:checked');
    const selectedColumns = Array.from(checkboxes).map(cb => cb.dataset.column);

    if (selectedColumns.length === 0) {
        alert('Por favor, selecione pelo menos uma coluna para exportar.');
        return;
    }

    if (filtered.length === 0) {
        alert('Nenhuma venda encontrada com os filtros selecionados.');
        return;
    }

    const worksheetData = filtered.map(sale => {
        const allPossibleColumns = {
            date: { header: 'Data da Compra', value: sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A' },
            productName: { header: 'Produto', value: sale.productName || 'N/A' },
            userName: { header: 'Nome do Cliente', value: sale.userName || 'N/A' },
            userEmail: { header: 'Email', value: sale.userEmail || 'N/A' },
            userPhone: { header: 'Telefone', value: sale.userPhone || 'N/A' },
            userUnit: { header: 'Unidade', value: sale.userUnit || 'N/A' },
            userPrograma: { header: 'Programa', value: sale.userPrograma || 'N/A' },
            userGraduacao: { header: 'Graduação', value: sale.userGraduacao || 'N/A' },
            amountTotal: { header: 'Valor Unitário', value: (sale.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
            paymentStatus: { header: 'Status do Pagamento', value: sale.paymentStatus === 'paid' ? 'Pago' : 'Pendente' },
            fulfillmentStatus: { header: 'Status de Entrega', value: getFulfillmentStatusLabel(sale.fulfillmentStatus) }
        };

        const rowData = {};
        selectedColumns.forEach(colKey => {
            if (allPossibleColumns[colKey]) {
                rowData[allPossibleColumns[colKey].header] = allPossibleColumns[colKey].value;
            }
        });
        return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas');
    XLSX.writeFile(workbook, 'RelatorioDeVendas.xlsx');

    closeExportModal();
};

const closeDetailsModal = () => {
    const saleDetailsModal = document.getElementById('sale-details-modal');
    if (saleDetailsModal) saleDetailsModal.classList.add('hidden');
};

const openSaleDetailsModal = async (saleIds) => {
    const saleDetailsModal = document.getElementById('sale-details-modal');
    const modalContent = document.getElementById('modal-content');
    const fulfillmentStatusSelect = document.getElementById('sale-fulfillment-status');
    const resendEmailBtnModal = document.getElementById('resend-email-btn-modal');
    const resendEmailText = document.getElementById('resend-email-text');
    const recoverCartBtnModal = document.getElementById('recover-cart-btn-modal');

    const idList = saleIds.split(',');
    const primarySaleId = idList[0];
    const saleDoc = await getDoc(doc(db, 'inscricoesFaixaPreta', primarySaleId));
    
    if (!saleDoc.exists()) {
        alert('Venda não encontrada.');
        return;
    }

    const sale = { id: saleDoc.id, ...saleDoc.data() };
    
    let allGroupSales = [sale];
    if (sale.checkoutSessionId) {
        const q = query(collection(db, 'inscricoesFaixaPreta'), where('checkoutSessionId', '==', sale.checkoutSessionId));
        const querySnapshot = await getDocs(q);
        allGroupSales = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    let productDetailsHtml = allGroupSales.map(s => `
        <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 mb-3 shadow-sm">
            <p class="font-bold text-blue-600 dark:text-blue-400">${s.productName || 'Produto N/A'}</p>
            ${s.userSize ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Tamanho: <span class="text-gray-900 dark:text-white font-medium">${s.userSize}</span></p>` : ''}
            ${s.kitSelections ? Object.entries(s.kitSelections).map(([key, val]) => `<p class="text-xs text-gray-500 dark:text-gray-400">${key}: <span class="text-gray-900 dark:text-white font-medium">${val}</span></p>`).join('') : ''}
            <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subtotal</span>
                <span class="text-sm font-bold text-green-600 dark:text-green-400">${(s.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: s.currency || 'BRL' })}</span>
            </div>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
                <div class="bg-gray-50 dark:bg-gray-800/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                    <h4 class="text-blue-600 dark:text-blue-400 font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                        <i class="fas fa-user-circle"></i> Dados do Cliente
                    </h4>
                    <div class="space-y-3 text-sm">
                        <p><span class="text-gray-500 dark:text-gray-400">Nome:</span> <span class="text-gray-900 dark:text-white font-bold">${sale.userName || 'N/A'}</span></p>
                        <p><span class="text-gray-500 dark:text-gray-400">Email:</span> <span class="text-gray-900 dark:text-white break-all">${sale.userEmail || 'N/A'}</span></p>
                        <p><span class="text-gray-500 dark:text-gray-400">Telefone:</span> <span class="text-gray-900 dark:text-white">${sale.userPhone || 'N/A'}</span></p>
                        <p><span class="text-gray-500 dark:text-gray-400">CPF:</span> <span class="text-gray-900 dark:text-white">${sale.userCpf || 'N/A'}</span></p>
                        <p><span class="text-gray-500 dark:text-gray-400">Unidade:</span> <span class="text-gray-900 dark:text-white font-medium">${sale.userUnit || 'N/A'}</span></p>
                    </div>
                </div>
            </div>
            <div class="space-y-4">
                <div class="bg-gray-50 dark:bg-gray-800/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                    <h4 class="text-purple-600 dark:text-purple-400 font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                        <i class="fas fa-shopping-bag"></i> Itens do Pedido
                    </h4>
                    <div class="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        ${productDetailsHtml}
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-800/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm mt-6">
            <h4 class="text-green-600 dark:text-green-400 font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                <i class="fas fa-credit-card"></i> Resumo do Pagamento
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div class="space-y-3">
                    <p class="flex items-center justify-between"><span class="text-gray-500 dark:text-gray-400">Status:</span> ${renderStatusTag(sale.paymentStatus)}</p>
                    <p class="flex items-center justify-between"><span class="text-gray-500 dark:text-gray-400">Total Pago:</span> <span class="text-green-600 dark:text-green-400 font-bold text-xl">${(allGroupSales.reduce((acc, curr) => acc + curr.amountTotal, 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                    <p class="flex items-center justify-between"><span class="text-gray-500 dark:text-gray-400">Data:</span> <span class="text-gray-900 dark:text-white font-medium">${sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A'}</span></p>
                </div>
                <div class="md:border-l border-gray-200 dark:border-gray-700 md:pl-6 space-y-3">
                    <p class="flex items-center justify-between"><span class="text-gray-500 dark:text-gray-400">Método:</span> <span class="text-gray-900 dark:text-white uppercase font-bold">${sale.paymentMethod || 'N/A'}</span></p>
                    ${sale.stripeSessionId ? `<p class="text-[10px] text-blue-600 dark:text-blue-400 mt-2 break-all opacity-70" title="${sale.stripeSessionId}">Stripe ID: ${sale.stripeSessionId}</p>` : ''}
                    ${sale.mercadoPagoPreferenceId ? `<p class="text-[10px] text-blue-600 dark:text-blue-400 mt-1 break-all opacity-70" title="${sale.mercadoPagoPreferenceId}">MP ID: ${sale.mercadoPagoPreferenceId}</p>` : ''}
                </div>
            </div>
        </div>
    `;

    await loadEmailLogs(primarySaleId);
    saleDetailsModal.classList.remove('hidden');

    if (fulfillmentStatusSelect) {
        fulfillmentStatusSelect.value = sale.fulfillmentStatus || 'pending';
        fulfillmentStatusSelect.onchange = async () => {
            const newStatus = fulfillmentStatusSelect.value;
            if (!confirm(`Deseja atualizar o status de entrega para "${getFulfillmentStatusLabel(newStatus)}" em todos os itens deste pedido?`)) {
                fulfillmentStatusSelect.value = sale.fulfillmentStatus || 'pending';
                return;
            }
            try {
                const batch = writeBatch(db);
                idList.forEach(id => {
                    const ref = doc(db, 'inscricoesFaixaPreta', id);
                    batch.update(ref, { fulfillmentStatus: newStatus, lastModifiedAt: serverTimestamp() });
                });
                await batch.commit();
                sale.fulfillmentStatus = newStatus;
                alert('Status atualizado com sucesso!');
                await fetchSales();
                applyFilters();
            } catch (error) {
                console.error("Erro ao atualizar status:", error);
                alert('Erro ao atualizar status.');
                fulfillmentStatusSelect.value = sale.fulfillmentStatus || 'pending';
            }
        };
    }

    if (resendEmailBtnModal) {
        resendEmailBtnModal.onclick = async () => {
            if (!confirm('Deseja reenviar o e-mail deste pedido para o cliente?')) return;
            resendEmailBtnModal.disabled = true;
            resendEmailText.innerText = 'Enviando...';
            try {
                const functions = getFunctions();
                const sendManualTicket = httpsCallable(functions, 'sendPurchaseReceiptManual');
                await sendManualTicket({ saleId: primarySaleId });
                alert('E-mail colocado na fila de envio com sucesso!');
                await loadEmailLogs(primarySaleId);
            } catch (error) {
                console.error('Erro ao reenviar email:', error);
                alert('Erro ao enviar e-mail: ' + error.message);
            } finally {
                resendEmailBtnModal.disabled = false;
                resendEmailText.innerText = 'Reenviar Email';
            }
        };
    }

    if (sale.paymentStatus === 'pending' && sale.mercadoPagoPreferenceId) {
        recoverCartBtnModal.classList.remove('hidden');
        recoverCartBtnModal.onclick = () => {
            const link = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${sale.mercadoPagoPreferenceId}`;
            navigator.clipboard.writeText(link).then(() => alert('Link copiado!'));
        };
    } else {
        recoverCartBtnModal.classList.add('hidden');
    }

    // Manual Payment Update Logic
    const paymentStatusModal = document.getElementById('sale-payment-status-modal');
    const paymentReasonModal = document.getElementById('sale-payment-reason');
    const updatePaymentBtnModal = document.getElementById('update-payment-btn-modal');

    if (paymentStatusModal) paymentStatusModal.value = sale.paymentStatus || 'pending';
    if (paymentReasonModal) paymentReasonModal.value = '';

    if (updatePaymentBtnModal) {
        updatePaymentBtnModal.onclick = async () => {
            const newStatus = paymentStatusModal.value;
            const reason = paymentReasonModal.value.trim();

            if (!reason) {
                alert('Por favor, insira uma justificativa para a alteração manual.');
                return;
            }

            if (!confirm(`Deseja alterar o status de pagamento de "${sale.paymentStatus}" para "${newStatus}"?`)) return;

            updatePaymentBtnModal.disabled = true;
            const originalText = updatePaymentBtnModal.innerHTML;
            updatePaymentBtnModal.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Atualizando...';

            try {
                const functions = getFunctions();
                const manuallyUpdateSaleStatus = httpsCallable(functions, 'manuallyUpdateSaleStatus');
                
                // We send all IDs in the group to ensure the whole checkout is updated
                const result = await manuallyUpdateSaleStatus({
                    saleIds: idList,
                    newStatus: newStatus,
                    reason: reason
                });

                if (result.data && result.data.results) {
                    const failures = result.data.results.filter(r => !r.success);
                    if (failures.length > 0) {
                        const errorMsg = failures.map(f => `ID ${f.saleId}: ${f.error}`).join('\n');
                        alert(`Atenção: Alguns itens não puderam ser atualizados:\n${errorMsg}`);
                        // Even if some failed, we should refresh to see what DID work
                    } else {
                        alert('Status de pagamento atualizado com sucesso!');
                    }
                } else {
                    alert('Status de pagamento atualizado com sucesso!');
                }
                
                // Refresh data
                await fetchSales();
                applyFilters();
                
                // Close modal or update UI?
                // For better UX, let's just close it or refresh the current view
                closeDetailsModal();
            } catch (error) {
                console.error('Erro ao atualizar status de pagamento:', error);
                alert('Erro ao atualizar: ' + (error.message || 'Erro desconhecido no servidor'));
            } finally {
                updatePaymentBtnModal.disabled = false;
                updatePaymentBtnModal.innerHTML = originalText;
            }
        };
    }
};

const loadEmailLogs = async (saleId) => {
    const emailLogsSection = document.getElementById('email-logs-section');
    const emailLogsList = document.getElementById('email-logs-list');
    try {
        const emailLogsRef = collection(db, 'inscricoesFaixaPreta', saleId, 'emailLogs');
        const q = query(emailLogsRef, orderBy('sentAt', 'desc'));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            emailLogsSection.classList.add('hidden');
            return;
        }
        emailLogsSection.classList.remove('hidden');
        emailLogsList.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const log = doc.data();
            const typeIcon = log.type === 'ticket' ? '🎫' : '📧';
            const statusIcon = log.success ? '✅' : '❌';
            const dateStr = log.sentAt ? new Date(log.sentAt.toDate()).toLocaleString('pt-BR') : 'N/A';
            const logItem = document.createElement('div');
            logItem.className = 'bg-gray-50 dark:bg-[#2a2a2a] p-4 rounded-xl text-sm border border-gray-100 dark:border-gray-800/50 shadow-sm transition-all hover:bg-white dark:hover:bg-[#333333]';
            logItem.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>${typeIcon}</span>
                        <span>${log.type === 'ticket' ? 'Ingresso' : 'Recibo'}</span>
                        <span class="ml-1">${statusIcon}</span>
                    </span>
                    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">${dateStr}</span>
                </div>
                ${log.error ? `<p class="text-red-600 dark:text-red-400 text-xs mt-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">Erro: ${log.error}</p>` : ''}
            `;
            emailLogsList.appendChild(logItem);
        });
    } catch (error) {
        console.error('Erro ao carregar logs de email:', error);
    }
};


const getFulfillmentStatusLabel = (status) => {
    const labels = {
        'pending': 'Pendente',
        'processing': 'Em Preparação',
        'shipped': 'Enviado',
        'delivered': 'Entregue',
        'returned': 'Devolvido',
        'canceled': 'Cancelado'
    };
    return labels[status] || 'Pendente';
};

async function fetchProducts() {
    try {
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

async function fetchSales() {
    try {
        const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'desc'));
        const querySnapshot = await getDocs(q);
        const salesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const salesBySession = salesData.reduce((acc, sale) => {
            const key = sale.checkoutSessionId || sale.id;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(sale);
            return acc;
        }, {});

        allSales = Object.values(salesBySession);
    } catch (error) {
        console.error('Error fetching sales:', error);
    }
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');
    const dateFilter = document.getElementById('filter-date');
    const fulfillmentFilter = document.getElementById('filter-fulfillment');

    const searchTerm = searchInput.value.toLowerCase();
    const selectedUnit = unitFilter.value;
    const selectedProduct = productFilter.value;
    const selectedDate = dateFilter.value;
    const selectedFulfillment = fulfillmentFilter.value;

    let filteredGroups = allSales.filter(group => {
        return group.some(sale => {
            const nameMatch = !searchTerm || (sale.userName && sale.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm));
            const unitMatch = !selectedUnit || sale.userUnit === selectedUnit;
            const productMatch = !selectedProduct || sale.productId === selectedProduct;
            const fulfillmentMatch = !selectedFulfillment || sale.fulfillmentStatus === selectedFulfillment || (selectedFulfillment === 'pending' && !sale.fulfillmentStatus);

            let dateMatch = true;
            if (selectedDate && sale.created) {
                const saleDate = sale.created.toDate().toISOString().split('T')[0];
                dateMatch = saleDate === selectedDate;
            }

            return (nameMatch || emailMatch) && unitMatch && productMatch && dateMatch && fulfillmentMatch;
        });
    });

    renderSalesLog(filteredGroups);
}

function renderSalesLog(groupsToDisplay) {
    const logBody = document.getElementById('sales-table-body');
    if (!logBody) return;

    const paginatedGroups = groupsToDisplay.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    if (paginatedGroups.length === 0) {
        logBody.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-gray-500">Nenhuma venda encontrada.</td></tr>`;
        renderPagination(0);
        return;
    }

    logBody.innerHTML = paginatedGroups.map(group => {
        const mainSale = group[0];
        const totalAmount = group.reduce((sum, sale) => sum + sale.amountTotal, 0);
        const date = mainSale.created ? new Date(mainSale.created.toDate()).toLocaleString('pt-BR') : 'N/A';
        const amount = (totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: mainSale.currency || 'BRL' });
        const status = renderStatusTag(mainSale.paymentStatus);
        const productName = group.length > 1 ? `${mainSale.productName} (x${group.length})` : mainSale.productName;
        
        const namesList = group.map(sale => sale.userName || 'N/A').join('<br>');
        const emailsList = group.map(sale => sale.userEmail || 'N/A').join('<br>');
        const phonesList = group.map(sale => sale.userPhone || 'N/A').join('<br>');
        const agesList = group.map(sale => sale.userAge || 'N/A').join('<br>');

        // Verifica se pelo menos um e-mail no grupo foi enviado
        const isAnyEmailSent = group.some(sale => sale.emailSent);
        const emailSentStatusHtml = isAnyEmailSent
            ? `<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Enviado</span>`
            : `<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">Pendente</span>`;

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-[#2a2a2a] border-b border-gray-100 dark:border-gray-800 transition-colors group">
                <td class="p-4 text-gray-900 dark:text-white font-bold">${namesList}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 text-xs">${emailsList}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 text-xs">${phonesList}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 text-xs">${agesList}</td>
                <td class="p-4 text-gray-900 dark:text-white font-medium">${productName}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 text-xs">${mainSale.userPrograma || 'N/A'}</td>
                <td class="p-4 text-gray-500 dark:text-gray-400 text-xs">${mainSale.userGraduacao || 'N/A'}</td>
                <td class="p-4 text-gray-900 dark:text-white font-bold">${amount}</td>
                <td class="p-4">${status}</td>
                <td class="p-4">${emailSentStatusHtml}</td>
                <td class="p-4 text-gray-400 dark:text-gray-500 text-[10px] font-medium">${date}</td>
                <td class="p-4 text-center">
                    <button class="update-status-btn bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-blue-100 dark:border-transparent flex items-center justify-center gap-2 mx-auto" 
                        data-ids="${group.map(s => s.id).join(',')}" 
                        data-name="${mainSale.userName}" 
                        data-product="${productName}"
                        data-status="${mainSale.paymentStatus}">
                        <i class="fas fa-eye text-[10px]"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination(groupsToDisplay.length);
    
    // Add event delegation for update buttons
    logBody.onclick = (e) => {
        const btn = e.target.closest('.update-status-btn');
        if (btn) {
            const ids = btn.dataset.ids;
            openSaleDetailsModal(ids);
        }
    };
}

function renderPagination(totalItems) {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <span class="text-sm text-gray-400">
            Página ${currentPage} de ${totalPages}
        </span>
        <div class="flex items-center gap-2">
    `;

    paginationHTML += `
        <button id="prev-page-btn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
            Anterior
        </button>
    `;

    paginationHTML += `
        <button id="next-page-btn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
            Próxima
        </button>
    `;

    paginationHTML += `</div>`;
    paginationContainer.innerHTML = paginationHTML;

    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });
}

function populateFilters() {
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');

    const units = [...new Set(allSales.map(sale => sale.userUnit).filter(Boolean))];
    unitFilter.innerHTML = '<option value="">Todas as Unidades</option>';
    units.sort().forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
        unitFilter.appendChild(option);
    });

    productFilter.innerHTML = '<option value="">Todos os Produtos</option>';
    allProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        productFilter.appendChild(option);
    });
}

const renderStatusTag = (status) => {
    if (!status) return 'N/A';
    
    let statusText = 'Pendente';
    let colorClasses = 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-100 dark:border-yellow-500/20';
    
    if (status === 'paid') {
        statusText = 'Pago';
        colorClasses = 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 border border-green-100 dark:border-green-500/20';
    } else if (status === 'canceled') {
        statusText = 'Cancelado';
        colorClasses = 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border border-red-100 dark:border-red-500/20';
    } else if (status === 'pending') {
        statusText = 'Pendente';
        colorClasses = 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-100 dark:border-yellow-500/20';
    } else {
        statusText = status.charAt(0).toUpperCase() + status.slice(1);
    }

    return `<span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${colorClasses}">${statusText}</span>`;
};

