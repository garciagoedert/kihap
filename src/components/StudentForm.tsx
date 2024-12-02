import React, { useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Student } from '../types';
import { Save, X, User, Upload, FileDown, Bell } from 'lucide-react';
import CertificateGenerator from './CertificateGenerator';
import NotificationForm from './NotificationForm';
import PaymentLinkGenerator from './PaymentLinkGenerator';
import { useDataStore } from '../store/useDataStore';

interface StudentFormProps {
  student?: Student | null;
  onSubmit: (student: Partial<Student>) => void;
  onClose: () => void;
}

export default function StudentForm({ student, onSubmit, onClose }: StudentFormProps) {
  const { units } = useDataStore();
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
    age: student?.age || 0,
    registrationDate: student?.registrationDate || new Date().toISOString(),
    lastAttendance: student?.lastAttendance || new Date().toISOString(),
    unitId: student?.unitId || '',
    subUnitId: student?.subUnitId || '',
    active: student?.active ?? true,
    instructorId: student?.instructorId || '1',
    storeId: student?.storeId || '1',
    badges: student?.badges || [],
    physicalTests: student?.physicalTests || [],
    contract: student?.contract || {
      id: '',
      studentId: '',
      templateId: '',
      content: '',
      status: 'draft',
      startDate: new Date(),
      endDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedUnit = useMemo(() => 
    units.find(u => u.id === formData.unitId),
    [units, formData.unitId]
  );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
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
    const birthDate = new Date(formData.birthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    const studentData: Partial<Student> = {
      ...formData,
      age,
      createdAt: student?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    onSubmit(studentData);
  };

  const handleTrainingDayChange = (day: string) => {
    setFormData(prev => ({
      ...prev,
      trainingDays: prev.trainingDays.includes(day)
        ? prev.trainingDays.filter(d => d !== day)
        : [...prev.trainingDays, day]
    }));
  };

  const handleUnitChange = (unitId: string) => {
    setFormData(prev => ({
      ...prev,
      unitId,
      subUnitId: ''
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
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title="Adicionar foto do aluno"
              >
                <Upload size={16} />
                <span>Adicionar Foto</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCertificateGenerator(true)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title="Gerar certificado"
              >
                <FileDown size={16} />
                <span>Gerar Certificado</span>
              </button>
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
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md">
              {error}
            </div>
          )}

          {/* Photo Upload (hidden input) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            className="hidden"
            title="Selecionar foto do aluno"
          />

          {/* Photo Preview */}
          {formData.photo && (
            <div className="flex justify-center">
              <div className="relative w-32 h-32">
                <img
                  src={formData.photo}
                  alt="Foto do aluno"
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  title="Remover foto"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Unit Selection */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Unidade</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade *
                </label>
                <select
                  value={formData.unitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Selecione a unidade"
                  aria-label="Selecione a unidade"
                >
                  <option value="">Selecione uma unidade</option>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUnit?.subunits && selectedUnit.subunits.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subunidade *
                  </label>
                  <select
                    value={formData.subUnitId}
                    onChange={(e) => setFormData(prev => ({ ...prev, subUnitId: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                    required
                    title="Selecione a subunidade"
                    aria-label="Selecione a subunidade"
                  >
                    <option value="">Selecione uma subunidade</option>
                    {selectedUnit.subunits.map(subunit => (
                      <option key={subunit.id} value={subunit.id}>
                        {subunit.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Personal Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Informações Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Digite o nome completo do aluno"
                  placeholder="Digite o nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Digite o email do aluno"
                  placeholder="exemplo@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Digite o telefone do aluno"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Selecione a data de nascimento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF *
                </label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Digite o CPF do aluno"
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faixa *
                </label>
                <select
                  value={formData.belt}
                  onChange={(e) => setFormData(prev => ({ ...prev, belt: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Selecione a faixa do aluno"
                  aria-label="Selecione a faixa do aluno"
                >
                  <option value="Branca recomendada">Branca recomendada</option>
                  <option value="Branca">Branca</option>
                  <option value="Amarela">Amarela</option>
                  <option value="Verde">Verde</option>
                  <option value="Azul">Azul</option>
                  <option value="Vermelha">Vermelha</option>
                  <option value="Preta">Preta</option>
                </select>
              </div>
            </div>
          </section>

          {/* Training Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Informações de Treino</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dias de Treino *
                </label>
                <div className="flex flex-wrap gap-4">
                  {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(day => (
                    <label key={day} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.trainingDays.includes(day)}
                        onChange={() => handleTrainingDayChange(day)}
                        className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                        title={`Selecionar ${day}-feira como dia de treino`}
                      />
                      <span className="ml-2">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário de Treino *
                </label>
                <input
                  type="text"
                  value={formData.trainingSchedule}
                  onChange={(e) => setFormData(prev => ({ ...prev, trainingSchedule: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  placeholder="Ex: 19:00 - 20:00"
                  required
                  title="Digite o horário de treino"
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
                  Nome do Contato *
                </label>
                <input
                  type="text"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Digite o nome do contato de emergência"
                  placeholder="Digite o nome do contato"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone de Emergência *
                </label>
                <input
                  type="tel"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  required
                  title="Digite o telefone do contato de emergência"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </section>

          {/* Form Actions */}
          <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-200">
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title="Cancelar cadastro"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#1d528d] hover:bg-[#1d528d]/90"
                title="Salvar cadastro"
              >
                <Save size={16} />
                <span>Salvar</span>
              </button>
            </div>
          </div>
        </form>

        {/* Additional Components */}
        {showCertificateGenerator && (
          <CertificateGenerator
            student={student || formData as Student}
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
