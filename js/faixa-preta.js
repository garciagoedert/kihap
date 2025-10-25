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
            body: JSON.stringify({
                userName: nome,
                userEmail: email,
                userPhone: telefone,
                userId: currentUser ? currentUser.uid : null,
                amount: 10000, // Exemplo: R$100,00 em centavos
                currency: 'brl',
                productName: 'Inscrição Exame Faixa Preta',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
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
