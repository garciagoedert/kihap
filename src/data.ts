import { Store, Product, Unit, User, Badge } from './types';

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
    image: 'https://example.com/dobok.jpg',
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
    image: 'https://example.com/faixa.jpg',
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
