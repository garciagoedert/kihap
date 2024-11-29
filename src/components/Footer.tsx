import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#303030] text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="col-span-1 md:col-span-2">
            <img 
              src="https://kihap.com.br/wp-content/uploads/2021/02/kihap-wh-1536x359.png" 
              alt="KIHAP Logo" 
              className="h-6 sm:h-8 w-auto mb-4"
            />
            <p className="text-gray-400 max-w-md text-sm md:text-base">
              Transformando vidas através da arte marcial desde 2015.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Programas</h3>
            <ul className="space-y-2 text-sm md:text-base">
              <li>
                <Link to="/programa/baby-littles" className="text-gray-400 hover:text-white transition-colors">
                  Baby Littles
                </Link>
              </li>
              <li>
                <Link to="/programa/littles" className="text-gray-400 hover:text-white transition-colors">
                  Littles
                </Link>
              </li>
              <li>
                <Link to="/programa/kids" className="text-gray-400 hover:text-white transition-colors">
                  Kids
                </Link>
              </li>
              <li>
                <Link to="/programa/adolescentes" className="text-gray-400 hover:text-white transition-colors">
                  Adolescentes
                </Link>
              </li>
              <li>
                <Link to="/programa/adultos" className="text-gray-400 hover:text-white transition-colors">
                  Adultos
                </Link>
              </li>
              <li>
                <Link to="/programa/familia" className="text-gray-400 hover:text-white transition-colors">
                  Família
                </Link>
              </li>
              <li>
                <Link to="/programa/mulheres" className="text-gray-400 hover:text-white transition-colors">
                  Mulheres
                </Link>
              </li>
              <li>
                <Link to="/programa/online" className="text-gray-400 hover:text-white transition-colors">
                  Online
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Links Rápidos</h3>
            <ul className="space-y-2 text-sm md:text-base">
              <li>
                <Link to="/cadastro" className="text-gray-400 hover:text-white transition-colors">
                  Agende uma experiência
                </Link>
              </li>
              <li>
                <Link to="/sobre" className="text-gray-400 hover:text-white transition-colors">
                  Sobre
                </Link>
              </li>
              <li>
                <Link to="/metodologia" className="text-gray-400 hover:text-white transition-colors">
                  Metodologia
                </Link>
              </li>
              <li>
                <Link to="/kihap-em-acao" className="text-gray-400 hover:text-white transition-colors">
                  Kihap em Ação
                </Link>
              </li>
              <li>
                <Link to="/privacidade-e-direitos" className="text-gray-400 hover:text-white transition-colors">
                  Privacidade e Direitos Autorais
                </Link>
              </li>
            </ul>

            <div className="mt-6">
              <Link
                to="/login"
                className="inline-block bg-[#dfa129] text-white px-6 py-3 rounded-md hover:bg-opacity-90 transition-colors text-center w-full font-medium"
              >
                Área do Instrutor
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-12 pt-8 text-center text-sm md:text-base text-gray-400">
          <p>&copy; {new Date().getFullYear()} KIHAP. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
