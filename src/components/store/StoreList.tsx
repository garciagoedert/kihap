import React from 'react';
import { Link } from 'react-router-dom';
import { Store } from '../../types';
import { ShoppingBag, MapPin, ChevronRight } from 'lucide-react';

interface StoreListProps {
  stores: Store[];
}

const StoreList: React.FC<StoreListProps> = ({ stores }) => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">KIHAP STORE</h1>
          <p className="text-gray-600">Gerenciamento das lojas KIHAP</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stores.map((store) => (
          <Link
            key={store.id}
            to={`/dashboard/store/${store.id}`}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-[#1d528d] bg-opacity-10 rounded-lg">
                <ShoppingBag className="text-[#1d528d]" size={24} />
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">{store.name}</h2>
            <div className="flex items-center text-gray-600">
              <MapPin size={16} className="mr-1" />
              <span className="text-sm">{store.city}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default StoreList;
