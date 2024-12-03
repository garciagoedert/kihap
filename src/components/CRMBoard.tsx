import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { Lead, LeadStatus } from '../types';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from 'react-beautiful-dnd';
import { FiSearch, FiTrash2, FiPhone, FiMail, FiMessageSquare, FiUsers } from 'react-icons/fi';

const statusLabels: Record<LeadStatus, string> = {
  'novo': 'Novo',
  'contato': 'Contatado',
  'visitou': 'Visitou',
  'matriculado': 'Matriculado',
  'desistente': 'Desistente',
  // mantendo os outros status para compatibilidade com o tipo LeadStatus
  'new': 'Novo',
  'contacted': 'Contatado',
  'interested': 'Interessado',
  'scheduled': 'Agendado',
  'converted': 'Convertido',
  'lost': 'Perdido'
};

const statusColors: Record<LeadStatus, string> = {
  'novo': 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-800 border-blue-200',
  'contato': 'bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-800 border-yellow-200',
  'visitou': 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-800 border-purple-200',
  'matriculado': 'bg-gradient-to-br from-green-50 to-green-100 text-green-800 border-green-200',
  'desistente': 'bg-gradient-to-br from-red-50 to-red-100 text-red-800 border-red-200',
  // mantendo os outros status para compatibilidade com o tipo LeadStatus
  'new': 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-800 border-blue-200',
  'contacted': 'bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-800 border-yellow-200',
  'interested': 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-800 border-purple-200',
  'scheduled': 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-800 border-indigo-200',
  'converted': 'bg-gradient-to-br from-green-50 to-green-100 text-green-800 border-green-200',
  'lost': 'bg-gradient-to-br from-red-50 to-red-100 text-red-800 border-red-200'
};

const kanbanStatuses: LeadStatus[] = ['novo', 'contato', 'visitou', 'matriculado', 'desistente'];

export default function CRMBoard() {
  const { leads, updateLead, deleteLead } = useDataStore();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const lead = leads.find(l => l.id === draggableId);
    
    if (lead) {
      const newStatus = destination.droppableId as LeadStatus;
      updateLead({ ...lead, status: newStatus });
    }
  };

  const handleDeleteLead = (leadId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lead?')) {
      deleteLead(leadId);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase();
    return (
      lead.name.toLowerCase().includes(searchLower) ||
      lead.email.toLowerCase().includes(searchLower) ||
      lead.phone.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <FiUsers className="text-blue-600" size={24} />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              CRM
            </h2>
          </div>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-72 transition-all duration-200 shadow-sm bg-white"
            />
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex overflow-x-auto gap-6 pb-6">
            {kanbanStatuses.map(status => (
              <Droppable key={status} droppableId={status}>
                {(provided: DroppableProvided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-shrink-0 w-80 bg-white rounded-xl shadow-sm border border-gray-100 backdrop-blur-lg bg-opacity-90"
                  >
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {statusLabels[status]}
                      </h3>
                      <div className="text-sm text-gray-500 mt-1">
                        {filteredLeads.filter(lead => lead.status === status).length} leads
                      </div>
                    </div>
                    <div className="p-4 space-y-4 min-h-[200px]">
                      {filteredLeads
                        .filter(lead => lead.status === status)
                        .map((lead, index) => (
                          <Draggable
                            key={lead.id}
                            draggableId={lead.id}
                            index={index}
                          >
                            {(provided: DraggableProvided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="group bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200 transform hover:-translate-y-1"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <h4 className="font-medium text-gray-800 text-lg">
                                    {lead.name}
                                  </h4>
                                  <button
                                    onClick={() => handleDeleteLead(lead.id)}
                                    className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                    title="Excluir lead"
                                    aria-label="Excluir lead"
                                  >
                                    <FiTrash2 size={16} />
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center text-gray-600 group-hover:text-blue-600 transition-colors">
                                    <FiMail className="mr-2" size={14} />
                                    <span className="text-sm">{lead.email}</span>
                                  </div>
                                  <div className="flex items-center text-gray-600 group-hover:text-blue-600 transition-colors">
                                    <FiPhone className="mr-2" size={14} />
                                    <span className="text-sm">{lead.phone}</span>
                                  </div>
                                  {lead.notes && (
                                    <div className="flex items-start text-gray-600 mt-2">
                                      <FiMessageSquare className="mr-2 mt-1" size={14} />
                                      <span className="text-sm italic">{lead.notes}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-3">
                                  <span className={`text-xs px-3 py-1 rounded-full border ${statusColors[lead.status]}`}>
                                    {statusLabels[lead.status]}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
