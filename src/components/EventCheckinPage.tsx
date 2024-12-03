import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import type { Student, KihapEvent, EventCheckin } from '../types';

const EventCheckinPage: React.FC = () => {
  const [events, setEvents] = useState<KihapEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<KihapEvent | null>(null);
  const [checkins, setCheckins] = useState<EventCheckin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuthStore();
  const { students } = useDataStore();

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadCheckins(selectedEvent.id);
    }
  }, [selectedEvent]);

  const loadEvents = async () => {
    try {
      const response = await fetch('/api/kihap-events');
      const data = await response.json();
      if (data.success) {
        const sortedEvents = (data.events || []).sort(
          (a: KihapEvent, b: KihapEvent) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setEvents(sortedEvents);
        if (sortedEvents.length > 0) {
          setSelectedEvent(sortedEvents[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    }
  };

  const loadCheckins = async (eventId: string) => {
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

  const handleAddCheckin = async (studentId: string, studentName: string) => {
    if (!selectedEvent) return;

    try {
      const response = await fetch('/api/event-checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          studentId,
          checkinTime: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadCheckins(selectedEvent.id);
      }
    } catch (error) {
      console.error('Erro ao adicionar checkin:', error);
    }
  };

  const handleRemoveCheckin = async (checkinId: string) => {
    if (!selectedEvent || !confirm('Tem certeza que deseja remover este checkin?')) return;

    try {
      const response = await fetch(`/api/event-checkins/${checkinId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        loadCheckins(selectedEvent.id);
      }
    } catch (error) {
      console.error('Erro ao remover checkin:', error);
    }
  };

  const filteredStudents = students.filter(
    student => 
      !checkins.some(checkin => checkin.studentId === student.id) &&
      student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Faça login para acessar o gerenciamento de checkins.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Gerenciamento de Checkins</h2>
        
        {/* Seletor de Evento */}
        <div className="mb-6">
          <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o Evento
          </label>
          <select
            id="event-select"
            value={selectedEvent?.id || ''}
            onChange={(e) => {
              const event = events.find(evt => evt.id === e.target.value);
              setSelectedEvent(event || null);
            }}
            className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md"
          >
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.name} - {new Date(event.date).toLocaleString('pt-BR')}
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lista de Alunos Disponíveis */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Adicionar Alunos</h3>
              
              {/* Barra de Pesquisa */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Pesquisar alunos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* Lista de Alunos */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-gray-600">Faixa: {student.belt}</p>
                      <p className="text-sm text-gray-600">ID: {student.id}</p>
                    </div>
                    <button
                      onClick={() => handleAddCheckin(student.id, student.name)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <p className="text-gray-600 text-center py-4">
                    Nenhum aluno encontrado
                  </p>
                )}
              </div>
            </div>

            {/* Lista de Checkins */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">
                Alunos Presentes ({checkins.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {checkins.map(checkin => (
                  <div
                    key={checkin.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {students.find(s => s.id === checkin.studentId)?.name || 'Aluno não encontrado'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Checkin: {new Date(checkin.checkinTime).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveCheckin(checkin.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                ))}
                {checkins.length === 0 && (
                  <p className="text-gray-600 text-center py-4">
                    Nenhum aluno fez checkin ainda
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCheckinPage;
