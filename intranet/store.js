import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, orderBy, where, 
    addDoc, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

export async function setupStorePage() {
    // Tab elements
    const tabSalesLog = document.getElementById('tab-sales-log');
    const tabManageProducts = document.getElementById('tab-manage-products');
    const contentSalesLog = document.getElementById('content-sales-log');
    const contentManageProducts = document.getElementById('content-manage-products');

    // Sales Log elements
    const salesTableBody = document.getElementById('sales-table-body');
    const searchInput = document.getElementById('search-input');
    const unitFilter = document.getElementById('filter-unit');
    const productFilter = document.getElementById('filter-product');
    const dateFilter = document.getElementById('filter-date');
    const modal = document.getElementById('sale-details-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalContent = document.getElementById('modal-content');

    // Product Management elements
    const productForm = document.getElementById('product-form');
    const productFormTitle = document.getElementById('product-form-title');
    const productIdInput = document.getElementById('product-id');
    const productNameInput = document.getElementById('product-name');
    const productPriceInput = document.getElementById('product-price');
    const productDescriptionInput = document.getElementById('product-description');
    const productImageInput = document.getElementById('product-image');
    const saveProductBtn = document.getElementById('save-product-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const productsTableBody = document.getElementById('products-table-body');

    let allSales = [];
    let allProducts = [];

    // --- Tab Switching Logic ---
    function switchTab(activeTab) {
        if (activeTab === 'sales') {
            tabSalesLog.classList.add('text-white', 'border-blue-500');
            tabSalesLog.classList.remove('text-gray-400', 'hover:border-gray-500');
            tabManageProducts.classList.remove('text-white', 'border-blue-500');
            tabManageProducts.classList.add('text-gray-400', 'hover:border-gray-500');
            contentSalesLog.classList.remove('hidden');
            contentManageProducts.classList.add('hidden');
        } else {
            tabManageProducts.classList.add('text-white', 'border-blue-500');
            tabManageProducts.classList.remove('text-gray-400', 'hover:border-gray-500');
            tabSalesLog.classList.remove('text-white', 'border-blue-500');
            tabSalesLog.classList.add('text-gray-400', 'hover:border-gray-500');
            contentManageProducts.classList.remove('hidden');
            contentSalesLog.classList.add('hidden');
        }
    }

    tabSalesLog.addEventListener('click', () => switchTab('sales'));
    tabManageProducts.addEventListener('click', () => switchTab('products'));

    // --- Sales Log Logic ---
    const fetchSales = async () => {
        salesTableBody.innerHTML = '<tr><td colspan="8" class="text-center p-8">Carregando vendas...</td></tr>';
        try {
            const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'desc'));
            const querySnapshot = await getDocs(q);
            allSales = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displaySales(allSales);
        } catch (error) {
            console.error('Error fetching sales:', error);
            salesTableBody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-red-500">Erro ao carregar vendas.</td></tr>';
        }
    };

    const displaySales = (salesToDisplay) => {
        salesTableBody.innerHTML = '';
        if (salesToDisplay.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="8" class="text-center p-8">Nenhuma venda encontrada.</td></tr>';
            return;
        }

        salesToDisplay.forEach(sale => {
            const row = salesTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700', 'hover:bg-gray-800', 'cursor-pointer');
            row.dataset.saleId = sale.id; // Add sale id to row for modal click

            const date = sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A';
            const amount = (sale.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: sale.currency || 'BRL' });

            row.innerHTML = `
                <td class="p-4">${sale.userName || 'N/A'}</td>
                <td class="p-4">${sale.userEmail || 'N/A'}</td>
                <td class="p-4">${sale.userPhone || 'N/A'}</td>
                <td class="p-4">${sale.productName || 'N/A'}</td>
                <td class="p-4">${amount}</td>
                <td class="p-4">${sale.paymentStatus || 'N/A'}</td>
                <td class="p-4">${date}</td>
                <td class="p-4">
                    <button class="delete-sale-btn text-red-500 hover:text-red-400" data-id="${sale.id}"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
    };

    const applyFilters = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedUnit = unitFilter.value;
        const selectedProduct = productFilter.value;
        const selectedDate = dateFilter.value;

        let filteredSales = allSales.filter(sale => {
            const nameMatch = !searchTerm || (sale.userName && sale.userName.toLowerCase().includes(searchTerm));
            const emailMatch = !searchTerm || (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm));
            const unitMatch = !selectedUnit || sale.userUnit === selectedUnit;
            const productMatch = !selectedProduct || sale.productId === selectedProduct;
            
            let dateMatch = true;
            if (selectedDate && sale.created) {
                const saleDate = sale.created.toDate().toISOString().split('T')[0];
                dateMatch = saleDate === selectedDate;
            }

            return (nameMatch || emailMatch) && unitMatch && productMatch && dateMatch;
        });

        displaySales(filteredSales);
    };

    [searchInput, unitFilter, productFilter, dateFilter].forEach(el => {
        el.addEventListener('change', applyFilters);
        el.addEventListener('keyup', applyFilters);
    });

    // --- Product Management Logic ---
    const fetchProducts = async () => {
        productsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Carregando produtos...</td></tr>';
        try {
            const q = query(collection(db, 'products'), orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayProducts(allProducts);
        } catch (error) {
            console.error('Error fetching products:', error);
            productsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao carregar produtos.</td></tr>';
        }
    };

    const displayProducts = (productsToDisplay) => {
        productsTableBody.innerHTML = '';
        if (productsToDisplay.length === 0) {
            productsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-8">Nenhum produto cadastrado.</td></tr>';
            return;
        }

        productsToDisplay.forEach(product => {
            const row = productsTableBody.insertRow();
            row.classList.add('border-b', 'border-gray-700');
            const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const productUrl = `${window.location.origin.replace('/intranet', '')}/produto.html?id=${product.id}`;

            row.innerHTML = `
                <td class="p-4">${product.name}</td>
                <td class="p-4">${price}</td>
                <td class="p-4">
                    <button class="copy-link-btn text-green-400 hover:text-green-300" data-link="${productUrl}">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </td>
                <td class="p-4">
                    <button class="edit-btn text-blue-400 hover:text-blue-300 mr-2" data-id="${product.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-btn text-red-500 hover:text-red-400" data-id="${product.id}"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
    };
    
    const resetProductForm = () => {
        productForm.reset();
        productIdInput.value = '';
        productImageInput.dataset.existingImageUrl = '';
        productFormTitle.textContent = 'Adicionar Novo Produto';
        saveProductBtn.textContent = 'Salvar Produto';
        cancelEditBtn.classList.add('hidden');
    };

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveProductBtn.disabled = true;
        saveProductBtn.textContent = 'Salvando...';

        const id = productIdInput.value;
        const imageFile = productImageInput.files[0];
        let imageUrl = productImageInput.dataset.existingImageUrl || null;

        try {
            if (imageFile) {
                const storage = getStorage();
                const storageRef = ref(storage, `product_images/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const productData = {
                name: productNameInput.value,
                price: parseInt(productPriceInput.value, 10),
                description: productDescriptionInput.value,
                imageUrl: imageUrl,
            };

            if (id) {
                const productRef = doc(db, 'products', id);
                await updateDoc(productRef, productData);
                alert('Produto atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'products'), productData);
                alert('Produto adicionado com sucesso!');
            }
            
            resetProductForm();
            fetchProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Erro ao salvar produto.');
        } finally {
            saveProductBtn.disabled = false;
            saveProductBtn.textContent = 'Salvar Produto';
        }
    });

    productsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const copyLinkBtn = e.target.closest('.copy-link-btn');

        if (copyLinkBtn) {
            const link = copyLinkBtn.dataset.link;
            navigator.clipboard.writeText(link).then(() => {
                alert('Link copiado para a área de transferência!');
            }, (err) => {
                console.error('Could not copy text: ', err);
                alert('Não foi possível copiar o link.');
            });
        }

        if (editBtn) {
            const id = editBtn.dataset.id;
            const product = allProducts.find(p => p.id === id);
            if (product) {
                productFormTitle.textContent = 'Editar Produto';
                productIdInput.value = product.id;
                productNameInput.value = product.name;
                productPriceInput.value = product.price;
                productDescriptionInput.value = product.description;
                productImageInput.dataset.existingImageUrl = product.imageUrl || '';
                saveProductBtn.textContent = 'Atualizar Produto';
                cancelEditBtn.classList.remove('hidden');
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('Tem certeza que deseja excluir este produto?')) {
                deleteProduct(id);
            }
        }
    });
    
    const deleteProduct = async (id) => {
        try {
            await deleteDoc(doc(db, 'products', id));
            alert('Produto excluído com sucesso!');
            fetchProducts(); // Refresh the list
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Erro ao excluir produto.');
        }
    };

    cancelEditBtn.addEventListener('click', resetProductForm);

    // --- Modal Logic ---
    const openModalWithSaleDetails = (saleId) => {
        const sale = allSales.find(s => s.id === saleId);
        if (!sale) return;

        modalContent.innerHTML = `
            <p><strong>ID da Venda:</strong> ${sale.id}</p>
            <p><strong>Nome do Cliente:</strong> ${sale.userName || 'N/A'}</p>
            <p><strong>Email:</strong> ${sale.userEmail || 'N/A'}</p>
            <p><strong>Telefone:</strong> ${sale.userPhone || 'N/A'}</p>
            <p><strong>CPF:</strong> ${sale.userCpf || 'N/A'}</p>
            <p><strong>Unidade:</strong> ${sale.userUnit || 'N/A'}</p>
            <p><strong>Produto:</strong> ${sale.productName || 'N/A'}</p>
            <p><strong>Valor:</strong> ${(sale.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <p><strong>Status do Pagamento:</strong> ${sale.paymentStatus || 'N/A'}</p>
            <p><strong>Data da Compra:</strong> ${sale.created ? new Date(sale.created.toDate()).toLocaleString('pt-BR') : 'N/A'}</p>
        `;
        modal.classList.remove('hidden');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    salesTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-sale-btn');
        if (deleteBtn) {
            e.stopPropagation(); // Prevent modal from opening
            const saleId = deleteBtn.dataset.id;
            if (confirm('Tem certeza que deseja excluir este log de venda?')) {
                deleteSaleLog(saleId);
            }
        } else {
            const row = e.target.closest('tr');
            if (row && row.dataset.saleId) {
                openModalWithSaleDetails(row.dataset.saleId);
            }
        }
    });

    const deleteSaleLog = async (saleId) => {
        try {
            await deleteDoc(doc(db, 'inscricoesFaixaPreta', saleId));
            alert('Log de venda excluído com sucesso!');
            fetchSales(); // Refresh the list
        } catch (error) {
            console.error('Error deleting sale log:', error);
            alert('Erro ao excluir o log de venda.');
        }
    };

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    const populateFilters = () => {
        // Populate units
        const units = [...new Set(allSales.map(sale => sale.userUnit).filter(Boolean))];
        unitFilter.innerHTML = '<option value="">Todas as Unidades</option>';
        units.sort().forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1).replace('-', ' ');
            unitFilter.appendChild(option);
        });

        // Populate products
        productFilter.innerHTML = '<option value="">Todos os Produtos</option>';
        allProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            productFilter.appendChild(option);
        });
    };

    // --- Initial Load ---
    const initialLoad = async () => {
        await fetchProducts(); // Fetch products first to populate filter
        await fetchSales();   // Fetch sales
        populateFilters();    // Then populate filters with data from both
    };

    initialLoad();
}
