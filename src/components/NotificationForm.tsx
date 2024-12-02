import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/useDataStore';
import { useAuthStore } from '../store/useAuthStore';
import { Bell, X, Search, Users, Building2 } from 'lucide-react';
import type { Student } from '../types';

interface NotificationFormProps {
  onClose: () => void;
  unitId?: string;
  subUnitId?: string;
  studentId?: string;
  selectedStudents?: string[];
}

export default function NotificationForm({ 
  onClose, 
  unitId: initialUnitId, 
  subUnitId: initialSubUnitId,
  studentId, 
  selectedStudents: initialSelectedStudents 
}: NotificationFormProps) {
  const currentUser = useAuthStore(state => state.user);
  const { addNotification, students, units } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>(initialSelectedStudents || []);
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>(initialUnitId || 'all');
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as const
  });
  const [showStudentList, setShowStudentList] = useState(false);

  // Filter students based on search term, unit and subunit
  const filteredStudents = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return students
      .filter((student: Student) => {
        const unitMatch = selectedUnitId === 'all' || student.unitId === selectedUnitId;
        const subUnitMatch = !initialSubUnitId || student.subUnitId === initialSubUnitId;
        const searchMatch = student.name.toLowerCase().includes(searchLower) ||
                          student.email?.toLowerCase().includes(searchLower) ||
                          student.phone.toLowerCase().includes(searchLower);
        return unitMatch && subUnitMatch && searchMatch;
      })
      .sort((a: Student, b: Student) => a.name.localeCompare(b.name));
  }, [students, selectedUnitId, initialSubUnitId, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const userIds = studentId ? [studentId] : selectedStudents;

    userIds.forEach(userId => {
      addNotification({
        title: formData.title,
        message: formData.message,
        type: formData.type,
        userId,
        read: false
      });
    });

    onClose();
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudents(filteredStudents.map(s => s.id));
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Nova Notificação</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedStudents.length} aluno{selectedStudents.length !== 1 ? 's' : ''} selecionado{selectedStudents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Mobile View */}
          <div className="md:hidden flex flex-col flex-1">
            {showStudentList ? (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  {!initialSubUnitId && (
                    <div className="flex items-center gap-2 text-gray-600 mb-4">
                      <Building2 size={20} />
                      <select
                        value={selectedUnitId}
                        onChange={(e) => {
                          setSelectedUnitId(e.target.value);
                          setSelectedStudents([]);
                        }}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                        aria-label="Selecionar unidade"
                      >
                        <option value="all">Todas as Unidades</option>
                        {units.map(unit => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar alunos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                      aria-label="Buscar alunos"
                    />
                  </div>
                </div>

                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={selectAllStudents}
                      className="text-sm text-[#1d528d] hover:text-[#164070] font-medium flex items-center gap-1"
                      aria-label="Selecionar todos os alunos"
                    >
                      <Users size={16} />
                      Selecionar Todos
                    </button>
                    <button
                      onClick={clearSelection}
                      className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                      aria-label="Limpar seleção"
                    >
                      Limpar Seleção
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filteredStudents.map(student => (
                    <label
                      key={student.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                        aria-label={`Selecionar ${student.name}`}
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-700">{student.name}</div>
                        <div className="text-xs text-gray-500">
                          {student.email && <div>{student.email}</div>}
                          {student.phone && <div>{student.phone}</div>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowStudentList(false)}
                    className="w-full bg-[#1d528d] text-white px-4 py-2 rounded-md"
                    aria-label="Continuar"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                <div className="p-4 flex-1">
                  <button
                    type="button"
                    onClick={() => setShowStudentList(true)}
                    className="w-full mb-4 p-3 border border-gray-300 rounded-md text-left flex justify-between items-center"
                    aria-label="Selecionar alunos"
                  >
                    <span className="text-gray-600">Selecionar alunos</span>
                    <Users size={20} className="text-gray-400" />
                  </button>

                  <div className="space-y-4">
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
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="message">
                        Mensagem
                      </label>
                      <textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full h-32 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="type">
                        Tipo
                      </label>
                      <select
                        id="type"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                      >
                        <option value="info">Informação</option>
                        <option value="warning">Aviso</option>
                        <option value="success">Sucesso</option>
                        <option value="error">Erro</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={selectedStudents.length === 0}
                    className="w-full bg-[#1d528d] text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Enviar notificação"
                  >
                    Enviar Notificação
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:flex flex-1">
            {/* Student Selection Panel */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                {!initialSubUnitId && (
                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <Building2 size={20} />
                    <select
                      value={selectedUnitId}
                      onChange={(e) => {
                        setSelectedUnitId(e.target.value);
                        setSelectedStudents([]);
                      }}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                      aria-label="Selecionar unidade"
                    >
                      <option value="all">Todas as Unidades</option>
                      {units.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar alunos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                    aria-label="Buscar alunos"
                  />
                </div>
              </div>

              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <button
                    onClick={selectAllStudents}
                    className="text-sm text-[#1d528d] hover:text-[#164070] font-medium flex items-center gap-1"
                    aria-label="Selecionar todos os alunos"
                  >
                    <Users size={16} />
                    Selecionar Todos
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                    aria-label="Limpar seleção"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredStudents.map(student => (
                  <label
                    key={student.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                      aria-label={`Selecionar ${student.name}`}
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-700">{student.name}</div>
                      <div className="text-xs text-gray-500">
                        {student.email && <div>{student.email}</div>}
                        {student.phone && <div>{student.phone}</div>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notification Form */}
            <div className="flex-1 flex flex-col">
              <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="desktop-title">
                    Título
                  </label>
                  <input
                    id="desktop-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                    required
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="desktop-message">
                    Mensagem
                  </label>
                  <textarea
                    id="desktop-message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full h-[200px] rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="desktop-type">
                    Tipo
                  </label>
                  <select
                    id="desktop-type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  >
                    <option value="info">Informação</option>
                    <option value="warning">Aviso</option>
                    <option value="success">Sucesso</option>
                    <option value="error">Erro</option>
                  </select>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    aria-label="Cancelar"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={selectedStudents.length === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md hover:bg-[#164070] disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Enviar notificação"
                  >
                    <Bell size={18} />
                    Enviar Notificação
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
