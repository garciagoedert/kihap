import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Eye, EyeOff, LogOut } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore(state => state.login);
  const logout = useAuthStore(state => state.logout);
  const currentUser = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If there's a current user, show warning
    if (currentUser) {
      setError(`Você está logado como ${currentUser.role === 'student' ? 'aluno' : 'instrutor'}. Por favor, deslogue primeiro para acessar outra conta.`);
      return;
    }

    const success = login(email, password);
    if (success) {
      // Get the current user after login
      const user = useAuthStore.getState().user;
      // Redirect based on user role
      if (user?.role === 'student') {
        navigate('/portal');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError('Email ou senha inválidos');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <Link to="/" className="block">
          <div className="flex items-center justify-center mb-8">
            <img 
              src="https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png" 
              alt="KIHAP Logo" 
              className="h-12 w-auto brightness-0"
            />
          </div>
        </Link>
        
        {currentUser ? (
          <div className="space-y-6">
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
              <p className="mb-4">
                Você está logado como {currentUser.role === 'student' ? 'aluno' : 'instrutor'}. 
                Para acessar outra conta, por favor deslogue primeiro.
              </p>
              <div className="flex justify-between items-center">
                <button
                  onClick={() => {
                    logout();
                    setError('');
                  }}
                  className="flex items-center gap-2 bg-yellow-800 text-white px-4 py-2 rounded-md hover:bg-yellow-900 transition-colors"
                >
                  <LogOut size={18} />
                  Deslogar
                </button>
                <button
                  onClick={() => navigate(currentUser.role === 'student' ? '/portal' : '/dashboard')}
                  className="text-yellow-800 hover:underline"
                >
                  Voltar ao painel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-[#1d528d] text-white py-2 px-4 rounded-md hover:bg-[#164070] transition-colors"
            >
              Entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}