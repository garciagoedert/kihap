import { units as initialUnits } from '../data';
import { Unit } from '../types';

export const checkAndResetStorage = () => {
  try {
    const storedData = localStorage.getItem('kihap-data-storage');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      const state = parsedData.state;

      // Se não houver unidades ou se o array estiver vazio, resetar o storage
      if (!state.units || state.units.length === 0) {
        console.log('Resetando storage devido a unidades ausentes');
        localStorage.removeItem('kihap-data-storage');
        window.location.reload();
        return;
      }

      // Verificar se todas as unidades iniciais estão presentes
      const missingUnits = initialUnits.filter((initialUnit: Unit) => 
        !state.units.some((unit: Unit) => unit.id === initialUnit.id)
      );

      if (missingUnits.length > 0) {
        console.log('Resetando storage devido a unidades faltantes:', missingUnits);
        localStorage.removeItem('kihap-data-storage');
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('Erro ao verificar storage:', error);
    localStorage.removeItem('kihap-data-storage');
    window.location.reload();
  }
};
