import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, User, Edit2, Trash2, Plus } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { Unit } from '../types';

export default function UnitManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const { units, updateUnit, addUnit, deleteUnit } = useDataStore();

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setShowForm(true);
  };

  const handleDeleteUnit = (unitId: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta unidade?')) {
      deleteUnit(unitId);
    }
  };

  const handleSubmit = (unitData: Omit<Unit, 'id'>) => {
    if (editingUnit) {
      updateUnit({ ...unitData, id: editingUnit.id });
    } else {
      addUnit(unitData);
    }
    setShowForm(false);
    setEditingUnit(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Unidades</h2>
          <p className="text-gray-600">Administre todas as unidades do KIHAP</p>
        </div>
        <button
          onClick={() => {
            setEditingUnit(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
        >
          <Plus size={20} />
          Nova Unidade
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map(unit => (
          <div key={unit.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <Link 
                to={`/dashboard/unit/${unit.id}`}
                className="text-xl font-bold text-gray-800 hover:text-[#1d528d] transition-colors"
              >
                {unit.name}
              </Link>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditUnit(unit)}
                  className="p-2 text-gray-600 hover:text-[#1d528d] transition-colors"
                >
                  <Edit2 size={20} />
                </button>
                <button
                  onClick={() => handleDeleteUnit(unit.id)}
                  className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin size={18} />
                <span>{unit.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={18} />
                <span>{unit.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={18} />
                <span>Gerente: {unit.manager}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <UnitForm
          unit={editingUnit}
          onClose={() => {
            setShowForm(false);
            setEditingUnit(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

interface UnitFormProps {
  unit?: Unit | null;
  onClose: () => void;
  onSubmit: (unit: Omit<Unit, 'id'>) => void;
}

function UnitForm({ unit, onClose, onSubmit }: UnitFormProps) {
  const [formData, setFormData] = useState({
    name: unit?.name || '',
    city: unit?.city || '',
    state: unit?.state || '',
    address: unit?.address || '',
    phone: unit?.phone || '',
    manager: unit?.manager || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {unit ? 'Editar Unidade' : 'Nova Unidade'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Unidade
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                name="city"
                required
                value={formData.city}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <input
                type="text"
                name="state"
                required
                value={formData.state}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endereço
            </label>
            <input
              type="text"
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefone
            </label>
            <input
              type="tel"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gerente
            </label>
            <input
              type="text"
              name="manager"
              required
              value={formData.manager}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
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
              {unit ? 'Salvar Alterações' : 'Criar Unidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}