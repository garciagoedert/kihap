import { initialUnits, initialUsers } from '../data';
import { Unit, User } from '../types';

export const clearStorage = () => {
  console.log('Limpando storage...');
  localStorage.clear(); // Limpa todo o localStorage
};

export const checkAndResetStorage = () => {
  try {
    console.log('Verificando storage...');
    clearStorage(); // Força a limpeza do storage em cada verificação
    
    // Inicializa com os dados padrão
    console.log('Inicializando storage com dados padrão');
    const newState = {
      state: {
        units: initialUnits,
        users: initialUsers,
        version: 1
      }
    };
    localStorage.setItem('kihap-data-storage', JSON.stringify(newState));
    localStorage.setItem('kihap-auth-storage', JSON.stringify({ state: { user: null } }));
    
    return true; // Sempre indica que houve mudança para forçar o reload
  } catch (error) {
    console.error('Erro ao verificar storage:', error);
    return true;
  }
};
