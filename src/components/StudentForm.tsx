import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Student } from '../types';
import { Save, X, User, Upload, FileDown, Bell } from 'lucide-react';
import CertificateGenerator from './CertificateGenerator';
import NotificationForm from './NotificationForm';
import PaymentLinkGenerator from './PaymentLinkGenerator';

interface StudentFormProps {
  student?: Student | null;
  onSubmit: (student: Omit<Student, 'id'>) => void;
  onClose: () => void;
}

export default function StudentForm({ student, onSubmit, onClose }: StudentFormProps) {
  const [showCertificateGenerator, setShowCertificateGenerator] = useState(false);
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const [formData, setFormData] = useState({
    name: student?.name || '',
    email: student?.email || '',
    phone: student?.phone || '',
    birthDate: student?.birthDate || '',
    cpf: student?.cpf || '',
    belt: student?.belt || 'Branca recomendada',
    trainingDays: student?.trainingDays || [],
    trainingSchedule: student?.trainingSchedule || '',
    emergencyContact: student?.emergencyContact || '',
    emergencyPhone: student?.emergencyPhone || '',
    photo: student?.photo || '',
    // Campos obrigatórios adicionados
    age: student?.age || 0,
    registrationDate: student?.registrationDate || new Date().toISOString(),
    lastAttendance: student?.lastAttendance || new Date().toISOString(),
    unitId: student?.unitId || 1,
    active: student?.active ?? true
  });
  const [error, setError] = useState<string | null>(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Calcula a idade baseada na data de nascimento
    const birthDate = new Date(formData.birthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    onSubmit({
      ...formData,
      age
    });
  };

  const handleTrainingDayChange = (day: string) => {
    setFormData(prev => ({
      ...prev,
      trainingDays: prev.trainingDays.includes(day)
        ? prev.trainingDays.filter(d => d !== day)
        : [...prev.trainingDays, day]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              {student ? 'Editar Aluno' : 'Novo Aluno'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md">
              {error}
            </div>
          )}

          {/* Photo Section */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Foto</h3>
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt={`Foto de ${formData.name}`}
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <User size={48} className="text-gray-400" />
                  </div>
                )}
                <div className="absolute bottom-0 right-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-[#1d528d] text-white rounded-full hover:bg-[#164070] transition-colors"
                    title="Fazer upload de foto"
                    aria-label="Fazer upload de foto"
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
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                title="Upload de foto"
                aria-label="Upload de foto"
              />
            </div>
          </section>

          {/* Basic Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Nome completo do aluno"
                  aria-label="Nome completo do aluno"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  title="Email do aluno"
                  aria-label="Email do aluno"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Telefone do aluno"
                  aria-label="Telefone do aluno"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Data de nascimento do aluno"
                  aria-label="Data de nascimento do aluno"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF *
                </label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="CPF do aluno"
                  aria-label="CPF do aluno"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faixa *
                </label>
                <select
                  value={formData.belt}
                  onChange={(e) => setFormData({ ...formData, belt: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Faixa do aluno"
                  aria-label="Faixa do aluno"
                >
                  <option value="Branca recomendada">Branca recomendada</option>
                  <option value="Branca decidida">Branca decidida</option>
                  <option value="Laranja recomendada">Laranja recomendada</option>
                  <option value="Laranja decidida">Laranja decidida</option>
                  <option value="Amarela recomendada">Amarela recomendada</option>
                  <option value="Amarela decidida">Amarela decidida</option>
                  <option value="Verde recomendada">Verde recomendada</option>
                  <option value="Verde decidida">Verde decidida</option>
                  <option value="Roxa recomendada">Roxa recomendada</option>
                  <option value="Roxa decidida">Roxa decidida</option>
                  <option value="Marrom recomendada">Marrom recomendada</option>
                  <option value="Marrom decidida">Marrom decidida</option>
                  <option value="Vermelha recomendada">Vermelha recomendada</option>
                  <option value="Vermelha decidida">Vermelha decidida</option>
                  <option value="Preta">Faixa Preta</option>
                </select>
              </div>
            </div>
          </section>

          {/* Training Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Informações de Treino</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dias de Treino
                </label>
                <div className="space-y-2">
                  {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(day => (
                    <label key={day} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.trainingDays.includes(day)}
                        onChange={() => handleTrainingDayChange(day)}
                        className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                        title={`Treino na ${day}`}
                        aria-label={`Treino na ${day}`}
                      />
                      <span className="ml-2 text-sm text-gray-700">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário de Treino
                </label>
                <input
                  type="text"
                  value={formData.trainingSchedule}
                  onChange={(e) => setFormData({ ...formData, trainingSchedule: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  placeholder="Ex: 19:00 - 20:30"
                  title="Horário de treino"
                  aria-label="Horário de treino"
                />
              </div>
            </div>
          </section>

          {/* Emergency Contact */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Contato de Emergência</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Contato
                </label>
                <input
                  type="text"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  title="Nome do contato de emergência"
                  aria-label="Nome do contato de emergência"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone de Emergência
                </label>
                <input
                  type="tel"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  title="Telefone do contato de emergência"
                  aria-label="Telefone do contato de emergência"
                />
              </div>
            </div>
          </section>

          {/* Additional Actions */}
          {student && (
            <section>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Ações Adicionais</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => setShowCertificateGenerator(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#dfa129] text-white rounded-md hover:bg-opacity-90 transition-colors"
                  title="Gerar certificado"
                  aria-label="Gerar certificado"
                >
                  <FileDown size={20} />
                  Gerar Certificado
                </button>

                <button
                  type="button"
                  onClick={() => setShowNotificationForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  title="Enviar notificação"
                  aria-label="Enviar notificação"
                >
                  <Bell size={20} />
                  Enviar Notificação
                </button>

                <button
                  type="button"
                  onClick={() => setShowPaymentLink(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  title="Gerar link de pagamento"
                  aria-label="Gerar link de pagamento"
                >
                  <FileDown size={20} />
                  Gerar Link de Pagamento
                </button>
              </div>
            </section>
          )}

          <div className="sticky bottom-0 bg-white pt-4 pb-6 flex justify-end gap-4">
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md hover:bg-[#164070]"
              title={student ? 'Salvar alterações' : 'Cadastrar aluno'}
              aria-label={student ? 'Salvar alterações' : 'Cadastrar aluno'}
            >
              <Save size={18} />
              {student ? 'Salvar Alterações' : 'Cadastrar Aluno'}
            </button>
          </div>
        </form>

        {/* Additional Components */}
        {showCertificateGenerator && student && (
          <CertificateGenerator
            student={student}
            onClose={() => setShowCertificateGenerator(false)}
          />
        )}

        {showNotificationForm && student && (
          <NotificationForm
            studentId={student.id}
            onClose={() => setShowNotificationForm(false)}
          />
        )}

        {showPaymentLink && student && (
          <PaymentLinkGenerator
            student={student}
            onClose={() => setShowPaymentLink(false)}
          />
        )}
      </div>
    </div>
  );
}
