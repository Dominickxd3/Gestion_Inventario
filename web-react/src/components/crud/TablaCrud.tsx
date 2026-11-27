import { useMemo, useState, type ReactNode } from 'react';
import { DataTable, type DataTableStateEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Plus, Search, type LucideIcon } from 'lucide-react';
import { Button, ErrorState, Icon, LoadingState } from '../ui';

export interface ColumnaCrud<T> {
  encabezado: string;
  valor: (fila: T) => ReactNode;
  /** Valor para ordenar. Sin él, la columna no se puede ordenar. */
  ordenar?: (fila: T) => string | number | null | undefined;
  ancho?: string;
  numerica?: boolean;
  mono?: boolean;
  /** Oculta la columna en pantallas estrechas. */
  secundaria?: boolean;
  /** Texto largo (observaciones, detalle): puede ocupar varias líneas. El resto va en una línea y se recorta. */
  envolver?: boolean;
}

export interface AccionFila<T> {
  etiqueta: string | ((fila: T) => string);
  icono: LucideIcon;
  onClick: (fila: T) => void;
  visible?: (fila: T) => boolean;
  peligro?: boolean;
  /** Acciones excluyentes (p. ej. Activar / Desactivar) comparten un mismo hueco en la columna. */
  grupo?: string;
}

/** Agrupa las acciones en huecos: una por hueco, salvo las de un mismo grupo, que comparten uno. */
function huecosDe<T>(acciones: AccionFila<T>[]) {
  const huecos: AccionFila<T>[][] = [];
  const porGrupo = new Map<string, AccionFila<T>[]>();
  for (const a of acciones) {
    const existente = a.grupo ? porGrupo.get(a.grupo) : undefined;
    if (existente) existente.push(a);
    else {
      const nuevo = [a];
      huecos.push(nuevo);
      if (a.grupo) porGrupo.set(a.grupo, nuevo);
    }
  }
  return huecos;
}

interface Props<T> {
  titulo: string;
  filas: T[] | undefined;
  columnas: ColumnaCrud<T>[];
  /** Texto en el que busca la caja de búsqueda (búsqueda local). */
  textoBusqueda?: (fila: T) => string;
  /** Búsqueda en el servidor (en vez de la local). */
  busqueda?: { valor: string; onCambio: (v: string) => void; placeholder?: string };
  filtros?: ReactNode;
  nuevo?: { etiqueta: string; onClick: () => void } | false;
  acciones?: AccionFila<T>[];
  onFila?: (fila: T) => void;
  vacio?: string;
  error?: Error;
  onReintentar?: () => void;
  /** Paginación en el servidor. */
  servidor?: { total: number; pagina: number; porPagina: number; onPagina: (p: number) => void };
  clave?: (fila: T) => string;
}

/**
 * Tabla CRUD común a todos los módulos (DESIGN.md §4.1): barra con búsqueda, filtros y "Nuevo";
 * filas densas, orden por columna, paginación y acciones por fila (ver, editar, desactivar/dar de baja).
 */
export function TablaCrud<T extends object>({
  titulo, filas, columnas, textoBusqueda, busqueda, filtros, nuevo, acciones = [], onFila, vacio = 'Sin registros.',
  error, onReintentar, servidor, clave = (f) => String((f as { id?: string }).id),
}: Props<T>) {
  const [q, setQ] = useState('');
  const visibles = useMemo(() => {
    if (!filas || !textoBusqueda || !q.trim()) return filas ?? [];
    const t = q.trim().toLowerCase();
    return filas.filter((f) => textoBusqueda(f).toLowerCase().includes(t));
  }, [filas, q, textoBusqueda]);
  const total = servidor?.total ?? visibles.length;
  const conBarra = !!(textoBusqueda || busqueda || filtros || nuevo);
  const huecos = useMemo(() => huecosDe(acciones), [acciones]);

  return (
    <div className="tabla-crud">
      {conBarra && (
      <div className="tabla-crud-barra" role="search">
        {(textoBusqueda || busqueda) && (
          <label className="caja-busqueda">
            <Icon icono={Search} />
            <span className="visualmente-oculto">Buscar en {titulo}</span>
            <input
              type="search"
              value={busqueda ? busqueda.valor : q}
              onChange={(e) => (busqueda ? busqueda.onCambio(e.target.value) : setQ(e.target.value))}
              placeholder={busqueda?.placeholder ?? 'Buscar…'}
            />
          </label>
        )}
        {filtros}
        <span className="tabla-crud-total">{total.toLocaleString('es')} {total === 1 ? 'registro' : 'registros'}</span>
        {nuevo && <Button variante="primario" icono={Plus} onClick={nuevo.onClick}>{nuevo.etiqueta}</Button>}
      </div>
      )}

      {error && !filas ? (
        <ErrorState mensaje={error.message} onReintentar={onReintentar} />
      ) : !filas ? (
        <LoadingState filas={6} />
      ) : (
        <DataTable
          value={visibles}
          dataKey={visibles.length && 'id' in visibles[0] ? 'id' : undefined}
          size="small"
          className="tabla-densa"
          aria-label={titulo}
          emptyMessage={q ? 'Ningún registro coincide con la búsqueda.' : vacio}
          rowHover
          onRowClick={onFila ? (e) => onFila(e.data as T) : undefined}
          rowClassName={() => (onFila ? 'fila-clicable' : '')}
          responsiveLayout="stack"
          breakpoint="767px"
          paginator={servidor ? servidor.total > servidor.porPagina : visibles.length > 25}
          rows={servidor?.porPagina ?? 25}
          {...(servidor
            ? {
                lazy: true,
                totalRecords: servidor.total,
                first: (servidor.pagina - 1) * servidor.porPagina,
                onPage: (e: DataTableStateEvent) => servidor.onPagina(Math.floor(e.first / e.rows) + 1),
              }
            : { first: 0 })}
          paginatorTemplate="PrevPageLink CurrentPageReport NextPageLink"
          currentPageReportTemplate="{first}–{last} de {totalRecords}"
          removableSort
        >
          {columnas.map((c) => (
            <Column
              key={c.encabezado}
              header={c.encabezado}
              sortable={!servidor && !!c.ordenar}
              sortField={c.encabezado}
              sortFunction={c.ordenar ? (e) => ordenarPor([...e.data] as T[], c.ordenar!, e.order ?? 1) : undefined}
              headerClassName={[c.numerica && 'num', c.secundaria && 'col-secundaria'].filter(Boolean).join(' ') || undefined}
              bodyClassName={[c.numerica && 'num', c.mono && 'mono', c.secundaria && 'col-secundaria', c.envolver ? 'col-envolver' : 'col-linea'].filter(Boolean).join(' ')}
              style={c.ancho ? { width: c.ancho } : undefined}
              body={(f: T) => {
                const v = c.valor(f);
                if (v === null || v === undefined || v === '') return <span className="texto-terciario">—</span>;
                // En una línea el texto puede recortarse: el título muestra el valor completo.
                return typeof v === 'string' || typeof v === 'number' ? <span title={String(v)}>{v}</span> : v;
              }}
            />
          ))}
          {acciones.length > 0 && (
            <Column
              header="Acciones"
              headerClassName="col-acciones"
              bodyClassName="col-acciones"
              style={{ width: `${Math.max(48, huecos.length * 30 + 24)}px` }}
              body={(f: T) => (
                <span className="acciones-fila" onClick={(e) => e.stopPropagation()} key={clave(f)}>
                  {huecos
                    .map((hueco, i) => {
                      // Las acciones que no aplican a la fila dejan su hueco: los iconos quedan alineados en columna.
                      const a = hueco.find((x) => !x.visible || x.visible(f));
                      if (!a) return <span key={`hueco-${i}`} className="accion-hueco" aria-hidden="true" />;
                      const etiqueta = typeof a.etiqueta === 'function' ? a.etiqueta(f) : a.etiqueta;
                      return (
                        <Button
                          key={etiqueta}
                          variante="fantasma"
                          icono={a.icono}
                          aria-label={etiqueta}
                          className={a.peligro ? 'boton-peligro' : undefined}
                          onClick={() => a.onClick(f)}
                          titulo={etiqueta}
                        />
                      );
                    })}
                </span>
              )}
            />
          )}
        </DataTable>
      )}
    </div>
  );
}

function ordenarPor<T>(datos: T[], valor: (f: T) => string | number | null | undefined, orden: number) {
  return datos.sort((a, b) => {
    const x = valor(a);
    const y = valor(b);
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * orden;
  });
}
