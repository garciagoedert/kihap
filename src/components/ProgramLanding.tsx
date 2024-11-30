import React from 'react';
import { useParams, Link } from 'react-router-dom';
import MainHeader from './MainHeader';
import Footer from './Footer';

interface Feature {
  title: string;
  description: string;
}

interface Character {
  name: string;
  belt: string;
  image: string;
}

interface ProgramData {
  name: string;
  ageRange: string;
  description: string;
  benefits: string[];
  image: string;
  features: Feature[];
  characters?: Character[];
}

type Programs = {
  [key: string]: ProgramData;
}

const programData: Programs = {
  'baby-littles': {
    name: 'Baby Littles',
    ageRange: '1 ano e meio a 3 anos',
    description: 'O Programa Baby Little da KIHAP é especialmente projetado para as crianças com idades entre 1 ano e meio e 3 anos, oferecendo uma introdução perfeita ao mundo das artes marciais em um ambiente seguro e estimulante. Este programa focado nos pequenos ajuda a desenvolver habilidades motoras básicas enquanto instila valores fundamentais de maneira divertida e lúdica.\n\nNossas aulas são pensadas para engajar as crianças através de atividades interativas que promovem a coordenação motora, equilíbrio e socialização. Com foco na brincadeira educativa, os Babies Littles aprendem conceitos importantes como seguir instruções, compartilhar e respeitar os outros, estabelecendo uma base sólida para seu desenvolvimento futuro.',
    benefits: [
      'Desenvolvimento Motor',
      'Socialização',
      'Ambiente Seguro e Acolhedor',
      'Introdução a Valores Fundamentais'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/baby-littles.jpg',
    features: [
      {
        title: 'Desenvolvimento Motor',
        description: 'As atividades são projetadas para aprimorar habilidades motoras básicas, como coordenação, equilíbrio e mobilidade.'
      },
      {
        title: 'Socialização',
        description: 'As aulas oferecem oportunidades para interações sociais, ajudando as crianças a desenvolverem habilidades interpessoais desde cedo.'
      },
      {
        title: 'Ambiente Seguro e Acolhedor',
        description: 'Um espaço seguro onde os pequenos podem explorar e aprender com confiança, sob a supervisão de instrutores qualificados.'
      }
    ],
    characters: [
      {
        name: 'Miles',
        belt: 'Faixa Branca',
        image: 'https://i.imgur.com/5htrmSR.png'
      },
      {
        name: 'Jun',
        belt: 'Faixa Laranja',
        image: 'https://i.imgur.com/EQTYTX4.png'
      },
      {
        name: 'Eddy',
        belt: 'Faixa Amarela',
        image: 'https://i.imgur.com/2dRvD57.png'
      },
      {
        name: 'Sachi',
        belt: 'Faixa Camuflada',
        image: 'https://i.imgur.com/KzmLUMe.png'
      },
      {
        name: 'Kobe',
        belt: 'Faixa Verde',
        image: 'https://i.imgur.com/6ZioGwz.png'
      },
      {
        name: 'Hye',
        belt: 'Faixa Roxa',
        image: 'https://i.imgur.com/h9JzXw9.png'
      },
      {
        name: 'Hope',
        belt: 'Faixa Azul',
        image: 'https://i.imgur.com/byRO2OU.png'
      },
      {
        name: 'Jeong',
        belt: 'Faixa Marrom',
        image: 'https://i.imgur.com/U7bPJln.png'
      },
      {
        name: 'Benny',
        belt: 'Faixa Vermelha',
        image: 'https://i.imgur.com/668jH8Z.png'
      }
    ]
  },
  littles: {
    name: 'Littles',
    ageRange: '4 a 7 anos',
    description: 'No Programa Littles da KIHAP, oferecemos um ambiente seguro e estimulante para o desenvolvimento das habilidades motoras e cognitivas das crianças. Nossas aulas são cuidadosamente planejadas para serem divertidas e emocionantes, utilizando métodos de instrução adaptados para cada faixa etária. Ensinamos valores importantes através da filosofia do Songahm, promovendo o aprendizado lúdico e tradicional.\n\nAs crianças são incentivadas a fazer analogias entre o que aprendem no tatame e suas experiências diárias, melhorando não apenas suas habilidades físicas, mas também seu comportamento, autoestima e disciplina. Essa abordagem holística garante que os benefícios do programa sejam percebidos em casa, na escola e em outros ambientes sociais.',
    benefits: [
      'Desenvolvimento Físico e Motor',
      'Crescimento Emocional',
      'Valores e Disciplina',
      'Integração Social'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/littles-kihap-2.jpeg',
    features: [
      {
        title: 'Desenvolvimento Físico e Motor',
        description: 'As crianças aprimoram sua coordenação motora, lateralidade e psicomotricidade através de atividades dinâmicas.'
      },
      {
        title: 'Crescimento Emocional',
        description: 'Através da repetição e de exercícios envolventes, as crianças aprendem a valorizar a si mesmas, desenvolvendo autoconfiança.'
      },
      {
        title: 'Valores e Disciplina',
        description: 'Ensinamos valores fundamentais que ajudam na formação das crianças com uma base sólida de autoestima e disciplina.'
      },
      {
        title: 'Integração Social',
        description: 'O programa incentiva a interação social, ajudando as crianças a se sentirem confortáveis em diferentes ambientes e situações.'
      }
    ],
    characters: [
      {
        name: 'Miles',
        belt: 'Faixa Branca',
        image: 'https://i.imgur.com/5htrmSR.png'
      },
      {
        name: 'Jun',
        belt: 'Faixa Laranja',
        image: 'https://i.imgur.com/EQTYTX4.png'
      },
      {
        name: 'Eddy',
        belt: 'Faixa Amarela',
        image: 'https://i.imgur.com/2dRvD57.png'
      },
      {
        name: 'Sachi',
        belt: 'Faixa Camuflada',
        image: 'https://i.imgur.com/KzmLUMe.png'
      },
      {
        name: 'Kobe',
        belt: 'Faixa Verde',
        image: 'https://i.imgur.com/6ZioGwz.png'
      },
      {
        name: 'Hye',
        belt: 'Faixa Roxa',
        image: 'https://i.imgur.com/h9JzXw9.png'
      },
      {
        name: 'Hope',
        belt: 'Faixa Azul',
        image: 'https://i.imgur.com/byRO2OU.png'
      },
      {
        name: 'Jeong',
        belt: 'Faixa Marrom',
        image: 'https://i.imgur.com/U7bPJln.png'
      },
      {
        name: 'Benny',
        belt: 'Faixa Vermelha',
        image: 'https://i.imgur.com/668jH8Z.png'
      }
    ]
  },
  kids: {
    name: 'Kids',
    ageRange: '8 a 12 anos',
    description: 'O Programa Kids da KIHAP oferece às crianças uma base sólida em lições de vida essenciais, como cortesia, respeito e disciplina. Nossas aulas são projetadas para serem seguras, divertidas e emocionantes, garantindo que as crianças desenvolvam suas habilidades motoras enquanto aumentam sua capacidade de prestar atenção e seguir instruções.\n\nUtilizando a filosofia do Taekwondo Songahm, criamos um ambiente familiar que equilibra emoção e disciplina, capturando a atenção das crianças e aprimorando sua capacidade de aprendizado. Este programa não apenas ensina técnicas de artes marciais, mas também promove o desenvolvimento de habilidades comportamentais e sociais.',
    benefits: [
      'Desenvolvimento Pessoal',
      'Autoconfiança e Realização',
      'Ambiente Familiar',
      'Impacto Positivo na Escola e em Casa'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/kids-kihap.jpeg',
    features: [
      {
        title: 'Desenvolvimento Pessoal',
        description: 'As crianças aprendem valores fundamentais como cortesia, respeito e disciplina, que são aplicáveis em todas as áreas de suas vidas.'
      },
      {
        title: 'Autoconfiança e Realização',
        description: 'Um ambiente de aprendizagem estruturado promove um sentimento de realização e autoconfiança.'
      },
      {
        title: 'Ambiente Familiar',
        description: 'O equilíbrio entre emoção e disciplina cria um espaço seguro e acolhedor para o aprendizado.'
      },
      {
        title: 'Impacto Positivo',
        description: 'As competências técnicas e comportamentais desenvolvidas refletem positivamente no desempenho escolar e no comportamento em casa.'
      }
    ]
  },
  adolescentes: {
    name: 'Adolescentes',
    ageRange: '13 a 18 anos',
    description: 'O Programa para Adolescentes da KIHAP é projetado para atender às necessidades únicas dos jovens em uma fase importante do desenvolvimento. Este programa oferece um ambiente estruturado e motivador, onde os adolescentes podem explorar o mundo das artes marciais enquanto desenvolvem habilidades essenciais para a vida.\n\nNossas aulas ajudam os adolescentes a construir confiança, disciplina e autocontrole. Utilizando a filosofia do Taekwondo Songahm, o programa promove valores como respeito e responsabilidade, preparando-os para enfrentar desafios diários com assertividade e discernimento. Além disso, o treinamento físico melhora a saúde geral, proporcionando um escape saudável para o estresse diário.',
    benefits: [
      'Desenvolvimento Pessoal e Social',
      'Aprimoramento Físico e Mental',
      'Ambiente Positivo e de Suporte',
      'Preparação para o Futuro'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/teens-kihap.jpeg',
    features: [
      {
        title: 'Desenvolvimento Pessoal e Social',
        description: 'Os adolescentes aprendem a trabalhar em equipe, respeitar os outros e assumir responsabilidade por suas ações.'
      },
      {
        title: 'Aprimoramento Físico e Mental',
        description: 'As aulas promovem a saúde física, melhorando a força, agilidade e resistência, além de fortalecer a resiliência mental.'
      },
      {
        title: 'Ambiente Positivo',
        description: 'Um espaço acolhedor onde os adolescentes se sentem parte de uma comunidade que apoia seu crescimento pessoal.'
      },
      {
        title: 'Preparação para o Futuro',
        description: 'O programa ensina habilidades que são valiosas tanto dentro quanto fora do tatame, preparando-os para o presente e para o futuro.'
      }
    ]
  },
  adultos: {
    name: 'Adultos',
    ageRange: 'Acima de 19 anos',
    description: 'O Programa para Adultos da KIHAP é uma jornada transformadora que oferece treinamento físico e mental através das artes marciais. Destinado a adultos de todas as idades e níveis de experiência, este programa ajuda a melhorar a saúde física, aumentar a resistência e promover um estilo de vida ativo.\n\nAs aulas englobam técnicas avançadas de artes marciais, defesa pessoal, treinamento com armas orientais e exercícios que promovem o condicionamento físico geral. Além disso, o programa também foca na redução do estresse e no fortalecimento mental, proporcionando uma experiência equilibrada que beneficia corpo e mente.',
    benefits: [
      'Aprimoramento Físico',
      'Redução de Estresse e Bem-Estar Mental',
      'Desenvolvimento de Habilidades Práticas',
      'Ambiente Acolhedor e Inclusivo'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/adultos-kihap.jpeg',
    features: [
      {
        title: 'Aprimoramento Físico',
        description: 'Melhoria do condicionamento cardiorrespiratório, força e flexibilidade através de exercícios variados e específicos.'
      },
      {
        title: 'Bem-Estar Mental',
        description: 'As aulas ajudam a aliviar o estresse e promovem a clareza mental, melhorando o bem-estar geral.'
      },
      {
        title: 'Habilidades Práticas',
        description: 'Aprendizado de técnicas de defesa pessoal e artes marciais, úteis para a segurança pessoal.'
      },
      {
        title: 'Ambiente Inclusivo',
        description: 'Treine em um espaço que respeita todas as idades e níveis de habilidade, incentivando a superação pessoal e o crescimento contínuo.'
      }
    ]
  },
  familia: {
    name: 'Família',
    ageRange: 'Todas as idades',
    description: 'No Programa para Família da KIHAP, acreditamos que as famílias são a essência de nossa arte marcial. Nosso programa é projetado para fortalecer os laços familiares através de atividades saudáveis e divertidas que promovem respeito e sinergia entre seus membros.\n\nA prática das artes marciais se torna um pilar na vida das famílias, oferecendo uma oportunidade única para que todos, desde crianças até adultos, compartilhem experiências enriquecedoras. Cada faixa etária tem aulas específicas que desenvolvem tanto a parte física quanto mental, respeitando as necessidades individuais de cada etapa da vida.\n\nAlém disso, oferecemos aulas familiares, onde pais e filhos podem treinar juntos no tatame. Essas aulas proporcionam um ambiente lúdico e tradicional, onde todos podem se desenvolver em conjunto, fortalecendo ainda mais os laços familiares.\n\nOferecemos aulas simultâneas para pais e filhos trazendo mais praticidade para as famílias (consulte disponibilidade).',
    benefits: [
      'Fortalecimento dos Laços Familiares',
      'Desenvolvimento Físico e Mental',
      'Ambiente Positivo e Divertido',
      'Aulas Familiares'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/familia-kihap.jpeg',
    features: [
      {
        title: 'Fortalecimento dos Laços',
        description: 'Atividades conjuntas que promovem respeito e sinergia entre os membros da família.'
      },
      {
        title: 'Desenvolvimento Integral',
        description: 'Aulas específicas para cada faixa etária que melhoram a saúde física e mental.'
      },
      {
        title: 'Ambiente Positivo',
        description: 'Um espaço onde as famílias podem se divertir e aprender juntas.'
      },
      {
        title: 'Aulas Familiares',
        description: 'Oportunidade para pais e filhos treinarem juntos, fortalecendo os vínculos através da prática conjunta.'
      }
    ]
  },
  mulheres: {
    name: 'Mulheres',
    ageRange: 'Todas as idades',
    description: 'O Programa das Mulheres da KIHAP é especialmente projetado para empoderar e fortalecer suas participantes, proporcionando técnicas de defesa pessoal desde a primeira faixa, a branca. Este treinamento é fundamental para a segurança pessoal, ajudando as alunas a desenvolver reflexos rápidos, agilidade e um forte condicionamento físico e psicológico para enfrentar situações adversas com confiança e segurança.\n\nAlém das técnicas de defesa, nossas aulas são conhecidas por promoverem o bem-estar geral. A prática regular auxilia na liberação de hormônios que melhoram o humor, reduzindo significativamente os níveis de estresse e aliviando os sintomas da TPM, proporcionando uma experiência de treino que beneficia tanto o corpo quanto a mente.',
    benefits: [
      'Segurança e Autodefesa',
      'Desenvolvimento Físico e Mental',
      'Bem-Estar e Redução de Estresse',
      'Ambiente de Apoio'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/mulheres-kihap.jpeg',
    features: [
      {
        title: 'Segurança e Autodefesa',
        description: 'Aprendizado de técnicas de defesa pessoal que aumentam a segurança e a autoconfiança.'
      },
      {
        title: 'Desenvolvimento Integral',
        description: 'Melhoria dos reflexos, agilidade e condicionamento físico, além de fortalecimento psicológico.'
      },
      {
        title: 'Bem-Estar',
        description: 'Aulas que promovem a liberação de hormônios do bem-estar, diminuindo o estresse e os sintomas da TPM.'
      },
      {
        title: 'Ambiente de Apoio',
        description: 'Um espaço seguro e acolhedor onde as mulheres podem treinar e crescer juntas.'
      }
    ]
  },
  online: {
    name: 'Aulas Online',
    ageRange: 'Todas as idades',
    description: 'O Programa de Aulas Online da KIHAP oferece a flexibilidade e conveniência de treinar artes marciais de qualquer lugar, adaptando-se a qualquer faixa etária. Você pode participar de aulas dinâmicas e interativas que mantêm o mesmo padrão de qualidade e instrução das aulas presenciais.\n\nNossas aulas online são projetadas para desenvolver habilidades físicas e mentais, proporcionando um treino completo que inclui técnicas de artes marciais, condicionamento físico e fortalecimento mental. Os participantes têm a oportunidade de aprender e melhorar suas habilidades em um ambiente virtual seguro e acessível, tornando o treinamento de artes marciais possível para todos, independentemente de sua localização.',
    benefits: [
      'Flexibilidade e Conveniência',
      'Acessibilidade',
      'Treinamento Completo',
      'Ambiente Seguro e Interativo'
    ],
    image: 'https://kihap.com.br/wp-content/uploads/2023/02/online-kihap.jpeg',
    features: [
      {
        title: 'Flexibilidade e Conveniência',
        description: 'Treine de qualquer lugar, no horário que for mais conveniente para você.'
      },
      {
        title: 'Acessibilidade',
        description: 'Disponível para todas as idades e níveis de habilidade, permitindo que todos participem.'
      },
      {
        title: 'Treinamento Completo',
        description: 'Desenvolvimento de habilidades físicas e mentais com técnicas de artes marciais e exercícios de condicionamento.'
      },
      {
        title: 'Ambiente Interativo',
        description: 'Aulas online que garantem a segurança e promovem a interação entre instrutores e alunos.'
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
              <p className="text-gray-300 mb-8 whitespace-pre-line">
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

        {/* Testimonials Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Depoimentos de Alunos</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[1, 2, 3, 4, 5, 6].map((index) => (
                <div key={index} className="bg-gray-100 rounded-lg overflow-hidden">
                  <div className="aspect-w-16 aspect-h-9">
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <div className="text-center p-4">
                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 5v10l7-5-7-5z"></path>
                          </svg>
                        </div>
                        <p className="text-gray-500">Depoimento em Vídeo {index}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-800">Nome do Aluno</p>
                    <p className="text-gray-600 text-sm">Aluno do Programa {data.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Characters Section */}
        {data.characters && (
          <section className="py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Personagens KIHAP {data.name}</h2>
              <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-3 gap-6">
                  {data.characters.map((character: Character, index: number) => (
                    <Link 
                      key={index}
                      to={`/personagem/${character.name.toLowerCase()}`}
                      className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 w-fit mx-auto"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10" />
                        <img 
                          src={character.image}
                          alt={character.name}
                          className="w-auto h-auto transform group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 z-20 p-4 text-white">
                        <div>
                          <h3 className="text-xl font-bold mb-1">{character.name}</h3>
                          <p className="text-sm text-gray-300">{character.belt}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

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
