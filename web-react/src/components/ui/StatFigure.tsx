import type { ReactNode } from 'react';
import { Unavailable } from './Unavailable';

interface Props {
  valor: string | number | null | undefined;
  unidad?: string;
  etiqueta: ReactNode;
}

/** Cifra principal + unidad pequeña + etiqueta. */
export function StatFigure({ valor, unidad, etiqueta }: Props) {
  return (
    <div className="cifra">
      <div className="cifra-valor num">
        {valor === null || valor === undefined || valor === '' ? (
          <Unavailable />
        ) : (
          <>
            {valor}
            {unidad && <span className="cifra-unidad">{unidad}</span>}
          </>
        )}
      </div>
      <div className="cifra-etiqueta">{etiqueta}</div>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="fila-cifras">{children}</div>;
}
