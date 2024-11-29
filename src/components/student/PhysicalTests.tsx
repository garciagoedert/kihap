import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';
import { Student, PhysicalTest } from '../../types';

interface PhysicalTestFormProps {
  test?: PhysicalTest;
  student: Student;
  onClose: () => void;
  onSubmit: (test: Omit<PhysicalTest, 'id' | 'createdAt'>) => void;
}

function PhysicalTestForm({ test, student, onClose, onSubmit }: PhysicalTestFormProps) {
  const [formData, setFormData] = useState({
    date: test?.date || format(new Date(), 'yyyy-MM-dd'),
    belt: test?.belt || student.belt,
    totalScore: test?.totalScore || 0,
    notes: test?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      studentId: student.id
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {test ? 'Editar Teste' : 'Novo Teste'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faixa
              </label>
              <input
                type="text"
                value={formData.belt}
                onChange={(e) => setFormData({ ...formData, belt: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pontuação Total
            </label>
            <input
              type="number"
              value={formData.totalScore}
              onChange={(e) => setFormData({ ...formData, totalScore: parseInt(e.target.value) })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              placeholder="Adicione observações sobre o teste..."
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
              {test ? 'Salvar Alterações' : 'Registrar Teste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PhysicalTestsProps {
  student: Student;
}

export default function PhysicalTests({ student }: PhysicalTestsProps) {
  const { physicalTests, addPhysicalTest, updatePhysicalTest, deletePhysicalTest } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTest, setEditingTest] = useState<PhysicalTest | null>(null);

  // Get tests for this student
  const studentTests = physicalTests
    .filter(test => test.studentId === student.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = (testId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este teste?')) {
      deletePhysicalTest(testId);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-gray-800">Testes Físicos</h2>
          <button
            onClick={() => {
              setEditingTest(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
          >
            <Plus size={20} />
            Novo Teste
          </button>
        </div>

        {studentTests.length > 0 ? (
          <div className="space-y-4">
            {studentTests.map(test => (
              <div key={test.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {format(new Date(test.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </h3>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {test.belt}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#1d528d] mb-2">
                      {test.totalScore} pontos
                    </p>
                    {test.notes && (
                      <p className="text-gray-600 text-sm">{test.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTest(test);
                        setShowForm(true);
                      }}
                      className="p-2 text-gray-400 hover:text-[#1d528d] transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(test.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Nenhum teste registrado
            </h3>
            <p className="text-gray-600">
              Registre seus testes físicos para acompanhar seu progresso.
            </p>
          </div>
        )}

        {showForm && (
          <PhysicalTestForm
            test={editingTest}
            student={student}
            onClose={() => {
              setShowForm(false);
              setEditingTest(null);
            }}
            onSubmit={(testData) => {
              if (editingTest) {
                updatePhysicalTest({ ...testData, id: editingTest.id });
              } else {
                addPhysicalTest(testData);
              }
              setShowForm(false);
              setEditingTest(null);
            }}
          />
        )}
      </div>
    </div>
  );
}