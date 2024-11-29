import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MainHeader from './MainHeader';
import Footer from './Footer';
import { MapPin } from 'lucide-react';

const programs = [
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
    image: 'https://kihap.com.br/wp-content/uploads/2021/12/kihap-kids.jpg'
  },
  {
    name: 'Adultos',
    description: 'Programa para adolescentes e adultos',
    path: '/programa/adultos',
    image: 'https://kihap.com.br/wp-content/uploads/2021/12/kihap-adolescentes-e-adultos.jpg'
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
    unitsCount: 3
  },
  {
    name: 'Dourados',
    state: 'MS',
    path: '/unidade/dourados',
    image: 'https://images.unsplash.com/photo-1533591380348-14193f1de18f?q=80&w=1000&auto=format&fit=crop',
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
              <Link
                to="/cadastro"
                className="inline-block bg-[#dfa129] text-white px-6 py-3 rounded-md text-base md:text-lg font-medium hover:bg-opacity-90 transition-colors"
              >
                Agende uma experiência
              </Link>
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

        {/* Programs Section */}
        <section className="py-16 md:py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-8 md:mb-12">Nossos Programas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {programs.map((program, index) => (
                <Link
                  key={index}
                  to={program.path}
                  className="group bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="aspect-w-16 aspect-h-9 relative">
                    <img 
                      src={program.image}
                      alt={program.name}
                      className="w-full h-64 object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{program.name}</h3>
                    <p className="text-gray-600">{program.description}</p>
                  </div>
                </Link>
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
                <Link
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
                </Link>
              ))}
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
