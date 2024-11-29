import { User, Unit, Student, AttendanceRecord, Badge } from './types';

export const users: User[] = [
  {
    id: 1,
    name: 'Admin',
    email: 'admin@kihap.com.br',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 2,
    name: 'Master Cavenatti',
    email: 'master@kihap.com.br',
    password: 'master123',
    role: 'master'
  },
  {
    id: 3,
    name: 'Prof. Cavenatti',
    email: 'prof@kihap.com.br',
    password: 'prof123',
    role: 'instructor'
  }
];

export const units: Unit[] = [
  {
    id: 1,
    name: 'Centro',
    city: 'Brasília',
    state: 'DF',
    address: 'Setor Comercial Sul',
    phone: '(61) 1234-5678',
    manager: 'João Silva',
    isFixed: true
  },
  {
    id: 2,
    name: 'Santa Mônica',
    city: 'Brasília',
    state: 'DF',
    address: 'Santa Mônica',
    phone: '(61) 2345-6789',
    manager: 'Maria Santos',
    isFixed: true
  },
  {
    id: 3,
    name: 'Coqueiros',
    city: 'Brasília',
    state: 'DF',
    address: 'Coqueiros',
    phone: '(61) 3456-7890',
    manager: 'Pedro Oliveira',
    isFixed: true
  },
  {
    id: 4,
    name: 'Jardim América',
    city: 'Brasília',
    state: 'DF',
    address: 'Jardim América',
    phone: '(61) 4567-8901',
    manager: 'Ana Costa',
    isFixed: true
  },
  {
    id: 5,
    name: 'Asa Sul',
    city: 'Brasília',
    state: 'DF',
    address: 'Asa Sul',
    phone: '(61) 5678-9012',
    manager: 'Carlos Souza',
    isFixed: true
  },
  {
    id: 6,
    name: 'Lago Sul',
    city: 'Brasília',
    state: 'DF',
    address: 'Lago Sul',
    phone: '(61) 6789-0123',
    manager: 'Paula Lima',
    isFixed: true
  },
  {
    id: 7,
    name: 'Sudoeste',
    city: 'Brasília',
    state: 'DF',
    address: 'Sudoeste',
    phone: '(61) 7890-1234',
    manager: 'Roberto Alves',
    isFixed: true
  }
];

export const students: Student[] = [];

export const attendanceRecords: AttendanceRecord[] = [];

export const beltBadges: Badge[] = [
  {
    id: 1,
    name: 'Faixa Branca',
    description: 'Conquistou a graduação de faixa branca',
    imageUrl: '/badges/white-belt.png',
    criteria: 'Graduação de faixa branca',
    type: 'belt',
    beltLevel: 'Faixa Branca'
  },
  {
    id: 2,
    name: 'Faixa Amarela',
    description: 'Conquistou a graduação de faixa amarela',
    imageUrl: '/badges/yellow-belt.png',
    criteria: 'Graduação de faixa amarela',
    type: 'belt',
    beltLevel: 'Faixa Amarela'
  },
  {
    id: 3,
    name: 'Faixa Laranja',
    description: 'Conquistou a graduação de faixa laranja',
    imageUrl: '/badges/orange-belt.png',
    criteria: 'Graduação de faixa laranja',
    type: 'belt',
    beltLevel: 'Faixa Laranja'
  },
  {
    id: 4,
    name: 'Faixa Verde',
    description: 'Conquistou a graduação de faixa verde',
    imageUrl: '/badges/green-belt.png',
    criteria: 'Graduação de faixa verde',
    type: 'belt',
    beltLevel: 'Faixa Verde'
  },
  {
    id: 5,
    name: 'Faixa Azul',
    description: 'Conquistou a graduação de faixa azul',
    imageUrl: '/badges/blue-belt.png',
    criteria: 'Graduação de faixa azul',
    type: 'belt',
    beltLevel: 'Faixa Azul'
  },
  {
    id: 6,
    name: 'Faixa Roxa',
    description: 'Conquistou a graduação de faixa roxa',
    imageUrl: '/badges/purple-belt.png',
    criteria: 'Graduação de faixa roxa',
    type: 'belt',
    beltLevel: 'Faixa Roxa'
  },
  {
    id: 7,
    name: 'Faixa Vermelha',
    description: 'Conquistou a graduação de faixa vermelha',
    imageUrl: '/badges/red-belt.png',
    criteria: 'Graduação de faixa vermelha',
    type: 'belt',
    beltLevel: 'Faixa Vermelha'
  },
  {
    id: 8,
    name: 'Faixa Marrom',
    description: 'Conquistou a graduação de faixa marrom',
    imageUrl: '/badges/brown-belt.png',
    criteria: 'Graduação de faixa marrom',
    type: 'belt',
    beltLevel: 'Faixa Marrom'
  },
  {
    id: 9,
    name: 'Faixa Preta',
    description: 'Conquistou a graduação de faixa preta',
    imageUrl: '/badges/black-belt.png',
    criteria: 'Graduação de faixa preta',
    type: 'belt',
    beltLevel: 'Faixa Preta'
  }
];

// Função para resetar o localStorage e recarregar os dados iniciais
export const resetData = () => {
  localStorage.clear();
  window.location.reload();
};
