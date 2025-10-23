import { db } from '../intranet/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { onAuthReady, getUserData } from '../members/js/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // A chave pública do Stripe deve ser a mesma usada em outras partes do site.
    const stripe = Stripe('pk_test_51SL5x1FzkLWBAYFuS8NZubHjVpZiwMRQ7Y2JgR1AIiXDhlNDmmnFu65vGGMsgm99RntNW364LhcHO4KEyD48mQPq00UZkdGIRR');

    const productLoading = document.getElementById('product-loading');
    const productContent = document.getElementById('product-content');
    const productNameTitle = document.getElementById('product-name-title');
    const productDescription = document.getElementById('product-description');
    const productImageDisplay = document.getElementById('product-image-display');
    const productPriceDisplay = document.getElementById('product-price-display');
    const paymentForm = document.getElementById('payment-form');
    const payButton = document.getElementById('pay-button');
    const formStatus = document.getElementById('form-status');

    const nomeInput = document.getElementById('nome');
    const emailInput = document.getElementById('email');
    const telefoneInput = document.getElementById('telefone');
    const cpfInput = document.getElementById('cpf');
    const unidadeSelect = document.getElementById('unidade');

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
        productNameTitle.textContent = product.name;
        document.title = `Kihap - ${product.name}`; // Update page title
        productDescription.textContent = product.description || '';
        
        if (product.imageUrl) {
            productImageDisplay.src = product.imageUrl;
            productImageDisplay.classList.remove('hidden');
        }

        const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        productPriceDisplay.textContent = price;

        productLoading.classList.add('hidden');
        productContent.classList.remove('hidden');
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        payButton.disabled = true;
        formStatus.textContent = 'Processando seu pagamento...';

        const userName = nomeInput.value;
        const userEmail = emailInput.value;
        const userPhone = telefoneInput.value;
        const userCpf = cpfInput.value;
        const userUnit = unidadeSelect.value;
        const userId = currentUser ? currentUser.uid : null;

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
                    userId,
                    productId,
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
                const option = document.createElement('option');
                option.value = unit;
                option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
                unidadeSelect.appendChild(option);
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
