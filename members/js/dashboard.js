import { onAuthReady, getUserData } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from '../../intranet/firebase-config.js';

const getMemberData = httpsCallable(functions, 'getMemberData');

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
                        const result = await getMemberData({ memberId: userData.evoMemberId });
                        const member = result.data;

                        // Preenche os campos com os dados da API
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
                        const graduation = member.memberships?.[0]?.name || 'Não informada';

                        // Atualiza a foto do perfil
                        const avatar = document.getElementById('user-avatar');
                        if (member.photoUrl) {
                            avatar.src = member.photoUrl;
                        }

                        document.getElementById('member-name').textContent = fullName;
                        document.getElementById('member-age').textContent = calculateAge(member.birthDate);
                        document.getElementById('member-belt').textContent = graduation;
                        document.getElementById('member-unit').textContent = member.branchName || 'Unidade Centro';
                        document.getElementById('member-status').textContent = member.membershipStatus || 'Não informado';
                        document.getElementById('member-register-date').textContent = member.registerDate ? new Date(member.registerDate).toLocaleDateString('pt-BR') : 'Não informada';
                        document.getElementById('member-kihapcoins').textContent = member.totalFitCoins || 0;

                    } catch (error) {
                        console.error("Erro ao buscar dados do membro:", error);
                        alert("Não foi possível carregar seus dados de aluno.");
                    }
                } else {
                    console.warn("ID de membro da EVO não encontrado para este usuário.");
                    // Opcional: Esconder a seção de informações do aluno
                }
            }
        }
    });
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
