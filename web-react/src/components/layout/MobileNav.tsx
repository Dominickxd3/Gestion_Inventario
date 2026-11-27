import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui';
import { Marca, NavPrincipal, UsuarioPie } from './Sidebar';
import { EstadoConexionPie } from './EstadoConexionPie';

/** Barra superior + menú a pantalla completa para móvil (< 768 px). */
export function MobileNav() {
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  return (
    <div className="nav-movil">
      <div className="nav-movil-barra">
        <Marca />
        <Button
          variante="fantasma"
          icono={abierto ? X : Menu}
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setAbierto(!abierto)}
        />
      </div>
      {abierto && (
        <div className="nav-movil-panel">
          <NavPrincipal onNavegar={() => setAbierto(false)} />
          <EstadoConexionPie />
          <UsuarioPie />
        </div>
      )}
    </div>
  );
}
