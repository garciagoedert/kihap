import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { MessageSquare, Send, X, Bell } from 'lucide-react';
import { format } from 'date-fns';

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore(state => state.user);
  const { users, messages, sendMessage, markMessageAsRead } = useDataStore();
  const lastMessageCountRef = useRef(messages.length);

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  const currentChat = messages.filter(m => 
    (m.senderId === currentUser?.id && m.receiverId === selectedUser?.id) ||
    (m.senderId === selectedUser?.id && m.receiverId === currentUser?.id)
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const unreadMessages = messages.filter(m => 
    m.receiverId === currentUser?.id && !m.read
  );

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChat]);

  useEffect(() => {
    if (selectedUser) {
      const unreadFromSelectedUser = unreadMessages.filter(m => m.senderId === selectedUser.id);
      unreadFromSelectedUser.forEach(m => markMessageAsRead(m.id));
    }
  }, [selectedUser, unreadMessages]);

  // Check for new messages and show notification
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      const hasNewMessageForMe = newMessages.some(m => 
        m.receiverId === currentUser?.id && !m.read
      );

      if (hasNewMessageForMe && !isOpen) {
        setShowNotification(true);
        // Optional: Play notification sound
        new Audio('/notification.mp3').play().catch(() => {
          // Ignore audio play errors
        });
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, currentUser, isOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && selectedUser) {
      sendMessage({
        senderId: currentUser!.id,
        receiverId: selectedUser.id,
        content: message.trim(),
        timestamp: new Date().toISOString(),
        read: false,
      });
      setMessage('');
    }
  };

  const handleOpenChat = () => {
    setIsOpen(true);
    setShowNotification(false);
  };

  if (!currentUser) return null;

  return (
    <div className="fixed bottom-4 right-4">
      {/* Chat Button */}
      <button
        onClick={handleOpenChat}
        className="bg-[#1d528d] text-white p-3 rounded-full shadow-lg hover:bg-[#164070] transition-colors relative"
      >
        <MessageSquare size={24} />
        {(unreadMessages.length > 0 || showNotification) && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
            {unreadMessages.length}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-96 bg-white rounded-lg shadow-xl">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Chat</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="h-96 flex">
            {/* Users List */}
            <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
              {otherUsers.map(user => {
                const unreadCount = unreadMessages.filter(m => m.senderId === user.id).length;
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between ${
                      selectedUser?.id === user.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <span className="truncate text-sm">{user.name}</span>
                    {unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Chat Area */}
            <div className="w-2/3 flex flex-col">
              {selectedUser ? (
                <>
                  <div className="p-3 border-b border-gray-200">
                    <h4 className="font-medium">{selectedUser.name}</h4>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {currentChat.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            msg.senderId === currentUser.id
                              ? 'bg-[#1d528d] text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {format(new Date(msg.timestamp), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200">
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
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  Selecione um usuário para conversar
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}