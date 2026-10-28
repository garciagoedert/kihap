import { cart } from './cart.js';
import { db } from '../intranet/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { onAuthReady, getUserData } from '../members/js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const checkoutForm = document.getElementById('checkout-form');
    const urlParams = new URLSearchParams(window.location.search);
    const directProductId = urlParams.get('product');

    if (directProductId) {
        try {
            const productSnap = await getDoc(doc(db, 'products', directProductId));
            if (productSnap.exists()) {
                const product = { id: productSnap.id, ...productSnap.data() };
                
                // Check if product is complex (requires options)
                const isComplex = 
                    product.hasSizes || 
                    product.priceType === 'variable' || 
                    product.priceType === 'kit' || 
                    product.priceType === 'lotes' || 
                    product.askAge || 
                    product.askProfessor ||
                    (product.addons && product.addons.length > 0);

                if (isComplex) {
                    // Redirect to product page for configuration
                    window.location.href = `produto.html?id=${directProductId}`;
                    return;
                } else {
                    // Simple product: add to cart (clearing it first for direct link logic)
                    cart.clearCart();
                    cart.addItem({
                        productId: product.id,
                        productName: product.name,
                        imageUrl: product.imageUrl,
                        isSubscription: product.isSubscription || false,
                        subscriptionFrequency: product.subscriptionFrequency || null,
                        subscriptionPeriod: product.subscriptionPeriod || null,
                        priceType: product.priceType || 'fixed',
                        customUnits: product.customUnits || [],
                        formDataList: [{ userAge: null, userSize: null, priceData: { amount: product.price } }],
                        totalAmount: product.price,
                        recommendedItems: [],
                        addedAt: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error("Error handling direct product link:", error);
        }
    }

    const unitSelector = document.getElementById('unidade');
    const summaryItemsContainer = document.getElementById('checkout-summary-items');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTotal = document.getElementById('summary-total');
    const participantsContainer = document.getElementById('participants-container');
    const checkoutError = document.getElementById('checkout-error');
    const payBtn = document.getElementById('final-pay-btn');

    // Payment method & discount elements
    const pixDiscountRow = document.getElementById('pix-discount-row');
    const pixDiscountLabel = document.getElementById('pix-discount-label');
    const summaryPixDiscount = document.getElementById('summary-pix-discount');
    const pixBadge = document.getElementById('pix-badge');
    const pixSubtitle = document.getElementById('pix-subtitle');
    const paymentPixCard = document.getElementById('payment-method-pix-card');
    const paymentCardCard = document.getElementById('payment-method-card-card');
    const paymentMethodInputs = document.querySelectorAll('input[name="payment-method"]');

    let currentUser = null;
    let unitsCache = [];
    let instructors = [];
    let paymentSettings = { pixDiscountEnabled: false, pixDiscountPercentage: 0 };
    let selectedPaymentMethod = 'pix';

    const formatCurrency = (amount) => {
        return (amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const calculatePixDiscount = (items, baseTotal, pSettings) => {
        let discount = 0;
        const globalPct = (pSettings && pSettings.pixDiscountEnabled && Number(pSettings.pixDiscountPercentage) > 0)
            ? Number(pSettings.pixDiscountPercentage)
            : 0;
        let hasExplicitPixPrice = false;

        items.forEach(item => {
            if (item.formDataList && Array.isArray(item.formDataList)) {
                item.formDataList.forEach(form => {
                    const priceData = form.priceData;
                    const amount = priceData ? priceData.amount : (item.totalAmount / item.formDataList.length);
                    if (priceData && priceData.pixAmount && Number(priceData.pixAmount) > 0 && Number(priceData.pixAmount) < amount) {
                        hasExplicitPixPrice = true;
                        discount += (amount - Number(priceData.pixAmount));
                    } else if (globalPct > 0) {
                        discount += Math.round(amount * (globalPct / 100));
                    }
                });
            }
            if (item.recommendedItems && Array.isArray(item.recommendedItems)) {
                item.recommendedItems.forEach(rec => {
                    if (globalPct > 0) {
                        discount += Math.round(rec.amount * (globalPct / 100));
                    }
                });
            }
        });

        return { discount, hasExplicitPixPrice };
    };

    const updatePaymentMethodUI = () => {
        const baseTotal = cart.getTotalAmount();
        let finalTotal = baseTotal;

        paymentMethodInputs.forEach(input => {
            if (input.checked) selectedPaymentMethod = input.value;
        });

        const items = cart.getCart();
        const { discount: pixDiscountAmount, hasExplicitPixPrice } = calculatePixDiscount(items, baseTotal, paymentSettings);

        if (paymentPixCard && paymentCardCard) {
            const pixDot = paymentPixCard.querySelector('.radio-dot');
            const cardDot = paymentCardCard.querySelector('.radio-dot');
            const pixIndicator = paymentPixCard.querySelector('.radio-indicator');
            const cardIndicator = paymentCardCard.querySelector('.radio-indicator');

            if (selectedPaymentMethod === 'pix') {
                paymentPixCard.className = 'relative flex items-center p-4 rounded-xl border-2 border-yellow-500 bg-gray-700/60 cursor-pointer transition-all';
                paymentCardCard.className = 'relative flex items-center p-4 rounded-xl border-2 border-gray-700 bg-gray-800/40 cursor-pointer transition-all hover:bg-gray-700/30';
                if (pixDot) pixDot.classList.remove('hidden');
                if (pixIndicator) { pixIndicator.classList.add('border-yellow-500'); pixIndicator.classList.remove('border-gray-600'); }
                if (cardDot) cardDot.classList.add('hidden');
                if (cardIndicator) { cardIndicator.classList.remove('border-yellow-500'); cardIndicator.classList.add('border-gray-600'); }
            } else {
                paymentCardCard.className = 'relative flex items-center p-4 rounded-xl border-2 border-yellow-500 bg-gray-700/60 cursor-pointer transition-all';
                paymentPixCard.className = 'relative flex items-center p-4 rounded-xl border-2 border-gray-700 bg-gray-800/40 cursor-pointer transition-all hover:bg-gray-700/30';
                if (cardDot) cardDot.classList.remove('hidden');
                if (cardIndicator) { cardIndicator.classList.add('border-yellow-500'); cardIndicator.classList.remove('border-gray-600'); }
                if (pixDot) pixDot.classList.add('hidden');
                if (pixIndicator) { pixIndicator.classList.remove('border-yellow-500'); pixIndicator.classList.add('border-gray-600'); }
            }
        }

        if (pixBadge && (hasExplicitPixPrice || (paymentSettings.pixDiscountEnabled && Number(paymentSettings.pixDiscountPercentage) > 0))) {
            const pct = paymentSettings.pixDiscountPercentage;
            pixBadge.textContent = hasExplicitPixPrice ? 'Preço Especial no Pix' : `${pct}% de Desconto`;
            pixBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-green-500 text-black uppercase tracking-wider animate-pulse';
            if (pixSubtitle) {
                pixSubtitle.textContent = hasExplicitPixPrice 
                    ? 'Desconto exclusivo no Pix já configurado neste pedido!' 
                    : `Pague via Pix e ganhe ${pct}% de desconto imediato`;
                pixSubtitle.className = 'text-xs text-green-400 font-semibold mt-0.5';
            }
        }

        if (selectedPaymentMethod === 'pix' && pixDiscountAmount > 0) {
            finalTotal = Math.max(0, baseTotal - pixDiscountAmount);
            if (pixDiscountRow) {
                pixDiscountRow.classList.remove('hidden');
                if (pixDiscountLabel) pixDiscountLabel.textContent = `⚡ Desconto Pix`;
                if (summaryPixDiscount) summaryPixDiscount.textContent = `- ${formatCurrency(pixDiscountAmount)}`;
            }
        } else {
            if (pixDiscountRow) pixDiscountRow.classList.add('hidden');
        }

        if (summaryTotal) summaryTotal.textContent = formatCurrency(finalTotal);
    };

    paymentMethodInputs.forEach(input => {
        input.addEventListener('change', updatePaymentMethodUI);
    });

    const fetchPaymentSettings = async () => {
        try {
            const snap = await getDoc(doc(db, 'settings', 'payment'));
            if (snap.exists()) {
                paymentSettings = snap.data();
                if (paymentSettings.pixDiscountEnabled && Number(paymentSettings.pixDiscountPercentage) > 0) {
                    const pct = Number(paymentSettings.pixDiscountPercentage);
                    if (pixBadge) {
                        pixBadge.textContent = `${pct}% de Desconto`;
                        pixBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-green-500 text-black uppercase tracking-wider animate-pulse';
                    }
                    if (pixSubtitle) {
                        pixSubtitle.textContent = `Pague via Pix e ganhe ${pct}% de desconto imediato`;
                        pixSubtitle.className = 'text-xs text-green-400 font-semibold mt-0.5';
                    }
                }
            }
        } catch (e) {
            console.warn('Error loading payment settings:', e);
        }
        updatePaymentMethodUI();
    };

    const renderSummary = () => {
        const items = cart.getCart();
        if (items.length === 0) {
            window.location.href = 'cart.html';
            return;
        }

        summaryItemsContainer.innerHTML = '';
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'flex justify-between items-start text-sm border-b border-gray-700/50 pb-3 mb-3 last:border-0';
            
            let itemDetails = '';
            item.formDataList.forEach((form, idx) => {
                if (form.userSize) itemDetails += `Tamanho: ${form.userSize} `;
            });

            let seatInfoHtml = '';
            if (item.hasSeatMap || (item.seats && item.seats.length > 0)) {
                const seatsList = (item.seats && item.seats.length > 0) ? item.seats.join(', ') : item.formDataList.map(f => f.seatId).filter(Boolean).join(', ');
                seatInfoHtml = `
                    <div class="mt-1 flex flex-wrap gap-1 items-center">
                        ${item.locationName ? `<span class="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs font-semibold"><i class="fas fa-map-marker-alt mr-1"></i> ${item.locationName}${item.locationVenue ? ` - ${item.locationVenue}` : ''}</span>` : ''}
                        ${item.sessionLabel ? `<span class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold"><i class="fas fa-calendar-day mr-1"></i> ${item.sessionLabel}</span>` : ''}
                        ${seatsList ? `<span class="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-black"><i class="fas fa-couch mr-1"></i> Cadeira(s): ${seatsList}</span>` : ''}
                    </div>
                `;
            }

            let priceText = formatCurrency(item.totalAmount);
            if (item.isSubscription) {
                const periodMap = { 'months': 'Mês', 'years': 'Ano', 'days': 'Dia' };
                const periodName = periodMap[item.subscriptionPeriod] || 'Mês';
                const freq = item.subscriptionFrequency || 1;
                if (freq > 1) {
                    priceText += ` / ${freq} ${periodName}s`;
                } else {
                    priceText += ` / ${periodName}`;
                }
            }

            el.innerHTML = `
                <div>
                    <p class="font-bold text-white">${item.productName}</p>
                    <p class="text-xs text-gray-400">Qtd: ${item.formDataList.length} ${itemDetails ? `| ${itemDetails}` : ''}</p>
                    ${seatInfoHtml}
                </div>
                <span class="font-semibold text-gray-300">${priceText}</span>
            `;
            summaryItemsContainer.appendChild(el);
        });

        summarySubtotal.textContent = formatCurrency(cart.getTotalAmount());
        updatePaymentMethodUI();
        initSeatReservationTimer();
        
        renderParticipantFields();
    };

    const initSeatReservationTimer = () => {
        const items = cart.getCart();
        const banner = document.getElementById('seat-reservation-banner');
        const timerDisplay = document.getElementById('seat-timer-display');
        if (!banner || !timerDisplay) return;

        const seatItem = items.find(i => i.hasSeatMap && i.lockExpiresAt);
        if (!seatItem) {
            banner.classList.add('hidden');
            return;
        }

        banner.classList.remove('hidden');

        const updateTimer = () => {
            const now = Date.now();
            const diff = seatItem.lockExpiresAt - now;

            if (diff <= 0) {
                timerDisplay.textContent = 'EXPIRADO';
                timerDisplay.classList.add('text-red-500');
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        updateTimer();
        setInterval(updateTimer, 1000);
    };

    const renderParticipantFields = () => {
        const items = cart.getCart();
        participantsContainer.innerHTML = '';
        
        let participantIndex = 1;
        
        items.forEach((item, itemIdx) => {
            item.formDataList.forEach((form, formIdx) => {
                const isComplexEvent = true; // For now, we collect for all, but could filter by product typa
                
                const assignedSeat = form.seatId || (item.seats && item.seats[formIdx]);
                const sessionTag = form.sessionName || form.sessionLabel;
                const seatBadge = assignedSeat ? `
                    <span class="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-black normal-case ml-2">
                        <i class="fas fa-couch mr-1"></i> Cadeira ${assignedSeat}${sessionTag ? ` (${sessionTag})` : ''}
                    </span>
                ` : '';

                const isExtra = Boolean(form.isExtraTicket);
                const titleLabel = isExtra ? `Ingresso Adicional ${participantIndex}` : `Participante ${participantIndex}`;
                const roleBadge = isExtra
                    ? `<span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold normal-case ml-2"><i class="fas fa-ticket-alt mr-1"></i> Acompanhante</span>`
                    : (item.hasExtraTicketPrice ? `<span class="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-bold normal-case ml-2"><i class="fas fa-user-graduate mr-1"></i> Graduando</span>` : '');

                const block = document.createElement('div');
                block.className = 'bg-gray-700/30 p-6 rounded-xl border border-gray-600 space-y-4';

                if (isExtra) {
                    block.innerHTML = `
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-emerald-400 uppercase flex items-center">
                                ${titleLabel} ${roleBadge} ${seatBadge}
                            </h3>
                            <span class="text-xs text-gray-400 font-normal normal-case">${item.productName}</span>
                        </div>
                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1 uppercase">Nome Completo do Acompanhante / Convidado</label>
                                <input type="text" name="participant-name" data-item="${itemIdx}" data-form="${formIdx}" placeholder="Nome do familiar ou acompanhante" class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" required>
                            </div>
                        </div>
                    `;
                } else {
                    block.innerHTML = `
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-yellow-500 uppercase flex items-center">
                                ${titleLabel} ${roleBadge} ${seatBadge}
                            </h3>
                            <span class="text-xs text-gray-400 font-normal normal-case">${item.productName}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="md:col-span-2">
                                <label class="block text-xs font-medium text-gray-400 mb-1 uppercase">Nome Completo do Aluno</label>
                                <input type="text" name="participant-name" data-item="${itemIdx}" data-form="${formIdx}" placeholder="Nome do participante" class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" required>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1 uppercase">Programa</label>
                                <select name="participant-program" data-item="${itemIdx}" data-form="${formIdx}" class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" required>
                                    <option value="">Selecione</option>
                                    <option value="tradicional">Tradicional</option>
                                    <option value="littles">Littles</option>
                                    <option value="não aluno">Ainda não sou aluno</option>
                                </select>
                            </div>
                            <div class="grad-container hidden">
                                <label class="block text-xs font-medium text-gray-400 mb-1 uppercase">Graduação</label>
                                <select name="participant-grad" data-item="${itemIdx}" data-form="${formIdx}" class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500">
                                    <option value="">Selecione</option>
                                </select>
                            </div>
                            ${form.hasOwnProperty('userProfessor') ? `
                            <div class="professor-container">
                                <label class="block text-xs font-medium text-gray-400 mb-1 uppercase">Professor Responsável</label>
                                <select name="participant-professor" data-item="${itemIdx}" data-form="${formIdx}" class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" required>
                                    <option value="">Selecione o Professor</option>
                                    ${(item.availableProfessors && item.availableProfessors.length > 0) 
                                        ? item.availableProfessors.map(prof => `<option value="${prof}" ${form.userProfessor === prof ? 'selected' : ''}>${prof}</option>`).join('')
                                        : instructors.map(instr => `<option value="${instr.name || instr.id}" ${form.userProfessor === (instr.name || instr.id) ? 'selected' : ''}>${instr.name || instr.id}</option>`).join('')
                                    }
                                </select>
                            </div>
                            ` : ''}
                        </div>
                    `;
                    
                    const programSelect = block.querySelector('[name="participant-program"]');
                    const gradContainer = block.querySelector('.grad-container');
                    const gradSelect = block.querySelector('[name="participant-grad"]');
                    
                    if (programSelect) {
                        programSelect.addEventListener('change', () => {
                            populateGraduacao(programSelect.value, gradContainer, gradSelect);
                        });
                    }
                }
                
                participantsContainer.appendChild(block);
                participantIndex++;
            });
        });
    };

    const fetchInstructors = async () => {
        try {
            const q = query(collection(db, 'users'), where('isInstructor', '==', true));
            const querySnapshot = await getDocs(q);
            instructors = [];
            querySnapshot.forEach(doc => {
                instructors.push({ id: doc.id, ...doc.data() });
            });
            instructors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } catch (error) {
            console.error("Error fetching instructors:", error);
        }
    };

    const fetchUnits = async () => {
        try {
            const functions = getFunctions();
            const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
            const result = await getPublicEvoUnits();
            unitsCache = result.data;
            populateUnits();
        } catch (error) {
            console.error("Error fetching units:", error);
            unitSelector.innerHTML = '<option value="">Erro ao carregar unidades</option>';
        }
    };

    const normalizeString = (str) => {
        if (!str) return '';
        return str.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
            .replace(/\s+/g, ' ') // Remove extra spaces
            .trim();
    };

    const populateUnits = () => {
        unitSelector.innerHTML = '<option value="">Selecione sua unidade</option>';
        
        const items = cart.getCart();
        let allowedUnitsIntersection = null;

        items.forEach(item => {
            if (item.customUnits && item.customUnits.length > 0) {
                // Fail-safe: Split by newline in case data was saved as a single block (legacy)
                const cleanUnits = item.customUnits.flatMap(u => u.split(/\n/)).map(u => u.trim()).filter(u => u);
                
                if (allowedUnitsIntersection === null) {
                    allowedUnitsIntersection = [...cleanUnits];
                } else {
                    allowedUnitsIntersection = allowedUnitsIntersection.filter(au => 
                        cleanUnits.some(itemUnit => {
                            const n1 = normalizeString(au);
                            const n2 = normalizeString(itemUnit);
                            return n1.includes(n2) || n2.includes(n1);
                        })
                    );
                }
            }
        });

        // Caso haja restrições específicas por produto
        if (allowedUnitsIntersection !== null) {
            allowedUnitsIntersection.forEach(customUnit => {
                const normalizedCustom = normalizeString(customUnit);
                
                // Busca se esse nome customizado corresponde a uma unidade do sistema EVO
                const matchingEvoUnit = unitsCache.find(evoUnit => {
                    if (evoUnit.toLowerCase() === 'atadf') return false;
                    const n1 = normalizeString(customUnit);
                    const n2 = normalizeString(evoUnit);
                    return n1.includes(n2) || n2.includes(n1);
                });

                const option = document.createElement('option');
                // Se bater com uma unidade EVO, usamos o ID da EVO como value para o backend
                // Mas mostramos o texto bonito que o usuário digitou
                option.value = matchingEvoUnit ? matchingEvoUnit : customUnit;
                option.textContent = customUnit;
                unitSelector.appendChild(option);
            });
        } else {
            // Caso NÃO haja restrições, mostra a lista global padrão (EVO)
            unitsCache.forEach(unit => {
                const unitLower = unit.toLowerCase();
                if (unitLower !== 'atadf') {
                    const option = document.createElement('option');
                    option.value = unit;
                    option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
                    unitSelector.appendChild(option);
                }
            });
        }
    };

    const populateGraduacao = (program, container, selector) => {
        const graduacoes = {
            tradicional: ['Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida', 'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida', 'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida', 'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida', 'Vermelha e preta', 'Preta 1º Dan', 'Preta 2º Dan', 'Preta 3º Dan', 'Preta 4º Dan', 'Preta 5º Dan', 'Preta 6º Dan', 'Preta 7º Dan', 'Preta 8º Dan', 'Preta 9º Dan'],
            littles: ['Littles Branca', 'Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta', 'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix']
        };
        const options = graduacoes[program];
        if (options) {
            container.classList.remove('hidden');
            selector.innerHTML = '<option value="">Selecione sua graduação</option>';
            selector.required = true;
            options.forEach(grad => {
                const option = document.createElement('option');
                option.value = grad;
                option.textContent = grad;
                selector.appendChild(option);
            });
        } else {
            container.classList.add('hidden');
            selector.required = false;
            selector.innerHTML = '<option value="">Selecione sua graduação</option>';
        }
    };


    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            if (userData) {
                currentUser = { uid: user.uid, ...userData };
                const nameResp = document.getElementById('nome-responsavel');
                if (nameResp) nameResp.value = currentUser.name || '';
                document.getElementById('email').value = currentUser.email || '';
                document.getElementById('telefone').value = currentUser.phoneNumber || '';
                document.getElementById('cpf').value = currentUser.cpf || '';
                if (currentUser.unit) {
                    // Wait for units to load then select
                    const checkUnits = setInterval(() => {
                        if (unitsCache.length > 0) {
                            unitSelector.value = currentUser.unit;
                            clearInterval(checkUnits);
                        }
                    }, 500);
                }
            }
        }
    });

    const handleCheckout = async (e) => {
        e.preventDefault();
        payBtn.disabled = true;
        payBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processando...';
        checkoutError.classList.add('hidden');

        const items = cart.getCart();
        
        // Coletar dados dos participantes e injetar nos itens
        const names = document.querySelectorAll('[name="participant-name"]');
        const programs = document.querySelectorAll('[name="participant-program"]');
        const grads = document.querySelectorAll('[name="participant-grad"]');
        const professors = document.querySelectorAll('[name="participant-professor"]');
        
        names.forEach((input) => {
            const itemIdx = input.dataset.item;
            const formIdx = input.dataset.form;
            const form = items[itemIdx].formDataList[formIdx];
            const isExtra = Boolean(form.isExtraTicket);
            
            form.userName = input.value;
            if (!isExtra) {
                const programInput = document.querySelector(`[name="participant-program"][data-item="${itemIdx}"][data-form="${formIdx}"]`);
                const gradInput = document.querySelector(`[name="participant-grad"][data-item="${itemIdx}"][data-form="${formIdx}"]`);
                const profInput = document.querySelector(`[name="participant-professor"][data-item="${itemIdx}"][data-form="${formIdx}"]`);

                form.userPrograma = programInput ? programInput.value : '';
                form.userGraduacao = (gradInput && gradInput.required) ? gradInput.value : null;
                form.userProfessor = profInput ? profInput.value : (form.userProfessor || null);
            }

            if (!items[itemIdx].formDataList[formIdx].seatId && items[itemIdx].seats && items[itemIdx].seats[formIdx]) {
                items[itemIdx].formDataList[formIdx].seatId = items[itemIdx].seats[formIdx];
            }
            if (!items[itemIdx].formDataList[formIdx].sessionId && items[itemIdx].sessionId) {
                items[itemIdx].formDataList[formIdx].sessionId = items[itemIdx].sessionId;
            }
            if (!items[itemIdx].formDataList[formIdx].sessionLabel && items[itemIdx].sessionLabel) {
                items[itemIdx].formDataList[formIdx].sessionLabel = items[itemIdx].sessionLabel;
            }
            if (!items[itemIdx].formDataList[formIdx].locationId && items[itemIdx].locationId) {
                items[itemIdx].formDataList[formIdx].locationId = items[itemIdx].locationId;
                items[itemIdx].formDataList[formIdx].locationName = items[itemIdx].locationName;
                items[itemIdx].formDataList[formIdx].locationVenue = items[itemIdx].locationVenue;
                items[itemIdx].formDataList[formIdx].locationAddress = items[itemIdx].locationAddress;
            }
        });

        const globalUserData = {
            userName: document.getElementById('nome-responsavel').value,
            userEmail: document.getElementById('email').value,
            userPhone: document.getElementById('telefone').value,
            userCpf: document.getElementById('cpf').value,
            userUnit: document.getElementById('unidade').value,
            userId: currentUser ? currentUser.uid : null
        };

        try {
            const baseTotal = cart.getTotalAmount();
            let finalTotal = baseTotal;
            let isPixDiscountApplied = false;

            if (selectedPaymentMethod === 'pix') {
                const { discount: pixDiscountAmount } = calculatePixDiscount(items, baseTotal, paymentSettings);
                if (pixDiscountAmount > 0) {
                    finalTotal = Math.max(0, baseTotal - pixDiscountAmount);
                    isPixDiscountApplied = true;
                }
            }

            // Robust check for free purchases (handles potential float precision issues)
            const isFree = finalTotal <= 0;
            console.log(`[Checkout] Processing ${isFree ? 'FREE' : 'PAID'} purchase with ${selectedPaymentMethod}. Total: ${finalTotal/100}`);
            
            const endpoint = isFree 
                ? 'https://us-central1-intranet-kihap.cloudfunctions.net/processCartFreePurchase'
                : 'https://us-central1-intranet-kihap.cloudfunctions.net/createCartCheckoutSession';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartItems: items,
                    globalUserData: globalUserData,
                    totalAmount: finalTotal,
                    paymentMethod: selectedPaymentMethod,
                    isPixDiscountApplied: isPixDiscountApplied
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao processar o checkout.');
            }

            const data = await response.json();
            
            if (isFree && data.status === 'success') {
                cart.clearCart();
                window.location.href = 'compra-success.html';
            } else if (data.checkoutUrl) {
                cart.clearCart();
                window.location.href = data.checkoutUrl;
            } else {
                throw new Error('Resposta inválida do servidor.');
            }
        } catch (error) {
            console.error('Checkout Error:', error);
            checkoutError.textContent = error.message;
            checkoutError.classList.remove('hidden');
            payBtn.disabled = false;
            payBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Pagar Agora';
        }
    };

    checkoutForm.addEventListener('submit', handleCheckout);

    renderSummary();
    await fetchPaymentSettings();
    await fetchInstructors();
    fetchUnits();
});
