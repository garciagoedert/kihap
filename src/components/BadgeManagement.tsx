import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { Plus, Edit2, Trash2, Award, Search, Medal } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BadgeForm from './BadgeForm';
import AwardBadgeForm from './AwardBadgeForm';
import { Badge } from '../types';

type BeltColors = {
  [key: string]: string;
};

const beltColors: BeltColors = {
  'Faixa Branca': 'bg-white border border-gray-200',
  'Faixa Amarela': 'bg-yellow-100',
  'Faixa Laranja': 'bg-orange-100',
  'Faixa Verde': 'bg-green-100',
  'Faixa Azul': 'bg-blue-100',
  'Faixa Roxa': 'bg-purple-100',
  'Faixa Vermelha': 'bg-red-100',
  'Faixa Marrom': 'bg-amber-800 bg-opacity-20',
  'Faixa Preta': 'bg-gray-900 bg-opacity-10'
};

const beltTextColors: BeltColors = {
  'Faixa Branca': 'text-gray-600',
  'Faixa Amarela': 'text-yellow-700',
  'Faixa Laranja': 'text-orange-700',
  'Faixa Verde': 'text-green-700',
  'Faixa Azul': 'text-blue-700',
  'Faixa Roxa': 'text-purple-700',
  'Faixa Vermelha': 'text-red-700',
  'Faixa Marrom': 'text-amber-800',
  'Faixa Preta': 'text-gray-900'
};

export default function BadgeManagement() {
  const currentUser = useAuthStore(state => state.user);
  const { badges, units, studentBadges } = useDataStore();
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Log para debug
    console.log('Estado atual:', {
      currentUser,
      totalBadges: badges.length,
      beltBadges: badges.filter(badge => badge.type === 'belt').length,
      otherBadges: badges.filter(badge => badge.type !== 'belt').length,
      badges: badges
    });
  }, [badges, currentUser]);

  // Separar badges de faixa das outras badges
  const beltBadges = badges.filter(badge => badge.type === 'belt');
  const otherBadges = badges.filter(badge => badge.type !== 'belt');

  const filteredOtherBadges = otherBadges.filter(badge => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        badge.name.toLowerCase().includes(searchLower) ||
        badge.description.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Badges</h2>
          <p className="text-gray-600">Gerencie e conceda badges aos alunos</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingBadge(null);
              setShowBadgeForm(true);
            }}
            className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
          >
            <Plus size={20} />
            Nova Badge
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar badges..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
        />
      </div>

      {/* Belt Badges Section */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Badges de Graduação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {beltBadges.map(badge => (
            <div key={badge.id} className={`rounded-lg shadow-md p-6 ${beltColors[badge.beltLevel || '']}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-white bg-opacity-50`}>
                  <Medal size={24} className={beltTextColors[badge.beltLevel || '']} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className={`font-semibold ${beltTextColors[badge.beltLevel || '']}`}>{badge.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{badge.description}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            setSelectedBadge(badge);
                            setShowAwardForm(true);
                          }}
                          className="p-1 text-[#dfa129] hover:text-[#c78b1f]"
                          title="Conceder Badge"
                          aria-label={`Conceder badge ${badge.name}`}
                        >
                          <Award size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Contador de alunos com a badge */}
                  <div className="mt-2 text-sm text-gray-600">
                    {studentBadges.filter(sb => sb.badgeId === badge.id).length} alunos conquistaram
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other Badges Section */}
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Outras Badges</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOtherBadges.map(badge => {
            const unit = units.find(u => u.id === badge.unitId);
            
            return (
              <div key={badge.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${badge.color || 'bg-gray-100'}`}>
                    <Award size={24} className="text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{badge.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{badge.description}</p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => {
                              setSelectedBadge(badge);
                              setShowAwardForm(true);
                            }}
                            className="p-1 text-[#dfa129] hover:text-[#c78b1f]"
                            title="Conceder Badge"
                            aria-label={`Conceder badge ${badge.name}`}
                          >
                            <Award size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingBadge(badge);
                              setShowBadgeForm(true);
                            }}
                            className="p-1 text-gray-400 hover:text-[#1d528d]"
                            title="Editar Badge"
                            aria-label={`Editar badge ${badge.name}`}
                          >
                            <Edit2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {unit && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {unit.name}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {studentBadges.filter(sb => sb.badgeId === badge.id).length} alunos conquistaram
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Forms */}
      {showBadgeForm && isAdmin && (
        <BadgeForm
          badge={editingBadge}
          onClose={() => {
            setShowBadgeForm(false);
            setEditingBadge(null);
          }}
        />
      )}

      {showAwardForm && selectedBadge && isAdmin && (
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
