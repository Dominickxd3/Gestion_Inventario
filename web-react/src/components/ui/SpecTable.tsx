import type { ReactNode } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Unavailable } from './Unavailable';

export interface Columna<T> {
  encabezado: string;
  /** Devuelve el contenido de la celda; null/undefined se muestra como "No detectado". */
  valor: (fila: T) => ReactNode;
  numerica?: boolean;
  mono?: boolean;
  ancho?: string;
}

interface Props<T> {
  filas: T[] | null | undefined;
  columnas: Columna<T>[];
  titulo: string;
  vacio?: string;
}

/** Tabla técnica: alineación numérica a la derecha, valores ausentes explícitos, apilada en móvil. */
export function SpecTable<T extends object>({ filas, columnas, titulo, vacio = 'Sin datos.' }: Props<T>) {
  return (
    <DataTable
      value={filas ?? []}
      size="small"
      responsiveLayout="stack"
      breakpoint="767px"
      emptyMessage={vacio}
      aria-label={titulo}
      className="tabla-tecnica"
    >
      {columnas.map((c) => (
        <Column
          key={c.encabezado}
          header={c.encabezado}
          headerClassName={c.numerica ? 'num' : undefined}
          bodyClassName={[c.numerica && 'num', c.mono && 'mono'].filter(Boolean).join(' ') || undefined}
          style={c.ancho ? { width: c.ancho } : undefined}
          body={(fila: T) => {
            const v = c.valor(fila);
            return v === null || v === undefined || v === '' ? <Unavailable /> : v;
          }}
        />
      ))}
    </DataTable>
  );
}
