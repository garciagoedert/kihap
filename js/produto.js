import { db } from '../intranet/firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { onAuthReady, getUserData } from '../members/js/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const stripe = Stripe('pk_live_51SL5wfCOKFM07tm8iVZ7c7tB8PEIoiczwTEAUoRhe4dXusoilvXxm4vkgmbrcnMdCrXnOiIpvc0nw6FBhxYbnryl00gTmK12WA');

    const productLoading = document.getElementById('product-loading');
    const productContent = document.getElementById('product-content');
    const productNameTitle = document.getElementById('product-name-title');
    const productDescription = document.getElementById('product-description');
    const productImageDisplay = document.getElementById('product-image-display');
    const productPriceDisplay = document.getElementById('product-price-display');
    const productLoteDisplay = document.getElementById('product-lote-display');
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
            
            formInstance.querySelector('.form-instance-number').textContent = i;

            const fields = ['nome', 'email', 'telefone', 'cpf', 'unidade', 'programa', 'graduacao', 'price-variant-selector'];
            fields.forEach(field => {
                const label = formInstance.querySelector(`label[for="${field}"]`);
                const input = formInstance.querySelector(`[name="${field}"]`);
                if (label) label.setAttribute('for', `${field}-${i}`);
                if (input) input.id = `${field}-${i}`;
            });

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
            if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0) {
                const selector = form.querySelector('[name="price-variant-selector"]');
                const selectedVariant = productData.priceVariants[selector.value];
                if (selectedVariant) {
                    totalAmount += selectedVariant.price;
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
                    totalAmount += activeLote.price;
                    activeLoteName = activeLote.name;
                } else {
                    // Fallback to the first lote if none is active yet
                    totalAmount += productData.lotes[0].price;
                    activeLoteName = productData.lotes[0].name;
                }
            } else {
                totalAmount += productData.price;
            }
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

        productPriceDisplay.textContent = (totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
                userGraduacao: form.querySelector('.graduacao-container').classList.contains('hidden') ? null : form.querySelector('[name="graduacao"]').value,
                userId: currentUser ? currentUser.uid : null
            };
            
            let priceData = {};
            if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0) {
                const selector = form.querySelector('[name="price-variant-selector"]');
                const selectedVariant = productData.priceVariants[selector.value];
                if (selectedVariant) {
                    priceData.variantName = selectedVariant.name;
                    priceData.amount = selectedVariant.price;
                } else {
                    priceData.amount = productData.price; 
                }
            } else {
                priceData.amount = productData.price;
            }
            formData.priceData = priceData;
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
            if (totalAmount <= 0) {
                const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/processFreePurchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        formDataList,
                        productId: currentProductId,
                        recommendedItems,
                        couponCode: appliedCoupon ? appliedCoupon.code : null
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Falha ao processar a compra gratuita.');
                }

                window.location.href = '/compra-success.html';
            } else {
                const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/createCheckoutSession', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        formDataList,
                        productId: currentProductId,
                        recommendedItems,
                        totalAmount,
                        couponCode: appliedCoupon ? appliedCoupon.code : null
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Falha ao criar a sessão de checkout.');
                }

                const data = await response.json();

                if (data.provider === 'pagarme' && data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                } else {
                    throw new Error('Resposta inválida do servidor de checkout. Esperava uma URL da Pagar.me.');
                }
            }
        } catch (error) {
            console.error('Payment Error:', error);
            formStatus.textContent = `Erro: ${error.message}`;
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
        unitSelectors.forEach(selector => {
            selector.innerHTML = '<option value="">Selecione sua unidade</option>';
            unitsCache.forEach(unit => {
                if (unit.toLowerCase() !== 'atadf') {
                    const option = document.createElement('option');
                    option.value = unit;
                    option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
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
