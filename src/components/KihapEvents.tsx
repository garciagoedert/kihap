import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import EventCheckinManagement from './EventCheckinManagement';

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
}

const KihapEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const { user } = useAuthStore();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

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

  const handleOpenCheckinManagement = (event: Event) => {
    setSelectedEvent(event);
    setIsCheckinModalOpen(true);
  };

  const handleCloseCheckinManagement = () => {
    setSelectedEvent(null);
    setIsCheckinModalOpen(false);
  };

  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const now = new Date();
  const pastEvents = sortedEvents.filter(event => new Date(event.date) < now);
  const upcomingEvents = sortedEvents.filter(event => new Date(event.date) >= now);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Eventos KIHAP</h2>

      {/* Eventos Futuros */}
      <div className="mb-12">
        <h3 className="text-xl font-semibold mb-4 text-blue-600">Próximos Eventos</h3>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-600">Nenhum evento programado no momento.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map(event => (
              <div key={event.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                <div className="mb-4">
                  <h4 className="text-lg font-semibold mb-2">{event.name}</h4>
                  <p className="text-gray-600 mb-2">{event.description}</p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Data:</span>{' '}
                    {new Date(event.date).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Local:</span> {event.location}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-blue-600">
                    {Math.ceil((new Date(event.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} dias restantes
                  </div>
                  <button
                    onClick={() => handleOpenCheckinManagement(event)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    Gerenciar Checkins
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eventos Passados */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-600">Eventos Anteriores</h3>
        {pastEvents.length === 0 ? (
          <p className="text-gray-600">Nenhum evento anterior registrado.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pastEvents.reverse().map(event => (
              <div key={event.id} className="bg-gray-50 rounded-lg shadow-md p-6 border-l-4 border-gray-400">
                <div>
                  <h4 className="text-lg font-semibold mb-2">{event.name}</h4>
                  <p className="text-gray-600 mb-2">{event.description}</p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Data:</span>{' '}
                    {new Date(event.date).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Local:</span> {event.location}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    {Math.floor((now.getTime() - new Date(event.date).getTime()) / (1000 * 60 * 60 * 24))} dias atrás
                  </div>
                  <button
                    onClick={() => handleOpenCheckinManagement(event)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  >
                    Ver Checkins
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Gerenciamento de Checkins */}
      {selectedEvent && (
        <EventCheckinManagement
          isOpen={isCheckinModalOpen}
          onClose={handleCloseCheckinManagement}
          eventId={selectedEvent.id}
          eventName={selectedEvent.name}
        />
      )}
    </div>
  );
};

export default KihapEvents;
