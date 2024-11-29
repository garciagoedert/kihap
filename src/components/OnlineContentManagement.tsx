import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Video, 
  Calendar, 
  Image as ImageIcon, 
  FileText, 
  Eye, 
  EyeOff,
  Users,
  Search,
  LayoutGrid,
  List
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OnlineContent } from '../types';
import ContentForm from './ContentForm';

export default function OnlineContentManagement() {
  const currentUser = useAuthStore(state => state.user);
  const { onlineContent, units, addContent, updateContent, deleteContent } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingContent, setEditingContent] = useState<OnlineContent | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | 'all'>(
    currentUser?.unitId || 'all'
  );
  const [selectedType, setSelectedType] = useState<'all' | 'video' | 'live' | 'image' | 'document'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('feed');

  // Filter content based on selections
  const filteredContent = onlineContent.filter(content => {
    if (selectedUnitId !== 'all' && content.unitId !== selectedUnitId) return false;
    if (selectedType !== 'all' && content.type !== selectedType) return false;
    if (selectedCategory !== 'all' && content.category !== selectedCategory) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        content.title.toLowerCase().includes(searchLower) ||
        content.description.toLowerCase().includes(searchLower) ||
        content.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  // Sort content by date
  const sortedContent = [...filteredContent].sort((a, b) => {
    const dateA = new Date(a.type === 'live' ? a.scheduledFor : a.createdAt);
    const dateB = new Date(b.type === 'live' ? b.scheduledFor : b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  const handleDelete = (contentId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este conteúdo?')) {
      deleteContent(contentId);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tatame Online</h2>
          <p className="text-gray-600">Gerencie o conteúdo online para seus alunos</p>
        </div>
        <button
          onClick={() => {
            setEditingContent(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
        >
          <Plus size={20} />
          Novo Conteúdo
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="w-full md:w-96 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
          </div>

          <div className="flex items-center gap-4">
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            >
              <option value="all">Todas as Unidades</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${
                  viewMode === 'grid'
                    ? 'bg-white shadow text-[#1d528d]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode('feed')}
                className={`p-2 rounded ${
                  viewMode === 'feed'
                    ? 'bg-white shadow text-[#1d528d]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-4 py-2 rounded-md ${
              selectedType === 'all'
                ? 'bg-[#1d528d] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setSelectedType('video')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              selectedType === 'video'
                ? 'bg-[#1d528d] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Video size={18} />
            Vídeos
          </button>
          <button
            onClick={() => setSelectedType('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              selectedType === 'live'
                ? 'bg-[#1d528d] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calendar size={18} />
            Aulas ao Vivo
          </button>
          <button
            onClick={() => setSelectedType('image')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              selectedType === 'image'
                ? 'bg-[#1d528d] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ImageIcon size={18} />
            Imagens
          </button>
          <button
            onClick={() => setSelectedType('document')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              selectedType === 'document'
                ? 'bg-[#1d528d] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText size={18} />
            Documentos
          </button>
        </div>
      </div>

      {/* Content List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedContent.map(content => (
            <div
              key={content.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-100 relative">
                {content.thumbnailUrl ? (
                  <img
                    src={content.thumbnailUrl}
                    alt={content.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {content.type === 'video' && <Video size={48} className="text-gray-400" />}
                    {content.type === 'live' && <Calendar size={48} className="text-gray-400" />}
                    {content.type === 'image' && <ImageIcon size={48} className="text-gray-400" />}
                    {content.type === 'document' && <FileText size={48} className="text-gray-400" />}
                  </div>
                )}

                {/* Publication Status */}
                <div className="absolute top-2 right-2">
                  {content.isPublished ? (
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm flex items-center gap-1">
                      <Eye size={14} />
                      Publicado
                    </div>
                  ) : (
                    <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm flex items-center gap-1">
                      <EyeOff size={14} />
                      Rascunho
                    </div>
                  )}
                </div>
              </div>

              {/* Content Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-2">{content.title}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{content.description}</p>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>
                      {format(new Date(content.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingContent(content);
                        setShowForm(true);
                      }}
                      className="p-1 text-gray-400 hover:text-[#1d528d]"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(content.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Target Info */}
                {(content.targetBelts?.length > 0 || content.targetStudentIds?.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Users size={16} />
                      <span>
                        {content.targetBelts?.length
                          ? `${content.targetBelts.length} faixa${content.targetBelts.length !== 1 ? 's' : ''}`
                          : `${content.targetStudentIds?.length} aluno${content.targetStudentIds?.length !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md divide-y">
          {sortedContent.map(content => (
            <div key={content.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-40 h-24 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                    {content.thumbnailUrl ? (
                      <img
                        src={content.thumbnailUrl}
                        alt={content.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {content.type === 'video' && <Video size={32} className="text-gray-400" />}
                        {content.type === 'live' && <Calendar size={32} className="text-gray-400" />}
                        {content.type === 'image' && <ImageIcon size={32} className="text-gray-400" />}
                        {content.type === 'document' && <FileText size={32} className="text-gray-400" />}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 mb-1">{content.title}</h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{content.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {format(new Date(content.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      
                      {content.targetBelts?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {content.targetBelts.length} faixa{content.targetBelts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 ml-4">
                  {content.isPublished ? (
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm flex items-center gap-1">
                      <Eye size={14} />
                      Publicado
                    </div>
                  ) : (
                    <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm flex items-center gap-1">
                      <EyeOff size={14} />
                      Rascunho
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setEditingContent(content);
                      setShowForm(true);
                    }}
                    className="p-1 text-gray-400 hover:text-[#1d528d]"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(content.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {sortedContent.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhum conteúdo encontrado.
            </div>
          )}
        </div>
      )}

      {/* Content Form Modal */}
      {showForm && (
        <ContentForm
          content={editingContent}
          onClose={() => {
            setShowForm(false);
            setEditingContent(null);
          }}
          onSubmit={(contentData) => {
            if (editingContent) {
              updateContent({ ...contentData, id: editingContent.id });
            } else {
              addContent(contentData);
            }
            setShowForm(false);
            setEditingContent(null);
          }}
        />
      )}
    </div>
  );
}