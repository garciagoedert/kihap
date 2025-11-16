import { onAuthReady, getUserData } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from '../../intranet/firebase-config.js';
// Importa o loadStripe de uma CDN para compatibilidade com ES Modules no navegador
import { loadStripe } from 'https://esm.sh/@stripe/stripe-js';

// Chave publicável do Stripe (substitua pela sua chave real)
const stripePromise = loadStripe('pk_live_51P8m4sRx05D6A5s73FmN532nsYyqXPIQ0YfVp2u21sZc2z4j5b4g5f6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v');
const priceId = 'price_1SQomFCOKFM07tm8brDGCQzX'; // IMPORTANTE: Substitua pelo ID do seu preço de assinatura do Stripe

document.addEventListener('DOMContentLoaded', () => {
    const statusContainer = document.getElementById('status-container');
    const actionsContainer = document.getElementById('actions-container');

    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            if (userData) {
                renderSubscriptionStatus(userData);
            } else {
                statusContainer.innerHTML = '<p>Não foi possível carregar os dados do usuário.</p>';
            }
        } else {
            // O onAuthReady em auth.js já redireciona, mas como fallback:
            window.location.href = '../intranet/login.html';
        }
    });

    function renderSubscriptionStatus(userData) {
        const status = userData.subscriptionStatus || 'inactive';

        let statusHtml = '';
        let actionsHtml = '';

        switch (status) {
            case 'active':
                statusHtml = '<p class="status-active">Sua assinatura está ATIVA.</p>';
                actionsHtml = '<button id="manage-subscription-btn" class="btn">Gerenciar Assinatura</button>';
                break;
            case 'past_due':
                statusHtml = '<p class="status-inactive">Sua assinatura está com o pagamento pendente.</p>';
                actionsHtml = '<button id="manage-subscription-btn" class="btn">Atualizar Pagamento</button>';
                break;
            case 'canceled':
                statusHtml = '<p class="status-inactive">Sua assinatura foi cancelada.</p>';
                actionsHtml = '<button id="subscribe-btn" class="btn">Assinar Novamente</button>';
                break;
            default:
                statusHtml = '<p>Você ainda não tem uma assinatura.</p>';
                actionsHtml = '<button id="subscribe-btn" class="btn">Assinar Agora</button>';
                break;
        }

        statusContainer.innerHTML = statusHtml;
        actionsContainer.innerHTML = actionsHtml;

        // Adiciona os event listeners aos botões
        if (document.getElementById('subscribe-btn')) {
            document.getElementById('subscribe-btn').addEventListener('click', createSubscriptionCheckout);
        }
        if (document.getElementById('manage-subscription-btn')) {
            document.getElementById('manage-subscription-btn').addEventListener('click', createCustomerPortal);
        }
    }

    async function createSubscriptionCheckout() {
        try {
            const createCheckout = httpsCallable(functions, 'createSubscriptionCheckout');
            const result = await createCheckout({ priceId: priceId });
            const { sessionId } = result.data;

            const stripe = await stripePromise;
            await stripe.redirectToCheckout({ sessionId });
        } catch (error) {
            console.error("Erro ao criar checkout:", error);
            alert("Não foi possível iniciar o processo de assinatura. Tente novamente.");
        }
    }

    async function createCustomerPortal() {
        try {
            const createPortal = httpsCallable(functions, 'createCustomerPortal');
            const result = await createPortal();
            const { url } = result.data;
            window.location.href = url;
        } catch (error) {
            console.error("Erro ao acessar o portal do cliente:", error);
            alert("Não foi possível acessar o portal de gerenciamento. Tente novamente.");
        }
    }
});
