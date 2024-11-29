import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, X, CheckCircle2, Calendar, Clock, Users } from 'lucide-react';

const weekDays = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo'
];

interface ClassFormProps {
  onClose: () => void;
  onSubmit: (classData: any) => void;
  editingClass?: any;
  units: any[];
}

function ClassForm({ onClose, onSubmit, editingClass, units }: ClassFormProps) {
  const [formData, setFormData] = useState({
    name: editingClass?.name || '',
    unitId: editingClass?.unitId || '',
    weekDay: editingClass?.weekDay || '',
    startTime: editingClass?.startTime || '',
    endTime: editingClass?.endTime || '',
    maxStudents: editingClass?.maxStudents || '',
    description: editingClass?.description || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      unitId: Number(formData.unitId),
      maxStudents: Number(formData.maxStudents)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              {editingClass ? 'Editar Turma' : 'Nova Turma'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Turma
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidade
            </label>
            <select
              value={formData.unitId}
              onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            >
              <option value="">Selecione uma unidade</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dia da Semana
            </label>
            <select
              value={formData.weekDay}
              onChange={(e) => setFormData({ ...formData, weekDay: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              required
            >
              <option value="">Selecione um dia</option>
              {weekDays.map(day => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horário Início
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horário Fim
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Máximo de Alunos
            </label>
            <input
              type="number"
              value={formData.maxStudents}
              onChange={(e) => setFormData({ ...formData, maxStudents: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md hover:bg-[#164070]"
            >
              {editingClass ? 'Salvar Alterações' : 'Criar Turma'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AttendanceFormProps {
  class: any;
  date: Date;
  onClose: () => void;
  onSubmit: (studentIds: number[]) => void;
  students: any[];
}

function AttendanceForm({ class: classData, date, onClose, onSubmit, students }: AttendanceFormProps) {
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedStudents);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Fazer Chamada</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <h3 className="font-medium text-gray-700">{classData.name}</h3>
            <p className="text-sm text-gray-500">
              {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {students.map(student => (
              <label
                key={student.id}
                className="flex items-center p-2 hover:bg-gray-50 rounded-md cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStudents([...selectedStudents, student.id]);
                    } else {
                      setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                    }
                  }}
                  className="rounded border-gray-300 text-[#1d528d] focus:ring-[#1d528d]"
                />
                <span className="ml-2">{student.name}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#1d528d] border border-transparent rounded-md hover:bg-[#164070]"
            >
              Salvar Presenças
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClassManagement() {
  const { units, classes, students, addClass: addNewClass, updateClass, deleteClass } = useDataStore();
  const [selectedUnitId, setSelectedUnitId] = useState<number | 'all'>('all');
  const [showClassForm, setShowClassForm] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);

  const filteredClasses = selectedUnitId === 'all'
    ? classes
    : classes.filter(c => c.unitId === selectedUnitId);

  const handleSubmitClass = (classData: any) => {
    if (editingClass) {
      updateClass({ ...classData, id: editingClass.id });
    } else {
      addNewClass(classData);
    }
    setShowClassForm(false);
    setEditingClass(null);
  };

  const handleDeleteClass = (classId: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta turma?')) {
      deleteClass(classId);
    }
  };

  const handleAttendance = (classData: any) => {
    setSelectedClass(classData);
    setShowAttendanceForm(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Aulas</h2>
          <p className="text-gray-600">Controle de turmas e presenças</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
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
          <button
            onClick={() => {
              setEditingClass(null);
              setShowClassForm(true);
            }}
            className="flex items-center justify-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
          >
            <Plus size={20} />
            Nova Turma
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map(classItem => (
          <div key={classItem.id} className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-800">{classItem.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingClass(classItem);
                    setShowClassForm(true);
                  }}
                  className="text-gray-600 hover:text-[#1d528d]"
                >
                  <Plus size={20} />
                </button>
                <button
                  onClick={() => handleDeleteClass(classItem.id)}
                  className="text-gray-600 hover:text-red-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} />
                <span>{classItem.weekDay}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={18} />
                <span>{classItem.startTime} - {classItem.endTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={18} />
                <span>{classItem.maxStudents} alunos</span>
              </div>
            </div>

            <button
              onClick={() => handleAttendance(classItem)}
              className="w-full bg-[#1d528d] text-white py-2 px-4 rounded-md hover:bg-[#164070] transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              Fazer Chamada
            </button>
          </div>
        ))}
      </div>

      {showClassForm && (
        <ClassForm
          onClose={() => {
            setShowClassForm(false);
            setEditingClass(null);
          }}
          onSubmit={handleSubmitClass}
          editingClass={editingClass}
          units={units}
        />
      )}

      {showAttendanceForm && selectedClass && (
        <AttendanceForm
          class={selectedClass}
          date={new Date()}
          onClose={() => setShowAttendanceForm(false)}
          onSubmit={(studentIds) => {
            // Handle attendance submission
            setShowAttendanceForm(false);
          }}
          students={students.filter(s => s.unitId === selectedClass.unitId)}
        />
      )}
    </div>
  );
}