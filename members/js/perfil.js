import { onAuthReady, getUserData } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { functions } from '../../intranet/firebase-config.js';
// Importações do Firebase Auth e Firestore serão necessárias para a atualização
import { updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { auth, db, app } from '../../intranet/firebase-config.js';

const storage = getStorage(app);
const getMemberData = httpsCallable(functions, 'getMemberData');
const updateMemberData = httpsCallable(functions, 'updateMemberData');

export function setupProfilePage() {
    const userNameDisplay = document.getElementById('user-name-display');
    const userEmailDisplay = document.getElementById('user-email-display');
    const nameInput = document.getElementById('name');
    const editProfileForm = document.getElementById('edit-profile-form');
    const photoInput = document.getElementById('photo-input');
    const avatar = document.getElementById('user-avatar');
    const changePhotoOverlay = document.getElementById('change-photo-overlay');
    const profilePhotoContainer = document.getElementById('profile-photo-container');

    let currentUser = null;
    let evoMemberId = null;

    // Handle photo click - attach to container for better hit area
    if (profilePhotoContainer) {
        profilePhotoContainer.addEventListener('click', (e) => {
            if (photoInput) {
                photoInput.click();
            }
        });
    }

    // Handle file selection
    if (photoInput) {
        photoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!currentUser) {
                alert("Erro: Usuário não identificado.");
                return;
            }

            // Show loading state (optional: could add a spinner overlay)
            const originalSrc = avatar.src;
            avatar.style.opacity = '0.5';

            try {
                const photoURL = await uploadProfilePicture(file, currentUser.uid);

                // Update Firestore
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, { photoURL: photoURL });

                // Update UI
                avatar.src = photoURL;
                alert("Foto de perfil atualizada com sucesso!");

            } catch (error) {
                console.error("Erro ao atualizar foto:", error);
                alert("Erro ao atualizar a foto de perfil.");
                avatar.src = originalSrc;
            } finally {
                avatar.style.opacity = '1';
            }
        });
    }

    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            currentUser = userData;
            if (userData) {
                userNameDisplay.textContent = userData.name;
                userEmailDisplay.textContent = userData.email;
                nameInput.value = userData.name;
                evoMemberId = userData.evoMemberId; // Armazena o ID do membro

                // Prioritize Firestore photoURL if available
                if (userData.photoURL) {
                    avatar.src = userData.photoURL;
                }

                // Se tivermos o ID, buscamos os dados da EVO para preencher o formulário
                if (evoMemberId) {
                    try {
                        const result = await getMemberData({ memberId: evoMemberId });
                        const member = result.data;

                        // Only use EVO photo if user hasn't uploaded one yet
                        if (member.photoUrl && !userData.photoURL) {
                            avatar.src = member.photoUrl;
                        }

                        // Atualiza o nome no formulário com o dado mais recente da EVO
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`;
                        nameInput.value = fullName;
                    } catch (error) {
                        console.error("Erro ao buscar dados do membro para edição:", error);
                    }
                }
                fetchPaymentHistory(user.uid);
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
            if (newPassword) document.getElementById('password').value = '';

        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            alert("Erro ao atualizar perfil: " + error.message);
        }
    });

    async function uploadProfilePicture(file, userId) {
        const storageRef = ref(storage, `profile_pictures/${userId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytesResumable(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    }

    async function fetchPaymentHistory(userId) {
        const paymentHistoryBody = document.getElementById('payment-history-body');
        paymentHistoryBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Carregando histórico...</td></tr>';

        try {
            const q = query(
                collection(db, 'inscricoesFaixaPreta'),
                where('userId', '==', userId),
                orderBy('created', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const payments = querySnapshot.docs.map(doc => doc.data());

            if (payments.length === 0) {
                paymentHistoryBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Nenhum pagamento encontrado.</td></tr>';
                return;
            }

            paymentHistoryBody.innerHTML = ''; // Clear loading state

            payments.forEach(payment => {
                const row = paymentHistoryBody.insertRow();
                const date = payment.created ? new Date(payment.created.toDate()).toLocaleDateString('pt-BR') : 'N/A';
                const amount = (payment.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const status = payment.paymentStatus === 'paid'
                    ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Pago</span>'
                    : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">Pendente</span>';

                row.innerHTML = `
                    <td class="p-4">${payment.productName}</td>
                    <td class="p-4">${date}</td>
                    <td class="p-4">${amount}</td>
                    <td class="p-4">${status}</td>
                `;
            });

        } catch (error) {
            console.error("Erro ao buscar histórico de pagamentos:", error);
            paymentHistoryBody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao carregar histórico.</td></tr>';
        }
    }
}
