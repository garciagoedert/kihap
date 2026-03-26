import { db } from '../intranet/firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { onAuthReady, getUserData } from '../members/js/auth.js';
import { cart } from './cart.js';
document.addEventListener('DOMContentLoaded', () => {
    const stripe = Stripe('pk_live_51SL5wfCOKFM07tm8iVZ7c7tB8PEIoiczwTEAUoRhe4dXusoilvXxm4vkgmbrcnMdCrXnOiIpvc0nw6FBhxYbnryl00gTmK12WA');

    const productLoading = document.getElementById('product-loading');
    const productContent = document.getElementById('product-content');
    const productNameTitle = document.getElementById('product-name-title');
    const productDescription = document.getElementById('product-description');
    const productImageDisplay = document.getElementById('product-image-display');
    const productPriceDisplay = document.getElementById('product-price-display');
    const productLoteDisplay = document.getElementById('product-lote-display');
    const productStockDisplay = document.getElementById('product-stock-display');
    const quantitySelector = document.getElementById('quantity-selector');
    const paymentForm = document.getElementById('payment-form');
    const formsContainer = document.getElementById('forms-container');
    const formTemplate = document.getElementById('form-template');
    const payButton = document.getElementById('pay-button');
    const formStatus = document.getElementById('form-status');
    const couponCodeInput = document.getElementById('coupon-code');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponStatus = document.getElementById('coupon-status');
    const recommendedProductsContainer = document.getElementById('recommended-products-container');
    const recommendedProductsList = document.getElementById('recommended-products-list');

    let productId = null;
    let productData = null;
    let currentUser = null;
    let unitsCache = [];
    let appliedCoupon = null;

    const getProductId = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    };

    const fetchProduct = async (id) => {
        if (!id) {
            productLoading.innerHTML = `
                <div class="text-center">
                    <p class="text-2xl text-red-500 mb-4">ID do produto não encontrado na URL.</p>
                    <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                </div>`;
            return;
        }
        try {
            const productRef = doc(db, 'products', id);
            const docSnap = await getDoc(productRef);

            if (docSnap.exists()) {
                productData = { id: docSnap.id, ...docSnap.data() };

                const isAvailable = productData.available !== false; // Default to true if undefined
                const hasExpired = productData.availabilityDate && new Date() > new Date(productData.availabilityDate);

                if (!isAvailable || hasExpired) {
                    productLoading.innerHTML = `
                        <div class="text-center">
                            <h1 class="text-4xl font-bold mb-4">Produto Indisponível</h1>
                            <p class="text-lg text-gray-400 mb-8">Este produto não está mais disponível para compra.</p>
                            <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                        </div>`;
                    productContent.classList.add('hidden');
                    productLoading.classList.remove('hidden');
                    return;
                }

                await displayProduct(productData);
                if (productData.recommendedProducts && productData.recommendedProducts.length > 0) {
                    await fetchAndDisplayRecommendedProducts(productData.recommendedProducts);
                }
            } else {
                productLoading.innerHTML = `
                    <div class="text-center">
                        <p class="text-2xl text-red-500 mb-4">Produto não encontrado.</p>
                        <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                    </div>`;
            }
        } catch (error) {
            console.error("Error fetching product:", error);
            productLoading.innerHTML = `
                <div class="text-center">
                    <p class="text-2xl text-red-500 mb-4">Erro ao carregar o produto.</p>
                    <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                </div>`;
        }
    };

    const displayProduct = async (product) => {
        productNameTitle.textContent = product.name;
        document.title = `Kihap - ${product.name}`;
        productDescription.textContent = product.description || '';
        if (product.imageUrl) {
            productImageDisplay.src = product.imageUrl;
            productImageDisplay.classList.remove('hidden');
        }

        if (product.controlStock && product.stockQuantity !== undefined) {
            productStockDisplay.classList.remove('hidden');
            if (product.stockQuantity <= 10 && product.stockQuantity > 0) {
                productStockDisplay.innerHTML = `<span class="text-red-400 font-bold">🔥 Últimas ${product.stockQuantity} unidades em estoque!</span>`;
            } else if (product.stockQuantity > 0) {
                productStockDisplay.textContent = `${product.stockQuantity} unidades disponíveis`;
            } else {
                productStockDisplay.innerHTML = `<span class="text-red-500 font-bold">Esgotado</span>`;
            }
        } else {
            productStockDisplay.classList.add('hidden');
        }

        if (product.isSubscription) {
            payButton.innerHTML = '<i class="fas fa-lock mr-2"></i> Assinar Agora';
        }

        await renderForms(1);
        productLoading.classList.add('hidden');
        productContent.classList.remove('hidden');
    };

    const fetchAndDisplayRecommendedProducts = async (productIds) => {
        try {
            const productsRef = collection(db, 'products');
            const q = query(productsRef, where('__name__', 'in', productIds));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                recommendedProductsList.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const product = { id: doc.id, ...doc.data() };
                    const productElement = document.createElement('div');
                    productElement.className = 'bg-gray-700 p-4 rounded-lg flex items-center justify-between';
                    productElement.innerHTML = `
                        <div class="flex items-center">
                            <img src="${product.imageUrl || 'imgs/placeholder.jpg'}" alt="${product.name}" class="w-16 h-16 object-cover rounded-md mr-4">
                            <div>
                                <h4 class="font-bold">${product.name}</h4>
                                <p class="text-yellow-400">${(product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>
                        <select data-product-id="${product.id}" data-product-price="${product.price}" class="recommended-product-quantity w-20 px-2 py-1 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500">
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    `;
                    recommendedProductsList.appendChild(productElement);
                });
                recommendedProductsContainer.classList.remove('hidden');

                document.querySelectorAll('.recommended-product-quantity').forEach(select => {
                    select.addEventListener('change', updateTotalPrice);
                });
            }
        } catch (error) {
            console.error("Error fetching recommended products:", error);
        }
    };

    const renderForms = async (quantity) => {
        formsContainer.innerHTML = '';
        for (let i = 1; i <= quantity; i++) {
            const formClone = formTemplate.content.cloneNode(true);
            const formInstance = formClone.querySelector('.form-instance');

            const formInstanceTitle = formInstance.querySelector('.form-instance-title');
            if (formInstanceTitle) {
                if (productData.priceType === 'kit') {
                    formInstanceTitle.innerHTML = `Detalhes do Item <span class="form-instance-number">${i}</span>`;
                } else {
                    formInstanceTitle.innerHTML = `Inscrição <span class="form-instance-number">${i}</span>`;
                }
            } else {
                formInstance.querySelector('.form-instance-number').textContent = i;
            }

            const fields = ['nome', 'email', 'telefone', 'cpf', 'unidade', 'programa', 'graduacao', 'price-variant-selector', 'size-selector'];
            fields.forEach(field => {
                const label = formInstance.querySelector(`label[for="${field}"]`);
                const input = formInstance.querySelector(`[name="${field}"]`);
                if (label) label.setAttribute('for', `${field}-${i}`);
                if (input) input.id = `${field}-${i}`;
            });

            // Campo Idade condicional
            if (productData.askAge) {
                const ageContainer = formInstance.querySelector('.age-container');
                if (ageContainer) {
                    ageContainer.classList.remove('hidden');
                    const ageInput = ageContainer.querySelector('input[name="idade"]');
                    if (ageInput) {
                        ageInput.id = `idade-${i}`;
                        ageInput.required = true;
                    }
                }
            }

            // Campo Professor condicional
            if (productData.askProfessor) {
                const professorContainer = document.createElement('div');
                professorContainer.innerHTML = `
                    <label for="professor-${i}" class="block text-sm font-medium text-gray-400 mb-1">Professor</label>
                    <input type="text" name="professor" id="professor-${i}" placeholder="Nome do Professor" class="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500">
                `;
                // Inserir após o campo de unidade
                const unidadeContainer = formInstance.querySelector('[name="unidade"]').closest('div');
                unidadeContainer.after(professorContainer);
            }

            const programaSelect = formInstance.querySelector('[name="programa"]');
            programaSelect.addEventListener('change', () => populateGraduacao(programaSelect.value, formInstance));

            const priceVariantSelectorContainer = formInstance.querySelector('.price-variant-selector-container');
            const priceVariantSelector = formInstance.querySelector('[name="price-variant-selector"]');

            if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0) {
                priceVariantSelectorContainer.classList.remove('hidden');
                priceVariantSelector.required = true;
                priceVariantSelector.innerHTML = '';

                productData.priceVariants.forEach((variant, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = `${variant.name} - ${(variant.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
                    priceVariantSelector.appendChild(option);
                });

                priceVariantSelector.addEventListener('change', updateTotalPrice);
            } else {
                priceVariantSelectorContainer.classList.add('hidden');
                priceVariantSelector.required = false;
            }

            const kitOptionsContainer = formInstance.querySelector('.kit-options-container');
            if (productData.priceType === 'kit' && productData.kitItems && productData.kitItems.length > 0) {
                kitOptionsContainer.classList.remove('hidden');
                kitOptionsContainer.innerHTML = '';
                
                productData.kitItems.forEach((item, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.innerHTML = `
                        <label for="kit-item-${i}-${index}" class="block text-sm font-semibold text-gray-300 mb-1">Selecione o tamanho/opção para: <span class="text-white">${item.name}</span></label>
                        <select id="kit-item-${i}-${index}" name="kit-item-select" data-item-name="${item.name}" class="w-full px-4 py-3 opacity-90 rounded-lg bg-gray-800 border border-gray-600 text-white shadow-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" required>
                            <option value="" disabled selected>Escolha uma opção...</option>
                            ${item.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    `;
                    kitOptionsContainer.appendChild(itemDiv);
                });
            } else {
                if (kitOptionsContainer) kitOptionsContainer.classList.add('hidden');
            }

            const addonsOptionsContainer = formInstance.querySelector('.addons-options-container');
            if (productData.addons && productData.addons.length > 0) {
                addonsOptionsContainer.classList.remove('hidden');
                addonsOptionsContainer.innerHTML = '';
                
                productData.addons.forEach((addon, index) => {
                    const priceFormatted = (addon.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const addonDiv = document.createElement('div');
                    addonDiv.innerHTML = `
                        <label class="flex items-start space-x-3 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors cursor-pointer group">
                            <div class="flex items-center h-5 mt-1">
                                <input type="checkbox" name="addon-checkbox-${i}" value="${index}" data-addon-name="${addon.name}" data-addon-price="${addon.price}" class="addon-checkbox w-5 h-5 text-yellow-500 bg-gray-900 border-gray-600 rounded focus:ring-yellow-500 focus:ring-offset-gray-800">
                            </div>
                            <div class="flex-1">
                                <span class="block text-base font-medium text-gray-200 group-hover:text-white">${addon.name}</span>
                                <span class="block text-sm text-yellow-500 font-semibold mt-0.5">+ ${priceFormatted}</span>
                            </div>
                        </label>
                    `;
                    addonsOptionsContainer.appendChild(addonDiv);
                });
                
                const checkboxes = addonsOptionsContainer.querySelectorAll('.addon-checkbox');
                checkboxes.forEach(cb => cb.addEventListener('change', updateTotalPrice));
            } else {
                if (addonsOptionsContainer) addonsOptionsContainer.classList.add('hidden');
            }

            const sizeSelectorContainer = formInstance.querySelector('.size-selector-container');
            const sizeSelector = formInstance.querySelector('[name="size-selector"]');
            if (productData.hasSizes && productData.sizes && productData.sizes.length > 0) {
                sizeSelectorContainer.classList.remove('hidden');
                sizeSelector.required = true;
                sizeSelector.innerHTML = '<option value="" disabled selected>Escolha o Tamanho</option>';
                productData.sizes.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size;
                    option.textContent = size;
                    sizeSelector.appendChild(option);
                });
            } else {
                sizeSelectorContainer.classList.add('hidden');
                sizeSelector.required = false;
            }

            formsContainer.appendChild(formClone);
        }

        if (quantity === 1 && currentUser) {
            const firstForm = formsContainer.querySelector('.form-instance');
            if (firstForm) {
                firstForm.querySelector('[name="nome"]').value = currentUser.name || '';
                firstForm.querySelector('[name="email"]').value = currentUser.email || '';
                firstForm.querySelector('[name="telefone"]').value = currentUser.phoneNumber || '';
            }
        }

        await populateAllUnitSelectors();
        updateTotalPrice();
    };

    const populateGraduacao = (program, formInstance) => {
        const graduacaoContainer = formInstance.querySelector('.graduacao-container');
        const graduacaoSelect = formInstance.querySelector('[name="graduacao"]');
        const graduacoes = {
            tradicional: ['Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida', 'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida', 'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida', 'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida', 'Vermelha e preta', 'Preta'],
            littles: ['Littles Branca', 'Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta', 'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix']
        };
        const options = graduacoes[program];
        if (options) {
            graduacaoContainer.classList.remove('hidden');
            graduacaoSelect.innerHTML = '<option value="">Selecione sua graduação</option>';
            options.forEach(grad => {
                const option = document.createElement('option');
                option.value = grad;
                option.textContent = grad;
                graduacaoSelect.appendChild(option);
            });
        } else {
            graduacaoContainer.classList.add('hidden');
        }
    };

    const updateTotalPrice = () => {
        let totalAmount = 0;
        const formInstances = formsContainer.querySelectorAll('.form-instance');
        let activeLoteName = null;

        formInstances.forEach(form => {
            let instancePrice = 0;
            if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0) {
                const selector = form.querySelector('[name="price-variant-selector"]');
                const selectedVariant = productData.priceVariants[selector.value];
                if (selectedVariant) {
                    instancePrice = selectedVariant.price;
                }
            } else if (productData.priceType === 'lotes' && productData.lotes && productData.lotes.length > 0) {
                const now = new Date();
                let activeLote = null;
                for (const lote of productData.lotes) {
                    const startDate = new Date(lote.startDate);
                    if (startDate <= now) {
                        activeLote = lote;
                    }
                }
                if (activeLote) {
                    instancePrice = activeLote.price;
                    activeLoteName = activeLote.name;
                } else {
                    // Fallback to the first lote if none is active yet
                    instancePrice = productData.lotes[0].price;
                    activeLoteName = productData.lotes[0].name;
                }
            } else if (productData.priceType === 'kit') {
                instancePrice = productData.kitBasePrice || productData.price || 0;
            } else {
                instancePrice = productData.price || 0;
            }

            // Somar Addons
            const checkedAddons = form.querySelectorAll('.addon-checkbox:checked');
            checkedAddons.forEach(addon => {
                instancePrice += parseInt(addon.dataset.addonPrice, 10);
            });

            totalAmount += instancePrice;
        });

        if (activeLoteName) {
            productLoteDisplay.textContent = activeLoteName;
            productLoteDisplay.classList.remove('hidden');
        } else {
            productLoteDisplay.classList.add('hidden');
        }

        if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
                totalAmount -= totalAmount * (appliedCoupon.value / 100);
            } else if (appliedCoupon.type === 'fixed') {
                totalAmount -= appliedCoupon.value;
            }
        }

        document.querySelectorAll('.recommended-product-quantity').forEach(select => {
            const quantity = parseInt(select.value, 10);
            if (quantity > 0) {
                const price = parseInt(select.dataset.productPrice, 10);
                totalAmount += price * quantity;
            }
        });

        let priceText = (totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        if (productData.isSubscription) {
            const periodMap = { 'months': 'Mês', 'years': 'Ano', 'days': 'Dia' };
            const periodName = periodMap[productData.subscriptionPeriod] || 'Mês';
            const freq = productData.subscriptionFrequency || 1;
            if (freq > 1) {
                priceText += ` / ${freq} ${periodName}s`;
            } else {
                priceText += ` / ${periodName}`;
            }
        }

        productPriceDisplay.textContent = priceText;
    };

    const applyCoupon = async () => {
        const code = couponCodeInput.value.trim();
        if (!code) {
            couponStatus.textContent = 'Por favor, insira um código de cupom.';
            couponStatus.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const q = query(collection(db, 'coupons'), where('code', '==', code));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                couponStatus.textContent = 'Cupom inválido.';
                couponStatus.className = 'mt-2 text-sm text-red-400';
                appliedCoupon = null;
                updateTotalPrice();
                return;
            }

            const couponDoc = querySnapshot.docs[0];
            const coupon = { id: couponDoc.id, ...couponDoc.data() };

            if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
                couponStatus.textContent = 'Cupom expirado.';
                couponStatus.className = 'mt-2 text-sm text-red-400';
                appliedCoupon = null;
                updateTotalPrice();
                return;
            }

            appliedCoupon = coupon;
            couponStatus.textContent = 'Cupom aplicado com sucesso!';
            couponStatus.className = 'mt-2 text-sm text-green-400';
            updateTotalPrice();

        } catch (error) {
            console.error('Error applying coupon:', error);
            couponStatus.textContent = 'Erro ao aplicar o cupom.';
            couponStatus.className = 'mt-2 text-sm text-red-400';
        }
    };

    applyCouponBtn.addEventListener('click', applyCoupon);

    quantitySelector.addEventListener('change', () => {
        renderForms(parseInt(quantitySelector.value, 10));
    });

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        payButton.disabled = true;
        formStatus.textContent = 'Processando seu pagamento...';

        const formInstances = formsContainer.querySelectorAll('.form-instance');
        const formDataList = [];
        let totalAmount = 0;
        const recommendedItems = [];

        // Re-read product ID at the time of submission for robustness
        const currentProductId = getProductId();
        if (!currentProductId) {
            formStatus.textContent = 'Erro: ID do produto não encontrado. Por favor, recarregue a página.';
            payButton.disabled = false;
            return;
        }

        document.querySelectorAll('.recommended-product-quantity').forEach(select => {
            const quantity = parseInt(select.value, 10);
            if (quantity > 0) {
                const productId = select.dataset.productId;
                const productPrice = parseInt(select.dataset.productPrice, 10);
                recommendedItems.push({
                    productId: productId,
                    productName: select.closest('.flex').querySelector('h4').textContent,
                    amount: productPrice * quantity,
                    quantity: quantity
                });
                totalAmount += productPrice * quantity;
            }
        });

        formInstances.forEach(form => {
            const formData = {
                userName: form.querySelector('[name="nome"]').value,
                userEmail: form.querySelector('[name="email"]').value,
                userPhone: form.querySelector('[name="telefone"]').value,
                userCpf: form.querySelector('[name="cpf"]').value,
                userUnit: form.querySelector('[name="unidade"]').value,
                userPrograma: form.querySelector('[name="programa"]').value,
                userPrograma: form.querySelector('[name="programa"]').value,
                userGraduacao: form.querySelector('.graduacao-container').classList.contains('hidden') ? null : form.querySelector('[name="graduacao"]').value,
                userProfessor: form.querySelector('[name="professor"]') ? form.querySelector('[name="professor"]').value : null,
                userAge: form.querySelector('[name="idade"]') && !form.querySelector('.age-container').classList.contains('hidden') ? form.querySelector('[name="idade"]').value : null,
                userSize: form.querySelector('[name="size-selector"]') && !form.querySelector('.size-selector-container').classList.contains('hidden') ? form.querySelector('[name="size-selector"]').value : null,
                userId: currentUser ? currentUser.uid : null
            };

            let priceData = {};
            let kitSelections = null;
            if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0) {
                const selector = form.querySelector('[name="price-variant-selector"]');
                const selectedVariant = productData.priceVariants[selector.value];
                if (selectedVariant) {
                    priceData.variantName = selectedVariant.name;
                    priceData.amount = selectedVariant.price;
                } else {
                    priceData.amount = productData.price;
                }
            } else if (productData.priceType === 'kit') {
                priceData.amount = productData.kitBasePrice || productData.price || 0;
                const kitSelects = form.querySelectorAll('select[name="kit-item-select"]');
                if (kitSelects.length > 0) {
                    kitSelections = {};
                    kitSelects.forEach(select => {
                        kitSelections[select.dataset.itemName] = select.value;
                    });
                }
            } else {
                priceData.amount = productData.price;
            }

            let addonsSelected = null;
            const checkedAddons = form.querySelectorAll('.addon-checkbox:checked');
            if (checkedAddons.length > 0) {
                addonsSelected = [];
                checkedAddons.forEach(addon => {
                    addonsSelected.push({
                        name: addon.dataset.addonName,
                        price: parseInt(addon.dataset.addonPrice, 10)
                    });
                    priceData.amount += parseInt(addon.dataset.addonPrice, 10); // Incorporar o valor do addon ao preço individual deste formulário
                });
            }

            formData.priceData = priceData;
            if (kitSelections) {
                formData.kitSelections = kitSelections;
            }
            if (addonsSelected) {
                formData.addonsSelected = addonsSelected;
            }
            totalAmount += priceData.amount;
            formDataList.push(formData);
        });

        if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
                totalAmount -= totalAmount * (appliedCoupon.value / 100);
            } else if (appliedCoupon.type === 'fixed') {
                totalAmount -= appliedCoupon.value;
            }
        }

        try {
            cart.addItem({
                productId: currentProductId,
                productName: productData.name,
                imageUrl: productData.imageUrl,
                isSubscription: productData.isSubscription || false,
                subscriptionFrequency: productData.subscriptionFrequency || null,
                subscriptionPeriod: productData.subscriptionPeriod || null,
                priceType: productData.priceType,
                formDataList: formDataList,
                totalAmount: totalAmount,
                recommendedItems: recommendedItems,
                coupon: appliedCoupon ? appliedCoupon.code : null,
                addedAt: new Date().toISOString()
            });

            formStatus.textContent = 'Produto adicionado ao carrinho com sucesso!';
            formStatus.className = 'mt-6 text-center text-lg text-green-500';
            
            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 1000);
            
        } catch (error) {
            console.error('Cart Error:', error);
            formStatus.textContent = `Erro ao adicionar ao carrinho: ${error.message}`;
            formStatus.className = 'mt-6 text-center text-lg text-red-500';
            payButton.disabled = false;
        }
    };

    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            if (userData) {
                currentUser = { uid: user.uid, ...userData };
                const firstForm = formsContainer.querySelector('.form-instance');
                if (firstForm) {
                    firstForm.querySelector('[name="nome"]').value = currentUser.name || '';
                    firstForm.querySelector('[name="email"]').value = currentUser.email || '';
                    firstForm.querySelector('[name="telefone"]').value = currentUser.phoneNumber || '';
                }
            }
        }
    });

    const fetchUnits = async () => {
        try {
            const functions = getFunctions();
            const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
            const result = await getPublicEvoUnits();
            unitsCache = result.data;
            await populateAllUnitSelectors();
        } catch (error) {
            console.error("Error fetching units:", error);
        }
    };

    const populateAllUnitSelectors = async () => {
        const unitSelectors = formsContainer.querySelectorAll('[name="unidade"]');

        let unitsToDisplay = unitsCache;
        const useCustomUnits = productData.customUnits && productData.customUnits.length > 0;

        // Lógica customizada baseada em configuração do produto
        if (useCustomUnits) {
            unitsToDisplay = productData.customUnits;
        }

        unitSelectors.forEach(selector => {
            selector.innerHTML = '<option value="">Selecione sua unidade</option>';
            unitsToDisplay.forEach(unit => {
                // Se for a lista padrão, aplica o filtro 'atadf'
                if (!useCustomUnits) {
                    if (unit.toLowerCase() !== 'atadf') {
                        const option = document.createElement('option');
                        option.value = unit;
                        option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
                        selector.appendChild(option);
                    }
                } else {
                    // Para a lista customizada, exibe exatamente como definido e apara espaços
                    const option = document.createElement('option');
                    option.value = unit.trim();
                    option.textContent = unit.trim();
                    selector.appendChild(option);
                }
            });
        });
    };

    const init = async () => {
        productId = getProductId();
        await fetchUnits();
        await fetchProduct(productId);
        paymentForm.addEventListener('submit', handleFormSubmit);
    };

    init();
});
