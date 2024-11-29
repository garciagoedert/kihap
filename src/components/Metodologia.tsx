import React from 'react';
import Footer from './Footer';
import MainHeader from './MainHeader';

const Metodologia: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainHeader />
      
      {/* Hero Section */}
      <div className="relative bg-[#303030] text-white">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=2942&auto=format&fit=crop')`,
          }}
        >
          {/* Overlay com gradiente para melhorar legibilidade do texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-black/50" />
        </div>

        <div className="relative container mx-auto px-4 py-32 md:py-48">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Metodologia Kihap</h1>
            <div className="w-24 h-1 bg-[#dfa129] mx-auto mb-8"></div>
            <p className="text-xl md:text-2xl text-gray-300 leading-relaxed">
              Transformando vidas através da energia interior e disciplina positiva
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
        {/* Metodologia */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-6">A Metodologia Kihap</h2>
            <div className="prose max-w-none">
              <p className="mb-4 text-gray-600">
                A metodologia Kihap é uma abordagem única que integra disciplina positiva com desenvolvimento pessoal, 
                adaptando-se ao tempo e à realidade de cada indivíduo. Nosso foco é promover uma transformação de dentro 
                para fora, criando harmonia entre a energia interior e o ambiente externo.
              </p>
              <p className="mb-4 text-gray-600">
                O método Kihap fundamenta-se no princípio de que a força para a mudança reside dentro de cada pessoa. 
                Encorajamos nossos alunos a reconhecerem e explorarem essa energia interior, estabelecendo metas claras 
                e utilizando a disciplina como ferramenta para alcançá-las.
              </p>
            </div>
          </div>
        </section>

        {/* Processo */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">O Processo</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="text-xl font-semibold text-gray-800 mb-4">(Re)conhecer a energia interior</h4>
                <p className="text-gray-600">
                  O primeiro passo é reconhecer e compreender sua própria energia vital.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="text-xl font-semibold text-gray-800 mb-4">Definir objetivos/alvos</h4>
                <p className="text-gray-600">
                  Estabelecer metas claras e alcançáveis para direcionar sua energia.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="text-xl font-semibold text-gray-800 mb-4">Desenvolver uma disciplina positiva</h4>
                <p className="text-gray-600">
                  Criar hábitos e rotinas que apoiem seu desenvolvimento pessoal.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="text-xl font-semibold text-gray-800 mb-4">Harmonizar a energia interior com o exterior</h4>
                <p className="text-gray-600">
                  Alinhar suas ações e energia com o ambiente ao seu redor.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="text-xl font-semibold text-gray-800 mb-4">Comunicar e exteriorizar essa energia</h4>
                <p className="text-gray-600">
                  Expressar sua energia de forma positiva e construtiva.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">6 Principais Benefícios dos Programas</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Desenvolvimento Físico</h3>
                <p className="text-gray-600">
                  Melhora da coordenação motora, flexibilidade, força muscular e condicionamento cardiorrespiratório. 
                  As aulas são projetadas para promover um alto gasto calórico e melhorar a saúde física geral.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Disciplina e Respeito</h3>
                <p className="text-gray-600">
                  As artes marciais ensinam valores fundamentais como disciplina, respeito e cortesia, que são 
                  aplicáveis em todas as áreas da vida.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Autoconfiança e Segurança</h3>
                <p className="text-gray-600">
                  Aprender técnicas de defesa pessoal aumenta a autoconfiança e a sensação de segurança, especialmente 
                  em programas voltados para mulheres e adolescentes.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Bem-Estar Mental</h3>
                <p className="text-gray-600">
                  As aulas ajudam a liberar hormônios do bem-estar, reduzindo o estresse e melhorando o humor. Isso é 
                  particularmente benéfico para aliviar sintomas de ansiedade e tensão.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Desenvolvimento Social</h3>
                <p className="text-gray-600">
                  Os programas promovem a interação social, ajudando a construir amizades baseadas em respeito e 
                  sinergia. Isso é especialmente valioso em programas familiares e para crianças.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Crescimento Pessoal</h3>
                <p className="text-gray-600">
                  As aulas incentivam o desenvolvimento de habilidades pessoais, como assertividade, discernimento e 
                  autoconhecimento, preparando os alunos para enfrentar desafios com confiança.
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

export default Metodologia;
