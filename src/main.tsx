import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useDataStore } from './store/useDataStore';
import { checkAndResetStorage } from './utils/storage';

// Inicializar o estado
const initializeState = () => {
  // Verificar e resetar o storage se necessário
  checkAndResetStorage();

  // Obter o estado inicial
  const state = useDataStore.getState();
  console.log('Estado inicial:', {
    totalUnits: state.units.length,
    units: state.units,
    totalUsers: state.users.length,
    totalBadges: state.badges.length
  });
};

// Inicializar antes de renderizar
initializeState();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
