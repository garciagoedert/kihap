import { initialUnits } from '../data';
import { Unit } from '../types';

export const checkAndResetStorage = () => {
  try {
    const storedData = localStorage.getItem('kihap-data-storage');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      const state = parsedData.state;

      // Se não houver unidades, inicializar com as unidades padrão
      if (!state.units || state.units.length === 0) {
        console.log('Inicializando storage com unidades padrão');
        const newState = {
          ...parsedData,
          state: {
            ...state,
            units: initialUnits
          }
        };
        localStorage.setItem('kihap-data-storage', JSON.stringify(newState));
        return true; // Indica que houve mudança
      }

      // Verificar se todas as unidades iniciais estão presentes
      const missingUnits = initialUnits.filter((initialUnit: Unit) => 
        !state.units.some((unit: Unit) => unit.id === initialUnit.id)
      );

      // Se houver unidades faltando, adicionar apenas as unidades faltantes
      if (missingUnits.length > 0) {
        console.log('Adicionando unidades faltantes:', missingUnits);
        const newState = {
          ...parsedData,
          state: {
            ...state,
            units: [...state.units, ...missingUnits]
          }
        };
        localStorage.setItem('kihap-data-storage', JSON.stringify(newState));
        return true; // Indica que houve mudança
      }
    } else {
      // Se não houver dados no storage, inicializar com as unidades padrão
      console.log('Inicializando storage com unidades padrão');
      const newState = {
        state: {
          units: initialUnits,
          version: 1
        }
      };
      localStorage.setItem('kihap-data-storage', JSON.stringify(newState));
      return true; // Indica que houve mudança
    }
    return false; // Indica que não houve mudança
  } catch (error) {
    console.error('Erro ao verificar storage:', error);
    // Em caso de erro, reinicializar com as unidades padrão
    const newState = {
      state: {
        units: initialUnits,
        version: 1
      }
    };
    localStorage.setItem('kihap-data-storage', JSON.stringify(newState));
    return true; // Indica que houve mudança
  }
};
