import { onAuthReady, getUserData } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from '../../intranet/firebase-config.js';
// Importações do Firebase Auth e Firestore serão necessárias para a atualização
import { updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from '../../intranet/firebase-config.js';

const getMemberData = httpsCallable(functions, 'getMemberData');
const updateMemberData = httpsCallable(functions, 'updateMemberData');

export function setupProfilePage() {
    const userNameDisplay = document.getElementById('user-name-display');
    const userEmailDisplay = document.getElementById('user-email-display');
    const nameInput = document.getElementById('name');
    const editProfileForm = document.getElementById('edit-profile-form');

    let currentUser = null;
    let evoMemberId = null;

    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            currentUser = userData;
            if (userData) {
                userNameDisplay.textContent = userData.name;
                userEmailDisplay.textContent = userData.email;
                nameInput.value = userData.name;
                evoMemberId = userData.evoMemberId; // Armazena o ID do membro

                // Se tivermos o ID, buscamos os dados da EVO para preencher o formulário
                if (evoMemberId) {
                    try {
                        const result = await getMemberData({ memberId: evoMemberId });
                        const member = result.data;
                        
                        // Atualiza a foto do perfil
                        const avatar = document.getElementById('user-avatar');
                        if (member.photoUrl) {
                            avatar.src = member.photoUrl;
                        }

                        // Atualiza o nome no formulário com o dado mais recente da EVO
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
                        nameInput.value = fullName;
                    } catch (error) {
                        console.error("Erro ao buscar dados do membro para edição:", error);
                    }
                }
            }
        }
    });

    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || !evoMemberId) {
            alert("Dados do aluno não encontrados. Não é possível atualizar.");
            return;
        }

        const newName = nameInput.value;
        const newPassword = document.getElementById('password').value;

        try {
            // Separa o nome completo em nome e sobrenome para a API
            const nameParts = newName.split(' ');
            const firstName = nameParts.shift();
            const lastName = nameParts.join(' ');

            // 1. Chama a função de backend para atualizar na API EVO
            await updateMemberData({
                memberId: evoMemberId,
                updatedData: { firstName: firstName, lastName: lastName }
            });

            // 2. Atualiza o nome no Firestore
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { name: newName });

            // 3. Atualiza a senha no Firebase Auth (se uma nova foi fornecida)
            if (newPassword) {
                await updatePassword(auth.currentUser, newPassword);
            }

            alert('Perfil atualizado com sucesso!');
            
            // Atualiza a UI
            userNameDisplay.textContent = newName;
            if(newPassword) document.getElementById('password').value = '';

        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            alert("Erro ao atualizar perfil: " + error.message);
        }
    });
}
