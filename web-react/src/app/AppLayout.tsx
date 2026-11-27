import { Outlet } from 'react-router-dom';
import { Volver } from '../components/layout/Volver';
import { EquiposProvider } from '../hooks/EquiposContext';
import { Sidebar, useBarraContraida } from '../components/layout/Sidebar';
import { MobileNav } from '../components/layout/MobileNav';
import { ConnectionBanner } from '../components/layout/ConnectionBanner';
import { AvisoEquiposNuevos } from '../components/layout/AvisoEquiposNuevos';

export function AppLayout() {
  const { contraida, alternar } = useBarraContraida();
  return (
    <EquiposProvider>
      <a href="#contenido" className="saltar-contenido">
        Saltar al contenido
      </a>
      <div className={`app${contraida ? ' app-menu-contraido' : ''}`}>
        <Sidebar contraida={contraida} alternar={alternar} />
        <div className="principal">
          <MobileNav />
          <ConnectionBanner />
          <main id="contenido" className="contenido" tabIndex={-1}>
            <Volver />
            <Outlet />
          </main>
        </div>
      </div>
      <AvisoEquiposNuevos />
    </EquiposProvider>
  );
}
