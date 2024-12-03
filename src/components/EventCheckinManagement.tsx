import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface Student {
  id: string;
  name: string;
}

interface Checkin {
  id: string;
  eventId: string;
  userId: string;
  studentName: string;
  checkinTime: string;
}

interface EventCheckinManagementProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
}

const EventCheckinManagement: React.FC<EventCheckinManagementProps> = ({
  isOpen,
  onClose,
  eventId,
  eventName,
}) => {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      loadCheckins();
      loadStudents();
    }
  }, [isOpen, eventId]);

  const loadCheckins = async () => {
    try {
      const response = await fetch(`/api/event-checkins?eventId=${eventId}`);
      const data = await response.json();
      if (data.success) {
        setCheckins(data.checkins || []);
      }
    } catch (error) {
      console.error('Erro ao carregar checkins:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await fetch('/api/students');
      const data = await response.json();
      if (data.success) {
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    }
  };

  const handleAddCheckin = async () => {
    if (!selectedStudent) return;

    try {
      const response = await fetch('/api/event-checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          userId: selectedStudent,
          checkinTime: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadCheckins();
        setSelectedStudent('');
      }
    } catch (error) {
      console.error('Erro ao adicionar checkin:', error);
    }
  };

  const handleRemoveCheckin = async (checkinId: string) => {
    if (!confirm('Tem certeza que deseja remover este checkin?')) return;

    try {
      const response = await fetch(`/api/event-checkins/${checkinId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        loadCheckins();
      }
    } catch (error) {
      console.error('Erro ao remover checkin:', error);
    }
  };

  if (!isOpen) return null;

  const availableStudents = students.filter(
    student => !checkins.some(checkin => checkin.userId === student.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Gerenciar Checkins - {eventName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Adicionar Checkin */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Adicionar Aluno ao Evento</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="student-select" className="sr-only">
                Selecione um aluno para adicionar ao evento
              </label>
              <select
                id="student-select"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                aria-label="Selecione um aluno para adicionar ao evento"
              >
                <option value="">Selecione um aluno</option>
                {availableStudents.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddCheckin}
              disabled={!selectedStudent}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Lista de Checkins */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Alunos Presentes ({checkins.length})</h3>
          {checkins.length === 0 ? (
            <p className="text-gray-600">Nenhum aluno fez checkin neste evento ainda.</p>
          ) : (
            <div className="space-y-2">
              {checkins.map(checkin => (
                <div
                  key={checkin.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{checkin.studentName}</p>
                    <p className="text-sm text-gray-600">
                      Checkin: {new Date(checkin.checkinTime).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveCheckin(checkin.id)}
                    className="text-red-600 hover:text-red-700"
                    aria-label={`Remover checkin de ${checkin.studentName}`}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCheckinManagement;
