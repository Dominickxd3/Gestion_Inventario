import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { DeviceTypeIcon, Icon } from '../../components/ui';
import type { EquipoListado } from '../../types/api';

interface Props {
  equipo: EquipoListado;
  /** Texto principal bajo el nombre. */
  detalle: ReactNode;
  /** Columna derecha (estado, tiempo). */
  meta?: ReactNode;
  icono?: ReactNode;
  a?: string;
}

/** Fila compacta de equipo, enlazada a su ficha. */
export function EquipoFila({ equipo, detalle, meta, icono, a }: Props) {
  return (
    <li>
      <Link to={a ?? `/equipos/${equipo.id}`} className="equipo-fila">
        <span className="equipo-fila-icono">{icono ?? <DeviceTypeIcon tipo={equipo.resumen.tipo} />}</span>
        <span className="equipo-fila-nombre">{equipo.resumen.nombreEquipo}</span>
        <span className="equipo-fila-detalle">{detalle}</span>
        <span className="equipo-fila-meta">{meta}</span>
        <Icon icono={ChevronRight} className="equipo-fila-chevron" />
      </Link>
    </li>
  );
}

export function ListaEquipos({ children }: { children: ReactNode }) {
  return <ul className="lista-equipos">{children}</ul>;
}
