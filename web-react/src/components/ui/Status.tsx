import type { ReactNode } from 'react';
import { ESTADOS, type Estado } from '../../lib/estados';
import { Icon } from './Icon';

/** Insignia de estado: icono + texto (nunca solo color). */
export function StatusBadge({ estado, texto }: { estado: Estado; texto?: string }) {
  const e = ESTADOS[estado];
  return (
    <span className={`insignia ${e.clase}`}>
      <Icon icono={e.icono} />
      {texto ?? e.etiqueta}
    </span>
  );
}

interface LineaProps {
  estado: Estado;
  titulo: ReactNode;
  detalle?: ReactNode;
  meta?: ReactNode;
}

/** Fila de comprobación (diagnóstico, compatibilidad). */
export function StatusLine({ estado, titulo, detalle, meta }: LineaProps) {
  const e = ESTADOS[estado];
  return (
    <li className="linea-estado">
      <span className={`linea-estado-icono ${e.clase}`}>
        <Icon icono={e.icono} etiqueta={e.etiqueta} />
      </span>
      <span className="linea-estado-titulo">{titulo}</span>
      <span className="linea-estado-detalle">{detalle}</span>
      {meta && <span className="linea-estado-meta">{meta}</span>}
    </li>
  );
}

export function StatusList({ children }: { children: ReactNode }) {
  return <ul className="lista-estado">{children}</ul>;
}
