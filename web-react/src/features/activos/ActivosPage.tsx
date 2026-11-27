import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, CloudOff, Plus, Wrench } from 'lucide-react';
import { Button, ErrorState, Icon, LoadingState, PageHeader, SelectField, SpecTable, TextField } from '../../components/ui';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { ESTADOS_TECNICOS, opcionesDe, type ActivoDetalle, type ActivoVista } from '../../types/gestion';
import { EstadoPunto, useOpcionesTipoActivo, useOpcionesUbicacion } from '../gestion/comun';

const POR_PAGINA = 50;
const SITUACIONES = [
  { valor: 'ASIGNADO', etiqueta: 'Asignados' },
  { valor: 'DISPONIBLE', etiqueta: 'Disponibles' },
  { valor: 'EN_MANTENIMIENTO', etiqueta: 'En mantenimiento' },
  { valor: 'CON_DISCREPANCIAS', etiqueta: 'Con discrepancias' },
  { valor: 'SIN_REPORTE', etiqueta: 'Sin reporte de ScanGP' },
  { valor: 'SIN_VINCULAR', etiqueta: 'Detectables sin vincular' },
];

/** Tabla principal de activos (DESIGN.md §4.1): código, equipo, tipo, marca, modelo, responsable, ubicación, estado. */
export function ActivosPage() {
  const [params, setParams] = useSearchParams();
  const filtro = (k: string) => params.get(k) ?? '';
  const poner = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k !== 'pagina') p.delete('pagina');
    setParams(p, { replace: true });
  };
  const pagina = Number(filtro('pagina')) || 1;
  const consulta = { q: filtro('q'), tipo: filtro('tipo'), situacion: filtro('situacion'), cicloVida: filtro('cicloVida'), pagina, porPagina: POR_PAGINA };
  const datos = usePolling((s) => api.activos.listar(consulta, s), 30_000, JSON.stringify(consulta));
  const tipos = usePolling((s) => api.catalogo.tiposActivo(s), 300_000).data ?? [];
  const { puede } = useSesion();
  const [nuevo, setNuevo] = useState(false);
  const total = datos.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <PageHeader
        titulo="Activos"
        subtitulo="Inventario validado: lo que TI registró, asignó y controla."
        acciones={puede('ADMIN', 'TECNICO') && <Button variante="primario" icono={Plus} onClick={() => setNuevo(true)}>Nuevo activo</Button>}
      />

      <div className="filtros-fila" role="search">
        <div className="filtro-busqueda">
          <TextField etiqueta="Buscar" placeholder="Código, nombre, serie, responsable, modelo…" value={filtro('q')} onChange={(e) => poner('q', e.target.value)} />
        </div>
        <SelectField etiqueta="Tipo" value={filtro('tipo')} onChange={(e) => poner('tipo', e.target.value)} opciones={[{ valor: '', etiqueta: 'Todos' }, ...tipos.map((t) => ({ valor: t.codigo, etiqueta: t.nombre }))]} />
        <SelectField etiqueta="Situación" value={filtro('situacion')} onChange={(e) => poner('situacion', e.target.value)} opciones={[{ valor: '', etiqueta: 'Todas' }, ...SITUACIONES]} />
        <SelectField
          etiqueta="Ciclo de vida"
          value={filtro('cicloVida')}
          onChange={(e) => poner('cicloVida', e.target.value)}
          opciones={[{ valor: '', etiqueta: 'Activos (sin bajas)' }, ...opcionesDe(['EN_SERVICIO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'])]}
        />
        <span className="filtros-total">{total.toLocaleString('es')} activos</span>
      </div>

      {datos.error && !datos.data ? (
        <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} />
      ) : !datos.data ? (
        <LoadingState filas={8} />
      ) : (
        <SpecTable<ActivoVista>
          titulo="Activos"
          filas={datos.data.items}
          vacio={params.toString() ? 'Ningún activo coincide con los filtros.' : 'Aún no hay activos. Regístralos desde "Equipos detectados" o con "Nuevo activo".'}
          columnas={[
            { encabezado: 'Código', mono: true, valor: (a) => <Link to={`/activos/${a.id}`}>{a.codigoPatrimonial}</Link> },
            { encabezado: 'Equipo', valor: (a) => a.nombre },
            { encabezado: 'Tipo', valor: (a) => a.tipo.nombre },
            { encabezado: 'Marca', valor: (a) => a.marca ?? '—' },
            { encabezado: 'Modelo', valor: (a) => a.modelo ?? '—' },
            { encabezado: 'Responsable', valor: (a) => a.asignacion?.responsable ?? <span className="texto-terciario">Sin asignar</span> },
            { encabezado: 'Ubicación', valor: (a) => a.ubicacionNombre ?? '—' },
            { encabezado: 'Estado', valor: (a) => <EstadoColumna a={a} /> },
          ]}
        />
      )}

      {paginas > 1 && (
        <nav className="paginacion" aria-label="Paginación">
          <Button icono={ChevronLeft} aria-label="Página anterior" disabled={pagina <= 1} onClick={() => poner('pagina', String(pagina - 1))} />
          <span className="texto-secundario">Página {pagina} de {paginas}</span>
          <Button icono={ChevronRight} aria-label="Página siguiente" disabled={pagina >= paginas} onClick={() => poner('pagina', String(pagina + 1))} />
        </nav>
      )}

      {nuevo && <NuevoActivo onCerrar={() => setNuevo(false)} />}
    </>
  );
}

/** Ciclo de vida + iconos de lo que requiere atención (mantenimiento, discrepancias, sin reporte). */
function EstadoColumna({ a }: { a: ActivoVista }) {
  return (
    <span className="insignia">
      <EstadoPunto valor={a.cicloVida} />
      {a.ordenAbierta && <span title={`En mantenimiento (${a.ordenAbierta.codigo})`}><Icon icono={Wrench} etiqueta="En mantenimiento" /></span>}
      {a.discrepanciasPendientes > 0 && <span className="estado-aviso" title={`${a.discrepanciasPendientes} discrepancias`}><Icon icono={AlertTriangle} etiqueta="Discrepancias pendientes" /></span>}
      {a.sincronizacion === 'SIN_REPORTE' && <span className="estado-aviso" title="ScanGP no reporta hace días"><Icon icono={CloudOff} etiqueta="Sin reporte" /></span>}
    </span>
  );
}

function NuevoActivo({ onCerrar }: { onCerrar: () => void }) {
  const tipos = useOpcionesTipoActivo();
  const ubicaciones = useOpcionesUbicacion();
  const navegar = useNavigate();
  return (
    <PanelFormulario
      titulo="Nuevo activo"
      descripcion="Para computadoras, lo más rápido es registrarlas desde Equipos detectados: ScanGP completa los datos y sus componentes."
      textoEnviar="Registrar activo"
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre o descripción', requerido: true, placeholder: 'Impresora recepción, LAP-VENTAS02…' },
        { nombre: 'tipoActivoId', etiqueta: 'Tipo', tipo: 'select', opciones: tipos, requerido: true },
        { nombre: 'marcaNombre', etiqueta: 'Marca' },
        { nombre: 'modeloNombre', etiqueta: 'Modelo', ayuda: 'Si la marca o el modelo no existen en el catálogo, se crean.' },
        { nombre: 'numeroSerie', etiqueta: 'Número de serie' },
        { nombre: 'codigoPatrimonial', etiqueta: 'Código patrimonial', ayuda: 'Déjalo vacío para generarlo (p. ej. TI-000012).' },
        { nombre: 'ubicacionId', etiqueta: 'Ubicación', tipo: 'select', opciones: ubicaciones, vacio: 'Sin ubicación' },
        { nombre: 'estadoTecnico', etiqueta: 'Estado técnico', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), vacio: 'Sin evaluar' },
        { nombre: 'fechaAdquisicion', etiqueta: 'Fecha de adquisición', tipo: 'fecha' },
        { nombre: 'proveedor', etiqueta: 'Proveedor' },
        { nombre: 'numeroFactura', etiqueta: 'N.º de factura' },
        { nombre: 'costo', etiqueta: 'Costo', tipo: 'numero' },
        { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
      ]}
      onEnviar={(d) => api.activos.crear({ ...d, costo: d.costo == null ? null : String(d.costo), estadoTecnico: d.estadoTecnico ?? undefined })}
      onHecho={(r) => navegar(`/activos/${(r as ActivoDetalle).id}`)}
      onCerrar={onCerrar}
    />
  );
}
