import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../store/useDataStore';
import { MapPin, Users, FileText, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { units, students, leads } = useDataStore();

  // Calcula o total de subunidades em todas as unidades
  const totalSubunits = units.reduce((total, unit) => total + (unit.subunits?.length || 0), 0);

  // Calcula o total de alunos
  const totalStudents = students.length;

  // Calcula o total de contratos ativos
  const totalActiveContracts = students.filter(student => 
    student.contract?.status === 'active'
  ).length;

  // Calcula o total de novos leads
  const totalNewLeads = leads.filter(lead => 
    lead.status === 'novo'
  ).length;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Visão Geral</h2>
        <p className="text-gray-600">Gerenciamento global das unidades</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <StatCard
          icon={<MapPin className="text-[#1d528d]" />}
          title="Total de Unidades"
          value={totalSubunits}
        />

        <StatCard
          icon={<Users className="text-[#1d528d]" />}
          title="Total de Alunos"
          value={totalStudents}
        />

        <StatCard
          icon={<FileText className="text-[#1d528d]" />}
          title="Contratos Ativos"
          value={totalActiveContracts}
        />

        <StatCard
          icon={<DollarSign className="text-[#1d528d]" />}
          title="Total de Novos Leads"
          value={totalNewLeads}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {units.map((unit) => (
          <div
            key={unit.id}
            onClick={() => navigate(`/dashboard/unit/${unit.id}`)}
            className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{unit.name}</h3>
                <p className="text-gray-600">{unit.city}</p>
              </div>
              <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                {unit.subunits?.length || 0} subunidades
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Users size={16} />
                <span>
                  {students.filter(s => s.unitId === unit.id).length} alunos
                </span>
              </div>

              <div className="flex items-center gap-2">
                <FileText size={16} />
                <span>
                  {students.filter(s => s.unitId === unit.id && s.contract?.status === 'active').length} contratos ativos
                </span>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign size={16} />
                <span>
                  {leads.filter(l => l.unitId === unit.id && l.status === 'novo').length} novos leads
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: number }) {
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
