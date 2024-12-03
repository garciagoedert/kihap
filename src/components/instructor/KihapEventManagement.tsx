import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import EventForm from '../EventForm';
import type { KihapEvent } from '../../types';

const KihapEventManagement: React.FC = () => {
  const [events, setEvents] = useState<KihapEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user]);

  const loadEvents = async () => {
    try {
      const response = await fetch('/api/kihap-events');
      const data = await response.json();
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    }
  };

  const handleCreateEvent = async (eventData: Omit<KihapEvent, 'id' | 'active' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/kihap-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...eventData,
          active: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadEvents();
        setIsEventModalOpen(false);
      } else {
        alert('Erro ao criar evento. Por favor, tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      alert('Erro ao criar evento. Por favor, tente novamente.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      const response = await fetch(`/api/kihap-events/${eventId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        loadEvents();
      } else {
        alert('Erro ao excluir evento. Por favor, tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      alert('Erro ao excluir evento. Por favor, tente novamente.');
    }
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Faça login para acessar o gerenciamento de eventos.</p>
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gerenciamento de Eventos KIHAP</h2>
        <button
          onClick={() => setIsEventModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <span className="mr-2">+</span>
          Novo Evento
        </button>
      </div>

      {/* Modal de Criação de Evento */}
      <EventForm
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSubmit={handleCreateEvent}
      />

      {/* Lista de Eventos */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Eventos</h3>
        {sortedEvents.length === 0 ? (
          <p className="text-gray-600">Nenhum evento cadastrado.</p>
        ) : (
          <div className="space-y-6">
            {sortedEvents.map(event => (
              <div key={event.id} className="border-b pb-6 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-semibold">{event.name}</h4>
                    <p className="text-gray-600">{event.description}</p>
                    <p className="text-gray-600">
                      Data: {new Date(event.date).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-gray-600">Local: {event.location}</p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-red-600 hover:text-red-700"
                      aria-label={`Excluir evento ${event.name}`}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KihapEventManagement;
