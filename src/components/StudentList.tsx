import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Student } from '../types';

interface StudentListProps {
  students: Student[];
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  unitId: string;
}

export default function StudentList({ students, onEditStudent, onDeleteStudent, unitId }: StudentListProps) {
  const handleDelete = (studentId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este aluno? Esta ação não pode ser desfeita.')) {
      onDeleteStudent(studentId);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {students.map((student) => {
        const hasActiveContract = student.contract?.status === 'active';
        
        return (
          <div 
            key={student.id} 
            className={`bg-white rounded-lg shadow-md p-6 relative ${
              hasActiveContract ? 'border-2 border-green-500' : ''
            }`}
          >
            {hasActiveContract && (
              <div className="absolute top-2 right-2">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Contrato Ativo
                </span>
              </div>
            )}

            <div className="flex items-center justify-between mb-4 mt-6">
              <button
                onClick={() => onEditStudent(student)}
                className="text-xl font-bold text-gray-800 hover:text-[#1d528d] transition-colors text-left"
              >
                {student.name}
              </button>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800`}>
                {student.belt}
              </span>
            </div>
            
            <div className="space-y-2 text-gray-600">
              {student.contract && (
                <div className="flex items-center gap-2">
                  <span>
                    {student.contract.content}
                  </span>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onEditStudent(student)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 size={16} />
                Editar
              </button>
              <button
                onClick={() => handleDelete(student.id)}
                className="flex-1 bg-red-100 text-red-700 py-2 px-4 rounded-md hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
