import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import EventCheckinManagement from '../EventCheckinManagement';

const EventCheckin: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{id: string; name: string} | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      loadEvents();
      loadCheckins();
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

  const loadCheckins = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/event-checkins/${user.id}`);
      const data = await response.json();
      if (data.success) {
        setCheckins(data.checkins || []);
      }
    } catch (error) {
      console.error('Erro ao carregar checkins:', error);
    }
  };

  const handleCheckin = async (eventId: string) => {
    if (!user) return;

    const existingCheckin = checkins.find(c => c.eventId === eventId);
    if (existingCheckin) {
      alert('Você já fez checkin neste evento!');
      return;
    }

    try {
      const response = await fetch('/api/event-checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          userId: user.id,
          checkinTime: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadCheckins();
        alert('Checkin realizado com sucesso!');
      } else {
        alert('Erro ao fazer checkin. Por favor, tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao fazer checkin:', error);
      alert('Erro ao fazer checkin. Por favor, tente novamente.');
    }
  };

  const handleManageCheckins = (event: {id: string; name: string}) => {
    setSelectedEvent(event);
    setIsCheckinModalOpen(true);
  };

  const isEventAvailable = (event: any) => {
    const eventDate = new Date(event.date);
    const now = new Date();
    const diffHours = Math.abs(eventDate.getTime() - now.getTime()) / 36e5;
    return diffHours <= 2; // Permite checkin 2 horas antes/depois do evento
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Faça login para acessar os eventos.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Checkin em Eventos KIHAP</h2>
      
      {events.length === 0 ? (
        <p className="text-gray-600">Nenhum evento disponível no momento.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => {
            const hasCheckin = checkins.some(c => c.eventId === event.id);
            const available = isEventAvailable(event);
            
            return (
              <div key={event.id} className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold mb-2">{event.name}</h3>
                <p className="text-gray-600 mb-2">{event.description}</p>
                <p className="text-gray-600 mb-4">
                  {new Date(event.date).toLocaleString('pt-BR')}
                </p>
                <p className="text-gray-600 mb-4">
                  Local: {event.location}
                </p>
                
                <div className="flex flex-col space-y-2">
                  {hasCheckin ? (
                    <span className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-center">
                      Checkin realizado
                    </span>
                  ) : available ? (
                    <button
                      onClick={() => handleCheckin(event.id)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Fazer Checkin
                    </button>
                  ) : (
                    <span className="inline-block bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-center">
                      Checkin indisponível
                    </span>
                  )}
                  
                  {user.role === 'instructor' && (
                    <button
                      onClick={() => handleManageCheckins(event)}
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Gerenciar Checkins
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Gerenciamento de Checkins */}
      {selectedEvent && (
        <EventCheckinManagement
          isOpen={isCheckinModalOpen}
          onClose={() => {
            setIsCheckinModalOpen(false);
            setSelectedEvent(null);
            loadCheckins();
          }}
          eventId={selectedEvent.id}
          eventName={selectedEvent.name}
        />
      )}
    </div>
  );
};

export default EventCheckin;
