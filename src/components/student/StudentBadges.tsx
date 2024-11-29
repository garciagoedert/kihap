import React from 'react';
import { useDataStore } from '../../store/useDataStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';
import { Student } from '../../types';

interface StudentBadgesProps {
  student: Student;
}

export default function StudentBadges({ student }: StudentBadgesProps) {
  const { badges, studentBadges, users } = useDataStore();

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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Stats Overview */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Suas Conquistas</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#1d528d]">
                {studentAwards.length}
              </div>
              <div className="text-sm text-gray-600">Total de Conquistas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#dfa129]">
                {studentAwards.filter(sa => 
                  badges.find(b => b.id === sa.badgeId)?.category === 'achievement'
                ).length}
              </div>
              <div className="text-sm text-gray-600">Conquistas Técnicas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {studentAwards.filter(sa => 
                  badges.find(b => b.id === sa.badgeId)?.category === 'special'
                ).length}
              </div>
              <div className="text-sm text-gray-600">Conquistas Especiais</div>
            </div>
          </div>
        </div>

        {/* Badges by Category */}
        {Object.entries(groupedBadges).map(([category, categoryBadges]) => (
          <div key={category} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryBadges.map(({ id, name, description, icon, color, award }) => {
                const IconComponent = LucideIcons[icon as keyof typeof LucideIcons];
                const awardedBy = users.find(u => u.id === award.awardedBy);
                
                return (
                  <div key={id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${color}`}>
                        {IconComponent && <IconComponent size={24} />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{name}</h4>
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
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-400 mb-4">
              <LucideIcons.Award size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Nenhuma conquista ainda
            </h3>
            <p className="text-gray-600">
              Continue treinando e conquistando novas habilidades para ganhar badges!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}