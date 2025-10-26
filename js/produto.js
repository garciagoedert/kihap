import { db } from '../intranet/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { onAuthReady, getUserData } from '../members/js/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // A chave pública do Stripe deve ser a mesma usada em outras partes do site.
    const stripe = Stripe('pk_live_51SL5wfCOKFM07tm8iVZ7c7tB8PEIoiczwTEAUoRhe4dXusoilvXxm4vkgmbrcnMdCrXnOiIpvc0nw6FBhxYbnryl00gTmK12WA'); // Chave Publicável de Produção

    const productLoading = document.getElementById('product-loading');
    const productContent = document.getElementById('product-content');
    const productNameTitle = document.getElementById('product-name-title');
    const productDescription = document.getElementById('product-description');
    const productImageDisplay = document.getElementById('product-image-display');
    const productPriceDisplay = document.getElementById('product-price-display');
    const priceVariantSelectorContainer = document.getElementById('price-variant-selector-container');
    const priceVariantSelector = document.getElementById('price-variant-selector');
    const paymentForm = document.getElementById('payment-form');
    const payButton = document.getElementById('pay-button');
    const formStatus = document.getElementById('form-status');

    const nomeInput = document.getElementById('nome');
    const emailInput = document.getElementById('email');
    const telefoneInput = document.getElementById('telefone');
    const cpfInput = document.getElementById('cpf');
    const unidadeSelect = document.getElementById('unidade');
    const programaSelect = document.getElementById('programa');
    const graduacaoContainer = document.getElementById('graduacao-container');
    const graduacaoSelect = document.getElementById('graduacao');

    let productId = null;
    let productData = null;
    let currentUser = null;

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
                displayProduct(productData);
            } else {
                productLoading.innerHTML = '<p class="text-2xl text-red-500">Produto não encontrado.</p>';
            }
        } catch (error) {
            console.error("Error fetching product:", error);
            productLoading.innerHTML = '<p class="text-2xl text-red-500">Erro ao carregar o produto.</p>';
        }
    };

    const displayProduct = (product) => {
        console.log(product);
        productNameTitle.textContent = product.name;
        document.title = `Kihap - ${product.name}`; // Update page title
        productDescription.textContent = product.description || '';
        
        if (product.imageUrl) {
            productImageDisplay.src = product.imageUrl;
            productImageDisplay.classList.remove('hidden');
        }

        if (product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0) {
            priceVariantSelectorContainer.classList.remove('hidden');
            priceVariantSelector.innerHTML = ''; // Clear existing options

            product.priceVariants.forEach((variant, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${variant.name} - ${(variant.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
                priceVariantSelector.appendChild(option);
            });

            // Set initial price
            updatePrice(product.priceVariants[0].price);

            // Add event listener to update price on change
            priceVariantSelector.addEventListener('change', (e) => {
                const selectedVariant = product.priceVariants[e.target.value];
                updatePrice(selectedVariant.price);
            });

        } else {
            priceVariantSelectorContainer.classList.add('hidden');
            priceVariantSelector.required = false;
            updatePrice(product.price);
        }

        productLoading.classList.add('hidden');
        productContent.classList.remove('hidden');
    };

    const updatePrice = (priceInCents) => {
        const price = (priceInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        productPriceDisplay.textContent = price;
    };

    const populateGraduacao = (program) => {
        const graduacoes = {
            tradicional: [
                'Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida',
                'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida',
                'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida',
                'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida',
                'Vermelha e preta', 'Preta'
            ],
            littles: [
                'Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta',
                'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix'
            ]
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

    programaSelect.addEventListener('change', (event) => {
        populateGraduacao(event.target.value);
    });

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        payButton.disabled = true;
        formStatus.textContent = 'Processando seu pagamento...';

        const userName = nomeInput.value;
        const userEmail = emailInput.value;
        const userPhone = telefoneInput.value;
        const userCpf = cpfInput.value;
        const userUnit = unidadeSelect.value;
        const userPrograma = programaSelect.value;
        const userGraduacao = graduacaoContainer.classList.contains('hidden') ? null : graduacaoSelect.value;
        const userId = currentUser ? currentUser.uid : null;
        
        let priceData = {};
        if (productData.priceType === 'variable') {
            const selectedVariantIndex = priceVariantSelector.value;
            const selectedVariant = productData.priceVariants[selectedVariantIndex];
            priceData.variantName = selectedVariant.name;
            priceData.amount = selectedVariant.price;
        } else {
            priceData.amount = productData.price;
        }

        try {
            const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/createCheckoutSession', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userName,
                    userEmail,
                    userPhone,
                    userCpf,
                    userUnit,
                    userPrograma,
                    userGraduacao,
                    userId,
                    productId,
                    priceData, // Send price data to backend
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao criar a sessão de checkout.');
            }

            const { sessionId } = await response.json();
            const { error } = await stripe.redirectToCheckout({ sessionId });

            if (error) {
                throw new Error(error.message);
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
                nomeInput.value = userData.displayName || '';
                emailInput.value = userData.email || '';
                telefoneInput.value = userData.phoneNumber || '';
                // CPF e Unidade podem não estar no perfil padrão do Firebase Auth
            }
        }
    });

    const fetchUnits = async () => {
        try {
            const functions = getFunctions();
            const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
            const result = await getPublicEvoUnits();
            const units = result.data;

            unidadeSelect.innerHTML = '<option value="">Selecione sua unidade</option>'; // Placeholder
            units.forEach(unit => {
                if (unit.toLowerCase() !== 'atadf') {
                    const option = document.createElement('option');
                    option.value = unit;
                    option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
                    unidadeSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error("Error fetching units:", error);
            unidadeSelect.innerHTML = '<option value="">Não foi possível carregar as unidades</option>';
        }
    };

    productId = getProductId();
    fetchProduct(productId);
    fetchUnits();
    paymentForm.addEventListener('submit', handleFormSubmit);
});
