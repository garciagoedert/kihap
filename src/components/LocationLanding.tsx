import React from 'react';
import { useParams } from 'react-router-dom';
import MainHeader from './MainHeader';
import Footer from './Footer';

interface Instructor {
  name: string;
  role: string;
  photo: string;
}

interface Location {
  name: string;
  address: string;
  phone: string;
  maps: string;
}

interface LocationData {
  name: string;
  state?: string;
  heroImage: string;
  description?: string;
  address?: string;
  phone?: string;
  maps?: string;
  locations?: Location[];
  instructors: Instructor[];
}

const locationData: Record<string, LocationData> = {
  brasilia: {
    name: 'Brasília',
    state: 'DF',
    heroImage: 'https://images.pexels.com/photos/29471958/pexels-photo-29471958.jpeg',
    locations: [
      {
        name: 'Lago Sul',
        address: 'SHIS QI 11 Bloco O, Sala 108, Lago Sul',
        phone: '(61) 99999-9999',
        maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3839.5389324841837!2d-47.8821246!3d-15.7989873!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTXCsDQ3JzU2LjQiUyA0N8KwNTInNTUuNiJX!5e0!3m2!1spt-BR!2sbr!4v1629899012345!5m2!1spt-BR!2sbr'
      },
      {
        name: 'Asa Sul',
        address: 'SGAS 915, Bloco C, Sala 201, Asa Sul',
        phone: '(61) 99999-9998',
        maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3839.5389324841837!2d-47.8821246!3d-15.7989873!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTXCsDQ3JzU2LjQiUyA0N8KwNTInNTUuNiJX!5e0!3m2!1spt-BR!2sbr!4v1629899012345!5m2!1spt-BR!2sbr'
      },
      {
        name: 'Sudoeste',
        address: 'CLSW 300, Bloco B, Loja 164, Sudoeste',
        phone: '(61) 99999-9997',
        maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3839.5389324841837!2d-47.8821246!3d-15.7989873!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTXCsDQ3JzU2LjQiUyA0N8KwNTInNTUuNiJX!5e0!3m2!1spt-BR!2sbr!4v1629899012345!5m2!1spt-BR!2sbr'
      }
    ],
    instructors: [
      {
        name: 'Mestre João Silva',
        role: 'Instrutor Principal',
        photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=300&h=300&fit=crop'
      },
      {
        name: 'Professor Pedro Santos',
        role: 'Instrutor Asa Sul',
        photo: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=300&h=300&fit=crop'
      },
      {
        name: 'Professora Maria Silva',
        role: 'Instrutora Lago Sul',
        photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=300&h=300&fit=crop'
      },
      {
        name: 'Professor André Oliveira',
        role: 'Instrutor Sudoeste',
        photo: 'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?q=80&w=300&h=300&fit=crop'
      }
    ]
  },
  florianopolis: {
    name: 'Florianópolis',
    state: 'SC',
    heroImage: 'https://images.pexels.com/photos/18090774/pexels-photo-18090774.jpeg',
    locations: [
      {
        name: 'Centro',
        address: 'Rua Felipe Schmidt, 515, Centro',
        phone: '(48) 99999-9999',
        maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3535.9789184906876!2d-48.5494156!3d-27.5969136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjfCsDM1JzQ4LjkiUyA0OMKwMzInNTcuOSJX!5e0!3m2!1spt-BR!2sbr!4v1629899012345!5m2!1spt-BR!2sbr'
      },
      {
        name: 'Santa Mônica',
        address: 'Rua João Pio Duarte Silva, 404, Santa Mônica',
        phone: '(48) 99999-9998',
        maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3535.9789184906876!2d-48.5494156!3d-27.5969136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjfCsDM1JzQ4LjkiUyA0OMKwMzInNTcuOSJX!5e0!3m2!1spt-BR!2sbr!4v1629899012345!5m2!1spt-BR!2sbr'
      },
      {
        name: 'Coqueiros',
        address: 'Rua Desembargador Pedro Silva, 2958, Coqueiros',
        phone: '(48) 99999-9997',
        maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3535.9789184906876!2d-48.5494156!3d-27.5969136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjfCsDM1JzQ4LjkiUyA0OMKwMzInNTcuOSJX!5e0!3m2!1spt-BR!2sbr!4v1629899012345!5m2!1spt-BR!2sbr'
      }
    ],
    instructors: [
      {
        name: 'Mestre Carlos Santos',
        role: 'Instrutor Principal',
        photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=300&h=300&fit=crop'
      },
      {
        name: 'Professor Ricardo Lima',
        role: 'Instrutor Centro',
        photo: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=300&h=300&fit=crop'
      },
      {
        name: 'Professora Ana Costa',
        role: 'Instrutora Santa Mônica',
        photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=300&h=300&fit=crop'
      }
    ]
  },
  dourados: {
    name: 'Dourados',
    state: 'MS',
    heroImage: 'https://i.imgur.com/L5zr9gT.jpg',
    address: 'Rua Principal, 123, Centro',
    phone: '(67) 99999-9999',
    maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3736.987456321098!2d-54.8067891!3d-22.2234567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjLCsDEzJzI0LjQiUyA1NMKwNDgnMjQuNCJX!5e0!3m2!1spt-BR!2sbr!4v1629899012345!5m2!1spt-BR!2sbr',
    instructors: [
      {
        name: 'Mestre Paulo Oliveira',
        role: 'Instrutor Principal',
        photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=300&h=300&fit=crop'
      },
      {
        name: 'Professor Lucas Souza',
        role: 'Instrutor',
        photo: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=300&h=300&fit=crop'
      }
    ]
  },
  online: {
    name: 'Unidade Online',
    heroImage: 'https://kihap.com.br/wp-content/uploads/2021/12/kihap-mulheres.png',
    description: 'Treine de onde estiver com nossos instrutores experientes',
    instructors: [
      {
        name: 'Mestre Roberto Silva',
        role: 'Instrutor Principal',
        photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=300&h=300&fit=crop'
      },
      {
        name: 'Professora Carla Santos',
        role: 'Instrutora',
        photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=300&h=300&fit=crop'
      }
    ]
  }
};

export default function LocationLanding() {
  const { location } = useParams<{ location: string }>();
  const data = location ? locationData[location] : null;

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section 
          className="h-screen relative flex items-center"
          style={{
            backgroundImage: `linear-gradient(rgba(48, 48, 48, 0.6), rgba(48, 48, 48, 0.6)), url(${data.heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold text-white mb-4">
                {data.name} {data.state && `- ${data.state}`}
              </h1>
              <p className="text-xl text-gray-200 mb-8">
                Transforme sua vida através da arte marcial
              </p>
              <a
                href="#contact"
                className="inline-block bg-[#dfa129] text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-opacity-90 transition-colors"
              >
                Agende uma experiência
              </a>
            </div>
          </div>
        </section>

        {/* Location Info */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            {(location === 'florianopolis' || location === 'brasilia') && data.locations ? (
              <div className="space-y-12">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Nossas Unidades em {data.name}</h2>
                {data.locations.map((loc: Location, index: number) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-12 py-8 border-b border-gray-200 last:border-0">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-4">Unidade {loc.name}</h3>
                      <div className="space-y-4 text-gray-600">
                        <p><strong>Endereço:</strong> {loc.address}</p>
                        <p><strong>Telefone:</strong> {loc.phone}</p>
                      </div>
                    </div>
                    {loc.maps && (
                      <div className="h-[300px] rounded-lg overflow-hidden">
                        <iframe
                          src={loc.maps}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title={`Mapa da unidade ${loc.name}`}
                        ></iframe>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-6">Informações da Unidade</h2>
                  <div className="space-y-4 text-gray-600">
                    {data.address && <p><strong>Endereço:</strong> {data.address}</p>}
                    {data.phone && <p><strong>Telefone:</strong> {data.phone}</p>}
                    {data.description && <p>{data.description}</p>}
                  </div>
                </div>
                {data.maps && (
                  <div className="h-[400px] rounded-lg overflow-hidden">
                    <iframe
                      src={data.maps}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`Mapa da unidade ${data.name}`}
                    ></iframe>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Nossa Equipe</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {data.instructors.map((instructor: Instructor, index: number) => (
                <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <img 
                    src={instructor.photo}
                    alt={instructor.name}
                    className="w-full h-64 object-cover"
                  />
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{instructor.name}</h3>
                    <p className="text-gray-600">{instructor.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section id="contact" className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Agende sua Experiência</h2>
              <form className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="nome">Nome completo</label>
                  <input
                    type="text"
                    id="nome"
                    name="nome"
                    className="w-full px-4 py-2 rounded-md border-gray-300 focus:border-[#dfa129] focus:ring-1 focus:ring-[#dfa129]"
                    required
                    placeholder="Digite seu nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="w-full px-4 py-2 rounded-md border-gray-300 focus:border-[#dfa129] focus:ring-1 focus:ring-[#dfa129]"
                    required
                    placeholder="Digite seu email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="telefone">Telefone</label>
                  <input
                    type="tel"
                    id="telefone"
                    name="telefone"
                    className="w-full px-4 py-2 rounded-md border-gray-300 focus:border-[#dfa129] focus:ring-1 focus:ring-[#dfa129]"
                    required
                    placeholder="Digite seu telefone"
                  />
                </div>
                {(location === 'florianopolis' || location === 'brasilia') && data.locations && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unidade">Unidade de Interesse</label>
                    <select
                      id="unidade"
                      name="unidade"
                      className="w-full px-4 py-2 rounded-md border-gray-300 focus:border-[#dfa129] focus:ring-1 focus:ring-[#dfa129]"
                      required
                    >
                      <option value="">Selecione uma unidade</option>
                      {data.locations.map((loc: Location, index: number) => (
                        <option key={index} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-[#dfa129] text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-opacity-90 transition-colors"
                >
                  Agendar Experiência
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
