import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { X, Upload, Plus, FileText, Video, Image as ImageIcon } from 'lucide-react';
import { OnlineContent } from '../types';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface ContentFormProps {
  content?: OnlineContent | null;
  onClose: () => void;
  onSubmit: (data: Omit<OnlineContent, 'id' | 'createdAt'>) => void;
}

export default function ContentForm({ content, onClose, onSubmit }: ContentFormProps) {
  const currentUser = useAuthStore(state => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: content?.title || '',
    description: content?.description || '',
    type: content?.type || 'video',
    url: content?.url || '',
    thumbnailUrl: content?.thumbnailUrl || '',
    youtubeUrl: content?.youtubeUrl || '',
    category: content?.category || 'class',
    tags: content?.tags || [],
    targetBelts: content?.targetBelts || [],
    targetStudentIds: content?.targetStudentIds || [],
    unitId: content?.unitId || currentUser?.unitId,
    isPublished: content?.isPublished ?? false,
    uploadStatus: content?.uploadStatus || 'pending',
    uploadProgress: content?.uploadProgress || 0,
    authorId: content?.authorId || currentUser?.id || 0,
    updatedAt: new Date().toISOString()
  });

  // Função para extrair o ID do vídeo do YouTube da URL
  const getYouTubeVideoId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Atualiza a thumbnail automaticamente quando uma URL do YouTube é inserida
  useEffect(() => {
    if (formData.youtubeUrl) {
      const videoId = getYouTubeVideoId(formData.youtubeUrl);
      if (videoId) {
        // Usa a thumbnail de alta qualidade do YouTube
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        setFormData(prev => ({
          ...prev,
          thumbnailUrl: thumbnailUrl
        }));
      }
    }
  }, [formData.youtubeUrl]);

  // Inicializa o formulário com os dados do conteúdo quando em modo de edição
  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title,
        description: content.description,
        type: content.type,
        url: content.url || '',
        thumbnailUrl: content.thumbnailUrl || '',
        youtubeUrl: content.youtubeUrl || '',
        category: content.category || 'class',
        tags: content.tags || [],
        targetBelts: content.targetBelts || [],
        targetStudentIds: content.targetStudentIds || [],
        unitId: content.unitId || currentUser?.unitId,
        isPublished: content.isPublished,
        uploadStatus: content.uploadStatus || 'pending',
        uploadProgress: content.uploadProgress || 0,
        authorId: content.authorId || currentUser?.id || 0,
        updatedAt: new Date().toISOString()
      });
    }
  }, [content]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const fileType = file.type.split('/')[0];
    const extension = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${fileType}/${timestamp}-${file.name}`;
    const storageRef = ref(storage, fileName);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
        setFormData(prev => ({
          ...prev,
          uploadProgress: progress,
          uploadStatus: 'uploading'
        }));
      },
      (error) => {
        console.error('Upload error:', error);
        setFormData(prev => ({
          ...prev,
          uploadStatus: 'error'
        }));
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setFormData(prev => ({
          ...prev,
          url: downloadURL,
          uploadStatus: 'complete',
          type: fileType === 'video' ? 'video' : fileType === 'image' ? 'image' : 'document',
          fileName: file.name,
          fileSize: file.size
        }));
        setIsUploading(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {content ? 'Editar Conteúdo' : 'Novo Conteúdo'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              title="Fechar formulário"
              aria-label="Fechar formulário"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
              Título
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
              aria-label="Título do conteúdo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
              Descrição
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
              aria-label="Descrição do conteúdo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="contentType">
                Tipo de Conteúdo
              </label>
              <select
                id="contentType"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as OnlineContent['type'] })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                required
                aria-label="Tipo de conteúdo"
              >
                <option value="video">Vídeo</option>
                <option value="image">Imagem</option>
                <option value="document">Documento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="category">
                Categoria
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                required
                aria-label="Categoria do conteúdo"
              >
                <option value="class">Aula</option>
                <option value="technique">Técnica</option>
                <option value="theory">Teoria</option>
                <option value="workout">Treino</option>
              </select>
            </div>
          </div>

          {formData.type === 'video' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="youtubeUrl">
                URL do YouTube
              </label>
              <input
                id="youtubeUrl"
                type="url"
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                placeholder="https://www.youtube.com/watch?v=..."
                aria-label="URL do vídeo do YouTube"
              />
            </div>
          )}

          {/* File Upload Section */}
          {!formData.youtubeUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload de Arquivo
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {isUploading ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">Fazendo upload... {uploadProgress.toFixed(0)}%</div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-[#1d528d] h-2.5 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : formData.url ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center text-[#1d528d]">
                        {formData.type === 'video' && <Video size={40} />}
                        {formData.type === 'image' && <ImageIcon size={40} />}
                        {formData.type === 'document' && <FileText size={40} />}
                      </div>
                      <div className="text-sm text-gray-600">Arquivo carregado com sucesso!</div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            url: '',
                            uploadStatus: 'pending',
                            uploadProgress: 0
                          }));
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
                        title="Remover arquivo"
                        aria-label="Remover arquivo"
                      >
                        Remover arquivo
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md font-medium text-[#1d528d] hover:text-[#164070] focus-within:outline-none"
                        >
                          <span>Faça upload de um arquivo</span>
                          <input
                            ref={fileInputRef}
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            accept={formData.type === 'video' ? 'video/*' : formData.type === 'image' ? 'image/*' : '.pdf'}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file);
                              }
                            }}
                            aria-label="Upload de arquivo"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formData.type === 'video' && 'MP4, WebM até 500MB'}
                        {formData.type === 'image' && 'PNG, JPG, GIF até 10MB'}
                        {formData.type === 'document' && 'PDF até 50MB'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="thumbnail">
              URL da Thumbnail
            </label>
            <input
              id="thumbnail"
              type="url"
              value={formData.thumbnailUrl}
              onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              aria-label="URL da thumbnail"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      tags: formData.tags.filter((_, i) => i !== index)
                    })}
                    className="text-gray-500 hover:text-red-500"
                    title={`Remover tag ${tag}`}
                    aria-label={`Remover tag ${tag}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => {
                  const tag = prompt('Digite uma nova tag:');
                  if (tag && !formData.tags.includes(tag)) {
                    setFormData({
                      ...formData,
                      tags: [...formData.tags, tag]
                    });
                  }
                }}
                className="px-2 py-1 border border-gray-300 text-gray-600 rounded-full text-sm hover:bg-gray-50 flex items-center gap-1"
                title="Adicionar nova tag"
                aria-label="Adicionar nova tag"
              >
                <Plus size={14} />
                Adicionar Tag
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Faixas Alvo
            </label>
            <div className="space-y-2">
              {[
                'Branca recomendada',
                'Branca decidida',
                'Laranja recomendada',
                'Laranja decidida',
                'Amarela recomendada',
                'Amarela decidida',
                'Verde recomendada',
                'Verde decidida',
                'Roxa recomendada',
                'Roxa decidida',
                'Marrom recomendada',
                'Marrom decidida',
                'Vermelha recomendada',
                'Vermelha decidida',
                'Preta'
              ].map(belt => (
                <label key={belt} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.targetBelts.includes(belt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          targetBelts: [...formData.targetBelts, belt]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          targetBelts: formData.targetBelts.filter(b => b !== belt)
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                    aria-label={`Faixa ${belt}`}
                  />
                  <span className="ml-2 text-sm text-gray-700">{belt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isPublished}
              onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
              className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
              id="isPublished"
              aria-label="Publicar conteúdo"
            />
            <label htmlFor="isPublished" className="ml-2 text-sm text-gray-700">
              Publicar Conteúdo
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              title="Cancelar"
              aria-label="Cancelar"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className={`px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md ${
                isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#164070]'
              }`}
              title={content ? 'Salvar alterações' : 'Criar conteúdo'}
              aria-label={content ? 'Salvar alterações' : 'Criar conteúdo'}
            >
              {content ? 'Salvar Alterações' : 'Criar Conteúdo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
