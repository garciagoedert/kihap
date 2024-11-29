import React from 'react';
import Footer from './Footer';
import MainHeader from './MainHeader';

const KihapEmAcao: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainHeader />
      
      {/* Hero Section */}
      <div className="relative bg-[#303030] text-white">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=2940&auto=format&fit=crop')`,
          }}
        >
          {/* Overlay com gradiente para melhorar legibilidade do texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-black/50" />
        </div>

        <div className="relative container mx-auto px-4 py-32 md:py-48">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-8">
              <img 
                src="https://i.imgur.com/MYwdJQ2.png" 
                alt="Logo Kihap em Ação" 
                className="w-32 md:w-40 object-contain"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Kihap em Ação</h1>
            <div className="w-24 h-1 bg-[#dfa129] mx-auto mb-8"></div>
            <p className="text-xl md:text-2xl text-gray-300 leading-relaxed">
              Transformando a sociedade através da responsabilidade social e sustentabilidade
            </p>
          </div>
        </div>

        {/* Decorative Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V120Z" fill="#F9FAFB"/>
          </svg>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Sobre o Programa */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-6">O Programa</h2>
            <div className="prose max-w-none">
              <p className="mb-4 text-gray-600">
                O Kihap em Ação é um programa de destaque que simboliza o compromisso da Kihap com a responsabilidade 
                social e o desenvolvimento sustentável.
              </p>
              <p className="mb-4 text-gray-600">
                Como signatária do Pacto Global da ONU, a Kihap alinha suas iniciativas aos Objetivos de 
                Desenvolvimento Sustentável (ODS), com foco particular nos Objetivos de Desenvolvimento 
                Sustentável - ODS.
              </p>
            </div>
          </div>
        </section>

        {/* Impacto e Compromisso */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">Impacto e Compromisso com a Sociedade</h2>
            <div className="prose max-w-none">
              <p className="mb-4 text-gray-600">
                Em parceria estratégica com a startup e.feito Social, que se dedica ao investimento social, 
                o Kihap em Ação demonstra um compromisso contínuo com a sociedade. Cada ação é cuidadosamente 
                planejada e executada com paixão.
              </p>
              <p className="mb-4 text-gray-600">
                Com a e.feito Social como parceira, estamos determinados a expandir nosso alcance e impacto, 
                sempre guiados pelos princípios de responsabilidade social corporativa e desenvolvimento sustentável.
              </p>
            </div>
          </div>
        </section>

        {/* Ações */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">Ações</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Em breve</h3>
                <p className="text-gray-600">
                  Novas ações serão adicionadas em breve. Fique atento às nossas redes sociais para mais informações.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default KihapEmAcao;
