import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface AwardBadgeFormProps {
  badge: any;
  onClose: () => void;
}

export default function AwardBadgeForm({ badge, onClose }: AwardBadgeFormProps) {
  const currentUser = useAuthStore(state => state.user);
  const { students, awardBadge } = useDataStore();
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter students based on unit and search term
  const filteredStudents = students.filter(student => {
    if (currentUser?.unitId && student.unitId !== currentUser.unitId) {
      return false;
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        student.name.toLowerCase().includes(searchLower) ||
        student.email?.toLowerCase().includes(searchLower) ||
        student.belt.toLowerCase().includes(searchLower)
      );
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    selectedStudents.forEach(studentId => {
      awardBadge(studentId, badge.id, currentUser.id, comment);
    });
    onClose();
  };

  const toggleStudent = (studentId: number) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudents(filteredStudents.map(s => s.id));
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

  const IconComponent = LucideIcons[badge.icon as keyof typeof LucideIcons];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Conceder Badge</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Badge Preview */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className={`p-3 rounded-lg ${badge.color}`}>
              {IconComponent && <IconComponent size={24} />}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{badge.name}</h3>
              <p className="text-sm text-gray-600">{badge.description}</p>
            </div>
          </div>

          {/* Student Search */}
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar alunos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <button
                type="button"
                onClick={selectAllStudents}
                className="text-[#1d528d] hover:text-[#164070]"
              >
                Selecionar Todos
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-gray-600 hover:text-gray-800"
              >
                Limpar Seleção
              </button>
            </div>
          </div>

          {/* Student List */}
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {filteredStudents.map(student => (
              <label
                key={student.id}
                className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                  className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-700">{student.name}</div>
                    <div className="text-xs text-gray-500">{student.belt}</div>
                  </div>
                  {student.email && (
                    <div className="text-xs text-gray-500">{student.email}</div>
                  )}
                </div>
              </label>
            ))}

            {filteredStudents.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                Nenhum aluno encontrado.
              </div>
            )}
          </div>

          {/* Selected Count */}
          <div className="text-sm text-gray-600">
            {selectedStudents.length} aluno{selectedStudents.length !== 1 ? 's' : ''} selecionado{selectedStudents.length !== 1 ? 's' : ''}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comentário (opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              placeholder="Adicione um comentário sobre esta conquista..."
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
              disabled={selectedStudents.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md hover:bg-[#164070] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Conceder Badge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}