import React, { useState, useRef } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { Upload, X, Check, AlertCircle } from 'lucide-react';

interface VideoUploaderProps {
  onClose: () => void;
  onSuccess: (contentId: number) => void;
}

export default function VideoUploader({ onClose, onSuccess }: VideoUploaderProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const { addContent, updateContentUploadStatus } = useDataStore();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setError('');
      } else {
        setError('Por favor, selecione um arquivo de vídeo válido.');
      }
    }
  };

  const handleThumbnailSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setThumbnailFile(file);
        setError('');
      } else {
        setError('Por favor, selecione uma imagem válida para a miniatura.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Por favor, selecione um arquivo de vídeo.');
      return;
    }

    if (!title.trim()) {
      setError('Por favor, insira um título para o vídeo.');
      return;
    }

    try {
      // Criar o conteúdo no store
      const contentId = addContent({
        title,
        description,
        type: 'video',
        category,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        isPublished: false,
        authorId: 1, // TODO: Pegar o ID do usuário atual
      });

      // Simular upload do vídeo
      updateContentUploadStatus(contentId, 'uploading', 0);
      
      // TODO: Implementar o upload real do vídeo para um serviço de storage
      // Por enquanto, vamos simular o progresso
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        updateContentUploadStatus(contentId, 'uploading', progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          updateContentUploadStatus(contentId, 'processing');
          
          // Simular processamento
          setTimeout(() => {
            updateContentUploadStatus(contentId, 'complete');
            onSuccess(contentId);
          }, 2000);
        }
      }, 500);

    } catch (error) {
      setError('Ocorreu um erro ao fazer upload do vídeo. Por favor, tente novamente.');
      console.error('Upload error:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Upload de Vídeo</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Fechar"
              title="Fechar"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleção de Arquivo */}
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  ${selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-[#1d528d]'}`}
                role="button"
                tabIndex={0}
                aria-label="Selecionar arquivo de vídeo"
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <Check size={24} />
                    <span>{selectedFile.name}</span>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <Upload size={32} className="mx-auto mb-2" />
                    <p>Clique ou arraste o vídeo aqui</p>
                    <p className="text-sm">MP4, MOV ou AVI (max. 500MB)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload de vídeo"
                title="Upload de vídeo"
                id="video-upload"
              />
            </div>

            {/* Miniatura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Miniatura do Vídeo (Opcional)
              </label>
              <div
                onClick={() => thumbnailInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
                  ${thumbnailFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-[#1d528d]'}`}
                role="button"
                tabIndex={0}
                aria-label="Selecionar miniatura do vídeo"
              >
                {thumbnailFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <Check size={24} />
                    <span>{thumbnailFile.name}</span>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <p>Clique para selecionar uma miniatura</p>
                    <p className="text-sm">JPG ou PNG (16:9)</p>
                  </div>
                )}
              </div>
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                className="hidden"
                aria-label="Upload de miniatura"
                title="Upload de miniatura"
                id="thumbnail-upload"
              />
            </div>

            {/* Informações do Vídeo */}
            <div>
              <label htmlFor="video-title" className="block text-sm font-medium text-gray-700 mb-2">
                Título *
              </label>
              <input
                id="video-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                placeholder="Digite o título do vídeo"
                required
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="video-description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                id="video-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                placeholder="Digite uma descrição para o vídeo"
                rows={3}
                aria-label="Descrição do vídeo"
              />
            </div>

            <div>
              <label htmlFor="video-category" className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <select
                id="video-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                aria-label="Categoria do vídeo"
              >
                <option value="">Selecione uma categoria</option>
                <option value="class">Aula</option>
                <option value="technique">Técnica</option>
                <option value="theory">Teoria</option>
                <option value="workout">Treino</option>
              </select>
            </div>

            <div>
              <label htmlFor="video-tags" className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                id="video-tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                placeholder="Digite as tags separadas por vírgula"
                aria-label="Tags do vídeo"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md" role="alert">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                aria-label="Cancelar upload"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1d528d] text-white rounded-md hover:bg-[#164070] transition-colors"
                aria-label="Iniciar upload"
              >
                Fazer Upload
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
