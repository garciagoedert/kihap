import { Store, Product, Unit, User, Badge, OnlineContent, LiveClass, Lead } from './types';

export const initialLeads: Lead[] = [
  {
    id: '1',
    name: 'João Silva',
    email: 'joao.silva@email.com',
    phone: '(48) 99999-1111',
    status: 'novo',
    source: 'site',
    unitId: '1',
    createdAt: new Date().toISOString(),
    value: 199.90,
    history: []
  },
  {
    id: '2',
    name: 'Maria Santos',
    email: 'maria.santos@email.com',
    phone: '(48) 99999-2222',
    status: 'contato',
    source: 'instagram',
    unitId: '1',
    createdAt: new Date().toISOString(),
    value: 299.90,
    history: []
  },
  {
    id: '3',
    name: 'Pedro Oliveira',
    email: 'pedro.oliveira@email.com',
    phone: '(48) 99999-3333',
    status: 'visitou',
    source: 'indicação',
    unitId: '1',
    createdAt: new Date().toISOString(),
    value: 399.90,
    history: []
  },
  {
    id: '4',
    name: 'Ana Costa',
    email: 'ana.costa@email.com',
    phone: '(48) 99999-4444',
    status: 'matriculado',
    source: 'facebook',
    unitId: '1',
    createdAt: new Date().toISOString(),
    value: 499.90,
    history: []
  },
  {
    id: '5',
    name: 'Lucas Pereira',
    email: 'lucas.pereira@email.com',
    phone: '(48) 99999-5555',
    status: 'desistente',
    source: 'google',
    unitId: '1',
    createdAt: new Date().toISOString(),
    value: 199.90,
    history: []
  }
];

export const initialStores: Store[] = [
  {
    id: '1',
    name: 'KIHAP STORE Florianópolis',
    city: 'Florianópolis',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'KIHAP STORE Dourados',
    city: 'Dourados (Jardim América)',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'KIHAP STORE Brasília',
    city: 'Brasília',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    name: 'KIHAP STORE Online',
    city: 'Online',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const initialProducts: Product[] = [
  {
    id: '1',
    name: 'Dobok Kihap',
    description: 'Dobok oficial Kihap Taekwondo',
    price: 299.90,
    image: 'https://placehold.co/400x400/white/black?text=Dobok+Kihap',
    category: 'Uniformes',
    storeId: '4', // Online
    stock: 50,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Faixa Preta',
    description: 'Faixa Preta oficial Kihap Taekwondo',
    price: 89.90,
    image: 'https://placehold.co/400x400/black/white?text=Faixa+Preta',
    category: 'Faixas',
    storeId: '4', // Online
    stock: 30,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const initialUnits: Unit[] = [
  {
    id: '1',
    name: 'Kihap Florianópolis',
    city: 'Florianópolis',
    address: 'Rua Principal, 123',
    phone: '(48) 99999-9999',
    email: 'floripa@kihap.com.br',
    active: true,
    subunits: [
      {
        id: '1-1',
        name: 'Santa Mônica',
        address: 'Rua Santa Mônica, 100',
        phone: '(48) 99999-9991',
        email: 'santamonica@kihap.com.br',
        active: true,
        parentUnitId: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '1-2',
        name: 'Centro',
        address: 'Rua do Centro, 200',
        phone: '(48) 99999-9992',
        email: 'centro@kihap.com.br',
        active: true,
        parentUnitId: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '1-3',
        name: 'Coqueiros',
        address: 'Rua dos Coqueiros, 300',
        phone: '(48) 99999-9993',
        email: 'coqueiros@kihap.com.br',
        active: true,
        parentUnitId: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Kihap Dourados',
    city: 'Dourados',
    address: 'Jardim América, 456',
    phone: '(67) 99999-9999',
    email: 'dourados@kihap.com.br',
    active: true,
    subunits: [
      {
        id: '2-1',
        name: 'Jardim América',
        address: 'Rua Jardim América, 100',
        phone: '(67) 99999-9991',
        email: 'jardimamerica@kihap.com.br',
        active: true,
        parentUnitId: '2',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'Kihap Brasília',
    city: 'Brasília',
    address: 'Setor Central, 789',
    phone: '(61) 99999-9999',
    email: 'brasilia@kihap.com.br',
    active: true,
    subunits: [
      {
        id: '3-1',
        name: 'Asa Sul',
        address: 'Asa Sul, 100',
        phone: '(61) 99999-9991',
        email: 'asasul@kihap.com.br',
        active: true,
        parentUnitId: '3',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3-2',
        name: 'Lago Sul',
        address: 'Lago Sul, 200',
        phone: '(61) 99999-9992',
        email: 'lagosul@kihap.com.br',
        active: true,
        parentUnitId: '3',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3-3',
        name: 'Sudoeste',
        address: 'Sudoeste, 300',
        phone: '(61) 99999-9993',
        email: 'sudoeste@kihap.com.br',
        active: true,
        parentUnitId: '3',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3-4',
        name: 'Pontos de ensino',
        address: 'Pontos de ensino, 400',
        phone: '(61) 99999-9994',
        email: 'pontosensino@kihap.com.br',
        active: true,
        parentUnitId: '3',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const initialUsers: User[] = [
  {
    id: '1',
    name: 'Admin',
    email: 'admin@kihap.com.br',
    password: 'admin123',
    role: 'admin',
    unitId: '1',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const beltBadges: Badge[] = [
  {
    id: '1',
    name: 'Faixa Branca',
    description: 'Conquistou a graduação de faixa branca',
    image: 'white-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'branca',
    color: 'bg-white text-gray-800',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Faixa Amarela',
    description: 'Conquistou a graduação de faixa amarela',
    image: 'yellow-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'amarela',
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'Faixa Laranja',
    description: 'Conquistou a graduação de faixa laranja',
    image: 'orange-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'laranja',
    color: 'bg-orange-100 text-orange-800',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    name: 'Faixa Verde',
    description: 'Conquistou a graduação de faixa verde',
    image: 'green-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'verde',
    color: 'bg-green-100 text-green-800',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '5',
    name: 'Faixa Azul',
    description: 'Conquistou a graduação de faixa azul',
    image: 'blue-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'azul',
    color: 'bg-blue-100 text-blue-800',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '6',
    name: 'Faixa Roxa',
    description: 'Conquistou a graduação de faixa roxa',
    image: 'purple-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'roxa',
    color: 'bg-purple-100 text-purple-800',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '7',
    name: 'Faixa Vermelha',
    description: 'Conquistou a graduação de faixa vermelha',
    image: 'red-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'vermelha',
    color: 'bg-red-100 text-red-800',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '8',
    name: 'Faixa Marrom',
    description: 'Conquistou a graduação de faixa marrom',
    image: 'brown-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'marrom',
    color: 'bg-[#D7CCC8] text-[#795548]',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '9',
    name: 'Faixa Preta',
    description: 'Conquistou a graduação de faixa preta',
    image: 'black-belt.png',
    criteria: '0 alunos conquistaram',
    active: true,
    category: 'belt',
    type: 'belt',
    beltLevel: 'preta',
    color: 'bg-gray-100 text-black',
    icon: 'Award',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const initialOnlineContent: OnlineContent[] = [
  {
    id: '1',
    title: 'Poomsae Taegeuk Il Jang',
    description: 'Aprenda o primeiro Poomsae do Taekwondo',
    type: 'video',
    url: 'https://example.com/video1.mp4',
    active: true,
    isPublished: true,
    thumbnailUrl: 'https://placehold.co/400x225/1d528d/white?text=Poomsae+1',
    category: 'technique',
    tags: ['poomsae', 'básico', 'faixa branca'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    title: 'Teoria do Taekwondo',
    description: 'História e filosofia do Taekwondo',
    type: 'video',
    url: 'https://example.com/video2.mp4',
    active: true,
    isPublished: true,
    thumbnailUrl: 'https://placehold.co/400x225/1d528d/white?text=Teoria',
    category: 'theory',
    tags: ['teoria', 'história', 'filosofia'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const initialLiveClasses: LiveClass[] = [
  {
    id: '1',
    title: 'Treino ao Vivo - Faixas Coloridas',
    description: 'Treino online para todas as faixas coloridas',
    type: 'live',
    instructorId: '1',
    startTime: new Date(),
    endTime: new Date(),
    url: 'https://meet.google.com/example',
    active: true,
    status: 'scheduled',
    duration: 60,
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Amanhã
    thumbnailUrl: 'https://placehold.co/400x225/1d528d/white?text=Aula+Ao+Vivo',
    category: 'class',
    tags: ['treino', 'faixas coloridas'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
