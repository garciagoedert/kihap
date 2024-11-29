import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { useAuthStore } from '../store/useAuthStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Award, Plus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import AwardBadgeForm from './AwardBadgeForm';

interface StudentProfileProps {
  student: any;
  onClose: () => void;
}

export default function StudentProfile({ student, onClose }: StudentProfileProps) {
  const { badges, studentBadges, users } = useDataStore();
  const [showAwardForm, setShowAwardForm] = useState(false);

  // Get all badges awarded to this student
  const studentAwards = studentBadges
    .filter(sb => sb.studentId === student.id)
    .sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime());

  // Group badges by category
  const groupedBadges = studentAwards.reduce((acc, award) => {
    const badge = badges.find(b => b.id === award.badgeId);
    if (badge) {
      if (!acc[badge.category]) {
        acc[badge.category] = [];
      }
      acc[badge.category].push({ ...badge, award });
    }
    return acc;
  }, {} as Record<string, any[]>);

  const categoryLabels = {
    belt: 'Graduações',
    achievement: 'Conquistas',
    special: 'Especiais'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              Perfil do Aluno
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Student Info */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {student.photo ? (
                <img
                  src={student.photo}
                  alt={student.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-gray-500">
                    {student.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-800">{student.name}</h3>
                <p className="text-gray-600">{student.belt}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Dados Pessoais</h4>
                <div className="space-y-2 text-gray-600">
                  <p><strong>Email:</strong> {student.email}</p>
                  <p><strong>Telefone:</strong> {student.phone}</p>
                  <p><strong>Data de Nascimento:</strong> {student.birthDate}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Informações de Treino</h4>
                <div className="space-y-2 text-gray-600">
                  <p><strong>Dias:</strong> {student.trainingDays.join(', ')}</p>
                  <p><strong>Horário:</strong> {student.trainingSchedule}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Badges Section */}
          <div className="border-t pt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Conquistas</h3>
              <button
                onClick={() => setShowAwardForm(true)}
                className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
              >
                <Plus size={20} />
                Conceder Badge
              </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-[#1d528d]">
                  {studentAwards.length}
                </div>
                <div className="text-sm text-gray-600">Total de Conquistas</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-[#dfa129]">
                  {studentAwards.filter(sa => 
                    badges.find(b => b.id === sa.badgeId)?.category === 'achievement'
                  ).length}
                </div>
                <div className="text-sm text-gray-600">Conquistas Técnicas</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {studentAwards.filter(sa => 
                    badges.find(b => b.id === sa.badgeId)?.category === 'special'
                  ).length}
                </div>
                <div className="text-sm text-gray-600">Conquistas Especiais</div>
              </div>
            </div>

            {/* Badges by Category */}
            {Object.entries(groupedBadges).map(([category, categoryBadges]) => (
              <div key={category} className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryBadges.map(({ id, name, description, icon, color, award }) => {
                    const IconComponent = LucideIcons[icon as keyof typeof LucideIcons];
                    const awardedBy = users.find(u => u.id === award.awardedBy);
                    
                    return (
                      <div key={id} className="border rounded-lg p-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${color}`}>
                            {IconComponent && <IconComponent size={24} />}
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-800">{name}</h5>
                            <p className="text-sm text-gray-600 mb-2">{description}</p>
                            <div className="text-xs text-gray-500">
                              <p>Concedida por {awardedBy?.name || 'Instrutor'}</p>
                              <p>{format(new Date(award.awardedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                            </div>
                            {award.comment && (
                              <p className="mt-2 text-sm text-gray-600 italic">
                                "{award.comment}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {studentAwards.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Award size={48} className="mx-auto text-gray-400 mb-4" />
                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                  Nenhuma conquista ainda
                </h4>
                <p className="text-gray-600">
                  Conceda badges para reconhecer o progresso e conquistas do aluno.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Award Badge Form */}
      {showAwardForm && (
        <AwardBadgeForm
          student={student}
          onClose={() => setShowAwardForm(false)}
        />
      )}
    </div>
  );
}