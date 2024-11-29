import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageSquare, 
  Send, 
  Archive, 
  CheckCircle, 
  Search,
  User,
  Phone,
  Mail,
  Clock,
  Filter,
  UserPlus
} from 'lucide-react';

export default function ChatDashboard() {
  const currentUser = useAuthStore(state => state.user);
  const { leads, updateLead } = useDataStore();
  const { 
    threads, 
    messages, 
    activeThread,
    setActiveThread,
    sendMessage,
    updateThreadStatus,
    assignThread,
    markAsRead
  } = useChatStore();
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived' | 'resolved'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);

  // Get the selected thread
  const selectedThread = threads.find(t => t.id === selectedThreadId);

  // Filter and sort threads
  const filteredThreads = threads
    .filter(thread => {
      const lead = leads.find(l => l.id === thread.leadId);
      if (!lead) return false;
      
      // Filter by status
      if (filter !== 'all' && thread.status !== filter) return false;
      
      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          lead.name.toLowerCase().includes(searchLower) ||
          lead.email.toLowerCase().includes(searchLower) ||
          lead.phone.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleThreadSelect = (threadId: number) => {
    setSelectedThreadId(threadId);
    markAsRead(threadId);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedThread || !currentUser) return;

    sendMessage({
      threadId: selectedThread.id,
      senderId: `staff_${currentUser.id}`,
      receiverId: `lead_${selectedThread.leadId}`,
      content: message.trim(),
      type: 'staff',
      read: false
    });

    setMessage('');
  };

  const handleAddToCRM = (lead: any) => {
    if (window.confirm('Deseja adicionar este lead ao CRM?')) {
      // Update the lead to remove the chat source and set initial CRM status
      updateLead({
        ...lead,
        source: 'chat-converted',
        status: 'contato'
      });

      // Show success message
      alert('Lead adicionado ao CRM com sucesso!');
    }
  };

  const selectedLead = selectedThread 
    ? leads.find(l => l.id === selectedThread.leadId)
    : null;

  const threadMessages = selectedThread
    ? messages
        .filter(m => m.threadId === selectedThread.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="grid grid-cols-12 divide-x divide-gray-200 h-[calc(100vh-12rem)]">
          {/* Threads List */}
          <div className="col-span-4 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar conversas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={20} className="text-gray-400" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="flex-1 rounded-md border-gray-300 focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                >
                  <option value="all">Todas</option>
                  <option value="active">Ativas</option>
                  <option value="archived">Arquivadas</option>
                  <option value="resolved">Resolvidas</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredThreads.map(thread => {
                const lead = leads.find(l => l.id === thread.leadId);
                if (!lead) return null;

                return (
                  <button
                    key={thread.id}
                    onClick={() => handleThreadSelect(thread.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 ${
                      selectedThreadId === thread.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-800">{lead.name}</span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(thread.updatedAt), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {thread.lastMessage && (
                      <p className="text-sm text-gray-600 truncate">
                        {thread.lastMessage.content}
                      </p>
                    )}
                    {thread.unreadCount > 0 && (
                      <span className="inline-block px-2 py-1 bg-[#1d528d] text-white text-xs rounded-full mt-2">
                        {thread.unreadCount} nova{thread.unreadCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Area */}
          <div className="col-span-8 flex flex-col">
            {selectedThread && selectedLead ? (
              <>
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">{selectedLead.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail size={14} />
                          {selectedLead.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone size={14} />
                          {selectedLead.phone}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedLead.source === 'chat' && (
                        <button
                          onClick={() => handleAddToCRM(selectedLead)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                        >
                          <UserPlus size={16} />
                          Adicionar ao CRM
                        </button>
                      )}
                      
                      {selectedThread.status === 'active' && (
                        <>
                          <button
                            onClick={() => updateThreadStatus(selectedThread.id, 'archived')}
                            className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                          >
                            <Archive size={16} />
                            Arquivar
                          </button>
                          <button
                            onClick={() => updateThreadStatus(selectedThread.id, 'resolved')}
                            className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                          >
                            <CheckCircle size={16} />
                            Resolver
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {threadMessages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'staff' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.type === 'staff'
                            ? 'bg-[#1d528d] text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {format(new Date(message.timestamp), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                    />
                    <button
                      type="submit"
                      disabled={!message.trim()}
                      className="bg-[#1d528d] text-white p-2 rounded-md hover:bg-[#164070] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Selecione uma conversa para começar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}