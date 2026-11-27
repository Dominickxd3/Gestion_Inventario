import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui';
import { destinoAnterior } from './navegacion';

/** Un único control de regreso compartido por todas las pantallas. */
export function Volver() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const tieneAnterior = typeof window.history.state?.idx === 'number' && window.history.state.idx > 0;
  const inicio = pathname === '/';
  return (
    <nav className="navegacion-regreso" aria-label="Navegación de regreso">
      <Button icono={ArrowLeft} disabled={inicio && !tieneAnterior} onClick={() => {
        if (tieneAnterior) navegar(-1);
        else navegar(destinoAnterior(pathname), { replace: true });
      }}>Volver</Button>
    </nav>
  );
}
