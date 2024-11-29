import React, { useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { X, Users, MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function LiveClassViewer({ liveClass, student, onClose }) {
  const [comment, setComment] = useState('');
  const { joinLiveClass, leaveLiveClass, addContentComment, contentEngagements, students } = useDataStore();

  useEffect(() => {
    joinLiveClass(liveClass.id, student.id);
    return () => leaveLiveClass(liveClass.id, student.id);
  }, []);

  const handleComment = () => {
    if (!comment.trim()) return;
    addContentComment(liveClass.id, student.id, comment);
    setComment('');
  };

  // Get comments for this live class
  const comments = contentEngagements
    .filter(e => e.contentId === liveClass.id && e.type === 'comment')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex flex-col h-full">
      {/* Video Section */}
      <div className="relative bg-black">
        <iframe
          src={liveClass.meetingUrl}
          className="w-full aspect-video"
          allow="camera; microphone; fullscreen"
        />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Live Class Info */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{liveClass.title}</h2>
            <p className="text-gray-600">{liveClass.description}</p>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <Users size={20} />
            <span>{liveClass.currentParticipants || 0}</span>
          </div>
        </div>

        {/* Chat Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-800 mb-4">Chat ao Vivo</h3>
          
          {/* Chat Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Envie uma mensagem..."
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
            <button
              onClick={handleComment}
              className="bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
            >
              <Send size={20} />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="space-y-4">
            {comments.map(comment => {
              const commentStudent = students.find(s => s.id === comment.studentId);
              return (
                <div key={comment.id} className="flex gap-4">
                  {commentStudent?.photo ? (
                    <img
                      src={commentStudent.photo}
                      alt={commentStudent.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {commentStudent?.name || 'Usuário'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {format(new Date(comment.timestamp), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-gray-600">{comment.comment}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}