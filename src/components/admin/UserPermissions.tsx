import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { Shield, Users, Key, Plus, Edit2, Trash2 } from 'lucide-react';
import { User } from '../../types';

export default function UserPermissions() {
  const { users, units, updateUser } = useDataStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  const handleUpdatePermissions = (userId: number, permissions: string[]) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      updateUser({
        ...user,
        permissions
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Permissões de Usuários</h2>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {users.map(user => (
          <div key={user.id} className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {user.photo ? (
                  <img
                    src={user.photo}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <Users size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-800 truncate">{user.name}</h3>
                  <p className="text-sm text-gray-600 truncate">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    setShowPermissions(true);
                  }}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-[#1d528d] border border-[#1d528d] rounded-md hover:bg-[#1d528d] hover:text-white transition-colors"
                >
                  <Shield size={18} />
                  <span className="whitespace-nowrap">Gerenciar Permissões</span>
                </button>
                {user.role !== 'admin' && (
                  <button
                    onClick={() => {
                      if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
                        // Handle delete
                      }
                    }}
                    className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <Key size={16} />
              <span className="capitalize">{user.role}</span>
              {user.unitId && (
                <>
                  <span className="mx-2">•</span>
                  <span className="truncate">{units.find(u => u.id === user.unitId)?.name}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showPermissions && selectedUser && (
        <PermissionsModal
          user={selectedUser}
          onClose={() => {
            setShowPermissions(false);
            setSelectedUser(null);
          }}
          onSave={handleUpdatePermissions}
        />
      )}
    </div>
  );
}