import React, { useState } from 'react';
import { Award, Edit2, Trash2, Star, Medal, Trophy, Crown, Target } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import type { Badge } from '../types';

interface BadgeFormData {
  name: string;
  description: string;
  image: string;
  criteria: string;
  type?: 'belt' | 'achievement';
  beltLevel?: string;
  color?: string;
  icon?: string;
}

const ICONS = [
  { value: 'star', label: 'Estrela', icon: Star },
  { value: 'medal', label: 'Medalha', icon: Medal },
  { value: 'trophy', label: 'Troféu', icon: Trophy },
  { value: 'crown', label: 'Coroa', icon: Crown },
  { value: 'target', label: 'Alvo', icon: Target }
];

const COLORS = [
  { value: '#FFD700', label: 'Dourado' },
  { value: '#C0C0C0', label: 'Prata' },
  { value: '#CD7F32', label: 'Bronze' },
  { value: '#1d528d', label: 'Azul' },
  { value: '#228B22', label: 'Verde' },
  { value: '#DC143C', label: 'Vermelho' }
];

export default function BadgeManagement() {
  const { badges, addBadge } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<BadgeFormData>({
    name: '',
    description: '',
    image: '',
    criteria: '',
    type: 'achievement',
    color: COLORS[0].value,
    icon: ICONS[0].value
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addBadge({
      ...formData,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    setShowForm(false);
    setFormData({
      name: '',
      description: '',
      image: '',
      criteria: '',
      type: 'achievement',
      color: COLORS[0].value,
      icon: ICONS[0].value
    });
  };

  const getIconComponent = (iconName: string) => {
    return ICONS.find(i => i.value === iconName)?.icon || Star;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Badges</h2>
          <p className="text-gray-600">Crie e gerencie badges para os alunos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors flex items-center gap-2"
        >
          <Award size={20} />
          Nova Badge
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {badges.map(badge => {
          const IconComponent = getIconComponent(badge.icon || 'star');
          return (
            <div
              key={badge.id}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-full"
                    style={{ backgroundColor: badge.color || '#1d528d' }}
                  >
                    <IconComponent className="text-white" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">{badge.name}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    className="p-2 text-gray-500 hover:text-[#1d528d] transition-colors"
                    aria-label="Editar badge"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                    aria-label="Excluir badge"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-gray-600">
                <p>{badge.description}</p>
                <p className="text-sm">Critério: {badge.criteria}</p>
                {badge.type === 'belt' && (
                  <p className="text-sm">Faixa: {badge.beltLevel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Nova Badge</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  placeholder="Digite o nome da badge"
                  aria-label="Nome da badge"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  placeholder="Digite a descrição da badge"
                  aria-label="Descrição da badge"
                />
              </div>

              <div>
                <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                  URL da Imagem
                </label>
                <input
                  id="image"
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  placeholder="Digite a URL da imagem"
                  aria-label="URL da imagem da badge"
                />
              </div>

              <div>
                <label htmlFor="criteria" className="block text-sm font-medium text-gray-700 mb-1">
                  Critério
                </label>
                <input
                  id="criteria"
                  type="text"
                  value={formData.criteria}
                  onChange={(e) => setFormData({ ...formData, criteria: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  placeholder="Digite o critério para ganhar a badge"
                  aria-label="Critério para ganhar a badge"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'belt' | 'achievement' })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  aria-label="Tipo da badge"
                >
                  <option value="achievement">Conquista</option>
                  <option value="belt">Faixa</option>
                </select>
              </div>

              <div>
                <label htmlFor="icon" className="block text-sm font-medium text-gray-700 mb-1">
                  Ícone
                </label>
                <select
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  aria-label="Ícone da badge"
                >
                  {ICONS.map(icon => (
                    <option key={icon.value} value={icon.value}>{icon.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                  Cor
                </label>
                <select
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  aria-label="Cor da badge"
                >
                  {COLORS.map(color => (
                    <option key={color.value} value={color.value}>{color.label}</option>
                  ))}
                </select>
              </div>

              {formData.type === 'belt' && (
                <div>
                  <label htmlFor="beltLevel" className="block text-sm font-medium text-gray-700 mb-1">
                    Nível da Faixa
                  </label>
                  <input
                    id="beltLevel"
                    type="text"
                    value={formData.beltLevel}
                    onChange={(e) => setFormData({ ...formData, beltLevel: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                    placeholder="Digite o nível da faixa"
                    aria-label="Nível da faixa"
                  />
                </div>
              )}

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md hover:bg-[#164070]"
                >
                  Criar Badge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
