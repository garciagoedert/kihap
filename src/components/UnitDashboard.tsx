import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import StudentList from './StudentList';
import StudentForm from './StudentForm';
import NotificationForm from './NotificationForm';
import { useDataStore } from '../store/useDataStore';
import { useUnitStats } from '../hooks/useUnitStats';
import { Users, Award, FileCheck, DollarSign, Search, Download, Bell } from 'lucide-react';
import { Student } from '../types';

export default function UnitDashboard() {
  const { unitId } = useParams();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  
  const { units, students, addStudent, updateStudent, deleteStudent } = useDataStore();
  const unit = units.find(u => u.id === Number(unitId));
  const unitStudents = students.filter(s => s.unitId === Number(unitId));
  const { getStats } = useUnitStats(Number(unitId));
  const stats = getStats();
  
  // Filter students based on search term
  const filteredStudents = unitStudents.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddStudent = (studentData: Omit<Student, 'id'>) => {
    addStudent({ ...studentData, unitId: Number(unitId) });
    setShowForm(false);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleUpdateStudent = (studentData: Omit<Student, 'id'>) => {
    if (!editingStudent) return;
    
    updateStudent({
      ...studentData,
      id: editingStudent.id,
      unitId: Number(unitId)
    });
    setShowForm(false);
    setEditingStudent(null);
  };

  const handleDeleteStudent = (studentId: number) => {
    deleteStudent(studentId);
  };

  const handleExportStudents = () => {
    const headers = [
      'Nome',
      'Idade',
      'Faixa',
      'Data de Matrícula',
      'CPF',
      'RG',
      'Email',
      'Telefone',
      'Contato de Emergência',
      'Telefone de Emergência',
      'Endereço',
      'Bairro',
      'Cidade',
      'Estado',
      'CEP',
      'Tipo Sanguíneo',
      'Peso',
      'Altura',
      'Condições Médicas',
      'Medicamentos',
      'Responsável',
      'CPF do Responsável',
      'Telefone do Responsável',
      'Dias de Treino',
      'Horário de Treino',
      'Dia do Pagamento',
      'Plano',
      'Início do Contrato',
      'Fim do Contrato',
      'Valor do Contrato',
      'Contrato Ativo',
      'Observações'
    ];

    const csvData = unitStudents.map(student => [
      student.name,
      student.age,
      student.belt,
      student.registrationDate,
      student.cpf,
      student.rg || '',
      student.email || '',
      student.phone,
      student.emergencyContact,
      student.emergencyPhone,
      student.address,
      student.neighborhood,
      student.city,
      student.state,
      student.zipCode,
      student.bloodType || '',
      student.weight || '',
      student.height || '',
      student.healthIssues || '',
      student.medications || '',
      student.guardianName || '',
      student.guardianCPF || '',
      student.guardianPhone || '',
      (student.trainingDays || []).join('; '),
      student.trainingSchedule,
      student.paymentDay,
      student.contract?.planName || '',
      student.contract?.startDate || '',
      student.contract?.endDate || '',
      student.contract?.value || '',
      student.contract?.active ? 'Sim' : 'Não',
      student.observations || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => 
        typeof cell === 'string' && cell.includes(',') 
          ? `"${cell}"`
          : cell
      ).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `alunos_${unit?.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!unit) return <div>Unidade não encontrada</div>;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{unit.name}</h2>
        <p className="text-gray-600">{unit.city}, {unit.state}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <StatCard
          icon={<Users className="text-[#1d528d]" />}
          title="Total de Alunos"
          value={stats.totalStudents.toString()}
        />

        <StatCard
          icon={<Award className="text-[#1d528d]" />}
          title="Faixas Pretas"
          value={stats.beltDistribution['Faixa Preta']?.toString() || '0'}
        />

        <StatCard
          icon={<FileCheck className="text-[#1d528d]" />}
          title="Contratos Ativos"
          value={stats.activeContracts.toString()}
        />

        <StatCard
          icon={<DollarSign className="text-[#1d528d]" />}
          title="Valor em Contratos"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(stats.totalContractsValue)}
        />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar alunos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-96 rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExportStudents}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            <Download size={20} />
            <span>Exportar Alunos</span>
          </button>
          <button
            onClick={() => setShowNotificationForm(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Bell size={20} />
            <span>Notificar Alunos</span>
          </button>
          <button
            onClick={() => {
              setEditingStudent(null);
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
          >
            <Users size={20} />
            <span>Novo Aluno</span>
          </button>
        </div>
      </div>

      <StudentList
        students={filteredStudents}
        onEditStudent={handleEditStudent}
        onDeleteStudent={handleDeleteStudent}
        unitId={Number(unitId)}
      />

      {showForm && (
        <StudentForm
          student={editingStudent}
          onSubmit={editingStudent ? handleUpdateStudent : handleAddStudent}
          onClose={() => {
            setShowForm(false);
            setEditingStudent(null);
          }}
        />
      )}

      {showNotificationForm && (
        <NotificationForm
          onClose={() => setShowNotificationForm(false)}
          unitId={Number(unitId)}
        />
      )}
    </main>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
          {icon}
        </div>
        <span className="text-xl md:text-2xl font-bold text-gray-800">{value}</span>
      </div>
      <h3 className="text-sm md:text-base text-gray-600 font-medium">{title}</h3>
    </div>
  );
}
