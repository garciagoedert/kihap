import { onAuthReady, getUserData } from '../members/js/auth.js';

// O carregamento de componentes header e footer é feito por js/script.js
// Não é necessário duplicar a lógica aqui.

const form = document.getElementById('faixa-preta-form');
const payButton = document.getElementById('pay-button');
const formStatus = document.getElementById('form-status');

let currentUser = null;

onAuthReady(async (user) => {
    if (user) {
        currentUser = await getUserData(user.uid);
        if (currentUser) {
            document.getElementById('nome').value = currentUser.displayName || '';
            document.getElementById('email').value = currentUser.email || '';
            document.getElementById('telefone').value = currentUser.phoneNumber || '';
        }
    } else {
        console.log("Usuário não logado. Preencha os dados manualmente.");
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    payButton.disabled = true;
    formStatus.textContent = 'Processando pagamento...';

    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const telefone = document.getElementById('telefone').value;

    try {
        // Chamar a Cloud Function para criar a sessão de checkout do Stripe
        // Chamar a Cloud Function para criar a sessão de checkout do Stripe
        const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/createCheckoutSession', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ formDataList, productId, totalAmount, couponCode: appliedCoupon ? appliedCoupon.code : null }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.provider === 'pagarme' && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else if (data.provider === 'stripe' && data.sessionId) {
                const stripe = Stripe('pk_live_51P6f2mRxzK85UT81651jodpLzQzU5k52zL8tq11xZgY2j231B350nCbdEa3z8j2b5nQJgI8e7f2p8d0000Q2Y8d0');
                await stripe.redirectToCheckout({ sessionId: data.sessionId });
            } else {
                throw new Error('Resposta inválida do servidor de checkout.');
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create checkout session.');
        }

        const { sessionId } = await response.json();

        if (sessionId) {
            // Redirecionar para o checkout do Stripe
            const stripe = Stripe('pk_live_51SL5wfCOKFM07tm8iVZ7c7tB8PEIoiczwTEAUoRhe4dXusoilvXxm4vkgmbrcnMdCrXnOiIpvc0nw6FBhxYbnryl00gTmK12WA'); // Chave Publicável de Produção
            stripe.redirectToCheckout({ sessionId: sessionId });
        } else {
            formStatus.textContent = 'Erro ao iniciar o pagamento. Tente novamente.';
            payButton.disabled = false;
        }

    } catch (error) {
        console.error('Erro no pagamento:', error);
        formStatus.textContent = `Erro no pagamento: ${error.message}. Verifique sua conexão e tente novamente.`;
        payButton.disabled = false;
    }
});
