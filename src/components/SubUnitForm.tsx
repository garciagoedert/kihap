import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SubUnit } from '../types';

interface SubUnitFormProps {
  subUnit?: SubUnit;
  onSubmit: (data: Omit<SubUnit, 'id' | 'parentUnitId'>) => void;
  onClose: () => void;
}

export default function SubUnitForm({ subUnit, onSubmit, onClose }: SubUnitFormProps) {
  const [formData, setFormData] = useState({
    name: subUnit?.name || '',
    address: subUnit?.address || '',
    phone: subUnit?.phone || '',
    email: subUnit?.email || '',
    active: subUnit?.active ?? true,
    createdAt: subUnit?.createdAt || new Date(),
    updatedAt: subUnit?.updatedAt || new Date()
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {subUnit ? 'Editar Subunidade' : 'Nova Subunidade'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
              title="Nome da subunidade"
              placeholder="Digite o nome da subunidade"
              aria-label="Nome da subunidade"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Endereço *
            </label>
            <input
              id="address"
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
              title="Endereço da subunidade"
              placeholder="Digite o endereço completo"
              aria-label="Endereço da subunidade"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefone *
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
              title="Telefone da subunidade"
              placeholder="(00) 00000-0000"
              aria-label="Telefone da subunidade"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
              title="Email da subunidade"
              placeholder="email@exemplo.com"
              aria-label="Email da subunidade"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
              title="Status da subunidade"
              aria-label="Status da subunidade"
            />
            <label htmlFor="active" className="ml-2 text-sm text-gray-700">
              Ativa
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md hover:bg-[#164070]"
            >
              {subUnit ? 'Salvar Alterações' : 'Criar Subunidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
