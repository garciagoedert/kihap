import React, { useState, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { Bell, LogOut, Upload, X, User, DollarSign, Video, Award, Dumbbell, ShoppingBag, Calendar } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import NotificationList from '../NotificationList';
import MainHeader from '../MainHeader';
import Footer from '../Footer';
import ContractPurchase from './ContractPurchase';
import OnlineTraining from './OnlineTraining';
import StudentBadges from './StudentBadges';
import PhysicalTests from './PhysicalTests';
import StoreWrapper from '../store/StoreWrapper';
import EventCheckin from './EventCheckin';

type TabType = 'profile' | 'online' | 'badges' | 'physical' | 'store' | 'checkin';

export default function StudentPortal() {
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const { students, updateStudent, notifications } = useDataStore();
  const [error, setError] = useState<string | null>(null);
  const [showContractPurchase, setShowContractPurchase] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If not logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // If not a student, redirect to home
  if (currentUser.role !== 'student') {
    return <Navigate to="/" />;
  }

  const student = students.find(s => s.id === currentUser.id);

  // If student not found, logout and redirect
  if (!student) {
    logout();
    return <Navigate to="/" />;
  }

  // Filter notifications for this student
  const studentNotifications = notifications
    .filter(n => 
      n.userId === student.id || 
      (student.unitId && n.userId === student.unitId)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('A foto deve ter no máximo 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (student) {
          updateStudent({
            ...student,
            photo: reader.result as string
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    if (student) {
      updateStudent({
        ...student,
        photo: ''
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      
      {/* Student Header */}
      <div className="bg-[#1d528d] py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="bg-[#164070] rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {student.photo ? (
                    <img
                      src={student.photo}
                      alt={student.name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-white"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center border-4 border-white">
                      <User size={32} className="text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 flex gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-white text-[#1d528d] rounded-full hover:bg-gray-100 transition-colors shadow-md"
                      title="Alterar foto"
                      aria-label="Alterar foto"
                    >
                      <Upload size={14} />
                    </button>
                    {student.photo && (
                      <button
                        onClick={handleRemovePhoto}
                        className="p-1.5 bg-white text-red-500 rounded-full hover:bg-gray-100 transition-colors shadow-md"
                        title="Remover foto"
                        aria-label="Remover foto"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    aria-label="Upload de foto"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{student.name}</h1>
                  <p className="text-gray-200">{student.belt}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white text-[#1d528d] rounded-md hover:bg-gray-100 transition-colors shadow-md"
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-2 font-medium ${
                activeTab === 'profile'
                  ? 'text-[#1d528d] border-b-2 border-[#1d528d]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User size={20} />
              Perfil
            </button>
            <button
              onClick={() => setActiveTab('online')}
              className={`flex items-center gap-2 px-4 py-2 font-medium ${
                activeTab === 'online'
                  ? 'text-[#1d528d] border-b-2 border-[#1d528d]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Video size={20} />
              Tatame Online
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`flex items-center gap-2 px-4 py-2 font-medium ${
                activeTab === 'badges'
                  ? 'text-[#1d528d] border-b-2 border-[#1d528d]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Award size={20} />
              Conquistas
            </button>
            <button
              onClick={() => setActiveTab('physical')}
              className={`flex items-center gap-2 px-4 py-2 font-medium ${
                activeTab === 'physical'
                  ? 'text-[#1d528d] border-b-2 border-[#1d528d]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Dumbbell size={20} />
              Teste Físico
            </button>
            <button
              onClick={() => setActiveTab('store')}
              className={`flex items-center gap-2 px-4 py-2 font-medium ${
                activeTab === 'store'
                  ? 'text-[#1d528d] border-b-2 border-[#1d528d]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingBag size={20} />
              KIHAP STORE
            </button>
            <button
              onClick={() => setActiveTab('checkin')}
              className={`flex items-center gap-2 px-4 py-2 font-medium ${
                activeTab === 'checkin'
                  ? 'text-[#1d528d] border-b-2 border-[#1d528d]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar size={20} />
              Eventos KIHAP
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-red-50 text-red-600 p-4 rounded-md">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      {activeTab === 'profile' && (
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Student Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Informações do Aluno</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Dados Pessoais</h3>
                  <div className="space-y-2 text-gray-600">
                    <p><strong>Email:</strong> {student.email}</p>
                    <p><strong>Telefone:</strong> {student.phone}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Informações de Treino</h3>
                  <div className="space-y-2 text-gray-600">
                    <p><strong>Graduação:</strong> {student.belt}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Informações do Contrato</h2>
                {(!student.contract || student.contract.status !== 'active') && (
                  <button
                    onClick={() => setShowContractPurchase(true)}
                    className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
                  >
                    <DollarSign size={20} />
                    Contratar Plano
                  </button>
                )}
              </div>
              {student.contract && student.contract.status === 'active' ? (
                <div className="space-y-2 text-gray-600">
                  <p><strong>Status:</strong> <span className="text-green-600">Ativo</span></p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Você ainda não possui um contrato ativo.</p>
                  <p className="text-sm mt-2">Clique em "Contratar Plano" para ver as opções disponíveis.</p>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="text-[#1d528d]" size={24} />
                <h2 className="text-xl font-bold text-gray-800">Notificações</h2>
              </div>
              <div className="max-h-[400px] overflow-y-auto pr-2">
                <NotificationList notifications={studentNotifications} />
              </div>
            </div>
          </div>
        </main>
      )}

      {activeTab === 'online' && <OnlineTraining />}
      {activeTab === 'badges' && <StudentBadges student={student} />}
      {activeTab === 'physical' && <PhysicalTests student={student} />}
      {activeTab === 'store' && <StoreWrapper student={student} />}
      {activeTab === 'checkin' && <EventCheckin />}

      {/* Contract Purchase Modal */}
      {showContractPurchase && (
        <ContractPurchase
          student={student}
          onClose={() => setShowContractPurchase(false)}
          onSuccess={() => {
            // Refresh the page or update the UI as needed
          }}
        />
      )}

      <Footer />
    </div>
  );
}
