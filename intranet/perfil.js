import { loadComponents, setupUIListeners } from './common-ui.js';
import { getAllUsers, getCurrentUser, updateUser } from './auth.js';
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

export async function setupProfilePage() {
    const userNameDisplay = document.getElementById('user-name-display');
    const userEmailDisplay = document.getElementById('user-email-display');
    const userAvatar = document.getElementById('user-avatar');
    const editProfileForm = document.getElementById('edit-profile-form');
    const nameInput = document.getElementById('name');
    const passwordInput = document.getElementById('password');
    const profilePictureInput = document.getElementById('profile-picture-input');
    const userBeltDisplayContainer = document.getElementById('user-belt-display-container');
    const userBeltDisplay = document.getElementById('user-belt-display');
    const userBeltSelect = document.getElementById('user-belt');
    const logoutBtn = document.getElementById('logout-btn');
    const fileNameSpan = document.getElementById('file-name');

    // Update file name display on file selection
    profilePictureInput.addEventListener('change', function() {
        if (this.files && this.files.length > 0) {
            fileNameSpan.textContent = this.files[0].name;
        } else {
            fileNameSpan.textContent = 'Nenhum arquivo selecionado';
        }
    });

    const normalizeDanBelt = (b) => {
        if (!b) return '';
        const trimmed = b.trim();
        const m = trimmed.match(/^(\d+)(?:º|o)?\s*Dan\s*(?:Preta)?$/i);
        if (m) return `Preta ${m[1]}º Dan`;
        const m2 = trimmed.match(/^Preta\s*(\d+)(?:º|o)?\s*Dan$/i);
        if (m2) return `Preta ${m2[1]}º Dan`;
        return trimmed;
    };

    let currentUser = await getCurrentUser();

    if (currentUser) {
        // Populate user info
        userNameDisplay.textContent = currentUser.name;
        userEmailDisplay.textContent = currentUser.email;
        nameInput.value = currentUser.name || '';
        userAvatar.src = currentUser.profilePicture || currentUser.photoURL || currentUser.photoUrl || 'default-profile.svg';

        const currentBelt = normalizeDanBelt(currentUser.belt || currentUser.graduacao || '');
        if (userBeltSelect) {
            userBeltSelect.value = currentBelt;
            if (currentBelt && userBeltSelect.value !== currentBelt) {
                const opt = document.createElement('option');
                opt.value = currentBelt;
                opt.textContent = currentBelt;
                userBeltSelect.appendChild(opt);
                userBeltSelect.value = currentBelt;
            }
        }
        if (currentBelt && userBeltDisplay && userBeltDisplayContainer) {
            userBeltDisplay.querySelector('span').textContent = currentBelt;
            userBeltDisplayContainer.classList.remove('hidden');
        }

    } else {
        // Redirect to login if no user is found in session
        window.location.href = 'login.html';
        return; // Stop execution if no user
    }

    // Handle profile update
    editProfileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const newName = nameInput.value.trim();
        const newBelt = userBeltSelect ? normalizeDanBelt(userBeltSelect.value.trim()) : '';
        const newPassword = passwordInput.value; // Note: password change should be handled via auth functions
        const newPictureFile = profilePictureInput.files[0];

        const updatedData = { 
            name: newName,
            belt: newBelt,
            graduacao: newBelt
        };

        try {
            if (newPictureFile) {
                const storage = getStorage();
                const storageRef = ref(storage, `profilePictures/${currentUser.id}/${newPictureFile.name}`);
                
                // Convert file to data URL to upload
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const dataUrl = event.target.result;
                    await uploadString(storageRef, dataUrl, 'data_url');
                    const downloadURL = await getDownloadURL(storageRef);
                    updatedData.profilePicture = downloadURL;
                    updatedData.photoURL = downloadURL;
                    updatedData.photoUrl = downloadURL;
                    
                    // Now update Firestore
                    await updateUser(currentUser.id, updatedData);
                    
                    // Update UI
                    userAvatar.src = downloadURL;
                    userNameDisplay.textContent = newName;
                    if (newBelt && userBeltDisplay && userBeltDisplayContainer) {
                        userBeltDisplay.querySelector('span').textContent = newBelt;
                        userBeltDisplayContainer.classList.remove('hidden');
                    }
                    alert('Perfil atualizado com sucesso!');
                };
                reader.readAsDataURL(newPictureFile);

            } else {
                // Update text fields
                await updateUser(currentUser.id, updatedData);
                userNameDisplay.textContent = newName;
                if (newBelt && userBeltDisplay && userBeltDisplayContainer) {
                    userBeltDisplay.querySelector('span').textContent = newBelt;
                    userBeltDisplayContainer.classList.remove('hidden');
                }
                alert('Perfil atualizado com sucesso!');
            }

            // Clear form
            passwordInput.value = '';
            profilePictureInput.value = '';
            fileNameSpan.textContent = 'Nenhum arquivo selecionado';

        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            alert('Erro ao atualizar o perfil.');
        }
    });

    // Handle logout
    logoutBtn.addEventListener('click', window.logout);
}
