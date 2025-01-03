import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MainHeader from './MainHeader';
import Footer from './Footer';
import { MapPin } from 'lucide-react';
import ScrollToTopLink from './ScrollToTopLink';

const programs = [
  {
    name: 'Baby Littles',
    description: 'Programa especial para bebês até 2 anos',
    path: '/programa/baby-littles',
    image: 'https://i.imgur.com/N1IaOpl.jpg'
  },
  {
    name: 'Littles',
    description: 'Programa especial para crianças de 3 a 6 anos',
    path: '/programa/littles',
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/littles-kihap-2.jpeg'
  },
  {
    name: 'Kids',
    description: 'Programa para crianças de 7 a 12 anos',
    path: '/programa/kids',
    image: 'https://i.imgur.com/TuOrswr.jpg'
  },
  {
    name: 'Adolescentes',
    description: 'Programa especial para adolescentes',
    path: '/programa/adolescentes',
    image: 'https://i.imgur.com/nNaAx6f.jpg'
  },
  {
    name: 'Adultos',
    description: 'Programa para adultos',
    path: '/programa/adultos',
    image: 'https://kihap.com.br/wp-content/uploads/2021/12/kihap-adolescentes-e-adultos.jpg'
  },
  {
    name: 'Família',
    description: 'Programa especial para toda a família treinar junta',
    path: '/programa/familia',
    image: 'https://i.imgur.com/x7Yj2rj.jpg'
  },
  {
    name: 'Mulheres',
    description: 'Programa exclusivo para mulheres',
    path: '/programa/mulheres',
    image: 'https://i.imgur.com/frJfdib.jpg'
  },
  {
    name: 'Online',
    description: 'Treine de onde estiver com nosso programa online',
    path: '/programa/online',
    image: 'https://i.imgur.com/1rng4W1.jpg'
  }
];

const cities = [
  {
    name: 'Florianópolis',
    state: 'SC',
    path: '/unidade/florianopolis',
    image: 'https://images.pexels.com/photos/18090774/pexels-photo-18090774.jpeg',
    unitsCount: 3
  },
  {
    name: 'Brasília',
    state: 'DF',
    path: '/unidade/brasilia',
    image: 'https://images.pexels.com/photos/29471958/pexels-photo-29471958.jpeg',
    unitsCount: 5
  },
  {
    name: 'Dourados',
    state: 'MS',
    path: '/unidade/dourados',
    image: 'https://i.imgur.com/L5zr9gT.jpg',
    unitsCount: 1
  }
];

export default function Home() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      
      <main>
        {/* Hero Section */}
        <section 
          className="h-screen relative flex items-center"
          style={{
            backgroundImage: 'linear-gradient(rgba(48, 48, 48, 0.6), rgba(48, 48, 48, 0.6)), url(https://kihap.com.br/wp-content/uploads/2021/02/hero-01.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-6">
                A força para a mudança que você precisa está dentro de você
              </h1>
              <ScrollToTopLink
                to="/cadastro"
                className="inline-block bg-[#dfa129] text-white px-6 py-3 rounded-md text-base md:text-lg font-medium hover:bg-opacity-90 transition-colors"
              >
                Agende uma experiência
              </ScrollToTopLink>
            </div>
          </div>
        </section>

        {/* Purpose Section */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Nosso Propósito</h2>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                Nosso propósito é que as pessoas (re)conheçam o poder da energia interior e que, com disciplina positiva, entre em harmonia com o objetivo definido e evolua a sua própria realidade.
              </p>
            </div>
          </div>
        </section>

        {/* Why Kihap Section */}
        <section className="py-16 md:py-20 bg-[#1d528d]">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-12">Por que Kihap?</h2>
              
              <div className="space-y-12">
                <div className="text-lg text-gray-200 leading-relaxed">
                  <p className="mb-8">
                    KI se traduz em ENERGIA, então a palavra KiHap, que significa gritar quando você atinge um alvo, basicamente se traduz em GRITO DE ENERGIA. Você está entregando sua energia ao alvo. Entendemos que no processo mental e emocional, conseguir estabelecer seus alvos, utilizar da disciplina para conquistá-los e conseguir canalizar e exteriorizar a energia necessária para atingi-lo, é fundamental para que se tenha uma vida de atitudes ativas e não somente atitudes reativas.
                  </p>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-bold text-[#dfa129] mb-4">Artes Marciais:</h3>
                      <p>
                        Temos como missão ajudar a melhorar o mundo desenvolvendo pessoas na parte física e mental, através da filosofia e arte marcial Kihap. Nossos alunos têm acesso a um ambiente familiar e são conduzidos de forma gradual e controlada a superar seus limites e desenvolver habilidades como consistência, disciplina, cortesia e honra.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-[#dfa129] mb-4">Desenvolvimento pessoal:</h3>
                      <p>
                        Nossa história de busca por excelência física, técnica e mental, desenvolvimento de pessoas, formação de times e gestão de negócios foi consolidada em um método para te levar para a mente faixa preta e atingir seus objetivos fora do tatame.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Programs Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-gray-100">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-12">
              Nossos Programas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 max-w-7xl mx-auto">
              {programs.map((program, index) => (
                <ScrollToTopLink
                  key={index}
                  to={program.path}
                  className="group relative bg-white rounded-xl overflow-hidden transform hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl"
                >
                  <div className="relative h-56 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
                    <img 
                      src={program.image}
                      alt={program.name}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 bg-white relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-white/100 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <h3 className="text-xl font-bold text-gray-800 mb-3 relative z-10 group-hover:text-[#dfa129] transition-colors duration-300">
                      {program.name}
                    </h3>
                    <p className="text-gray-600 relative z-10 group-hover:text-gray-800 transition-colors duration-300 leading-relaxed">
                      {program.description}
                    </p>
                  </div>
                </ScrollToTopLink>
              ))}
            </div>
          </div>
        </section>

        {/* Locations Section */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-8 md:mb-12">Onde Estamos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
              {cities.map((city, index) => (
                <ScrollToTopLink
                  key={index}
                  to={city.path}
                  className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {/* Image with gradient overlay */}
                  <div className="relative h-48">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10" />
                    <img 
                      src={city.image}
                      alt={city.name}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Content overlay */}
                  <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 text-white">
                    <div className="flex items-center gap-2">
                      <MapPin size={20} className="text-[#dfa129]" />
                      <div>
                        <h3 className="text-xl font-bold">
                          {city.name}
                        </h3>
                        <p className="text-sm text-gray-300">
                          {city.state} • {city.unitsCount} {city.unitsCount === 1 ? 'unidade' : 'unidades'}
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollToTopLink>
              ))}
            </div>
          </div>
        </section>

        {/* Kihap Academy Section */}
        <section className="py-16 md:py-20 bg-[#1a1a1a] relative">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden rounded-lg">
              {/* Background Image with Overlay */}
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://imgur.com/bh6pyDC.png')`,
                  backgroundPosition: 'center 25%'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/50" />
              </div>

              {/* Content */}
              <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <img 
                    src="https://imgur.com/DOSZQbH.png" 
                    alt="Logo Kihap Academy" 
                    className="w-32 md:w-40 object-contain mb-6"
                  />
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Kihap Academy
                  </h2>
                  <p className="text-lg text-gray-300 mb-6">
                    Desenvolvimento profissional e pessoal através dos três pilares: Cultura, Processos e Tatame.
                  </p>
                  <ScrollToTopLink
                    to="/kihap-academy"
                    className="inline-block bg-[#dfa129] text-white px-6 py-3 rounded-md font-medium hover:bg-opacity-90 transition-colors"
                  >
                    Saiba mais
                  </ScrollToTopLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="py-16 md:py-20 bg-[#1d528d]">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
                Receba as novidades
              </h2>
              <p className="text-gray-300 mb-8">
                Inscreva-se em nossa newsletter e fique por dentro das novidades.
              </p>
              <div className="flex justify-center">
                <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
                  <iframe 
                    src="https://embeds.beehiiv.com/10b6139c-0d4d-433d-aae7-5f4c46eb98a1?slim=true" 
                    data-test-id="beehiiv-embed" 
                    height="52" 
                    frameBorder="0" 
                    scrolling="no" 
                    style={{ 
                      margin: '0 auto',
                      borderRadius: '0.5rem',
                      backgroundColor: 'transparent',
                      width: '100%',
                      maxWidth: '500px'
                    }}
                    className="mx-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
