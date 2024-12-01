import { Store, Product, Unit, User, Badge, OnlineContent, LiveClass } from './types';

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
    description: 'Conquistou a faixa branca',
    image: 'white-belt.png',
    criteria: 'Iniciante',
    active: true,
    type: 'belt',
    beltLevel: 'branca',
    color: '#FFFFFF',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Faixa Preta',
    description: 'Conquistou a faixa preta',
    image: 'black-belt.png',
    criteria: 'Avançado',
    active: true,
    type: 'belt',
    beltLevel: 'preta',
    color: '#000000',
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
