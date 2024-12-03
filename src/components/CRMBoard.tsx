import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useDataStore } from '../store/useDataStore';
import { Plus, X, DollarSign, Calendar, Phone, Mail, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead, LeadStatus } from '../types';
import LeadDetailsModal from './LeadDetailsModal';
import LeadForm from './LeadForm';

const statusColumns = [
  { id: 'novo', title: 'Novos Leads', color: 'bg-blue-600' },
  { id: 'contato', title: 'Em Contato', color: 'bg-yellow-600' },
  { id: 'visitou', title: 'Visitou', color: 'bg-purple-600' },
  { id: 'matriculado', title: 'Matriculado', color: 'bg-green-600' },
  { id: 'desistente', title: 'Desistente', color: 'bg-red-600' }
] as const;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function CRMBoard() {
  const { leads, units, addLead, updateLead, deleteLead, updateLeadStatus } = useDataStore();
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>(undefined);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>(units[0]?.id || '');
  const [showFormLeads, setShowFormLeads] = useState(true);
  const [showManualLeads, setShowManualLeads] = useState(true);

  const calculateColumnTotal = (status: LeadStatus, filteredLeads: Lead[]) => {
    return filteredLeads
      .filter(lead => lead.status === status)
      .reduce((sum, lead) => sum + (lead.value || 0), 0);
  };

  // Filter leads by unit and source
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (lead.unitId !== selectedUnit) return false;
      if (lead.source === 'form' && !showFormLeads) return false;
      if ((lead.source === 'manual' || !lead.source) && !showManualLeads) return false;
      return true;
    });
  }, [leads, selectedUnit, showFormLeads, showManualLeads]);

  // Create a mapping of leads to their indices
  const leadIndices = useMemo(() => {
    const indices = new Map<string, number>();
    filteredLeads.forEach((lead, index) => {
      indices.set(lead.id, index);
    });
    return indices;
  }, [filteredLeads]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as LeadStatus;
    const [_, leadId] = draggableId.split('-');
    const lead = filteredLeads.find(l => l.id === leadId);
    if (!lead) return;

    updateLeadStatus(lead.id, newStatus, '1'); // TODO: Pegar o userId real do contexto de autenticação
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">CRM</h2>
          <p className="text-gray-600">Gestão de Leads</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="unit-select" className="text-sm text-gray-700">
              Unidade:
            </label>
            <select
              id="unit-select"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="p-2 border rounded-md"
              aria-label="Selecionar unidade"
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showFormLeads}
                onChange={(e) => setShowFormLeads(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
                aria-label="Mostrar leads do formulário"
              />
              <span className="text-sm text-gray-700">Leads do Formulário</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showManualLeads}
                onChange={(e) => setShowManualLeads(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
                aria-label="Mostrar leads manuais"
              />
              <span className="text-sm text-gray-700">Leads Manuais</span>
            </label>
          </div>
          <button
            onClick={() => {
              setEditingLead(undefined);
              setShowLeadForm(true);
            }}
            className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
          >
            <Plus size={20} />
            Novo Lead
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {statusColumns.map(column => (
            <div key={column.id} className="bg-white rounded-lg shadow-lg">
              <div className={`p-4 ${column.color} rounded-t-lg`}>
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-semibold">{column.title}</h3>
                  <span className="text-white text-sm font-medium">
                    {formatCurrency(calculateColumnTotal(column.id as LeadStatus, filteredLeads))}
                  </span>
                </div>
              </div>
              
              <Droppable droppableId={column.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="p-4 min-h-[200px]"
                  >
                    {filteredLeads
                      .filter(lead => lead.status === column.id)
                      .map((lead, i) => {
                        const index = leadIndices.get(lead.id) || 0;
                        return (
                          <Draggable
                            key={lead.id}
                            draggableId={`${index}-${lead.id}`}
                            index={index}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`bg-gray-50 p-4 rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group
                                  ${lead.source === 'form' ? 'border-l-4 border-green-500' : ''}`}
                                onClick={() => setSelectedLead(lead)}
                              >
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm('Tem certeza que deseja excluir este lead?')) {
                                        deleteLead(lead.id);
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                    title="Excluir lead"
                                    aria-label="Excluir lead"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium text-gray-800">{lead.name}</h4>
                                  {lead.source === 'form' && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      Formulário
                                    </span>
                                  )}
                                </div>
                                
                                <div className="space-y-2 text-sm text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <Phone size={14} />
                                    <span>{lead.phone}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Mail size={14} />
                                    <span>{lead.email}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <DollarSign size={14} />
                                    <span>{formatCurrency(lead.value || 0)}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Calendar size={14} />
                                    <span>{format(new Date(lead.createdAt), 'dd/MM/yyyy')}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {showLeadForm && (
        <LeadForm
          lead={editingLead}
          onClose={() => {
            setShowLeadForm(false);
            setEditingLead(undefined);
          }}
          onSubmit={(leadData) => {
            if (editingLead) {
              updateLead({
                ...editingLead,
                ...leadData
              });
            } else {
              addLead(leadData);
            }
            setShowLeadForm(false);
            setEditingLead(undefined);
          }}
        />
      )}

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          userId="1" // TODO: Pegar o userId real do contexto de autenticação
        />
      )}
    </div>
  );
}
