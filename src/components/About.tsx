import React from 'react';
import Footer from './Footer';
import MainHeader from './MainHeader';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainHeader />
      
      {/* Hero Section */}
      <div className="relative bg-[#303030] text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-black bg-opacity-50">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Nossa História e Valores</h1>
            <div className="w-24 h-1 bg-[#dfa129] mx-auto mb-8"></div>
            <p className="text-xl md:text-2xl text-gray-300 leading-relaxed">
              Transformando vidas através da arte marcial, disciplina e desenvolvimento pessoal
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
        {/* História */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-6">História</h2>
            <div className="prose max-w-none">
              <p className="mb-4 text-gray-600">
                A Kihap surgiu como uma escola de Artes Marciais com a missão de transformar e enriquecer a vida das pessoas, incentivando-as a reconhecer o poder de sua energia interior por meio da prática dedicada.
              </p>
              <p className="mb-4 text-gray-600">
                Fundada na experiência de uma vida orientada pela filosofia positiva da disciplina, a Kihap foi criada para ajudar indivíduos a desenvolverem e encontrarem sinergia em seus ambientes e relações, começando sempre por si mesmos.
              </p>
              <p className="mb-4 text-gray-600">
                A palavra Kihap é composta por dois elementos: "KI", que significa energia vital, e "HAP", que representa harmonia. Assim, Kihap traduz-se em um "grito de energia", simbolizando a entrega de sua energia ao atingir um alvo. No âmbito mental e emocional, acreditamos que estabelecer metas, usar a disciplina para alcançá-las e canalizar a energia necessária para isso são essenciais para viver uma vida de ações proativas, em vez de apenas reações.
              </p>
              <p className="text-gray-600">
                Kihap representa a harmonização de nossa energia vital com o ambiente, promovendo uma transformação que ocorre de dentro para fora. Por essa razão, acreditamos nos quatro níveis de consciência: Eu, próximo, sociedade e universo.
              </p>
            </div>
          </div>
        </section>

        {/* Missão, Visão e Valores */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">Missão, Visão e Valores</h2>
            
            <div className="mb-8">
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">Missão</h3>
              <p className="text-gray-600">
                Despertar nas famílias o desejo pelo desenvolvimento pessoal e pela disciplina da arte marcial.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">Visão</h3>
              <p className="text-gray-600">
                Ser referência na introjeção de valores através do exercício físico e desenvolvimento humano.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">Valores</h3>
              <p className="text-gray-600 mb-6">
                Na Kihap, acreditamos que o desenvolvimento de valores é essencial para a formação de indivíduos completos e preparados para enfrentar os desafios do mundo. Trabalhamos com um ciclo de seis valores fundamentais, abordando três deles a cada ano.
              </p>
              <p className="text-gray-600 mb-6">
                Cada valor é cuidadosamente integrado em nosso plano de aula unificado, garantindo que todas as nossas unidades compartilhem uma abordagem coesa e consistente.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Respeito</h4>
                  <p className="text-gray-600">
                    Enfatizamos a importância de reconhecer a existência do próximo. Este valor não é apenas sobre o que sabemos, mas sobre o que fazemos. A prática do respeito é sustentada por pilares como comunicação não violenta, empatia, honra, e humildade.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Autoestima</h4>
                  <p className="text-gray-600">
                    Promovemos a alegria de ser você mesmo(a), incentivando uma autoimagem positiva e aceitação pessoal. Abordamos este valor através de pilares como ciclo social, comunicação, saúde física e mental.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Acreditar</h4>
                  <p className="text-gray-600">
                    Estimulamos a crença pessoal com o lema "Eu posso, eu consigo". Os pilares incluem sonhar, definir metas, confiar no processo, e celebrar conquistas.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Gratidão</h4>
                  <p className="text-gray-600">
                    Encorajamos o reconhecimento das coisas e pessoas pelas quais somos gratos. Este valor é explorado através de ações de gratidão e a contribuição sem esperar algo em troca.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Comunicação</h4>
                  <p className="text-gray-600">
                    Vemos a comunicação como o elo entre o mundo e o indivíduo. Trabalhamos habilidades como tom de voz adequado, escuta ativa, assertividade, e controle emocional.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Disciplina</h4>
                  <p className="text-gray-600">
                    Ensinamos que disciplina é obedecer o que é correto, sustentada por consistência, responsabilidade, planejamento, e foco.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Os Fundadores */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">Os Fundadores</h2>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">MASTER CAVENATTI E PROFESSORA CAVENATTI</h3>
            
            <div className="mb-8">
              <div className="aspect-w-16 aspect-h-9 mb-6">
                {/* Placeholder para a foto do casal Cavenatti na Coréia do Sul */}
                <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                  Foto do casal Cavenatti na Coréia do Sul
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Master Cavenatti, faixa preta 7° dan e Professora Cavenatti, faixa preta 5° dan, fundaram oficialmente o KIHAP no dia 12/01/2015, na Capital Federal. Entretanto, a essência da filosofia KIHAP já permeava as escolas, competições e empreendimentos em volta deles durante muito tempo. Entre eles, existem 14 títulos mundiais e milhares de famílias impactadas ao longo da jornada do casal na Arte Marcial.
              </p>

              <div className="aspect-w-16 aspect-h-9 mb-6">
                {/* Placeholder para a foto da fachada da primeira escola */}
                <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                  Foto da fachada da primeira escola
                </div>
              </div>

              <p className="text-gray-600 mb-6">
                A primeira aula ministrada em Brasília foi às 19h30 do dia 12 de janeiro de 2015. Essa aula já demonstrava fortes sinais do impacto dos fundadores com suas filosofias e valores na vida dos alunos. Não à toa, dos 04 alunos que fizeram uma aula experimental, 03 deles se tornaram faixas pretas.
              </p>

              <p className="text-gray-600 mb-6">
                Conforme se passaram os anos, a KIHAP já se posicionava como referência em artes marciais para toda a família, e com a dedicação de instrutores que surgiram de dentro da escola e outros tantos que abraçaram a ideia e vieram de outros lugares do Brasil, isso se tornou realidade. Além disso, todos possuíam e ainda possuem um propósito em comum: impactar famílias positivamente com a filosofia e arte marcial KIHAP.
              </p>

              <p className="text-gray-600 mb-8">
                Hoje, com mais de 20 instrutores, 06 escolas e mais de 03 mil alunos impactados somente em Brasília, a KIHAP se comporta como uma comunidade de desenvolvimento físico, mental e emocional, em que desde os fundadores até os alunos menos graduados são exemplos de que todos podem evoluir em sua própria realidade, exercendo a disciplina positiva e colocando todos os seus objetivos em harmonia.
              </p>

              {/* Citações dos fundadores */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <blockquote className="italic text-gray-600">
                    "Citação do Master Cavenatti"
                  </blockquote>
                  <p className="text-right mt-4 font-semibold text-gray-800">- Master Cavenatti</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <blockquote className="italic text-gray-600">
                    "Citação da Professora Cavenatti"
                  </blockquote>
                  <p className="text-right mt-4 font-semibold text-gray-800">- Professora Cavenatti</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Equipe */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">Equipe</h2>
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">Mestres, Professores e Instrutores</h3>
            
            <p className="text-gray-600 mb-8">
              Nossa equipe é composta por mestres, professores e instrutores altamente qualificados, dedicados a guiar nossos alunos em sua jornada de desenvolvimento pessoal e marcial.
            </p>

            <div className="aspect-w-16 aspect-h-9 mb-8">
              {/* Placeholder para a foto da equipe */}
              <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                Foto da Equipe
              </div>
            </div>

            <h3 className="text-2xl font-semibold text-gray-800 mb-6">Depoimentos de Alunos sobre os professores</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Video Placeholder 1 */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l7-5-7-5z"/>
                        </svg>
                      </div>
                      <p className="text-gray-500">Depoimento em Vídeo 1</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-800">Nome do Aluno</p>
                  <p className="text-gray-600 text-sm">Faixa Preta 2º Dan</p>
                </div>
              </div>

              {/* Video Placeholder 2 */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l7-5-7-5z"/>
                        </svg>
                      </div>
                      <p className="text-gray-500">Depoimento em Vídeo 2</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-800">Nome do Aluno</p>
                  <p className="text-gray-600 text-sm">Faixa Vermelha</p>
                </div>
              </div>

              {/* Video Placeholder 3 */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l7-5-7-5z"/>
                        </svg>
                      </div>
                      <p className="text-gray-500">Depoimento em Vídeo 3</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-800">Nome do Aluno</p>
                  <p className="text-gray-600 text-sm">Faixa Preta 1º Dan</p>
                </div>
              </div>

              {/* Video Placeholder 4 */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l7-5-7-5z"/>
                        </svg>
                      </div>
                      <p className="text-gray-500">Depoimento em Vídeo 4</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-800">Nome do Aluno</p>
                  <p className="text-gray-600 text-sm">Faixa Azul</p>
                </div>
              </div>

              {/* Video Placeholder 5 */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l7-5-7-5z"/>
                        </svg>
                      </div>
                      <p className="text-gray-500">Depoimento em Vídeo 5</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-800">Nome do Aluno</p>
                  <p className="text-gray-600 text-sm">Faixa Preta 3º Dan</p>
                </div>
              </div>

              {/* Video Placeholder 6 */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l7-5-7-5z"/>
                        </svg>
                      </div>
                      <p className="text-gray-500">Depoimento em Vídeo 6</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-800">Nome do Aluno</p>
                  <p className="text-gray-600 text-sm">Faixa Preta 1º Dan</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
