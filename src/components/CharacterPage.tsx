import React from 'react';
import { useParams, Link } from 'react-router-dom';
import MainHeader from './MainHeader';
import Footer from './Footer';

interface Character {
  name: string;
  belt: string;
  image: string;
  program: string;
  description: string;
  traits: string[];
  skills: string[];
}

const charactersData: { [key: string]: Character } = {
  'miles': {
    name: 'Miles',
    belt: 'Faixa Branca',
    image: 'https://i.imgur.com/5htrmSR.png',
    program: 'Littles',
    description: 'Miles é um personagem curioso e determinado, sempre pronto para aprender novas habilidades. Como faixa branca, ele representa o início da jornada nas artes marciais, trazendo consigo entusiasmo e vontade de aprender.',
    traits: [
      'Curioso',
      'Determinado',
      'Entusiasta',
      'Amigável'
    ],
    skills: [
      'Posturas básicas',
      'Equilíbrio inicial',
      'Coordenação motora',
      'Disciplina'
    ]
  },
  'jun': {
    name: 'Jun',
    belt: 'Faixa Laranja',
    image: 'https://i.imgur.com/EQTYTX4.png',
    program: 'Littles',
    description: 'Jun é uma personagem energética e criativa, que adora ajudar seus amigos. Com sua faixa laranja, ela demonstra progresso e dedicação em sua jornada nas artes marciais.',
    traits: [
      'Energética',
      'Criativa',
      'Prestativa',
      'Alegre'
    ],
    skills: [
      'Movimentos básicos',
      'Trabalho em equipe',
      'Coordenação avançada',
      'Foco'
    ]
  },
  'eddy': {
    name: 'Eddy',
    belt: 'Faixa Amarela',
    image: 'https://i.imgur.com/2dRvD57.png',
    program: 'Littles',
    description: 'Eddy é conhecido por sua perseverança e espírito aventureiro. Como faixa amarela, ele mostra que com dedicação e prática constante, podemos alcançar nossos objetivos.',
    traits: [
      'Perseverante',
      'Aventureiro',
      'Dedicado',
      'Corajoso'
    ],
    skills: [
      'Técnicas intermediárias',
      'Autocontrole',
      'Resistência',
      'Liderança inicial'
    ]
  },
  'sachi': {
    name: 'Sachi',
    belt: 'Faixa Camuflada',
    image: 'https://i.imgur.com/KzmLUMe.png',
    program: 'Littles',
    description: 'Sachi é uma personagem observadora e estratégica. Sua faixa camuflada representa sua adaptabilidade e capacidade de enfrentar diferentes desafios.',
    traits: [
      'Observadora',
      'Estratégica',
      'Adaptável',
      'Paciente'
    ],
    skills: [
      'Adaptabilidade',
      'Estratégia',
      'Percepção espacial',
      'Equilíbrio avançado'
    ]
  },
  'kobe': {
    name: 'Kobe',
    belt: 'Faixa Verde',
    image: 'https://i.imgur.com/6ZioGwz.png',
    program: 'Littles',
    description: 'Kobe é um personagem focado e disciplinado. Com sua faixa verde, ele demonstra crescimento constante e compromisso com seu desenvolvimento.',
    traits: [
      'Focado',
      'Disciplinado',
      'Comprometido',
      'Responsável'
    ],
    skills: [
      'Técnicas avançadas',
      'Disciplina mental',
      'Força física',
      'Liderança'
    ]
  },
  'hye': {
    name: 'Hye',
    belt: 'Faixa Roxa',
    image: 'https://i.imgur.com/h9JzXw9.png',
    program: 'Littles',
    description: 'Hye é uma personagem sábia e mentora. Sua faixa roxa representa seu conhecimento profundo e capacidade de inspirar outros.',
    traits: [
      'Sábia',
      'Mentora',
      'Inspiradora',
      'Calma'
    ],
    skills: [
      'Mentoria',
      'Técnicas especializadas',
      'Equilíbrio mental',
      'Ensino'
    ]
  },
  'hope': {
    name: 'Hope',
    belt: 'Faixa Azul',
    image: 'https://i.imgur.com/byRO2OU.png',
    program: 'Littles',
    description: 'Hope é uma personagem otimista e resiliente. Sua faixa azul simboliza sua maturidade e capacidade de superar desafios.',
    traits: [
      'Otimista',
      'Resiliente',
      'Madura',
      'Determinada'
    ],
    skills: [
      'Resiliência',
      'Técnicas avançadas',
      'Liderança pelo exemplo',
      'Autocontrole avançado'
    ]
  },
  'jeong': {
    name: 'Jeong',
    belt: 'Faixa Marrom',
    image: 'https://i.imgur.com/U7bPJln.png',
    program: 'Littles',
    description: 'Jeong é um personagem experiente e dedicado. Sua faixa marrom representa anos de prática e profundo entendimento das artes marciais.',
    traits: [
      'Experiente',
      'Dedicado',
      'Mentor',
      'Paciente'
    ],
    skills: [
      'Técnicas avançadas',
      'Mentoria',
      'Liderança',
      'Sabedoria marcial'
    ]
  },
  'benny': {
    name: 'Benny',
    belt: 'Faixa Vermelha',
    image: 'https://i.imgur.com/668jH8Z.png',
    program: 'Littles',
    description: 'Benny é um personagem que representa o mais alto nível de excelência. Sua faixa vermelha simboliza maestria e dedicação completa às artes marciais.',
    traits: [
      'Mestre',
      'Sábio',
      'Líder',
      'Inspirador'
    ],
    skills: [
      'Maestria técnica',
      'Liderança suprema',
      'Sabedoria profunda',
      'Mentoria avançada'
    ]
  }
};

export default function CharacterPage() {
  const { characterId } = useParams<{ characterId: string }>();
  const character = characterId ? charactersData[characterId.toLowerCase()] : null;

  if (!character) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-gray-900 to-gray-800">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="relative">
                  <img 
                    src={character.image}
                    alt={character.name}
                    className="w-full h-auto max-h-[500px] object-contain rounded-lg"
                  />
                </div>
                <div className="text-white">
                  <div className="mb-4">
                    <h1 className="text-4xl font-bold mb-2">{character.name}</h1>
                    <p className="text-xl text-gray-300">{character.belt}</p>
                    <p className="text-gray-400">Programa {character.program}</p>
                  </div>
                  <p className="text-gray-300 mb-8">
                    {character.description}
                  </p>
                  <Link
                    to={`/programa/${character.program.toLowerCase().replace(' ', '-')}`}
                    className="inline-block bg-[#dfa129] text-white px-6 py-3 rounded-md text-lg font-medium hover:bg-opacity-90 transition-colors"
                  >
                    Voltar para {character.program}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Characteristics Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Características</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {character.traits.map((trait, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-800 font-medium">{trait}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Habilidades</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {character.skills.map((skill, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-800 font-medium">{skill}</p>
                      </div>
                    ))}
                  </div>
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
