import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { useStoreStore } from '../store/useStoreStore';
import { Eye, EyeOff, Save, User, Upload, X, ShoppingBag } from 'lucide-react';

export default function UserProfile() {
  const currentUser = useAuthStore(state => state.user);
  const { units, students } = useDataStore();
  const { stores } = useStoreStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    password: '',
    currentPassword: '',
    photo: currentUser?.photo || ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('A foto deve ter no máximo 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          photo: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({
      ...prev,
      photo: ''
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (formData.password && !formData.currentPassword) {
      setError('Digite sua senha atual para confirmar as alterações');
      return;
    }

    try {
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          name: formData.name,
          email: formData.email,
          photo: formData.photo,
          ...(formData.password ? { password: formData.password } : {})
        };

        // updateUser(updatedUser);
        setSuccess('Perfil atualizado com sucesso!');
        setIsEditing(false);

        // Reset password fields
        setFormData(prev => ({
          ...prev,
          password: '',
          currentPassword: ''
        }));
      }
    } catch (err) {
      setError('Erro ao atualizar o perfil. Tente novamente.');
    }
  };

  if (!currentUser) return null;

  const userUnit = units.find(u => u.id === currentUser.unitId);
  const currentStudent = students.find(s => s.id === currentUser.id);
  const userStore = currentStudent ? stores.find(s => s.id === currentStudent.storeId) : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">Meu Perfil</h1>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-[#1d528d] text-white rounded-md hover:bg-[#164070] transition-colors"
              >
                Editar Perfil
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 text-green-600 rounded-md">
              {success}
            </div>
          )}

          <div className="space-y-6">
            {/* Profile Photo */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt={`Foto de perfil de ${formData.name}`}
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <User size={48} className="text-gray-400" />
                  </div>
                )}
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-[#1d528d] text-white rounded-full hover:bg-[#164070] transition-colors"
                      title="Carregar nova foto"
                      aria-label="Carregar nova foto"
                    >
                      <Upload size={16} />
                    </button>
                    {formData.photo && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        title="Remover foto"
                        aria-label="Remover foto"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isEditing && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  aria-label="Selecionar foto de perfil"
                  title="Selecionar foto de perfil"
                />
              )}
            </div>

            {/* User Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Função
                </label>
                <div className="p-3 bg-gray-50 rounded-md">
                  <span className="capitalize">{currentUser.role}</span>
                </div>
              </div>

              {userUnit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidade
                  </label>
                  <div className="p-3 bg-gray-50 rounded-md">
                    {userUnit.name}
                  </div>
                </div>
              )}

              {currentUser.role === 'student' && userStore && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    KIHAP Store
                  </label>
                  <div className="p-4 bg-gray-50 rounded-md flex items-center justify-between">
                    <span>{userStore.name}</span>
                    <Link
                      to={`/store/${userStore.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#dfa129] text-white rounded-md hover:bg-opacity-90 transition-colors"
                    >
                      <ShoppingBag size={20} />
                      Acessar Store
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  {isEditing ? (
                    <input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                      required
                      placeholder="Seu nome completo"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md">
                      {formData.name}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  {isEditing ? (
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                      required
                      placeholder="seu.email@exemplo.com"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md">
                      {formData.email}
                    </div>
                  )}
                </div>
              </div>

              {isEditing && (
                <>
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Alterar Senha
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                          Nova Senha
                        </label>
                        <div className="relative">
                          <input
                            id="new-password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                            minLength={6}
                            placeholder="Digite sua nova senha"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                          Senha Atual
                        </label>
                        <input
                          id="current-password"
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                          placeholder="Digite sua senha atual"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          name: currentUser.name,
                          email: currentUser.email,
                          password: '',
                          currentPassword: '',
                          photo: currentUser.photo || ''
                        });
                        setError(null);
                        setSuccess(null);
                      }}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#1d528d] text-white rounded-md hover:bg-[#164070] transition-colors flex items-center gap-2"
                    >
                      <Save size={20} />
                      Salvar Alterações
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
