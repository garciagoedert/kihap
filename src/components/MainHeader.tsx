import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function MainHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if we're on the home page
  const isHomePage = location.pathname === '/';

  // Only use transparent background on home page
  const useTransparentBg = isHomePage && !isScrolled;

  return (
    <>
      <header className={`fixed w-full top-0 z-50 transition-colors duration-300 ${
        useTransparentBg ? 'bg-transparent' : 'bg-[#303030]'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <img 
                src="https://kihap.com.br/wp-content/uploads/2021/02/kihap-wh-1536x359.png" 
                alt="KIHAP Logo" 
                className="h-6 sm:h-8 w-auto"
              />
            </Link>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 bg-[#dfa129] hover:bg-[#c78b1f] rounded-md transition-colors"
              aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Side Menu */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 z-40 ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      <div 
        className={`fixed top-0 right-0 h-full w-[280px] bg-[#303030] z-50 transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-end p-4 border-b border-gray-700">
          <button
            onClick={() => setIsMenuOpen(false)}
            className="p-2 bg-[#dfa129] hover:bg-[#c78b1f] rounded-md transition-colors text-white"
            aria-label="Fechar menu"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        <nav className="h-[calc(100%-64px)] overflow-y-auto">
          <div className="flex flex-col p-4 space-y-6">
            <Link
              to="/"
              className="text-white hover:text-gray-300 transition-colors text-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>

            <Link
              to="/sobre"
              className="text-white hover:text-gray-300 transition-colors text-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Sobre
            </Link>

            <Link
              to="/metodologia"
              className="text-white hover:text-gray-300 transition-colors text-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Metodologia
            </Link>

            <Link
              to="/kihap-em-acao"
              className="text-white hover:text-gray-300 transition-colors text-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Kihap em Ação
            </Link>

            {/* Programs */}
            <div className="space-y-3">
              <h3 className="text-gray-400 uppercase text-sm font-medium">Programas</h3>
              <div className="flex flex-col space-y-3 pl-2">
                <Link
                  to="/programa/littles"
                  className="text-white hover:text-gray-300 transition-colors text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Littles
                </Link>
                <Link
                  to="/programa/kids"
                  className="text-white hover:text-gray-300 transition-colors text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Kids
                </Link>
                <Link
                  to="/programa/adultos"
                  className="text-white hover:text-gray-300 transition-colors text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Adultos
                </Link>
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-3">
              <h3 className="text-gray-400 uppercase text-sm font-medium">Unidades</h3>
              <div className="flex flex-col space-y-3 pl-2">
                <Link
                  to="/unidade/brasilia"
                  className="text-white hover:text-gray-300 transition-colors text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Brasília - DF
                </Link>
                <Link
                  to="/unidade/florianopolis"
                  className="text-white hover:text-gray-300 transition-colors text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Florianópolis - SC
                </Link>
                <Link
                  to="/unidade/dourados"
                  className="text-white hover:text-gray-300 transition-colors text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dourados - MG
                </Link>
                <Link
                  to="/unidade/online"
                  className="text-white hover:text-gray-300 transition-colors text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Unidade Online
                </Link>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <Link
                to="/portal"
                className="block w-full bg-[#dfa129] text-white px-6 py-3 rounded-md hover:bg-opacity-90 transition-colors text-center font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Área do Aluno
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
