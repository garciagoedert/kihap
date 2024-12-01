import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useDataStore } from './store/useDataStore';
import { checkAndResetStorage } from './utils/storage';

// Inicializar o estado
const initializeState = () => {
  // Verificar e resetar o storage se necessário
  const needsReload = checkAndResetStorage();

  // Obter o estado inicial
  const state = useDataStore.getState();
  console.log('Estado inicial:', {
    totalUnits: state.units.length,
    units: state.units,
    totalUsers: state.users.length,
    totalBadges: state.badges.length
  });

  // Se precisar recarregar, não renderiza ainda
  if (needsReload) {
    return false;
  }
  return true;
};

// Inicializar antes de renderizar
const shouldRender = initializeState();

// Só renderiza se não precisar recarregar
if (shouldRender) {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Failed to find the root element');

  const root = createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
