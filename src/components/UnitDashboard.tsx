import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentList from './StudentList';
import StudentForm from './StudentForm';
import SubUnitForm from './SubUnitForm';
import NotificationForm from './NotificationForm';
import { useDataStore } from '../store/useDataStore';
import { useUnitStats } from '../hooks/useUnitStats';
import { Users, Award, FileCheck, DollarSign, Search, Download, Bell, Building, Edit2, Trash2, Plus } from 'lucide-react';
import { Student, SubUnit } from '../types';

export default function UnitDashboard() {
  const { unitId, subUnitId } = useParams();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showSubUnitForm, setShowSubUnitForm] = useState(false);
  const [editingSubUnit, setEditingSubUnit] = useState<SubUnit | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  
  const { units, students, addStudent, updateStudent, deleteStudent, addSubUnit, updateSubUnit, deleteSubUnit } = useDataStore();
  const unit = units.find(u => u.id === unitId);
  const subUnit = unit?.subunits?.find(s => s.id === subUnitId);
  
  const unitStudents = students.filter(s => 
    s.unitId === unitId && 
    (!subUnitId || s.subUnitId === subUnitId)
  );
  
  const { getStats } = useUnitStats(unitId || '', subUnitId);
  const stats = getStats();
  
  // Filter students based on search term
  const filteredStudents = unitStudents.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddStudent = (studentData: Partial<Student>) => {
    if (!unitId) return;

    const newStudent: Omit<Student, 'id'> = {
      name: studentData.name || '',
      email: studentData.email || '',
      phone: studentData.phone || '',
      belt: studentData.belt || 'Branca recomendada',
      unitId,
      subUnitId: subUnitId || undefined,
      instructorId: studentData.instructorId || '1',
      instructor: studentData.instructor!,
      active: studentData.active ?? true,
      contract: studentData.contract!,
      badges: studentData.badges || [],
      physicalTests: studentData.physicalTests || [],
      storeId: studentData.storeId || '1',
      store: studentData.store!,
      photo: studentData.photo,
      birthDate: studentData.birthDate || '',
      cpf: studentData.cpf || '',
      trainingDays: studentData.trainingDays || [],
      trainingSchedule: studentData.trainingSchedule || '',
      emergencyContact: studentData.emergencyContact || '',
      emergencyPhone: studentData.emergencyPhone || '',
      age: studentData.age || 0,
      registrationDate: studentData.registrationDate || new Date().toISOString(),
      lastAttendance: studentData.lastAttendance || new Date().toISOString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    addStudent(newStudent);
    setShowForm(false);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleUpdateStudent = (studentData: Partial<Student>) => {
    if (!editingStudent || !unitId) return;
    
    const updatedStudent: Student = {
      ...editingStudent,
      ...studentData,
      unitId,
      subUnitId: subUnitId || undefined,
      updatedAt: new Date()
    };

    updateStudent(updatedStudent);
    setShowForm(false);
    setEditingStudent(null);
  };

  const handleDeleteStudent = (studentId: string) => {
    deleteStudent(studentId);
  };

  const handleAddSubUnit = (subUnitData: Omit<SubUnit, 'id' | 'parentUnitId'>) => {
    if (!unitId) return;
    addSubUnit(unitId, subUnitData);
    setShowSubUnitForm(false);
  };

  const handleUpdateSubUnit = (subUnitData: Omit<SubUnit, 'id' | 'parentUnitId'>) => {
    if (!unitId || !editingSubUnit) return;
    updateSubUnit(unitId, { ...editingSubUnit, ...subUnitData });
    setShowSubUnitForm(false);
    setEditingSubUnit(undefined);
  };

  const handleDeleteSubUnit = (subUnitId: string) => {
    if (!unitId) return;
    if (window.confirm('Tem certeza que deseja excluir esta subunidade? Esta ação não pode ser desfeita.')) {
      deleteSubUnit(unitId, subUnitId);
    }
  };

  const handleExportStudents = () => {
    const headers = [
      'Nome',
      'Email',
      'Telefone',
      'Faixa',
      'Status do Contrato',
      'Data de Início',
      'Data de Término'
    ];

    const csvData = unitStudents.map(student => [
      student.name,
      student.email,
      student.phone,
      student.belt,
      student.contract?.status || 'Sem contrato',
      student.contract?.startDate ? new Date(student.contract.startDate).toLocaleDateString() : '',
      student.contract?.endDate ? new Date(student.contract.endDate).toLocaleDateString() : ''
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
    link.setAttribute('download', `alunos_${unit?.name}_${subUnit?.name || ''}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubUnitClick = (subUnit: SubUnit) => {
    navigate(`/dashboard/unit/${unitId}/subunit/${subUnit.id}`);
  };

  if (!unit) return <div>Unidade não encontrada</div>;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {unit.name}
          {subUnit && ` - ${subUnit.name}`}
        </h2>
        <p className="text-gray-600">{unit.city}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {subUnitId ? (
          <StatCard
            icon={<Users className="text-[#1d528d]" />}
            title="Total de Alunos"
            value={stats.totalStudents.toString()}
          />
        ) : (
          <StatCard
            icon={<Building className="text-[#1d528d]" />}
            title="Total de Subunidades"
            value={(unit.subunits?.length || 0).toString()}
          />
        )}

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

      {subUnitId ? (
        <>
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
            unitId={unitId || ''}
          />
        </>
      ) : (
        unit.subunits && (
          <div className="mt-12">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-700">Subunidades</h3>
              <button
                onClick={() => {
                  setEditingSubUnit(undefined);
                  setShowSubUnitForm(true);
                }}
                className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
              >
                <Plus size={20} />
                <span>Nova Subunidade</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unit.subunits.map((subUnit) => (
                <div
                  key={subUnit.id}
                  className="bg-white rounded-lg shadow-md p-6 relative group"
                >
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSubUnit(subUnit);
                          setShowSubUnitForm(true);
                        }}
                        className="p-1 text-gray-600 hover:text-[#1d528d] transition-colors"
                        title="Editar subunidade"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSubUnit(subUnit.id);
                        }}
                        className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                        title="Excluir subunidade"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div
                    onClick={() => handleSubUnitClick(subUnit)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Building className="text-[#1d528d]" size={24} />
                      <h4 className="text-lg font-medium text-gray-800">{subUnit.name}</h4>
                    </div>
                    <p className="text-gray-600">{subUnit.address}</p>
                    <p className="text-gray-500 text-sm mt-2">{subUnit.phone}</p>
                    <p className="text-gray-500 text-sm">{subUnit.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

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

      {showSubUnitForm && (
        <SubUnitForm
          subUnit={editingSubUnit}
          onSubmit={editingSubUnit ? handleUpdateSubUnit : handleAddSubUnit}
          onClose={() => {
            setShowSubUnitForm(false);
            setEditingSubUnit(undefined);
          }}
        />
      )}

      {showNotificationForm && (
        <NotificationForm
          onClose={() => setShowNotificationForm(false)}
          unitId={unitId || ''}
          subUnitId={subUnitId}
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
