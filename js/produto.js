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
            productLoading.innerHTML = '<p class="text-2xl text-red-500">ID do produto não encontrado na URL.</p>';
            return;
        }
        try {
            const productRef = doc(db, 'products', id);
            const docSnap = await getDoc(productRef);
            if (docSnap.exists()) {
                productData = docSnap.data();
                await displayProduct(productData);
            } else {
                productLoading.innerHTML = '<p class="text-2xl text-red-500">Produto não encontrado.</p>';
            }
        } catch (error) {
            console.error("Error fetching product:", error);
            productLoading.innerHTML = '<p class="text-2xl text-red-500">Erro ao carregar o produto.</p>';
        }
    };

    const displayProduct = async (product) => {
        if (product.availabilityDate) {
            const availabilityDate = new Date(product.availabilityDate);
            const now = new Date();
            if (now > availabilityDate) {
                productLoading.innerHTML = '<p class="text-2xl text-red-500">Este produto não está mais disponível.</p>';
                return;
            }
        }

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
            littles: ['Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta', 'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix']
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
                        productId,
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
                        productId,
                        totalAmount,
                        couponCode: appliedCoupon ? appliedCoupon.code : null
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Falha ao criar a sessão de checkout.');
                }

                const { sessionId } = await response.json();
                const { error } = await stripe.redirectToCheckout({ sessionId });
                if (error) throw new Error(error.message);
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
