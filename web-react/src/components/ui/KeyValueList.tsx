import type { ReactNode } from 'react';
import { Unavailable, type MotivoNoDisponible } from './Unavailable';

export interface Dato {
  etiqueta: string;
  valor: ReactNode;
  /** Valores técnicos (series, MAC, versiones) en tipografía monoespaciada. */
  mono?: boolean;
  /** Motivo a mostrar cuando el valor está vacío. */
  motivo?: MotivoNoDisponible;
  ayuda?: string;
}

const vacio = (v: ReactNode) => v === null || v === undefined || v === '' || v === false;

/** Lista etiqueta/valor alineada en dos columnas (una en móvil). */
export function KeyValueList({ datos, columnas = 1 }: { datos: Dato[]; columnas?: 1 | 2 }) {
  return (
    <dl className={`kv kv-${columnas}`}>
      {datos.map((d) => (
        <div className="kv-fila" key={d.etiqueta}>
          <dt title={d.ayuda}>{d.etiqueta}</dt>
          <dd className={d.mono ? 'mono' : undefined}>{vacio(d.valor) ? <Unavailable motivo={d.motivo} /> : d.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
