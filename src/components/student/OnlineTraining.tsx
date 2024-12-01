import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Play, Video, Image, FileText, Calendar, Clock, Heart, MessageSquare, CheckCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import VideoPlayer from './VideoPlayer';
import LiveClassViewer from './LiveClassViewer';
import VideoUploader from './VideoUploader';
import { OnlineContent, LiveClass } from '../../types';

type Content = OnlineContent | LiveClass;

export default function OnlineTraining() {
  const currentUser = useAuthStore(state => state.user);
  const { onlineContent, liveClasses, students } = useDataStore();
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'videos' | 'favorites'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploader, setShowUploader] = useState(false);

  // Usar currentUser.id diretamente já que é o ID do aluno
  const student = students.find(s => s.id === currentUser?.id);
  if (!student) return null;

  // Verificar se o usuário tem permissão para fazer upload
  const canUpload = currentUser?.role === 'admin' || currentUser?.role === 'instructor';

  // Filter content available for this student
  const availableContent = onlineContent.filter(content => {
    if (!content.isPublished) return false;
    if (content.targetStudentIds?.length && !content.targetStudentIds.includes(student.id)) return false;
    if (content.targetBelts?.length && !content.targetBelts.includes(student.belt)) return false;
    if (content.unitId && content.unitId !== student.unitId) return false;
    return true;
  });

  const availableLiveClasses = liveClasses.filter(liveClass => {
    if (liveClass.status === 'ended') return false;
    if (liveClass.targetStudentIds?.length && !liveClass.targetStudentIds.includes(student.id)) return false;
    if (liveClass.targetBelts?.length && !liveClass.targetBelts.includes(student.belt)) return false;
    if (liveClass.unitId && liveClass.unitId !== student.unitId) return false;
    return true;
  });

  const categories = ['all', 'class', 'technique', 'theory', 'workout'] as const;
  const categoryLabels = {
    all: 'Todos',
    class: 'Aulas',
    technique: 'Técnicas',
    theory: 'Teoria',
    workout: 'Treinos'
  };

  const filteredContent: Content[] = activeTab === 'favorites'
    ? availableContent.filter(content => student.favoriteContent?.includes(content.id))
    : activeTab === 'live'
    ? availableLiveClasses
    : activeTab === 'videos'
    ? availableContent.filter(content => content.type === 'video')
    : [...availableContent, ...availableLiveClasses];

  const finalContent = selectedCategory === 'all'
    ? filteredContent
    : filteredContent.filter(content => content.category === selectedCategory);

  // Filter by search term
  const searchedContent = searchTerm
    ? finalContent.filter(content =>
        content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : finalContent;

  // Sort content by date
  const sortedContent = [...searchedContent].sort((a, b) => {
    const dateA = new Date('scheduledFor' in a ? a.scheduledFor : a.createdAt);
    const dateB = new Date('scheduledFor' in b ? b.scheduledFor : b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  const handleUploadSuccess = (contentId: number) => {
    setShowUploader(false);
    // Você pode adicionar aqui qualquer lógica adicional após o upload bem-sucedido
  };

  const isLiveClass = (content: Content): content is LiveClass => {
    return content.type === 'live';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Buscar conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-96 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
            
            {/* Botão de Upload - só aparece para usuários com permissão */}
            {canUpload && (
              <button
                onClick={() => setShowUploader(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1d528d] text-white rounded-md hover:bg-[#164070] transition-colors"
                aria-label="Fazer upload de vídeo"
              >
                <Plus size={20} />
                <span className="hidden md:inline">Upload</span>
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-md ${
                activeTab === 'all'
                  ? 'bg-[#1d528d] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-2 rounded-md ${
                activeTab === 'live'
                  ? 'bg-[#1d528d] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aulas ao Vivo
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-4 py-2 rounded-md ${
                activeTab === 'videos'
                  ? 'bg-[#1d528d] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Vídeos
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 rounded-md ${
                activeTab === 'favorites'
                  ? 'bg-[#1d528d] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Favoritos
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedCategory === category
                  ? 'bg-[#dfa129] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>
      </div>

      {/* Content Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedContent.map(content => (
          <div
            key={content.id}
            className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Thumbnail */}
            <div
              className="relative aspect-video bg-gray-100 cursor-pointer"
              onClick={() => setSelectedContent(content)}
            >
              {content.thumbnailUrl ? (
                <img
                  src={content.thumbnailUrl}
                  alt={content.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {content.type === 'video' && <Video size={48} className="text-gray-400" />}
                  {content.type === 'live' && <Play size={48} className="text-gray-400" />}
                  {content.type === 'image' && <Image size={48} className="text-gray-400" />}
                  {content.type === 'document' && <FileText size={48} className="text-gray-400" />}
                </div>
              )}

              {/* Live Badge */}
              {isLiveClass(content) && content.status === 'live' && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-sm rounded-md">
                  AO VIVO
                </div>
              )}

              {/* Duration Badge - apenas para aulas ao vivo */}
              {isLiveClass(content) && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black bg-opacity-50 text-white text-sm rounded-md">
                  {Math.floor(content.duration / 60)}:{String(content.duration % 60).padStart(2, '0')}
                </div>
              )}
            </div>

            {/* Content Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 mb-2">{content.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 mb-4">{content.description}</p>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  {isLiveClass(content) ? (
                    <>
                      <Calendar size={16} />
                      <span>
                        {format(new Date(content.scheduledFor), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock size={16} />
                      <span>{format(new Date(content.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {student.completedContent?.includes(content.id) && (
                    <CheckCircle size={16} className="text-green-500" />
                  )}
                  {student.favoriteContent?.includes(content.id) && (
                    <Heart size={16} className="text-red-500" />
                  )}
                </div>
              </div>

              {/* Tags */}
              {content.tags && content.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {content.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sortedContent.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nenhum conteúdo encontrado.
          </div>
        )}
      </div>

      {/* Content Viewer Modal */}
      {selectedContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {isLiveClass(selectedContent) ? (
              <LiveClassViewer
                liveClass={selectedContent}
                student={student}
                onClose={() => setSelectedContent(null)}
              />
            ) : (
              <VideoPlayer
                content={selectedContent}
                student={student}
                onClose={() => setSelectedContent(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Video Uploader Modal */}
      {showUploader && canUpload && (
        <VideoUploader
          onClose={() => setShowUploader(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
