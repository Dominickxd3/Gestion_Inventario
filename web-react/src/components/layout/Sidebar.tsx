import { NavLink } from 'react-router-dom';
import { House, LayoutList, ScanSearch, type LucideIcon } from 'lucide-react';
import { Icon } from '../ui';
import { EstadoConexionPie } from './EstadoConexionPie';

const DESTINOS: { a: string; etiqueta: string; icono: LucideIcon; fin?: boolean }[] = [
  { a: '/', etiqueta: 'Inicio', icono: House, fin: true },
  { a: '/equipos', etiqueta: 'Equipos', icono: LayoutList },
  { a: '/detectar', etiqueta: 'Detectar equipo', icono: ScanSearch },
];

export function NavPrincipal({ onNavegar }: { onNavegar?: () => void }) {
  return (
    <nav aria-label="Principal">
      <ul className="nav-principal">
        {DESTINOS.map((d) => (
          <li key={d.a}>
            <NavLink to={d.a} end={d.fin} onClick={onNavegar} className={({ isActive }) => (isActive ? 'activo' : undefined)}>
              <Icon icono={d.icono} tamano={20} />
              {d.etiqueta}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Marca() {
  return (
    <span className="marca">
      <span className="marca-simbolo" aria-hidden="true" />
      ScanGP
    </span>
  );
}

/** Barra lateral de escritorio (≥ 768 px). */
export function Sidebar() {
  return (
    <aside className="barra-lateral">
      <Marca />
      <NavPrincipal />
      <div className="barra-lateral-pie">
        <EstadoConexionPie />
      </div>
    </aside>
  );
}
