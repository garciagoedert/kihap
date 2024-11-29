import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useDataStore } from '../../store/useDataStore';
import { MessageSquare, Send, X } from 'lucide-react';

export default function LeadChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [leadInfo, setLeadInfo] = useState({ name: '', email: '', phone: '' });
  const [showForm, setShowForm] = useState(true);
  const [threadId, setThreadId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, createThread, sendMessage } = useChatStore();
  const { addLead } = useDataStore();

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create lead specifically for chat
    const lead = {
      name: leadInfo.name,
      email: leadInfo.email,
      phone: leadInfo.phone,
      source: 'chat', // Mark as chat lead
      value: 0,
      status: 'novo' as const
    };
    
    // Add lead and get the ID
    const leadId = await addLead(lead);
    
    // Create chat thread
    const newThreadId = createThread(leadId);
    setThreadId(newThreadId);
    
    // Send initial message
    sendMessage({
      threadId: newThreadId,
      senderId: `lead_${leadId}`,
      receiverId: 'staff',
      content: 'Olá! Gostaria de mais informações sobre as aulas.',
      type: 'lead',
      read: false
    });
    
    setShowForm(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !threadId) return;

    sendMessage({
      threadId,
      senderId: `lead_${threadId}`,
      receiverId: 'staff',
      content: message.trim(),
      type: 'lead',
      read: false
    });

    setMessage('');
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get messages for this thread
  const threadMessages = threadId 
    ? messages.filter(m => m.threadId === threadId)
    : [];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#25D366] text-white p-3 rounded-full shadow-lg hover:bg-[#1faa52] transition-colors"
        title="Abrir chat"
        aria-label="Abrir chat"
      >
        <MessageSquare size={24} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-96 bg-white rounded-lg shadow-xl">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Chat</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              title="Fechar chat"
              aria-label="Fechar chat"
            >
              <X size={20} />
            </button>
          </div>

          {showForm ? (
            <form onSubmit={handleStartChat} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={leadInfo.name}
                  onChange={(e) => setLeadInfo({ ...leadInfo, name: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                  required
                  placeholder="Digite seu nome"
                  title="Campo para digitar seu nome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={leadInfo.email}
                  onChange={(e) => setLeadInfo({ ...leadInfo, email: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                  required
                  placeholder="Digite seu email"
                  title="Campo para digitar seu email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={leadInfo.phone}
                  onChange={(e) => setLeadInfo({ ...leadInfo, phone: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                  required
                  placeholder="Digite seu telefone"
                  title="Campo para digitar seu telefone"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#25D366] text-white px-4 py-2 rounded-md hover:bg-[#1faa52] transition-colors"
              >
                Iniciar Chat
              </button>
            </form>
          ) : (
            <>
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {threadMessages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'lead' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        message.type === 'lead'
                          ? 'bg-[#25D366] text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim()}
                    className="bg-[#25D366] text-white p-2 rounded-md hover:bg-[#1faa52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Enviar mensagem"
                    aria-label="Enviar mensagem"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
