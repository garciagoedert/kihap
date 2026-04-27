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

    let currentUser = null;
    let unitsCache = [];
    let instructors = [];

    const formatCurrency = (amount) => {
        return (amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

            el.innerHTML = `
                <div>
                    <p class="font-bold text-white">${item.productName}</p>
                    <p class="text-xs text-gray-400">Qtd: ${item.formDataList.length} ${itemDetails ? `| ${itemDetails}` : ''}</p>
                </div>
                <span class="font-semibold text-gray-300">${formatCurrency(item.totalAmount)}</span>
            `;
            summaryItemsContainer.appendChild(el);
        });

        summarySubtotal.textContent = formatCurrency(cart.getTotalAmount());
        summaryTotal.textContent = formatCurrency(cart.getTotalAmount());
        
        renderParticipantFields();
    };

    const renderParticipantFields = () => {
        const items = cart.getCart();
        participantsContainer.innerHTML = '';
        
        let participantIndex = 1;
        
        items.forEach((item, itemIdx) => {
            item.formDataList.forEach((form, formIdx) => {
                const isComplexEvent = true; // For now, we collect for all, but could filter by product typa
                
                const block = document.createElement('div');
                block.className = 'bg-gray-700/30 p-6 rounded-xl border border-gray-600 space-y-4';
                block.innerHTML = `
                    <h3 class="text-lg font-bold text-yellow-500 uppercase flex justify-between">
                        Participante ${participantIndex}
                        <span class="text-xs text-gray-500 font-normal normal-case pt-1">${item.productName}</span>
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-medium text-gray-400 mb-1 uppercase">Nome Completo</label>
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
                                ${instructors.map(instr => `<option value="${instr.name || instr.id}" ${form.userProfessor === (instr.name || instr.id) ? 'selected' : ''}>${instr.name || instr.id}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}
                    </div>
                `;
                
                const programSelect = block.querySelector('[name="participant-program"]');
                const gradContainer = block.querySelector('.grad-container');
                const gradSelect = block.querySelector('[name="participant-grad"]');
                
                programSelect.addEventListener('change', () => {
                    populateGraduacao(programSelect.value, gradContainer, gradSelect);
                });
                
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
            tradicional: ['Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida', 'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida', 'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida', 'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida', 'Vermelha e preta', '1º Dan Preta', '2º Dan Preta', '3º Dan Preta', '4º Dan Preta', '5º Dan Preta', '6º Dan Preta', '7º Dan Preta', '8º Dan Preta', '9º Dan Preta'],
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
        
        names.forEach((input, index) => {
            const itemIdx = input.dataset.item;
            const formIdx = input.dataset.form;
            
            items[itemIdx].formDataList[formIdx].userName = input.value;
            items[itemIdx].formDataList[formIdx].userPrograma = programs[index].value;
            items[itemIdx].formDataList[formIdx].userGraduacao = grads[index].required ? grads[index].value : null;
            items[itemIdx].formDataList[formIdx].userProfessor = professors[index] ? professors[index].value : (items[itemIdx].formDataList[formIdx].userProfessor || null);
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
            const totalAmount = cart.getTotalAmount();
            // Robust check for free purchases (handles potential float precision issues)
            const isFree = totalAmount <= 0;
            console.log(`[Checkout] Processing ${isFree ? 'FREE' : 'PAID'} purchase. Total: ${totalAmount/100}`);
            
            const endpoint = isFree 
                ? 'https://us-central1-intranet-kihap.cloudfunctions.net/processCartFreePurchase'
                : 'https://us-central1-intranet-kihap.cloudfunctions.net/createCartCheckoutSession';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartItems: items,
                    globalUserData: globalUserData,
                    totalAmount: totalAmount
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
    await fetchInstructors();
    fetchUnits();
});
