import React, { useState } from 'react';
import { useStoreStore } from '../../store/useStoreStore';
import { Store, Product, Promotion } from '../../types';
import { Plus, Edit, Trash2, Tag, ShoppingBag, DollarSign, Package, BarChart } from 'lucide-react';

interface StoreDashboardProps {
  store: Store;
}

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  active: boolean;
}

interface PromotionFormData {
  type: 'percentage' | 'fixed';
  value: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

const StoreDashboard: React.FC<StoreDashboardProps> = ({ store }) => {
  const { products, promotions, addProduct, updateProduct, deleteProduct, addPromotion, updatePromotion, deletePromotion, getStoreProducts, getProductPromotions } = useStoreStore();
  const [showProductForm, setShowProductForm] = useState(false);
  const [showPromotionForm, setShowPromotionForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'promotions' | 'sales'>('products');

  const storeProducts = getStoreProducts(store.id);

  const initialProductForm: ProductFormData = {
    name: '',
    description: '',
    price: 0,
    image: '',
    category: '',
    stock: 0,
    active: true
  };

  const initialPromotionForm: PromotionFormData = {
    type: 'percentage',
    value: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    active: true
  };

  const [productForm, setProductForm] = useState<ProductFormData>(initialProductForm);
  const [promotionForm, setPromotionForm] = useState<PromotionFormData>(initialPromotionForm);

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProduct) {
      updateProduct({
        ...selectedProduct,
        ...productForm,
        updatedAt: new Date()
      });
    } else {
      addProduct({
        ...productForm,
        storeId: store.id
      });
    }
    setShowProductForm(false);
    setSelectedProduct(null);
    setProductForm(initialProductForm);
  };

  const handlePromotionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (selectedPromotion) {
      updatePromotion({
        ...selectedPromotion,
        ...promotionForm,
        startDate: new Date(promotionForm.startDate),
        endDate: new Date(promotionForm.endDate),
        updatedAt: new Date()
      });
    } else {
      addPromotion({
        ...promotionForm,
        productId: selectedProduct.id,
        startDate: new Date(promotionForm.startDate),
        endDate: new Date(promotionForm.endDate)
      });
    }
    setShowPromotionForm(false);
    setSelectedPromotion(null);
    setPromotionForm(initialPromotionForm);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">{store.name}</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'products' ? 'bg-[#1d528d] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Package size={20} />
            Produtos
          </button>
          <button
            onClick={() => setActiveTab('promotions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'promotions' ? 'bg-[#1d528d] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Tag size={20} />
            Promoções
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'sales' ? 'bg-[#1d528d] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <BarChart size={20} />
            Vendas
          </button>
        </div>
      </div>

      {activeTab === 'products' && (
        <>
          <div className="flex justify-end mb-6">
            <button
              onClick={() => {
                setSelectedProduct(null);
                setProductForm(initialProductForm);
                setShowProductForm(true);
              }}
              className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
            >
              <Plus size={20} />
              Novo Produto
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="aspect-w-1 aspect-h-1">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-gray-800">
                      R$ {product.price.toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setProductForm({
                            name: product.name,
                            description: product.description,
                            price: product.price,
                            image: product.image,
                            category: product.category,
                            stock: product.stock,
                            active: product.active
                          });
                          setShowProductForm(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Editar produto"
                      >
                        <Edit size={20} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowPromotionForm(true);
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                        title="Adicionar promoção"
                      >
                        <Tag size={20} />
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Excluir produto"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {selectedProduct ? 'Editar Produto' : 'Novo Produto'}
            </h2>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                  type="text"
                  id="name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrição</label>
                <textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">Preço</label>
                <input
                  type="number"
                  id="price"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label htmlFor="image" className="block text-sm font-medium text-gray-700">URL da Imagem</label>
                <input
                  type="url"
                  id="image"
                  value={productForm.image}
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">Categoria</label>
                <input
                  type="text"
                  id="category"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="stock" className="block text-sm font-medium text-gray-700">Estoque</label>
                <input
                  type="number"
                  id="stock"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={productForm.active}
                  onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900">Ativo</label>
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductForm(false);
                    setSelectedProduct(null);
                    setProductForm(initialProductForm);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
                >
                  {selectedProduct ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promotion Form Modal */}
      {showPromotionForm && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {selectedPromotion ? 'Editar Promoção' : 'Nova Promoção'}
            </h2>
            <form onSubmit={handlePromotionSubmit} className="space-y-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">Tipo</label>
                <select
                  id="type"
                  value={promotionForm.type}
                  onChange={(e) => setPromotionForm({ ...promotionForm, type: e.target.value as 'percentage' | 'fixed' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="percentage">Porcentagem</option>
                  <option value="fixed">Valor Fixo</option>
                </select>
              </div>
              <div>
                <label htmlFor="value" className="block text-sm font-medium text-gray-700">
                  {promotionForm.type === 'percentage' ? 'Porcentagem' : 'Valor'}
                </label>
                <input
                  type="number"
                  id="value"
                  value={promotionForm.value}
                  onChange={(e) => setPromotionForm({ ...promotionForm, value: parseFloat(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                  step={promotionForm.type === 'percentage' ? "1" : "0.01"}
                  required
                />
              </div>
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Data de Início</label>
                <input
                  type="date"
                  id="startDate"
                  value={promotionForm.startDate}
                  onChange={(e) => setPromotionForm({ ...promotionForm, startDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Data de Término</label>
                <input
                  type="date"
                  id="endDate"
                  value={promotionForm.endDate}
                  onChange={(e) => setPromotionForm({ ...promotionForm, endDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="promotionActive"
                  checked={promotionForm.active}
                  onChange={(e) => setPromotionForm({ ...promotionForm, active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="promotionActive" className="ml-2 block text-sm text-gray-900">Ativa</label>
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPromotionForm(false);
                    setSelectedPromotion(null);
                    setPromotionForm(initialPromotionForm);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
                >
                  {selectedPromotion ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreDashboard;
