import React, { useState } from 'react';
import { ContractTemplate } from '../../types';
import { Plus, Edit2, Trash2, DollarSign, Calendar, Building2, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';

interface ContractTemplateFormProps {
  template?: ContractTemplate | null;
  onClose: () => void;
  onSubmit: (data: Omit<ContractTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

function ContractTemplateForm({ template, onClose, onSubmit }: ContractTemplateFormProps) {
  const { units } = useDataStore();
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    duration: template?.duration || 12,
    value: template?.value || 0,
    active: template?.active ?? true,
    unitIds: template?.unitIds || []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleUnitToggle = (unitId: number) => {
    setFormData(prev => ({
      ...prev,
      unitIds: prev.unitIds.includes(unitId)
        ? prev.unitIds.filter(id => id !== unitId)
        : [...prev.unitIds, unitId]
    }));
  };

  const selectAllUnits = () => {
    setFormData(prev => ({
      ...prev,
      unitIds: units.map(u => u.id)
    }));
  };

  const clearUnitSelection = () => {
    setFormData(prev => ({
      ...prev,
      unitIds: []
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {template ? 'Editar Modelo' : 'Novo Modelo de Contrato'}
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
              Nome do Modelo
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
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duração (meses)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Mensal
            </label>
            <input
              type="number"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidades Disponíveis
            </label>
            <div className="mb-2 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={selectAllUnits}
                className="text-[#1d528d] hover:text-[#164070]"
              >
                Selecionar Todas
              </button>
              <button
                type="button"
                onClick={clearUnitSelection}
                className="text-gray-600 hover:text-gray-800"
              >
                Limpar Seleção
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {units.map(unit => (
                <label key={unit.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.unitIds.includes(unit.id)}
                    onChange={() => handleUnitToggle(unit.id)}
                    className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                  />
                  <span className="ml-2 text-sm text-gray-700">{unit.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
              id="active"
            />
            <label htmlFor="active" className="ml-2 text-sm text-gray-700">
              Modelo Ativo
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
              {template ? 'Salvar Alterações' : 'Criar Modelo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContractTemplates() {
  const { contractTemplates, units, addContractTemplate, updateContractTemplate, deleteContractTemplate } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este modelo de contrato?')) {
      deleteContractTemplate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Modelos de Contrato</h2>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors w-full sm:w-auto"
        >
          <Plus size={20} />
          <span>Novo Modelo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contractTemplates.map(template => (
          <div key={template.id} className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-800 truncate">{template.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
              </div>
              <div className="flex gap-2 ml-4 shrink-0">
                <button
                  onClick={() => {
                    setEditingTemplate(template);
                    setShowForm(true);
                  }}
                  className="text-gray-600 hover:text-[#1d528d] transition-colors p-1"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="text-gray-600 hover:text-red-600 transition-colors p-1"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mt-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>{template.duration} meses</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign size={16} />
                <span>
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(template.value)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={16} />
                <span>
                  {(template.unitIds || []).length === units.length 
                    ? 'Todas as unidades'
                    : `${(template.unitIds || []).length} unidade${(template.unitIds || []).length !== 1 ? 's' : ''}`
                  }
                </span>
              </div>
            </div>

            <div className="mt-4">
              <span className={`px-2 py-1 rounded-full text-xs ${
                template.active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {template.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <ContractTemplateForm
          template={editingTemplate}
          onClose={() => {
            setShowForm(false);
            setEditingTemplate(null);
          }}
          onSubmit={(data) => {
            if (editingTemplate) {
              updateContractTemplate({ ...data, id: editingTemplate.id });
            } else {
              addContractTemplate(data);
            }
            setShowForm(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}