<content>import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Users, Mail, MessageCircle, Calendar, Plus, Edit2, Trash2 } from 'lucide-react';
import { ContactHistory as ContactHistoryType } from '../types';
import ContactHistoryForm from './ContactHistoryForm';
import { useDataStore } from '../store/useDataStore';
import { useAuthStore } from '../store/useAuthStore';

interface ContactHistoryProps {
  studentId: number;
}

const getContactIcon = (type: ContactHistoryType['type']) => {
  switch (type) {
    case 'call':
      return <Phone size={18} />;
    case 'meeting':
      return <Users size={18} />;
    case 'email':
      return <Mail size={18} />;
    case 'whatsapp':
      return <MessageCircle size={18} />;
    default:
      return <Calendar size={18} />;
  }
};

const getContactTypeLabel = (type: ContactHistoryType['type']) => {
  switch (type) {
    case 'call':
      return 'Ligação';
    case 'meeting':
      return 'Reunião';
    case 'email':
      return 'Email';
    case 'whatsapp':
      return 'WhatsApp';
    default:
      return 'Outro';
  }
};

export default function ContactHistory({ studentId }: ContactHistoryProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactHistoryType | null>(null);
  const { contactHistory, users, addContactHistory, updateContactHistory, deleteContactHistory } = useDataStore();
  const currentUser = useAuthStore(state => state.user);

  const studentContacts = contactHistory
    .filter(contact => contact.studentId === studentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = (contactId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este registro de contato?')) {
      deleteContactHistory(contactId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Histórico de Contatos</h3>
        <button
          onClick={() => {
            setEditingContact(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 text-sm bg-[#1d528d] text-white px-3 py-1.5 rounded-md hover:bg-[#164070] transition-colors"
        >
          <Plus size={16} />
          Novo Contato
        </button>
      </div>

      <div className="space-y-4">
        {studentContacts.map(contact => {
          const creator = users.find(u => u.id === contact.createdBy);
          
          return (
            <div key={contact.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getContactIcon(contact.type)}
                  <span className="font-medium text-gray-800">
                    {getContactTypeLabel(contact.type)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {format(new Date(contact.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingContact(contact);
                      setShowForm(true);
                    }}
                    className="text-gray-600 hover:text-[#1d528d] transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="text-gray-600 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-gray-800">{contact.description}</p>
                <p className="text-gray-700"><strong>Resultado:</strong> {contact.outcome}</p>
                
                {contact.nextAction && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <strong>Próxima ação:</strong>
                    <span>{contact.nextAction}</span>
                    {contact.nextActionDate && (
                      <span className="text-gray-500">
                        ({format(new Date(contact.nextActionDate), 'dd/MM/yyyy')})
                      </span>
                    )}
                  </div>
                )}

                <p className="text-gray-500 text-xs">
                  Registrado por {creator?.name || 'Usuário desconhecido'}
                </p>
              </div>
            </div>
          );
        })}

        {studentContacts.length === 0 && (
          <p className="text-gray-500 text-center py-4">
            Nenhum contato registrado ainda.
          </p>
        )}
      </div>

      {showForm && (
        <ContactHistoryForm
          studentId={studentId}
          contact={editingContact || undefined}
          onClose={() => {
            setShowForm(false);
            setEditingContact(null);
          }}
          onSubmit={(contactData) => {
            if (editingContact) {
              updateContactHistory({ ...contactData, id: editingContact.id });
            } else {
              addContactHistory(contactData);
            }
            setShowForm(false);
            setEditingContact(null);
          }}
        />
      )}
    </div>
  );
}</content>