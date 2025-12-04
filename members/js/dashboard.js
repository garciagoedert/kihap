import { onAuthReady, getUserData } from './auth.js';

import { functions, db, auth } from '../../intranet/firebase-config.js';
import { collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Substitui httpsCallable por fetch direto para lidar com a função HTTP getMemberDetails
async function getMemberData(data) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Usuário não autenticado.");
    }
    const token = await user.getIdToken();

    const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/getMemberDetails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data: data })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na requisição: ${response.status} ${errorText}`);
    }

    return await response.json();
}

export function loadMemberDashboard() {
    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            if (userData) {
                document.getElementById('user-name-display').textContent = userData.name;
                document.getElementById('user-email-display').textContent = userData.email;

                // Assumindo que o ID do membro da EVO está armazenado no documento do usuário no Firestore
                if (userData.evoMemberId) {
                    try {
                        const result = await getMemberData({
                            memberId: userData.evoMemberId,
                            unitId: userData.unitId // Passa a unidade do aluno para a função
                        });
                        const member = result.data;

                        // Preenche os campos com os dados da API
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
                        const graduation = member.memberships?.[0]?.name || 'Não informada';

                        // Atualiza a foto do perfil
                        const avatar = document.getElementById('user-avatar');

                        // Prioritize Firestore photoURL if available
                        if (userData.photoURL) {
                            avatar.src = userData.photoURL;
                        } else if (member.photoUrl) {
                            avatar.src = member.photoUrl;
                        } else {
                            // No photo found, using default.
                        }

                        document.getElementById('member-name').textContent = fullName;
                        document.getElementById('member-age').textContent = calculateAge(member.birthDate);
                        document.getElementById('member-belt').textContent = graduation;
                        document.getElementById('member-unit').textContent = member.branchName || 'Unidade Centro';
                        document.getElementById('member-status').textContent = member.membershipStatus || 'Não informado';
                        document.getElementById('member-register-date').textContent = member.registerDate ? new Date(member.registerDate).toLocaleDateString('pt-BR') : 'Não informada';
                        document.getElementById('member-instructor').textContent = member.nameEmployeeInstructor || 'Não informado';

                        const kihapCoins = member.totalFitCoins || 0;
                        document.getElementById('member-kihapcoins').textContent = kihapCoins;
                        document.getElementById('member-kihapcoins-highlight').textContent = kihapCoins;

                    } catch (error) {
                        console.error("Erro ao buscar dados do membro:", error);
                        alert("Não foi possível carregar seus dados de aluno.");
                    }
                } else {
                    console.warn("ID de membro da EVO não encontrado para este usuário.");
                    // Opcional: Esconder a seção de informações do aluno
                }

                // Carrega o histórico de testes físicos
                loadMemberPhysicalTestHistory(user.uid);
                // Carrega os emblemas do aluno
                loadMemberBadges(userData);

                // Carrega histórico de compras (se tiver CPF no objeto member retornado do EVO)
                if (member && member.document) {
                    loadMemberPurchases(member.document);
                }
            }
        }
    });
}

async function loadMemberPhysicalTestHistory(userId) {
    const historyContainer = document.getElementById('member-physical-test-history');
    historyContainer.innerHTML = '<p class="text-gray-500">Carregando histórico...</p>';

    const testsQuery = query(collection(db, `users/${userId}/physicalTests`), orderBy("date", "desc"));
    const querySnapshot = await getDocs(testsQuery);

    if (querySnapshot.empty) {
        historyContainer.innerHTML = '<p class="text-gray-500">Nenhum teste físico registrado ainda.</p>';
    } else {
        let html = '<ul class="space-y-2">';
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date.toDate().toLocaleDateString('pt-BR');
            html += `
                <li class="flex justify-between items-center bg-gray-800 p-3 rounded">
                    <span>Data: <span class="font-semibold">${date}</span></span>
                    <span>Pontuação: <span class="font-semibold text-yellow-500">${data.score}</span></span>
                </li>
            `;
        });
        html += '</ul>';
        historyContainer.innerHTML = html;
    }
}

function calculateAge(birthDateString) {
    if (!birthDateString) return 'Não informada';
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

async function loadMemberBadges(userData) {
    const container = document.getElementById('badges-container');
    if (!userData || !userData.earnedBadges || userData.earnedBadges.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Você ainda não conquistou emblemas.</p>';
        return;
    }

    container.innerHTML = ''; // Limpa a mensagem de "carregando"

    try {
        for (const badgeId of userData.earnedBadges) {
            const badgeRef = doc(db, "badges", badgeId);
            const badgeSnap = await getDoc(badgeRef);

            if (badgeSnap.exists()) {
                const badge = badgeSnap.data();
                const badgeElement = document.createElement('div');
                badgeElement.className = 'flex flex-col items-center text-center';
                badgeElement.innerHTML = `
                    <img src="${badge.imageUrl}" alt="${badge.name}" title="${badge.name}: ${badge.description}" class="w-20 h-20 rounded-full object-cover border-2 border-yellow-500 transition-transform hover:scale-110">
                    <p class="text-sm mt-2">${badge.name}</p>
                `;
                container.appendChild(badgeElement);
            }
        }
    } catch (error) {
        console.error("Erro ao carregar emblemas do aluno:", error);
        container.innerHTML = '<p class="text-red-500">Não foi possível carregar seus emblemas.</p>';
    }
}

async function loadMemberPurchases(cpf) {
    const container = document.getElementById('member-purchase-history');
    if (!cpf) {
        container.innerHTML = '<p class="text-gray-500">CPF não cadastrado para buscar compras.</p>';
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();

        // Chama a Cloud Function getStudentPurchases
        const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/getStudentPurchases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data: { cpf: cpf } })
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar compras');
        }

        const result = await response.json();
        const purchases = result.result.purchases; // Cloud Functions onCall returns data in 'result'

        if (!purchases || purchases.length === 0) {
            container.innerHTML = '<p class="text-gray-500">Nenhuma compra encontrada.</p>';
            return;
        }

        let html = '<div class="space-y-4">';

        purchases.forEach(purchase => {
            const date = purchase.data; // Já vem formatada do Tiny ou precisa formatar? Tiny manda DD/MM/YYYY
            const total = parseFloat(purchase.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            let itemsHtml = '<ul class="mt-2 text-sm text-gray-400 pl-4 border-l-2 border-gray-700">';
            purchase.itens.forEach(item => {
                itemsHtml += `<li>${parseFloat(item.quantidade).toFixed(0)}x ${item.descricao}</li>`;
            });
            itemsHtml += '</ul>';

            html += `
                <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="font-semibold text-white">Pedido #${purchase.numero}</p>
                            <p class="text-sm text-gray-400">${date}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-yellow-500">${total}</p>
                            <span class="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">${purchase.situacao}</span>
                        </div>
                    </div>
                    ${itemsHtml}
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar compras:", error);
        container.innerHTML = '<p class="text-red-500">Não foi possível carregar o histórico de compras.</p>';
    }
}
