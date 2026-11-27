import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Icon } from '../../components/ui';

export type EstadoPasoAsistente = 'pendiente' | 'actual' | 'hecho';

interface Props {
  numero: number;
  titulo: string;
  estado: EstadoPasoAsistente;
  children?: ReactNode;
}

export function Paso({ numero, titulo, estado, children }: Props) {
  return (
    <li className={`paso paso-${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
      <span className="paso-marca">
        {estado === 'hecho' ? <Icon icono={Check} etiqueta="Completado" /> : numero}
      </span>
      <div className="paso-cuerpo">
        <h2 className="paso-titulo">{titulo}</h2>
        {children}
      </div>
    </li>
  );
}
