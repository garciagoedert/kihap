import React from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { Shield, FileText } from 'lucide-react';
import ContractTemplates from './ContractTemplates';
import UserPermissions from './UserPermissions';

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Administração do Sistema</h1>
        <p className="text-gray-600 text-sm md:text-base">Gerencie contratos e permissões do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate('contracts')}
          className="p-4 md:p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#1d528d] bg-opacity-10 rounded-lg shrink-0">
              <FileText size={24} className="text-[#1d528d]" />
            </div>
            <div className="text-left min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 truncate">Modelos de Contrato</h2>
              <p className="text-gray-600 text-sm">Gerencie os modelos de contrato padrão</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('permissions')}
          className="p-4 md:p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#1d528d] bg-opacity-10 rounded-lg shrink-0">
              <Shield size={24} className="text-[#1d528d]" />
            </div>
            <div className="text-left min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 truncate">Permissões</h2>
              <p className="text-gray-600 text-sm">Gerencie permissões de usuários</p>
            </div>
          </div>
        </button>
      </div>

      <Routes>
        <Route path="contracts" element={<ContractTemplates />} />
        <Route path="permissions" element={<UserPermissions />} />
      </Routes>
    </div>
  );
}