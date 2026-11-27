import { useState, type ReactNode } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button, ErrorState, LoadingState, Section, SpecTable, type Columna } from '../ui';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { PanelFormulario, type Campo, type Valores } from './PanelFormulario';

interface Props<T extends { id: string }> {
  titulo: string;
  descripcion?: ReactNode;
  /** Nombre en singular para los botones ("sede", "marca"…). */
  singular: string;
  cargar: (s: AbortSignal) => Promise<T[]>;
  columnas: Columna<T>[];
  campos: Campo[] | ((editando: T | null) => Campo[]);
  aValores?: (x: T) => Valores;
  crear: (d: Record<string, unknown>) => Promise<unknown>;
  editar: (id: string, d: Record<string, unknown>) => Promise<unknown>;
  /** Clave para recargar cuando cambian dependencias externas. */
  clave?: string;
}

/** Lista + alta + edición de una tabla maestra (sedes, marcas, personas…). Sin borrado: se desactivan. */
export function TablaMaestra<T extends { id: string }>({ titulo, descripcion, singular, cargar, columnas, campos, aValores, crear, editar, clave }: Props<T>) {
  const datos = usePolling(cargar, 120_000, clave);
  const { puede } = useSesion();
  const escribe = puede('ADMIN', 'TECNICO');
  const [panel, setPanel] = useState<{ item: T | null } | null>(null);
  const listaCampos = (x: T | null) => (typeof campos === 'function' ? campos(x) : campos);

  return (
    <Section
      titulo={titulo}
      descripcion={descripcion}
      acciones={escribe && <Button icono={Plus} onClick={() => setPanel({ item: null })}>Nuevo {singular}</Button>}
    >
      {datos.error && !datos.data ? (
        <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} />
      ) : !datos.data ? (
        <LoadingState />
      ) : (
        <SpecTable<T>
          titulo={titulo}
          filas={datos.data}
          vacio={`No hay registros. Usa "Nuevo ${singular}".`}
          columnas={[
            ...columnas,
            ...(escribe
              ? [{ encabezado: '', ancho: '48px', valor: (x: T) => <Button variante="fantasma" icono={Pencil} aria-label={`Editar ${singular}`} onClick={() => setPanel({ item: x })} /> }]
              : []),
          ]}
        />
      )}
      {panel && (
        <PanelFormulario
          titulo={panel.item ? `Editar ${singular}` : `Nuevo ${singular}`}
          campos={listaCampos(panel.item)}
          inicial={panel.item && aValores ? aValores(panel.item) : undefined}
          onEnviar={(d) => (panel.item ? editar(panel.item.id, d) : crear(d))}
          onCerrar={() => setPanel(null)}
          onHecho={datos.recargar}
        />
      )}
    </Section>
  );
}

/** Opciones activo/inactivo para los formularios de edición. */
export const CAMPO_ACTIVO: Campo = {
  nombre: 'activo',
  etiqueta: 'Activo (desmarca para ocultarlo de las listas sin perder su historia)',
  tipo: 'casilla',
};
