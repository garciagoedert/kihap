import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useDataStore } from './store/useDataStore';
import { clearStorage } from './utils/storage';

// Limpa o storage e inicializa com dados padrão
clearStorage();

// Obter o estado inicial
const state = useDataStore.getState();
console.log('Estado inicial:', {
  totalUnits: state.units.length,
  units: state.units,
  totalUsers: state.users.length,
  totalBadges: state.badges.length
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
