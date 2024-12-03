import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Menu, X, LogOut, Users, Building2, BookOpen, BarChart3, CheckSquare, Home, UserCircle, Shield, Video, Award, MessageSquare, ChevronDown, ShoppingBag, Calendar } from 'lucide-react';

export default function Header() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCRMSubmenuOpen, setIsCRMSubmenuOpen] = useState(false);
  const [isAdminSubmenuOpen, setIsAdminSubmenuOpen] = useState(false);
  const [isEventsSubmenuOpen, setIsEventsSubmenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: <Home size={20} />
    },
    {
      label: 'Meu Perfil',
      path: '/dashboard/profile',
      icon: <UserCircle size={20} />
    },
    ...(user?.role === 'admin' ? [
      {
        label: 'Administração',
        path: '/dashboard/admin',
        icon: <Shield size={20} />,
        submenu: [
          { 
            label: 'Usuários',
            path: '/dashboard/users/manage',
            icon: <Users size={20} />
          },
          {
            label: 'Unidades',
            path: '/dashboard/units/manage',
            icon: <Building2 size={20} />
          },
          {
            label: 'Grade de horários',
            path: '/dashboard/classes',
            icon: <BookOpen size={20} />
          }
        ]
      }
    ] : []),
    ...(user?.role === 'admin' || user?.role === 'instructor' ? [
      {
        label: 'Tatame Online',
        path: '/dashboard/online',
        icon: <Video size={20} />
      },
      {
        label: 'Badges',
        path: '/dashboard/badges',
        icon: <Award size={20} />
      },
      {
        label: 'KIHAP STORE',
        path: '/dashboard/store',
        icon: <ShoppingBag size={20} />
      },
      {
        label: 'Eventos KIHAP',
        path: '/dashboard/events',
        icon: <Calendar size={20} />,
        submenu: [
          {
            label: 'Gerenciar Eventos',
            path: '/dashboard/events/manage',
            icon: <Calendar size={20} />
          },
          {
            label: 'Checkins',
            path: '/dashboard/events/checkins',
            icon: <CheckSquare size={20} />
          }
        ]
      }
    ] : []),
    ...(user?.role === 'admin' ? [
      {
        label: 'CRM',
        path: '/dashboard/crm',
        icon: <BarChart3 size={20} />,
        submenu: [
          {
            label: 'Mensagens',
            path: '/dashboard/messages',
            icon: <MessageSquare size={20} />
          }
        ]
      }
    ] : []),
    {
      label: 'Tarefas',
      path: '/dashboard/tasks',
      icon: <CheckSquare size={20} />
    }
  ];

  return (
    <header className="bg-[#1a2c54] text-white sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img 
              src="https://kihap.com.br/wp-content/uploads/2021/02/kihap-wh-1536x359.png" 
              alt="KIHAP Logo" 
              className="h-8 w-auto"
            />
          </Link>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div 
          className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 ${
            isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsMenuOpen(false)}
        />

        <div 
          className={`fixed right-0 top-0 h-full w-64 bg-[#1a2c54] transform transition-transform duration-300 ease-in-out ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-gray-700 flex justify-end">
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              title="Fechar Menu"
            >
              <X size={24} />
            </button>
          </div>

          <nav className="p-4">
            <div className="space-y-1">
              {menuItems.map((item, index) => (
                <div key={index}>
                  {item.submenu ? (
                    <div className="mb-2">
                      <div className="flex items-center gap-3 px-3 py-3 text-white hover:bg-gray-700 rounded-md transition-colors">
                        <Link
                          to={item.path}
                          className="flex-1 flex items-center gap-3"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {item.icon}
                          <span className="font-medium">{item.label}</span>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (item.label === 'CRM') {
                              setIsCRMSubmenuOpen(!isCRMSubmenuOpen);
                            } else if (item.label === 'Administração') {
                              setIsAdminSubmenuOpen(!isAdminSubmenuOpen);
                            } else if (item.label === 'Eventos KIHAP') {
                              setIsEventsSubmenuOpen(!isEventsSubmenuOpen);
                            }
                          }}
                          className="p-2 hover:bg-gray-600 rounded-full transition-colors"
                          title={`Expandir submenu ${item.label}`}
                          aria-label={`Expandir submenu ${item.label}`}
                        >
                          <ChevronDown 
                            size={16} 
                            className="transition-transform transform duration-200" 
                            style={{ 
                              transform: (
                                (item.label === 'CRM' && isCRMSubmenuOpen) || 
                                (item.label === 'Administração' && isAdminSubmenuOpen) ||
                                (item.label === 'Eventos KIHAP' && isEventsSubmenuOpen)
                              ) ? 'rotate(180deg)' : 'rotate(0deg)' 
                            }} 
                          />
                        </button>
                      </div>
                      {((item.label === 'CRM' && isCRMSubmenuOpen) || 
                        (item.label === 'Administração' && isAdminSubmenuOpen) ||
                        (item.label === 'Eventos KIHAP' && isEventsSubmenuOpen)) && (
                        <div className="mt-1 ml-4 border-l-2 border-gray-700">
                          {item.submenu.map((subitem, subindex) => (
                            <Link
                              key={subindex}
                              to={subitem.path}
                              className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors"
                              onClick={() => setIsMenuOpen(false)}
                            >
                              {subitem.icon}
                              <span>{subitem.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      className="flex items-center gap-3 px-3 py-3 text-white hover:bg-gray-700 rounded-md transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
            <button
              onClick={() => {
                handleLogout();
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-3 w-full px-3 py-3 text-white hover:bg-gray-700 rounded-md transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
