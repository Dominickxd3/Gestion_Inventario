import { Outlet } from 'react-router-dom';
import { EquiposProvider } from '../hooks/EquiposContext';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileNav } from '../components/layout/MobileNav';
import { ConnectionBanner } from '../components/layout/ConnectionBanner';
import { AvisoEquiposNuevos } from '../components/layout/AvisoEquiposNuevos';

export function AppLayout() {
  return (
    <EquiposProvider>
      <a href="#contenido" className="saltar-contenido">
        Saltar al contenido
      </a>
      <div className="app">
        <Sidebar />
        <div className="principal">
          <MobileNav />
          <ConnectionBanner />
          <main id="contenido" className="contenido" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <AvisoEquiposNuevos />
    </EquiposProvider>
  );
}
