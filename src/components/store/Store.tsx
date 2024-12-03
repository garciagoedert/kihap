import React, { useState } from 'react';
import { Product, Store as StoreType, Student, Sale, Instructor } from '../../types';

interface StoreProps {
  store: StoreType;
  products: Product[];
  currentStudent: Student;
  instructor: Instructor;
  onPurchase: (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const Store: React.FC<StoreProps> = ({ 
  store, 
  products, 
  currentStudent, 
  instructor,
  onPurchase 
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePurchase = async () => {
    if (!selectedProduct) return;

    const sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'> = {
      productId: selectedProduct.id,
      product: selectedProduct,
      storeId: store.id,
      store: store,
      studentId: currentStudent.id,
      student: currentStudent,
      instructorId: instructor.id,
      instructor: instructor,
      quantity: quantity,
      totalPrice: selectedProduct.price * quantity,
      commission: (selectedProduct.price * quantity) * (instructor.commissionRate / 100),
      status: 'pending'
    };

    try {
      await onPurchase(sale);
      setIsModalOpen(false);
      setSelectedProduct(null);
      setQuantity(1);
    } catch (error) {
      console.error('Erro ao processar a compra:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">KIHAP Store {store.city}</h1>
        
        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="relative h-80 w-full">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{product.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-gray-800">
                    R$ {product.price.toFixed(2)}
                  </span>
                  <button 
                    className="bg-[#dfa129] text-white px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsModalOpen(true);
                    }}
                    disabled={!product.active || product.stock <= 0}
                  >
                    {product.active && product.stock > 0 ? 'Comprar' : 'Indisponível'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Purchase Modal */}
        {isModalOpen && selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">{selectedProduct.name}</h2>
              <div className="mb-4">
                <div className="relative h-64 w-full mb-4 rounded-lg overflow-hidden">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                </div>
                <p className="text-gray-600 mb-2">Preço unitário: R$ {selectedProduct.price.toFixed(2)}</p>
                <div className="flex items-center gap-4">
                  <label htmlFor="quantity" className="text-gray-600">Quantidade:</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    max={selectedProduct.stock}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, selectedProduct.stock))}
                    className="border rounded px-2 py-1 w-20"
                    aria-label="Quantidade do produto"
                  />
                </div>
                <p className="text-lg font-bold mt-4">
                  Total: R$ {(selectedProduct.price * quantity).toFixed(2)}
                </p>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedProduct(null);
                    setQuantity(1);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="bg-[#dfa129] text-white px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
                  onClick={handlePurchase}
                >
                  Confirmar Compra
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Store;
