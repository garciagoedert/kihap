import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthReady } from './auth.js';

// DOM Elements
const vendorsList = document.getElementById('vendors-list');
const addVendorBtn = document.getElementById('add-vendor-btn');
const vendorModal = document.getElementById('vendor-modal');
const closeVendorModalBtn = document.getElementById('close-vendor-modal');
const cancelVendorBtn = document.getElementById('cancel-vendor-btn');
const deleteVendorBtn = document.getElementById('delete-vendor-btn');
const vendorForm = document.getElementById('vendor-form');

// Form Inputs
const vendorIdInput = document.getElementById('vendor-id');
const vendorNameInput = document.getElementById('vendor-name');
const vendorCategoryInput = document.getElementById('vendor-category');
const vendorTagsInput = document.getElementById('vendor-tags');
const vendorSinceInput = document.getElementById('vendor-since');
const vendorCityInput = document.getElementById('vendor-city');
const vendorEmailInput = document.getElementById('vendor-email');
const vendorPhoneInput = document.getElementById('vendor-phone');
const vendorWebsiteInput = document.getElementById('vendor-website');
const vendorAddressInput = document.getElementById('vendor-address');
const vendorDescriptionInput = document.getElementById('vendor-description');
const vendorLogoInput = document.getElementById('vendor-logo');
const vendorBannerInput = document.getElementById('vendor-banner');
const modalTitle = document.getElementById('modal-title');

// Search & Filter
const searchInput = document.getElementById('search-input');
const cityFilter = document.getElementById('city-filter');

// View Modal Elements
const viewModal = document.getElementById('view-modal');
const closeViewModalBtn = document.getElementById('close-view-modal');
const editVendorBtnView = document.getElementById('edit-vendor-btn-view');

// View Modal Fields
const viewVendorName = document.getElementById('view-vendor-name');
const viewVendorCategory = document.getElementById('view-vendor-category');
const viewVendorTags = document.getElementById('view-vendor-tags');
const viewVendorIconContainer = document.getElementById('view-vendor-icon-container');
const viewVendorInitials = document.getElementById('view-vendor-initials');
const viewVendorLogoImg = document.getElementById('view-vendor-logo-img');
const viewBannerContainer = document.getElementById('view-banner-container');
const viewVendorStatus = document.getElementById('view-vendor-status');
const viewVendorSummary = document.getElementById('view-vendor-summary');
const viewVendorDescription = document.getElementById('view-vendor-description');
const viewVendorCity = document.getElementById('view-vendor-city');
const viewVendorAddress = document.getElementById('view-vendor-address');
const viewVendorEmail = document.getElementById('view-vendor-email');
const viewVendorEmailLink = document.getElementById('view-vendor-email-link');
const viewVendorPhone = document.getElementById('view-vendor-phone');
const viewVendorPhoneLink = document.getElementById('view-vendor-phone-link');
const viewVendorWebsite = document.getElementById('view-vendor-website');
const viewVendorWebsiteLink = document.getElementById('view-vendor-website-link');
const contactButtonLink = document.getElementById('contact-button-link');


let currentUser = null;
let allVendors = [];

// Initialization
onAuthReady(async (user) => {
    if (!user) return;
    currentUser = user;

    loadVendors();
    setupEventListeners();
});

function setupEventListeners() {
    addVendorBtn.addEventListener('click', openNewVendorModal);
    closeVendorModalBtn.addEventListener('click', closeModal);
    cancelVendorBtn.addEventListener('click', closeModal);
    vendorForm.addEventListener('submit', handleFormSubmit);

    // Search & Filter Listeners
    searchInput.addEventListener('input', handleFilter);
    cityFilter.addEventListener('change', handleFilter);

    // Modal Delete Button
    deleteVendorBtn.addEventListener('click', () => {
        const id = vendorIdInput.value;
        if (id) deleteVendor(id);
    });

    // View Modal Listeners
    closeViewModalBtn.addEventListener('click', closeViewModal);
    editVendorBtnView.addEventListener('click', () => {
        const id = editVendorBtnView.dataset.id;
        if (id) {
            closeViewModal();
            openEditVendorModal(id);
        }
    });
}

// --- CRUD ---

async function loadVendors() {
    vendorsList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin text-2xl"></i> Carregando parceiros...</div>';

    try {
        // Fetch all vendors
        const q = query(collection(db, "fornecedores"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        allVendors = [];
        querySnapshot.forEach((doc) => {
            allVendors.push({ id: doc.id, ...doc.data() });
        });

        populateCityFilter(allVendors);
        renderVendors(allVendors);

    } catch (error) {
        console.error("Erro ao carregar fornecedores:", error);
        vendorsList.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">Erro ao carregar parceiros.</div>';
    }
}

function renderVendors(vendors) {
    vendorsList.innerHTML = '';

    if (vendors.length === 0) {
        vendorsList.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">Nenhum parceiro encontrado.</div>';
        return;
    }

    vendors.forEach(vendor => {
        const card = createVendorCard(vendor);
        vendorsList.appendChild(card);
    });
}

function createVendorCard(vendor) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-700 cursor-pointer flex flex-col group h-full';

    const initials = getInitials(vendor.name);
    // Determine tags display
    const firstTag = vendor.tags ? vendor.tags.split(',')[0].trim().toUpperCase() : 'GERAL';

    div.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="w-12 h-12 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center text-xl font-bold overflow-hidden">
                ${vendor.logoUrl ? `<img src="${vendor.logoUrl}" alt="${vendor.name}" class="w-full h-full object-cover">` : initials}
            </div>
            <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-semibold">Verificado</span>
        </div>
        
        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1 line-clamp-1" title="${vendor.name}">${vendor.name}</h3>
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-3 uppercase font-medium tracking-wide">
            ${vendor.category || 'Serviços'} • <span class="text-yellow-600">${firstTag}</span>
        </div>
        
        <p class="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3 flex-grow">
            ${vendor.description || 'Sem descrição.'}
        </p>
        
        <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700 mt-auto">
            <span>Desde ${vendor.since || '2024'}</span>
            <button class="text-blue-500 hover:text-blue-600 font-semibold group-hover:translate-x-1 transition-transform flex items-center">
                Ver Perfil <i class="fas fa-arrow-right ml-1"></i>
            </button>
        </div>
    `;

    div.addEventListener('click', () => openViewModal(vendor));

    return div;
}

function populateCityFilter(vendors) {
    // Get unique cities
    const cities = [...new Set(vendors.map(v => v.city).filter(c => c))].sort();

    // Save current selection
    const currentSelection = cityFilter.value;

    // Clear options except first
    cityFilter.innerHTML = '<option value="">Todas as Cidades</option>';

    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });

    // Restore selection if still valid
    if (cities.includes(currentSelection)) {
        cityFilter.value = currentSelection;
    }
}

function handleFilter() {
    const searchTerm = searchInput.value.toLowerCase();
    const cityTerm = cityFilter.value;

    const filtered = allVendors.filter(vendor => {
        const matchesSearch = (vendor.name || '').toLowerCase().includes(searchTerm) ||
            (vendor.description || '').toLowerCase().includes(searchTerm) ||
            (vendor.tags || '').toLowerCase().includes(searchTerm);

        const matchesCity = cityTerm === '' || (vendor.city === cityTerm);

        return matchesSearch && matchesCity;
    });

    renderVendors(filtered);
}

// --- View ---
function openViewModal(vendor) {
    // Populate Modal
    viewVendorName.textContent = vendor.name;
    viewVendorCategory.textContent = vendor.category || 'Serviços';
    viewVendorTags.textContent = vendor.tags ? vendor.tags.toUpperCase() : '';

    viewVendorTags.textContent = vendor.tags ? vendor.tags.toUpperCase() : '';

    // Icon / Logo Logic
    if (vendor.logoUrl) {
        viewVendorInitials.classList.add('hidden');
        viewVendorLogoImg.src = vendor.logoUrl;
        viewVendorLogoImg.classList.remove('hidden');
        viewVendorIconContainer.classList.remove('bg-yellow-100'); // Remove default bg
    } else {
        viewVendorLogoImg.classList.add('hidden');
        viewVendorInitials.classList.remove('hidden');
        viewVendorInitials.textContent = getInitials(vendor.name);
        viewVendorIconContainer.classList.add('bg-white', 'dark:bg-gray-800'); // Restore default bg
    }

    // Banner Logic
    if (vendor.bannerUrl) {
        viewBannerContainer.style.backgroundImage = `url('${vendor.bannerUrl}')`;
    } else {
        viewBannerContainer.style.backgroundImage = 'none';
    }

    // Summary logic: Just use description cut off or full? 
    // Image in mockup showed a summary and then "About". I'll use description for both for now, or split if I had a summary field.
    // I'll make the summary the first sentence or so.
    const desc = vendor.description || '';
    const summary = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
    viewVendorSummary.textContent = summary;
    viewVendorDescription.innerHTML = desc.replace(/\n/g, '<br>'); // Simple line break

    viewVendorCity.textContent = vendor.city || 'Não informado';
    viewVendorAddress.textContent = vendor.address || 'Não informado';

    // Contact
    viewVendorEmail.textContent = vendor.email || 'Não informado';
    viewVendorEmailLink.href = vendor.email ? `mailto:${vendor.email}` : '#';

    viewVendorPhone.textContent = vendor.phone || 'Não informado';
    viewVendorPhoneLink.href = vendor.phone ? `https://wa.me/${vendor.phone.replace(/\D/g, '')}` : '#';

    viewVendorWebsite.textContent = vendor.website ? 'Visitar site' : 'Não informado';
    viewVendorWebsiteLink.href = vendor.website || '#';
    viewVendorWebsiteLink.target = vendor.website ? '_blank' : '_self';

    if (vendor.phone) {
        contactButtonLink.href = `https://wa.me/${vendor.phone.replace(/\D/g, '')}`;
    } else if (vendor.email) {
        contactButtonLink.href = `mailto:${vendor.email}`;
    } else {
        contactButtonLink.href = '#';
    }

    editVendorBtnView.dataset.id = vendor.id;

    viewModal.classList.remove('hidden');
}

function closeViewModal() {
    viewModal.classList.add('hidden');
}

// --- Form & Modals ---

function openNewVendorModal() {
    resetForm();
    modalTitle.textContent = "Novo Parceiro";
    deleteVendorBtn.classList.add('hidden');
    vendorModal.classList.remove('hidden');
}

function openEditVendorModal(id) {
    const vendor = allVendors.find(v => v.id === id);
    if (!vendor) return;

    vendorIdInput.value = vendor.id;
    vendorNameInput.value = vendor.name;
    vendorCategoryInput.value = vendor.category || '';
    vendorTagsInput.value = vendor.tags || '';
    vendorSinceInput.value = vendor.since || '';
    vendorCityInput.value = vendor.city || '';
    vendorEmailInput.value = vendor.email || '';
    vendorPhoneInput.value = vendor.phone || '';
    vendorWebsiteInput.value = vendor.website || '';
    vendorAddressInput.value = vendor.address || '';
    vendorDescriptionInput.value = vendor.description || '';
    vendorLogoInput.value = vendor.logoUrl || '';
    vendorBannerInput.value = vendor.bannerUrl || '';

    modalTitle.textContent = "Editar Parceiro";
    deleteVendorBtn.classList.remove('hidden');
    vendorModal.classList.remove('hidden');
}

function closeModal() {
    vendorModal.classList.add('hidden');
    resetForm();
}

function resetForm() {
    vendorForm.reset();
    vendorIdInput.value = '';
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = vendorIdInput.value;
    const vendorData = {
        name: vendorNameInput.value,
        category: vendorCategoryInput.value,
        tags: vendorTagsInput.value,
        since: vendorSinceInput.value,
        city: vendorCityInput.value,
        email: vendorEmailInput.value,
        phone: vendorPhoneInput.value,
        website: vendorWebsiteInput.value,
        address: vendorAddressInput.value,
        description: vendorDescriptionInput.value,
        logoUrl: vendorLogoInput.value,
        bannerUrl: vendorBannerInput.value,
        updatedAt: serverTimestamp()
    };

    const submitBtn = document.getElementById('save-vendor-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        if (id) {
            await updateDoc(doc(db, "fornecedores", id), vendorData);
        } else {
            vendorData.createdAt = serverTimestamp();
            vendorData.createdBy = currentUser.id || currentUser.uid;
            await addDoc(collection(db, "fornecedores"), vendorData);
        }

        closeModal();
        loadVendors();
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar parceiro.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

async function deleteVendor(id) {
    if (!confirm("Tem certeza que deseja excluir este parceiro?")) return;

    try {
        await deleteDoc(doc(db, "fornecedores", id));
        closeModal();
        loadVendors();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir parceiro.");
    }
}

// Helper
function getInitials(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}
