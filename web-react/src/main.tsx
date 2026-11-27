import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrimeReactProvider } from 'primereact/api';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import './design/tokens.css';
import './design/base.css';
import './design/primereact.css';
import './components/ui/ui.css';
import './components/layout/layout.css';
import './components/crud/crud.css';
import './design/alertas.css';
import './features/equipos/equipos.css';
import './features/equipo/equipo.css';
import './features/detectar/detectar.css';
import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrimeReactProvider value={{ ripple: false }}>
      <App />
    </PrimeReactProvider>
  </React.StrictMode>,
);
