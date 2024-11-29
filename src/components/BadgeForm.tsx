import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const iconOptions = Object.keys(LucideIcons).filter(key => 
  typeof LucideIcons[key as keyof typeof LucideIcons] === 'function'
);

const colorOptions = [
  { label: 'Azul', value: 'bg-blue-100 text-blue-800' },
  { label: 'Verde', value: 'bg-green-100 text-green-800' },
  { label: 'Vermelho', value: 'bg-red-100 text-red-800' },
  { label: 'Amarelo', value: 'bg-yellow-100 text-yellow-800' },
  { label: 'Roxo', value: 'bg-purple-100 text-purple-800' },
  { label: 'Rosa', value: 'bg-pink-100 text-pink-800' },
  { label: 'Indigo', value: 'bg-indigo-100 text-indigo-800' },
];

interface BadgeFormProps {
  badge?: any;
  onClose: () => void;
}

export default function BadgeForm({ badge, onClose }: BadgeFormProps) {
  const currentUser = useAuthStore(state => state.user);
  const { addBadge, updateBadge, units } = useDataStore();
  const [formData, setFormData] = useState({
    name: badge?.name || '',
    description: badge?.description || '',
    icon: badge?.icon || 'Award',
    color: badge?.color || colorOptions[0].value,
    category: badge?.category || 'achievement',
    unitId: badge?.unitId || currentUser?.unitId
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (badge) {
      updateBadge({ ...badge, ...formData });
    } else {
      addBadge({
        ...formData,
        createdBy: currentUser?.id || 0
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {badge ? 'Editar Badge' : 'Nova Badge'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ícone
            </label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            >
              {iconOptions.map(icon => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            <div className="mt-2 p-2 border rounded-md">
              <div className="flex items-center gap-2">
                <span>Preview:</span>
                {LucideIcons[formData.icon as keyof typeof LucideIcons] &&
                  React.createElement(
                    LucideIcons[formData.icon as keyof typeof LucideIcons],
                    { size: 24, className: formData.color.split(' ')[1] }
                  )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cor
            </label>
            <select
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            >
              {colorOptions.map(color => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            >
              <option value="belt">Graduação</option>
              <option value="achievement">Conquista</option>
              <option value="special">Especial</option>
            </select>
          </div>

          {currentUser?.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidade
              </label>
              <select
                value={formData.unitId || ''}
                onChange={(e) => setFormData({ ...formData, unitId: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              >
                <option value="">Todas as Unidades</option>
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {badge ? 'Salvar Alterações' : 'Criar Badge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}