import React from 'react';
import { useDataStore } from '../../store/useDataStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Award } from 'lucide-react';
import { Student } from '../../types';

interface StudentBadgesProps {
  student: Student;
}

const getBeltBackgroundColor = (beltLevel: string, isAchieved: boolean) => {
  const colors: { [key: string]: string } = {
    'branca': isAchieved ? 'bg-white' : 'bg-white/50',
    'amarela': isAchieved ? 'bg-yellow-100' : 'bg-yellow-100/50',
    'laranja': isAchieved ? 'bg-orange-100' : 'bg-orange-100/50',
    'verde': isAchieved ? 'bg-green-100' : 'bg-green-100/50',
    'azul': isAchieved ? 'bg-blue-100' : 'bg-blue-100/50',
    'roxa': isAchieved ? 'bg-purple-100' : 'bg-purple-100/50',
    'vermelha': isAchieved ? 'bg-red-100' : 'bg-red-100/50',
    'marrom': isAchieved ? 'bg-[#D7CCC8]' : 'bg-[#D7CCC8]/50',
    'preta': isAchieved ? 'bg-gray-100' : 'bg-gray-100/50'
  };
  return colors[beltLevel] || 'bg-white';
};

const getBeltIconColor = (beltLevel: string, isAchieved: boolean) => {
  const colors: { [key: string]: string } = {
    'branca': isAchieved ? 'text-gray-800' : 'text-gray-400',
    'amarela': isAchieved ? 'text-yellow-500' : 'text-yellow-300',
    'laranja': isAchieved ? 'text-orange-500' : 'text-orange-300',
    'verde': isAchieved ? 'text-green-500' : 'text-green-300',
    'azul': isAchieved ? 'text-blue-500' : 'text-blue-300',
    'roxa': isAchieved ? 'text-purple-500' : 'text-purple-300',
    'vermelha': isAchieved ? 'text-red-500' : 'text-red-300',
    'marrom': isAchieved ? 'text-[#795548]' : 'text-[#795548]/50',
    'preta': isAchieved ? 'text-black' : 'text-gray-300'
  };
  return colors[beltLevel] || 'text-gray-800';
};

export default function StudentBadges({ student }: StudentBadgesProps) {
  const { badges, studentBadges, users } = useDataStore();

  // Get all badges awarded to this student
  const studentAwards = studentBadges
    .filter(sb => sb.studentId === student.id)
    .sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime());

  // Separar badges por tipo
  const allBeltBadges = badges.filter(badge => badge.type === 'belt');
  const achievementBadges = studentAwards
    .map(award => {
      const badge = badges.find(b => b.id === award.badgeId);
      return badge && badge.type === 'achievement' ? { ...badge, award } : null;
    })
    .filter(badge => badge !== null);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Stats Overview */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Suas Conquistas</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#1d528d]">
                {studentAwards.filter(award => 
                  badges.find(b => b.id === award.badgeId)?.type === 'belt'
                ).length}
              </div>
              <div className="text-sm text-gray-600">Graduações</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#dfa129]">
                {achievementBadges.length}
              </div>
              <div className="text-sm text-gray-600">Conquistas</div>
            </div>
          </div>
        </div>

        {/* Badges de Graduação */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Badges de Graduação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allBeltBadges.map(badge => {
              const award = studentBadges.find(sb => 
                sb.studentId === student.id && sb.badgeId === badge.id
              );
              const isAchieved = !!award;
              const awardedBy = award ? users.find(u => u.id === award.awardedBy) : null;
              
              return (
                <div
                  key={badge.id}
                  className={`rounded-lg p-6 ${getBeltBackgroundColor(badge.beltLevel || '', isAchieved)}`}
                >
                  <div className="flex items-center gap-4">
                    <Award className={`w-8 h-8 ${getBeltIconColor(badge.beltLevel || '', isAchieved)}`} />
                    <div>
                      <h3 className={`text-lg font-semibold ${isAchieved ? 'text-gray-800' : 'text-gray-500'}`}>
                        {badge.name}
                      </h3>
                      <p className={isAchieved ? 'text-gray-600' : 'text-gray-400'}>
                        {badge.description}
                      </p>
                    </div>
                  </div>
                  {isAchieved && award && (
                    <div className="mt-4 text-sm text-gray-500">
                      <p>Concedida por {awardedBy?.name || 'Instrutor'}</p>
                      <p>{format(new Date(award.awardedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                    </div>
                  )}
                  {!isAchieved && (
                    <div className="mt-4 text-sm text-gray-400">
                      <p>Ainda não conquistada</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Outras Conquistas */}
        {achievementBadges.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Outras Conquistas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievementBadges.map(badge => {
                if (!badge) return null;
                const awardedBy = users.find(u => u.id === badge.award.awardedBy);
                
                return (
                  <div key={badge.id} className="bg-white border rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <div 
                        className="p-2 rounded-full"
                        style={{ backgroundColor: badge.color || '#1d528d' }}
                      >
                        <Award className="text-white" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{badge.name}</h3>
                        <p className="text-gray-600">{badge.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                      <p>Concedida por {awardedBy?.name || 'Instrutor'}</p>
                      <p>{format(new Date(badge.award.awardedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {studentAwards.length === 0 && achievementBadges.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Award size={48} className="mx-auto" />
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
