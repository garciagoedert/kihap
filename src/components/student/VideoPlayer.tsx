import React, { useState, useRef, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { X, Heart, MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OnlineContent, Student } from '../../types';

interface VideoPlayerProps {
  content: OnlineContent;
  student: Student;
  onClose: () => void;
}

export default function VideoPlayer({ content, student, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  
  const {
    trackContentProgress,
    markContentComplete,
    toggleContentFavorite,
    addContentComment,
    contentEngagements,
    students
  } = useDataStore();

  // Função para extrair o ID do vídeo do YouTube da URL
  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Load saved progress
  useEffect(() => {
    if (!content.youtubeUrl) {
      const savedProgress = student.contentProgress?.[content.id] || 0;
      if (videoRef.current && savedProgress > 0) {
        videoRef.current.currentTime = savedProgress;
      }
    }
  }, []);

  // Track progress
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const progress = Math.floor(videoRef.current.currentTime);
    setCurrentTime(progress);
    
    // Save progress every 5 seconds
    if (progress % 5 === 0) {
      trackContentProgress(content.id, student.id, progress);
    }
  };

  const handleComment = () => {
    if (!comment.trim()) return;
    addContentComment(content.id, student.id, comment);
    setComment('');
  };

  // Get comments for this content
  const comments = contentEngagements
    .filter(e => e.contentId === content.id && e.type === 'comment')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex flex-col h-full">
      {/* Video Section */}
      <div className="relative bg-black">
        {content.youtubeUrl ? (
          <div className="aspect-video w-full">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${getYouTubeVideoId(content.youtubeUrl)}?autoplay=0`}
              title={content.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={content.url}
            className="w-full aspect-video"
            controls
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 transition-colors"
          title="Fechar vídeo"
          aria-label="Fechar vídeo"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content Info */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{content.title}</h2>
            <p className="text-gray-600">{content.description}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => toggleContentFavorite(content.id, student.id)}
              className={`p-2 rounded-full ${
                student.favoriteContent?.includes(content.id)
                  ? 'text-red-500 bg-red-50'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title={student.favoriteContent?.includes(content.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              aria-label={student.favoriteContent?.includes(content.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Heart size={24} />
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className={`p-2 rounded-full ${
                showComments
                  ? 'text-[#1d528d] bg-blue-50'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title={showComments ? "Ocultar comentários" : "Mostrar comentários"}
              aria-label={showComments ? "Ocultar comentários" : "Mostrar comentários"}
            >
              <MessageSquare size={24} />
            </button>
          </div>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-4">Comentários</h3>
            
            {/* Comment Input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Adicione um comentário..."
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
              <button
                onClick={handleComment}
                className="bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
                title="Enviar comentário"
                aria-label="Enviar comentário"
              >
                <Send size={20} />
              </button>
            </div>

            {/* Comments List */}
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
                          {format(new Date(comment.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-gray-600">{comment.comment}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
