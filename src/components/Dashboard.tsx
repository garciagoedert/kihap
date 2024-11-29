import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, Award, FileCheck, DollarSign, Bell } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useAuthStore } from '../store/useAuthStore';

export default function Dashboard() {
  const { units, students, leads } = useDataStore();
  const { user } = useAuthStore();
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  
  // Calculate global statistics
  const totalStudents = students.length;
  const activeContracts = students.filter(s => {
    if (!s.contract) return false;
    const endDate = new Date(s.contract.endDate);
    const now = new Date();
    return endDate >= now && s.contract.active;
  }).length;

  // Calcular valor total dos leads novos
  const totalLeadsValue = leads
    .filter(lead => lead.status === 'novo')
    .reduce((total, lead) => total + (lead.value || 0), 0);

  // Log para debug
  console.log('Estado atual:', {
    totalUnits: units.length,
    units,
    user
  });

  // Calcular estatísticas por unidade
  const unitStats = useMemo(() => {
    const now = new Date();
    return units.map(unit => {
      // Get students for this unit
      const unitStudents = students.filter(s => s.unitId === unit.id);
      
      // Get active contract students
      const activeContractStudents = unitStudents.filter(student => {
        if (!student.contract?.active) return false;
        try {
          const endDate = new Date(student.contract.endDate);
          return endDate >= now;
        } catch {
          return false;
        }
      });

      // Calculate unit leads value
      const unitLeadsValue = leads
        .filter(lead => lead.status === 'novo' && lead.unitId === unit.id)
        .reduce((total, lead) => total + (lead.value || 0), 0);

      return {
        ...unit,
        stats: {
          totalStudents: unitStudents.length,
          activeContracts: activeContractStudents.length,
          leadsValue: unitLeadsValue
        }
      };
    });
  }, [units, students, leads]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
          <p className="text-gray-600">Gerenciamento global das unidades</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowNotificationForm(true)}
            className="flex items-center justify-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors w-full sm:w-auto"
          >
            <Bell size={20} />
            <span>Enviar Notificação</span>
          </button>
          <Link
            to="/dashboard/units/manage"
            className="flex items-center justify-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors w-full sm:w-auto"
          >
            <MapPin size={20} />
            <span>Gerenciar Unidades</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
        <StatCard
          icon={<MapPin className="text-[#1d528d]" size={24} />}
          title="Total de Unidades"
          value={units.length.toString()}
        />
        <StatCard
          icon={<Users className="text-[#1d528d]" size={24} />}
          title="Total de Alunos"
          value={totalStudents.toString()}
        />
        <StatCard
          icon={<FileCheck className="text-[#1d528d]" size={24} />}
          title="Contratos Ativos"
          value={activeContracts.toString()}
        />
        <StatCard
          icon={<DollarSign className="text-[#1d528d]" size={24} />}
          title="Valor Total de Novos Leads"
          value={formatCurrency(totalLeadsValue)}
          link="/dashboard/crm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {unitStats.map(unit => (
          <Link
            key={unit.id}
            to={`/dashboard/unit/${unit.id}`}
            className="bg-white rounded-lg shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">{unit.name}</h3>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {unit.stats.activeContracts} contratos ativos
              </span>
            </div>
            
            <div className="space-y-3 text-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <MapPin size={18} />
                <span className="text-sm md:text-base">{unit.city}, {unit.state}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={18} />
                <span className="text-sm md:text-base">{unit.stats.totalStudents} alunos</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign size={18} />
                <span className="text-sm md:text-base">
                  {formatCurrency(unit.stats.leadsValue)} em leads
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showNotificationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Enviar Notificação</h3>
            <button
              onClick={() => setShowNotificationForm(false)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  link?: string;
}

function StatCard({ icon, title, value, link }: StatCardProps) {
  const Content = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
          {icon}
        </div>
        <span className="text-xl md:text-2xl font-bold text-gray-800">{value}</span>
      </div>
      <h3 className="text-sm md:text-base text-gray-600 font-medium">{title}</h3>
    </>
  );

  if (link) {
    return (
      <Link to={link} className="block bg-white rounded-lg shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow">
        <Content />
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <Content />
    </div>
  );
}
