import { onAuthReady, getUserData } from './auth.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { app, db } from '../../intranet/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const functions = getFunctions(app);
const getTuitionPlans = httpsCallable(functions, 'getTuitionPlans');
const createTuitionSubscription = httpsCallable(functions, 'createTuitionSubscription');
const cancelTuitionSubscription = httpsCallable(functions, 'cancelTuitionSubscription');

document.addEventListener('DOMContentLoaded', () => {
    onAuthReady(async (user) => {
        if (!user) {
            window.location.href = '../intranet/login.html';
            return;
        }

        try {
            // Buscamos o documento principal do member no Firestore baseado no auth UID
            // Em auth.js, getUserData procura na collection "users", precisamos do doc em "members"
            // Se o sistema mantem o ID do aluno no authDoc.idMember:
            const authDocResponse = await getUserData(user.uid);
            
            const memberIdForQuery = authDocResponse.evoMemberId || authDocResponse.idMember;
            if (!authDocResponse || !memberIdForQuery) {
                 showPanel('error', 'Conta não vinculada a um aluno. Contate a secretaria.');
                 return;
            }

            // Precisamos dos dados completos do membro na coleção members
            // Para maior simplicidade, se já trouxer de authDocResponse os campos de mensalidade usamos, 
            // senão buscamos localmente
            // Aparentemente o getUserData pode não retornar a collection "members" inteira se for na users, mas o DB guarda `idMember`, `tuitionStatus`, etc na "members" collection.
            
            // Re-fetch member para ter as info mais novas e garantidas de MP
            const findMemberQuery = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(m => m.query);
            const whereClause = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(m => m.where);
            const getDocsFetch = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(m => m.getDocs);
            const collectionFetch = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(m => m.collection);

            const memberQuery = findMemberQuery(collectionFetch(db, 'evo_students'), whereClause('idMember', '==', memberIdForQuery));
            const memberSnap = await getDocsFetch(memberQuery);
            
            if (memberSnap.empty) {
                showPanel('error', 'Dados do aluno não encontrados.');
                return;
            }

            const studentData = memberSnap.docs[0].data();
            
            evaluateTuitionStatus(studentData, memberIdForQuery);
            
        } catch (error) {
            console.error("Erro interno ao carregar assinatura:", error);
            showPanel('error', 'Ops! Ocorreu um erro ao carregar os dados. Tente novamente mais tarde.');
        }
    });
});

async function evaluateTuitionStatus(studentData, studentId) {
    const status = studentData.tuitionStatus;
    const planId = studentData.tuitionPlanId;

    if (status === 'active' || status === 'authorized' || status === 'pending') {
        // Aluno tem assinatura
        await renderActiveSubscription(studentData, studentId);
    } else {
        // Aluno NÃO tem assinatura, carregar planos
        await renderAvailablePlans(studentData.unitId || 'centro', studentId);
    }
}

async function renderActiveSubscription(studentData, studentId) {
    showPanel('active');

    const statusBadge = document.getElementById('sub-status-badge');
    const unitSpan = document.getElementById('sub-unit');
    const planNameEl = document.getElementById('sub-plan-name');
    const planPriceEl = document.getElementById('sub-plan-price');
    const cancelBtn = document.getElementById('cancel-subscription-btn');

    unitSpan.textContent = studentData.unitId || 'Não definida';

    if (studentData.tuitionStatus === 'pending') {
        statusBadge.textContent = 'Pendente de Pagamento';
        statusBadge.className = 'text-yellow-500 font-bold';
    } else {
        statusBadge.textContent = 'Ativa';
        statusBadge.className = 'text-green-500 font-bold';
    }

    // Buscar Detalhes do Plano
    if (studentData.tuitionPlanId) {
        try {
            const planRef = doc(db, 'tuitionPlans', studentData.tuitionPlanId);
            const planSnap = await getDoc(planRef);
            if (planSnap.exists()) {
                const planData = planSnap.data();
                planNameEl.textContent = planData.name;
                
                const valorReais = (planData.amountCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const freq = planData.frequency === 1 ? '/ mês' : `/ a cada ${planData.frequency} meses`;
                planPriceEl.innerHTML = `${valorReais} <span class="text-sm font-normal text-gray-500">${freq}</span>`;
            } else {
                planNameEl.textContent = 'Plano Desconhecido';
                planPriceEl.textContent = '-';
            }
        } catch(e) { console.error('Error fetching plan:', e); }
    } else {
        planNameEl.textContent = 'Plano Desconhecido';
        planPriceEl.textContent = '-';
    }

    // Setup action listeners
    cancelBtn.onclick = () => {
        showConfirm('Cancelar Assinatura', 'Deseja realmente cancelar sua mensalidade automática? Você perderá todos os benefícios e descontos atrelados.', async () => {
            const originalBtnText = cancelBtn.innerHTML;
            cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Cancelando...';
            cancelBtn.disabled = true;

            try {
                await cancelTuitionSubscription({ 
                    studentId: studentId,
                    preapprovalId: studentData.mpPreapprovalId,
                    unitId: studentData.unitId
                });
                showNotification('Sua assinatura foi cancelada.', 'success');
                setTimeout(() => window.location.reload(), 2000);
            } catch (error) {
                console.error("Erro ao cancelar:", error);
                showNotification('Houve um erro ao cancelar. Contate o suporte.', 'error');
                cancelBtn.innerHTML = originalBtnText;
                cancelBtn.disabled = false;
            }
        });
    };
}

async function renderAvailablePlans(unitId, studentId) {
    showPanel('plans');
    document.getElementById('plans-unit-name').textContent = unitId;

    try {
        const result = await getTuitionPlans({ unitId: unitId });
        const plans = result.data || [];
        
        const grid = document.getElementById('plans-grid');
        grid.innerHTML = '';

        if (plans.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400 py-8 bg-gray-50 dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800">Nenhum plano disponível no momento para sua unidade. Entre em contato com a recepção.</div>';
            return;
        }

        plans.filter(p => p.active).sort((a,b) => a.amountCentavos - b.amountCentavos).forEach(plan => {
            const valorReais = (plan.amountCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const freq = plan.frequency === 1 ? '/ mês' : `/ a cada ${plan.frequency} meses`;

            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:border-yellow-500 rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)] flex flex-col items-center text-center';
            card.innerHTML = `
                <div class="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-2 py-1 rounded mb-4 uppercase tracking-wider font-semibold">Plano de Mensalidade</div>
                <h4 class="text-xl font-bold text-gray-900 dark:text-white mb-2">${plan.name}</h4>
                <div class="mb-6 mt-2">
                    <span class="text-3xl font-black text-yellow-500">${valorReais}</span>
                    <span class="text-gray-500 text-sm ml-1">${freq}</span>
                </div>
                <ul class="text-gray-500 dark:text-gray-400 text-sm mb-8 space-y-2 text-left w-full">
                    <li class="flex items-center"><i class="fas fa-check text-green-500 mr-2"></i> Acesso aos treinos regulares</li>
                    <li class="flex items-center"><i class="fas fa-check text-green-500 mr-2"></i> Cobrança automática no cartão</li>
                    <li class="flex items-center"><i class="fas fa-check text-green-500 mr-2"></i> Sem burocracia para cancelar</li>
                </ul>
                <button class="subscribe-btn w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-4 rounded-lg mt-auto transition-colors" data-id="${plan.id}">
                    Selecionar e Pagar
                </button>
            `;
            grid.appendChild(card);
        });

        // Add listeners
        document.querySelectorAll('.subscribe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const planId = e.currentTarget.dataset.id;
                const originalText = e.currentTarget.innerHTML;
                
                e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processando';
                e.currentTarget.disabled = true;

                try {
                    const res = await createTuitionSubscription({ planId, studentId });
                    if (res.data.initPoint) {
                        window.location.href = res.data.initPoint;
                    } else {
                        throw new Error('Link de pagamento não recebido.');
                    }
                } catch (error) {
                    console.error("Erro ao assinar:", error);
                    showNotification('Falha ao processar pagamento. Tente novamente.', 'error');
                    e.currentTarget.innerHTML = originalText;
                    e.currentTarget.disabled = false;
                }
            });
        });

    } catch (error) {
        console.error("Erro ao buscar planos:", error);
        document.getElementById('plans-grid').innerHTML = '<div class="col-span-full text-center text-red-400">Falha de comunicação com o servidor. Tente novamente.</div>';
    }
}

function showPanel(panelName, errorMessage = '') {
    const loading = document.getElementById('loading-container');
    const active = document.getElementById('active-subscription-container');
    const plans = document.getElementById('available-plans-container');

    loading.classList.add('hidden');
    active.classList.add('hidden');
    plans.classList.add('hidden');

    if (panelName === 'active') active.classList.remove('hidden');
    if (panelName === 'plans') plans.classList.remove('hidden');
    if (panelName === 'error') {
        loading.classList.remove('hidden');
        loading.innerHTML = `<i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i><p class="text-red-400 text-center">${errorMessage}</p>`;
    }
}

// Custom UI implementations for Student Portal
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return alert(message);

    const el = document.createElement('div');
    const colors = {
        success: 'bg-green-600 border-green-500',
        error: 'bg-red-600 border-red-500',
        info: 'bg-blue-600 border-blue-500'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    el.className = `p-4 rounded shadow-lg border text-white ${colors[type] || colors.info} transform transition-all duration-300 translate-y-4 opacity-0 flex items-center space-x-3`;
    el.innerHTML = `<i class="fas ${icons[type]} text-xl"></i><span>${message}</span>`;
    
    container.appendChild(el);
    setTimeout(() => {
        el.classList.remove('translate-y-4', 'opacity-0');
    }, 10);

    setTimeout(() => {
        el.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        if(window.confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
        return;
    }
    
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const cancelBtn = document.getElementById('cancelConfirmBtn');
    const confirmBtn = document.getElementById('confirmActionBtn');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const cleanup = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        cancelBtn.removeEventListener('click', handleCancel);
        confirmBtn.removeEventListener('click', handleConfirm);
    };
    
    const handleCancel = () => cleanup();
    const handleConfirm = () => {
        cleanup();
        onConfirm();
    };
    
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);
}
