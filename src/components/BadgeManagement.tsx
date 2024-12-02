import React, { useState } from 'react';
import { Award, Plus, Search } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import BadgeForm from './BadgeForm';
import AwardBadgeForm from './AwardBadgeForm';
import * as LucideIcons from 'lucide-react';
import { Badge } from '../types';

export default function BadgeManagement() {
  const { badges, studentBadges } = useDataStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // Função para contar quantos alunos conquistaram cada badge
  const getStudentCount = (badgeId: string) => {
    return studentBadges.filter(sb => sb.badgeId === badgeId).length;
  };

  // Filtrar badges baseado na categoria e termo de busca
  const filteredBadges = badges.filter(badge => {
    const matchesCategory = selectedCategory === 'all' || badge.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      badge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getBeltBackgroundColor = (beltLevel: string) => {
    const colors: { [key: string]: string } = {
      'branca': 'bg-white',
      'amarela': 'bg-yellow-50',
      'laranja': 'bg-orange-50',
      'verde': 'bg-green-50',
      'azul': 'bg-blue-50',
      'roxa': 'bg-purple-50',
      'vermelha': 'bg-red-50',
      'marrom': 'bg-[#D7CCC8]',
      'preta': 'bg-gray-100'
    };
    return colors[beltLevel] || 'bg-white';
  };

  const getBeltIconColor = (beltLevel: string) => {
    const colors: { [key: string]: string } = {
      'branca': 'text-gray-800',
      'amarela': 'text-[#dfa129]',
      'laranja': 'text-orange-500',
      'verde': 'text-green-600',
      'azul': 'text-blue-600',
      'roxa': 'text-purple-600',
      'vermelha': 'text-red-600',
      'marrom': 'text-[#795548]',
      'preta': 'text-black'
    };
    return colors[beltLevel] || 'text-gray-800';
  };

  const handleEditBadge = (badge: Badge) => {
    setSelectedBadge(badge);
    setShowBadgeForm(true);
  };

  const handleAwardBadge = (badge: Badge) => {
    setSelectedBadge(badge);
    setShowAwardForm(true);
  };

  // Ordenar as badges na ordem correta das faixas quando necessário
  const beltOrder = ['branca', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'vermelha', 'marrom', 'preta'];
  const sortedBadges = [...filteredBadges].sort((a, b) => {
    if (a.category === 'belt' && b.category === 'belt') {
      const indexA = beltOrder.indexOf(a.beltLevel || '');
      const indexB = beltOrder.indexOf(b.beltLevel || '');
      return indexA - indexB;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header com título e botão de adicionar */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Badges</h2>
        <button
          onClick={() => {
            setSelectedBadge(null);
            setShowBadgeForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1d528d] text-white rounded-md hover:bg-[#164070]"
        >
          <Plus size={20} />
          Nova Badge
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar badges..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
          </div>
        </div>
        <div>
          <label htmlFor="category-select" className="sr-only">
            Filtrar por categoria
          </label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-48 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
          >
            <option value="all">Todas as Categorias</option>
            <option value="belt">Graduação</option>
            <option value="achievement">Conquista</option>
            <option value="special">Especial</option>
          </select>
        </div>
      </div>

      {/* Lista de Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedBadges.map(badge => {
          const IconComponent = badge.icon ? (LucideIcons[badge.icon as keyof typeof LucideIcons] as React.FC<any>) : Award;
          
          return (
            <div
              key={badge.id}
              className={`rounded-lg p-6 ${
                badge.category === 'belt' 
                  ? getBeltBackgroundColor(badge.beltLevel || '')
                  : badge.color.split(' ')[0]
              } shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <IconComponent 
                    size={24}
                    className={
                      badge.category === 'belt'
                        ? getBeltIconColor(badge.beltLevel || '')
                        : badge.color.split(' ')[1]
                    }
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{badge.name}</h3>
                    <p className="text-sm text-gray-600">{badge.description}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {getStudentCount(badge.id)} alunos conquistaram
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditBadge(badge)}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleAwardBadge(badge)}
                    className="px-3 py-1 text-sm text-[#1d528d] hover:text-white hover:bg-[#1d528d] border border-[#1d528d] rounded"
                  >
                    Conceder
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Criar/Editar Badge */}
      {showBadgeForm && (
        <BadgeForm
          badge={selectedBadge}
          onClose={() => {
            setShowBadgeForm(false);
            setSelectedBadge(null);
          }}
        />
      )}

      {/* Modal de Conceder Badge */}
      {showAwardForm && selectedBadge && (
        <AwardBadgeForm
          badge={selectedBadge}
          onClose={() => {
            setShowAwardForm(false);
            setSelectedBadge(null);
          }}
        />
      )}
    </div>
  );
}
