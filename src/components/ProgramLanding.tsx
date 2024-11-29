import React from 'react';
import { useParams, Link } from 'react-router-dom';
import MainHeader from './MainHeader';
import Footer from './Footer';

interface Feature {
  title: string;
  description: string;
}

interface ProgramData {
  name: string;
  ageRange: string;
  description: string;
  benefits: string[];
  image: string;
  features: Feature[];
}

type Programs = {
  [key: string]: ProgramData;
}

const programData: Programs = {
  'baby-littles': {
    name: 'Baby Littles',
    ageRange: '0 a 2 anos',
    description: 'Programa exclusivo para bebês até 2 anos, focando no desenvolvimento sensorial, motor e social através de atividades adaptadas e estimulantes.',
    benefits: [
      'Desenvolvimento sensorial',
      'Coordenação motora inicial',
      'Socialização precoce',
      'Vínculo familiar',
      'Estimulação cognitiva',
      'Adaptação social'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/baby-littles.jpg',
    features: [
      {
        title: 'Ambiente Adaptado',
        description: 'Espaço seguro e adequado para bebês'
      },
      {
        title: 'Atividades Sensoriais',
        description: 'Estímulos específicos para a primeira infância'
      },
      {
        title: 'Interação Pais e Bebês',
        description: 'Fortalecimento do vínculo familiar'
      }
    ]
  },
  littles: {
    name: 'Littles',
    ageRange: '3 a 6 anos',
    description: 'Programa especialmente desenvolvido para crianças de 3 a 6 anos, focando no desenvolvimento motor, cognitivo e social através de atividades lúdicas e divertidas.',
    benefits: [
      'Desenvolvimento motor',
      'Coordenação motora',
      'Socialização',
      'Disciplina',
      'Respeito',
      'Autoconfiança'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/littles-kihap-2.jpeg',
    features: [
      {
        title: 'Metodologia Exclusiva',
        description: 'Aulas dinâmicas e divertidas, adaptadas para a faixa etária'
      },
      {
        title: 'Desenvolvimento Integral',
        description: 'Foco no desenvolvimento físico, mental e social'
      },
      {
        title: 'Ambiente Seguro',
        description: 'Espaço preparado e equipe especializada'
      }
    ]
  },
  kids: {
    name: 'Kids',
    ageRange: '7 a 12 anos',
    description: 'Programa completo para crianças de 7 a 12 anos, combinando arte marcial tradicional com desenvolvimento pessoal e valores fundamentais.',
    benefits: [
      'Disciplina',
      'Foco',
      'Respeito',
      'Autodefesa',
      'Condicionamento físico',
      'Trabalho em equipe'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2021/12/kihap-kids.jpg',
    features: [
      {
        title: 'Formação Completa',
        description: 'Desenvolvimento técnico e pessoal'
      },
      {
        title: 'Valores e Princípios',
        description: 'Ensino de valores fundamentais para a vida'
      },
      {
        title: 'Preparação Física',
        description: 'Desenvolvimento atlético adequado à idade'
      }
    ]
  },
  adolescentes: {
    name: 'Adolescentes',
    ageRange: '13 a 17 anos',
    description: 'Programa especializado para adolescentes, focando no desenvolvimento físico, mental e emocional durante esta fase crucial de transformação.',
    benefits: [
      'Autoconfiança',
      'Gestão emocional',
      'Preparação física',
      'Autodefesa',
      'Liderança',
      'Foco nos estudos'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2021/12/kihap-adolescentes.jpg',
    features: [
      {
        title: 'Desenvolvimento Integral',
        description: 'Equilíbrio entre corpo, mente e emoções'
      },
      {
        title: 'Preparação para Vida',
        description: 'Habilidades essenciais para o futuro'
      },
      {
        title: 'Ambiente Motivador',
        description: 'Suporte para superar desafios'
      }
    ]
  },
  adultos: {
    name: 'Adultos',
    ageRange: 'A partir de 18 anos',
    description: 'Programa avançado para adultos, focando em técnica, condicionamento físico e desenvolvimento pessoal.',
    benefits: [
      'Condicionamento físico',
      'Autodefesa',
      'Redução do estresse',
      'Flexibilidade',
      'Força mental',
      'Networking'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2021/12/kihap-adolescentes-e-adultos.jpg',
    features: [
      {
        title: 'Treino Completo',
        description: 'Combinação de técnica, força e condicionamento'
      },
      {
        title: 'Desenvolvimento Pessoal',
        description: 'Foco em superação e crescimento'
      },
      {
        title: 'Comunidade',
        description: 'Ambiente de suporte e networking'
      }
    ]
  },
  familia: {
    name: 'Família',
    ageRange: 'Todas as idades',
    description: 'Programa especial que permite que toda a família treine junta, fortalecendo laços e compartilhando experiências através da arte marcial.',
    benefits: [
      'União familiar',
      'Momentos especiais',
      'Valores compartilhados',
      'Saúde em família',
      'Desenvolvimento conjunto',
      'Memórias duradouras'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/familia-kihap.jpg',
    features: [
      {
        title: 'Treino Integrado',
        description: 'Atividades adaptadas para todas as idades'
      },
      {
        title: 'Fortalecimento de Laços',
        description: 'Experiências compartilhadas em família'
      },
      {
        title: 'Valores Familiares',
        description: 'Construção de legado e tradições'
      }
    ]
  },
  mulheres: {
    name: 'Mulheres',
    ageRange: 'Todas as idades',
    description: 'Programa exclusivo para mulheres, focando em autodefesa, empoderamento e bem-estar físico e mental.',
    benefits: [
      'Autodefesa',
      'Empoderamento',
      'Condicionamento físico',
      'Autoconfiança',
      'Bem-estar mental',
      'Comunidade feminina'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/mulheres-kihap.jpg',
    features: [
      {
        title: 'Ambiente Exclusivo',
        description: 'Espaço seguro e acolhedor'
      },
      {
        title: 'Empoderamento',
        description: 'Desenvolvimento de força e confiança'
      },
      {
        title: 'Comunidade',
        description: 'Rede de apoio e amizades'
      }
    ]
  },
  online: {
    name: 'Online',
    ageRange: 'Todas as idades',
    description: 'Programa de treinamento online que permite praticar de qualquer lugar, com flexibilidade de horários e acompanhamento personalizado.',
    benefits: [
      'Flexibilidade',
      'Treino em casa',
      'Acompanhamento remoto',
      'Economia de tempo',
      'Suporte online',
      'Comunidade virtual'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/online-kihap.jpg',
    features: [
      {
        title: 'Flexibilidade Total',
        description: 'Treine quando e onde quiser'
      },
      {
        title: 'Suporte Contínuo',
        description: 'Acompanhamento online personalizado'
      },
      {
        title: 'Conteúdo Exclusivo',
        description: 'Material didático e vídeos especiais'
      }
    ]
  }
};

export default function ProgramLanding() {
  const { program } = useParams<{ program: string }>();
  const data = program ? programData[program] : null;

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section 
          className="h-screen relative flex items-center"
          style={{
            backgroundImage: `linear-gradient(rgba(48, 48, 48, 0.6), rgba(48, 48, 48, 0.6)), url(${data.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold text-white mb-2">
                Programa {data.name}
              </h1>
              <p className="text-xl text-gray-200 mb-4">
                Para {data.ageRange}
              </p>
              <p className="text-gray-300 mb-8">
                {data.description}
              </p>
              <Link
                to="/cadastro"
                className="inline-block bg-[#dfa129] text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-opacity-90 transition-colors"
              >
                Agende uma experiência
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Benefícios</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
              {data.benefits.map((benefit: string, index: number) => (
                <div key={index} className="bg-white rounded-lg shadow-lg p-4 md:p-6 text-center">
                  <h3 className="text-sm md:text-base lg:text-lg font-semibold text-gray-800 whitespace-normal break-words">
                    {benefit}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Diferenciais</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {data.features.map((feature: Feature, index: number) => (
                <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4 whitespace-normal break-words">
                    {feature.title}
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 whitespace-normal break-words">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section 
          className="py-20 relative"
          style={{
            backgroundImage: 'linear-gradient(rgba(29, 82, 141, 0.95), rgba(29, 82, 141, 0.95)), url(https://kihap.com.br/wp-content/uploads/2021/02/hero-01.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        >
          <div className="container mx-auto px-4 text-center relative z-10">
            <h2 className="text-3xl font-bold text-white mb-6">Comece sua jornada hoje</h2>
            <p className="text-gray-200 mb-8 max-w-2xl mx-auto">
              Transforme sua vida através da arte marcial. Agende uma aula experimental gratuita e conheça nossa metodologia.
            </p>
            <Link
              to="/cadastro"
              className="inline-block bg-[#dfa129] text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-opacity-90 transition-colors"
            >
              Agende uma experiência
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
