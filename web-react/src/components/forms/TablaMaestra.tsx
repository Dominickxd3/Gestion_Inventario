import { useState, type ReactNode } from 'react';
import { Eye, Pencil, Power, PowerOff } from 'lucide-react';
import { PuntoEstado, Section } from '../ui';
import { TablaCrud, type AccionFila, type ColumnaCrud } from '../crud/TablaCrud';
import { useConfirmar } from '../crud/Confirmar';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { PanelFormulario, type Campo, type Valores } from './PanelFormulario';

interface Props<T extends { id: string; activo?: boolean }> {
  titulo: string;
  descripcion?: ReactNode;
  /** Nombre en singular para los botones ("sede", "marca"…). */
  singular: string;
  cargar: (s: AbortSignal) => Promise<T[]>;
  columnas: ColumnaCrud<T>[];
  /** Texto donde busca la caja de búsqueda. */
  textoBusqueda: (x: T) => string;
  campos: Campo[] | ((editando: T | null) => Campo[]);
  aValores?: (x: T) => Valores;
  crear: (d: Record<string, unknown>) => Promise<unknown>;
  editar: (id: string, d: Record<string, unknown>) => Promise<unknown>;
  /** Abrir la ficha (si el registro tiene una). */
  ver?: (x: T) => void;
  /** Nombre que se muestra en la confirmación de desactivar. */
  nombre?: (x: T) => string;
  clave?: string;
  /** Sin título de sección (cuando la página ya lo tiene). */
  sinSeccion?: boolean;
}

/**
 * CRUD de una tabla maestra: listar, buscar, crear, editar y desactivar/activar.
 * No hay borrado físico: desactivar oculta el registro de las listas y conserva su historia.
 */
export function TablaMaestra<T extends { id: string; activo?: boolean }>({
  titulo, descripcion, singular, cargar, columnas, textoBusqueda, campos, aValores, crear, editar, ver, nombre, clave, sinSeccion,
}: Props<T>) {
  const datos = usePolling(cargar, 120_000, clave);
  const { puede } = useSesion();
  const confirmar = useConfirmar();
  const escribe = puede('ADMIN', 'TECNICO');
  const [panel, setPanel] = useState<{ item: T | null } | null>(null);
  const listaCampos = (x: T | null) => (typeof campos === 'function' ? campos(x) : campos);

  const alternarActivo = async (x: T) => {
    const desactivar = x.activo !== false;
    const ok = await confirmar({
      titulo: desactivar ? `Desactivar ${singular}` : `Activar ${singular}`,
      mensaje: desactivar
        ? `«${nombre?.(x) ?? singular}» dejará de aparecer en las listas para elegir. Su historia y sus relaciones se conservan; puedes volver a activarlo.`
        : `«${nombre?.(x) ?? singular}» volverá a estar disponible.`,
      accion: desactivar ? 'Desactivar' : 'Activar',
      peligro: desactivar,
    });
    if (!ok) return;
    await editar(x.id, { activo: !desactivar });
    datos.recargar();
  };

  const tieneActivo = (datos.data ?? []).some((x) => 'activo' in x);
  const acciones: AccionFila<T>[] = [];
  if (ver) acciones.push({ etiqueta: 'Ver ficha', icono: Eye, onClick: ver });
  if (escribe) {
    acciones.push({ etiqueta: 'Editar', icono: Pencil, onClick: (x) => setPanel({ item: x }) });
    if (tieneActivo) {
      acciones.push(
        { etiqueta: 'Desactivar', icono: PowerOff, peligro: true, grupo: 'estado', onClick: (x) => void alternarActivo(x), visible: (x) => x.activo !== false },
        { etiqueta: 'Activar', icono: Power, grupo: 'estado', onClick: (x) => void alternarActivo(x), visible: (x) => x.activo === false },
      );
    }
  }

  const tabla = (
    <TablaCrud<T>
      titulo={titulo}
      filas={datos.data}
      error={datos.error}
      onReintentar={datos.recargar}
      columnas={[
        ...columnas,
        ...(tieneActivo
          ? [{ encabezado: 'Estado', ancho: '96px', ordenar: (x: T) => (x.activo ? 0 : 1), valor: (x: T) => <PuntoEstado tono={x.activo ? 'ok' : 'neutro'} texto={x.activo ? 'Activo' : 'Inactivo'} /> }]
          : []),
      ]}
      textoBusqueda={textoBusqueda}
      nuevo={escribe && { etiqueta: `Nuevo ${singular}`, onClick: () => setPanel({ item: null }) }}
      acciones={acciones}
      onFila={ver}
      vacio={`No hay registros. Usa «Nuevo ${singular}».`}
    />
  );

  return (
    <>
      {sinSeccion ? tabla : <Section titulo={titulo} descripcion={descripcion}>{tabla}</Section>}
      {panel && (
        <PanelFormulario
          titulo={panel.item ? `Editar ${singular}` : `Nuevo ${singular}`}
          borradorId={`${titulo}:${panel.item?.id ?? "nuevo"}`}
          campos={listaCampos(panel.item)}
          inicial={panel.item && aValores ? aValores(panel.item) : undefined}
          onEnviar={(d) => (panel.item ? editar(panel.item.id, d) : crear(d))}
          onCerrar={() => setPanel(null)}
          onHecho={datos.recargar}
        />
      )}
    </>
  );
}

/** Ya no se usa en los formularios: activar/desactivar es una acción de la fila. Se conserva por compatibilidad. */
export const CAMPO_ACTIVO: Campo = {
  nombre: 'activo',
  etiqueta: 'Activo (desmarca para ocultarlo de las listas sin perder su historia)',
  tipo: 'casilla',
};
