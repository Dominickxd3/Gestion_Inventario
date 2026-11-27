import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftRight, Ban, CheckCircle2, Eye, LogOut, Pencil, Users, Wrench } from 'lucide-react';
import { Button, EmptyState, KeyValueList, LoadingState, PageHeader, Section, SelectField } from '../../components/ui';
import { TablaCrud, type AccionFila } from '../../components/crud/TablaCrud';
import { TablaMaestra } from '../../components/forms/TablaMaestra';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { fecha, fechaHora, unir } from '../../lib/formato';
import { ESTADOS_TECNICOS, MOTIVOS, TIPOS_ASIGNACION, et, opcionesDe, type Asignacion, type Orden, type Persona } from '../../types/gestion';
import { EstadoPunto, hoyMas, useOpcionesActivoDisponible, useOpcionesArea, useOpcionesPersona, useOpcionesUbicacion } from '../gestion/comun';
import { TabDocumentos } from '../activos/ActivoTabs';

const hoy = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ Trabajadores

export function PersonasPage() {
  const areas = useOpcionesArea();
  const navegar = useNavigate();
  return (
    <>
      <PageHeader titulo="Trabajadores" subtitulo="Personas que pueden recibir equipos. No son usuarios de la plataforma." />
      <TablaMaestra<Persona>
        sinSeccion
        titulo="Trabajadores"
        singular="trabajador"
        cargar={(s) => api.org.personas(s)}
        textoBusqueda={(p) => [p.nombre, p.documento, p.area?.nombre, p.cargo, p.usuarioWindows].join(' ')}
        nombre={(p) => p.nombre}
        ver={(p) => navegar(`/personas/${p.id}`)}
        columnas={[
          { encabezado: 'Nombre', ordenar: (p) => p.nombre, valor: (p) => <Link to={`/personas/${p.id}`} onClick={(e) => e.stopPropagation()}>{p.nombre}</Link> },
          { encabezado: 'Documento', ordenar: (p) => p.documento, valor: (p) => p.documento },
          { encabezado: 'Área', ordenar: (p) => p.area?.nombre, valor: (p) => p.area?.nombre },
          { encabezado: 'Cargo', ordenar: (p) => p.cargo, valor: (p) => p.cargo, secundaria: true },
          { encabezado: 'Usuario de Windows', mono: true, valor: (p) => p.usuarioWindows, secundaria: true },
        ]}
        campos={[
          { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true },
          { nombre: 'documento', etiqueta: 'Documento de identidad' },
          { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, vacio: 'Sin área' },
          { nombre: 'cargo', etiqueta: 'Cargo' },
          { nombre: 'correo', etiqueta: 'Correo' },
          { nombre: 'usuarioWindows', etiqueta: 'Usuario de Windows', placeholder: 'DOMINIO\\usuario', ayuda: 'ScanGP avisará si su equipo asignado lo usa otra persona.' },
        ]}
        aValores={(p) => ({ nombre: p.nombre, documento: p.documento ?? '', areaId: p.areaId ?? '', cargo: p.cargo ?? '', correo: p.correo ?? '', usuarioWindows: p.usuarioWindows ?? '' })}
        crear={api.org.crearPersona}
        editar={api.org.editarPersona}
      />
    </>
  );
}

export function PersonaPage() {
  const { id = '' } = useParams();
  const persona = usePolling((s) => api.org.persona(id, s), 120_000, id);
  const asignaciones = usePolling((s) => api.asignaciones.listar({ personaId: id }, s), 60_000, id);
  const [accion, setAccion] = useState<{ tipo: 'devolver' | 'transferir'; x: Asignacion } | null>(null);
  if (persona.error) return <EmptyState icono={Users} titulo="Trabajador no encontrado" accion={<Button a="/personas">Ir a Trabajadores</Button>} />;
  const p = persona.data;
  if (!p) return <LoadingState />;
  const vigentes = asignaciones.data?.filter((a) => !a.hasta);
  const pasadas = asignaciones.data?.filter((a) => a.hasta);
  return (
    <>
      <PageHeader migas={[{ etiqueta: 'Trabajadores', a: '/personas' }, { etiqueta: p.nombre }]} titulo={p.nombre} subtitulo={unir([p.cargo, p.area?.nombre], ' · ')} />
      <Section titulo="Datos">
        <KeyValueList datos={[
          { etiqueta: 'Documento', valor: p.documento }, { etiqueta: 'Correo', valor: p.correo },
          { etiqueta: 'Usuario de Windows', valor: p.usuarioWindows, mono: true }, { etiqueta: 'Estado', valor: <EstadoPunto valor={p.activo ? 'ACTIVO' : 'INACTIVO'} texto={p.activo ? 'Activo' : 'Inactivo'} /> },
        ]} />
      </Section>
      <Section titulo={`Equipos a su cargo (${vigentes?.length ?? 0})`}>
        <TablaAsignacionesCrud filas={vigentes} mostrar="activo" onAccion={(tipo, x) => setAccion({ tipo, x })} />
      </Section>
      <Section titulo="Equipos que tuvo">
        <TablaAsignacionesCrud filas={pasadas} mostrar="activo" />
      </Section>
      <TabDocumentos entidad="PERSONA" entidadId={p.id} />
      {accion && <AsignacionAcciones {...accion} onCerrar={() => setAccion(null)} onHecho={asignaciones.recargar} />}
    </>
  );
}

// ------------------------------------------------------------------ Asignaciones

type AccionAsignacion = 'devolver' | 'transferir';

export function TablaAsignacionesCrud({ filas, mostrar, onAccion, nuevo, filtros, error }: {
  filas: Asignacion[] | undefined;
  mostrar: 'persona' | 'activo' | 'ambos';
  onAccion?: (a: AccionAsignacion, x: Asignacion) => void;
  nuevo?: { etiqueta: string; onClick: () => void } | false;
  filtros?: React.ReactNode;
  error?: Error;
}) {
  const navegar = useNavigate();
  const { puede } = useSesion();
  const vigente = (x: Asignacion) => !x.hasta;
  const acciones: AccionFila<Asignacion>[] = [{ etiqueta: 'Ver activo', icono: Eye, onClick: (x) => navegar(`/activos/${x.activoId}`) }];
  if (onAccion && puede('ADMIN', 'TECNICO')) {
    acciones.push(
      { etiqueta: 'Transferir', icono: ArrowLeftRight, onClick: (x) => onAccion('transferir', x), visible: vigente },
      { etiqueta: 'Registrar devolución', icono: LogOut, onClick: (x) => onAccion('devolver', x), visible: vigente },
    );
  }
  return (
    <TablaCrud<Asignacion>
      titulo="Asignaciones"
      filas={filas}
      error={error}
      nuevo={nuevo}
      filtros={filtros}
      acciones={acciones}
      textoBusqueda={(x) => [x.activo?.codigoPatrimonial, x.activo?.nombre, x.persona?.nombre, x.area?.nombre].join(' ')}
      vacio="Sin asignaciones."
      columnas={[
        ...(mostrar !== 'persona'
          ? [{ encabezado: 'Activo', ordenar: (x: Asignacion) => x.activo?.codigoPatrimonial, valor: (x: Asignacion) => x.activo && <Link to={`/activos/${x.activo.id}?tab=asignaciones`}>{x.activo.codigoPatrimonial} · {x.activo.nombre}</Link> }]
          : []),
        ...(mostrar !== 'activo'
          ? [{ encabezado: 'Responsable', ordenar: (x: Asignacion) => x.persona?.nombre ?? x.area?.nombre, valor: (x: Asignacion) => (x.persona ? <Link to={`/personas/${x.persona.id}`}>{x.persona.nombre}</Link> : x.area?.nombre) }]
          : []),
        { encabezado: 'Tipo', ordenar: (x) => x.tipo, valor: (x) => et(x.tipo) },
        { encabezado: 'Desde', ordenar: (x) => x.desde, valor: (x) => fecha(x.desde) },
        {
          encabezado: 'Hasta',
          ordenar: (x) => x.hasta ?? x.hastaPrevisto ?? '9',
          valor: (x) => (x.hasta ? fecha(x.hasta) : x.hastaPrevisto
            ? <span className={x.hastaPrevisto < hoy() ? 'estado-problema' : ''}>Previsto {fecha(x.hastaPrevisto)}{x.hastaPrevisto < hoy() ? ' (vencido)' : ''}</span>
            : <strong>Vigente</strong>),
        },
        { encabezado: 'Cierre', valor: (x) => et(x.motivoCierre), secundaria: true },
        { encabezado: 'Observaciones', valor: (x) => x.observaciones, secundaria: true, envolver: true },
      ]}
    />
  );
}

function AsignacionAcciones({ tipo, x, onCerrar, onHecho }: { tipo: AccionAsignacion; x: Asignacion; onCerrar: () => void; onHecho: () => void }) {
  const personas = useOpcionesPersona();
  const areas = useOpcionesArea();
  const ubicaciones = useOpcionesUbicacion();
  const quien = x.persona?.nombre ?? x.area?.nombre ?? '';
  if (tipo === 'devolver') {
    return (
      <PanelFormulario
        titulo={`Devolución de ${x.activo?.codigoPatrimonial ?? 'activo'}`}
        descripcion={`Lo tiene ${quien} (${et(x.tipo).toLowerCase()}).`}
        textoEnviar="Registrar devolución"
        campos={[
          { nombre: 'ubicacionId', etiqueta: 'Dónde queda', tipo: 'select', opciones: ubicaciones, vacio: 'Sin cambiar la ubicación' },
          { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea', ayuda: 'Estado en que se devuelve, faltantes…' },
        ]}
        onEnviar={(d) => api.asignaciones.devolver(x.id, d)}
        onCerrar={onCerrar}
        onHecho={onHecho}
      />
    );
  }
  return (
    <PanelFormulario
      titulo={`Transferir ${x.activo?.codigoPatrimonial ?? 'activo'}`}
      descripcion={`Ahora lo tiene ${quien}. Se cierra su asignación y se abre otra, sin pasar por el almacén.`}
      textoEnviar="Transferir"
      campos={[
        { nombre: 'personaId', etiqueta: 'Nuevo responsable', tipo: 'select', opciones: personas, vacio: 'Ninguno (asignar a un área)' },
        { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, visible: (v) => !v.personaId },
        { nombre: 'observacion', etiqueta: 'Motivo u observación', tipo: 'textarea' },
      ]}
      onEnviar={(d) => api.asignaciones.transferir(x.id, d)}
      onCerrar={onCerrar}
      onHecho={onHecho}
    />
  );
}

export function AsignacionesPage() {
  const [vista, setVista] = useState('vigentes');
  const filtro = vista === 'vigentes' ? { vigentes: true } : vista === 'vencidas' ? { vencidas: true } : vista === 'temporales' ? { vigentes: true, tipo: 'TEMPORAL_REEMPLAZO' } : {};
  const datos = usePolling((s) => api.asignaciones.listar(filtro, s), 30_000, vista);
  const { puede } = useSesion();
  const [accion, setAccion] = useState<{ tipo: AccionAsignacion; x: Asignacion } | null>(null);
  const [nueva, setNueva] = useState(false);
  const disponibles = useOpcionesActivoDisponible(undefined, String(nueva));
  const personas = useOpcionesPersona();
  const areas = useOpcionesArea();
  return (
    <>
      <PageHeader titulo="Asignaciones" subtitulo="Quién tiene cada equipo, desde cuándo y hasta cuándo." />
      <TablaAsignacionesCrud
        filas={datos.data}
        error={datos.error}
        mostrar="ambos"
        onAccion={(tipo, x) => setAccion({ tipo, x })}
        nuevo={puede('ADMIN', 'TECNICO') && { etiqueta: 'Nueva asignación', onClick: () => setNueva(true) }}
        filtros={
          <SelectField etiqueta="Ver" value={vista} onChange={(e) => setVista(e.target.value)} opciones={[
            { valor: 'vigentes', etiqueta: 'Vigentes' }, { valor: 'vencidas', etiqueta: 'Préstamos vencidos' },
            { valor: 'temporales', etiqueta: 'Reemplazos temporales' }, { valor: 'todas', etiqueta: 'Historial completo' },
          ]} />
        }
      />
      {accion && <AsignacionAcciones {...accion} onCerrar={() => setAccion(null)} onHecho={datos.recargar} />}
      {nueva && (
        <PanelFormulario
          titulo="Nueva asignación"
          textoEnviar="Asignar"
          campos={[
            { nombre: 'activoId', etiqueta: 'Activo', tipo: 'select', opciones: disponibles, requerido: true, vacio: disponibles.length ? 'Elegir…' : 'No hay activos disponibles', ayuda: 'Solo activos en servicio, sin asignar y fuera de mantenimiento.' },
            { nombre: 'tipo', etiqueta: 'Modalidad de entrega', tipo: 'select', opciones: opcionesDe(TIPOS_ASIGNACION.filter((t) => t !== 'TEMPORAL_REEMPLAZO')), requerido: true },
            { nombre: 'personaId', etiqueta: 'Trabajador', tipo: 'select', opciones: personas, vacio: 'Ninguno (asignar a un área)' },
            { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, visible: (v) => !v.personaId },
            { nombre: 'hastaPrevisto', etiqueta: 'Devolución prevista', tipo: 'fecha', requerido: true, visible: (v) => v.tipo !== 'PERMANENTE' },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea', ayuda: 'Estado en que se entrega, accesorios…' },
          ]}
          inicial={{ tipo: 'PERMANENTE', hastaPrevisto: hoyMas(7) }}
          onEnviar={(d) => api.asignaciones.asignar(d)}
          onCerrar={() => setNueva(false)}
          onHecho={datos.recargar}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ Mantenimiento

type AccionOrden = 'avance' | 'cerrar' | 'cancelar';
const abierta = (o: Orden) => ['ABIERTA', 'EN_CURSO', 'EN_ESPERA'].includes(o.estado);

export function TablaOrdenesCrud({ filas, conActivo, onAccion, nuevo, filtros, error }: {
  filas: Orden[] | undefined;
  conActivo?: boolean;
  onAccion?: (a: AccionOrden, o: Orden) => void;
  nuevo?: { etiqueta: string; onClick: () => void } | false;
  filtros?: React.ReactNode;
  error?: Error;
}) {
  const navegar = useNavigate();
  const { puede } = useSesion();
  const acciones: AccionFila<Orden>[] = [{ etiqueta: 'Ver orden', icono: Eye, onClick: (o) => navegar(`/mantenimiento/${o.id}`) }];
  if (onAccion && puede('ADMIN', 'TECNICO')) {
    acciones.push(
      { etiqueta: 'Registrar avance', icono: Pencil, onClick: (o) => onAccion('avance', o), visible: abierta },
      { etiqueta: 'Cerrar orden', icono: CheckCircle2, onClick: (o) => onAccion('cerrar', o), visible: abierta },
      { etiqueta: 'Cancelar orden', icono: Ban, peligro: true, onClick: (o) => onAccion('cancelar', o), visible: abierta },
    );
  }
  return (
    <TablaCrud<Orden>
      titulo="Órdenes de mantenimiento"
      filas={filas}
      error={error}
      nuevo={nuevo}
      filtros={filtros}
      acciones={acciones}
      onFila={(o) => navegar(`/mantenimiento/${o.id}`)}
      textoBusqueda={(o) => [o.codigo, o.activo?.codigoPatrimonial, o.activo?.nombre, o.fallaReportada, o.tecnico].join(' ')}
      vacio="Sin órdenes de mantenimiento."
      columnas={[
        { encabezado: 'Orden', mono: true, ancho: '100px', ordenar: (o) => o.codigo, valor: (o) => <Link to={`/mantenimiento/${o.id}`} onClick={(e) => e.stopPropagation()}>{o.codigo}</Link> },
        ...(conActivo ? [{ encabezado: 'Activo', ordenar: (o: Orden) => o.activo?.codigoPatrimonial, valor: (o: Orden) => o.activo && <Link to={`/activos/${o.activo.id}`} onClick={(e) => e.stopPropagation()}>{o.activo.codigoPatrimonial} · {o.activo.nombre}</Link> }] : []),
        { encabezado: 'Tipo', ordenar: (o) => o.tipo, valor: (o) => `${et(o.tipo)} · ${et(o.motivo)}` },
        { encabezado: 'Falla', valor: (o) => o.fallaReportada, secundaria: true, envolver: true },
        { encabezado: 'Apertura', ordenar: (o) => o.fechaApertura, valor: (o) => fecha(o.fechaApertura) },
        { encabezado: 'Estado', ordenar: (o) => o.estado, valor: (o) => <EstadoPunto valor={o.estado} /> },
        { encabezado: 'Resultado', valor: (o) => et(o.resultado), secundaria: true },
      ]}
    />
  );
}

function OrdenAcciones({ tipo, o, onCerrar, onHecho }: { tipo: AccionOrden; o: Orden; onCerrar: () => void; onHecho: () => void }) {
  const ubicaciones = useOpcionesUbicacion();
  if (tipo === 'avance') {
    return (
      <PanelFormulario
        titulo={`Avance de ${o.codigo}`}
        campos={[
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: opcionesDe(['ABIERTA', 'EN_CURSO', 'EN_ESPERA']), requerido: true },
          { nombre: 'diagnostico', etiqueta: 'Diagnóstico', tipo: 'textarea' },
          { nombre: 'tecnico', etiqueta: 'Técnico' },
          { nombre: 'proveedorExterno', etiqueta: 'Proveedor externo' },
          { nombre: 'costo', etiqueta: 'Costo', tipo: 'numero' },
        ]}
        inicial={{ estado: o.estado, diagnostico: o.diagnostico ?? '', tecnico: o.tecnico ?? '', proveedorExterno: o.proveedorExterno ?? '', costo: o.costo ?? '' }}
        onEnviar={(d) => api.mantenimiento.actualizar(o.id, { ...d, costo: d.costo == null ? null : String(d.costo) })}
        onCerrar={onCerrar}
        onHecho={onHecho}
      />
    );
  }
  if (tipo === 'cerrar') {
    return (
      <PanelFormulario
        titulo={`Cerrar ${o.codigo}`}
        descripcion="El activo vuelve a su ubicación anterior y, si se prestó un equipo temporal, se registra su devolución."
        textoEnviar="Cerrar orden"
        campos={[
          { nombre: 'resultado', etiqueta: 'Estado técnico final', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS.filter((e) => e !== 'SIN_EVALUAR')), requerido: true },
          { nombre: 'solucion', etiqueta: 'Solución aplicada', tipo: 'textarea', requerido: true },
          { nombre: 'costo', etiqueta: 'Costo', tipo: 'numero' },
          { nombre: 'ubicacionId', etiqueta: 'Dónde queda', tipo: 'select', opciones: ubicaciones, vacio: 'Donde estaba antes del taller' },
          { nombre: 'devolverTemporal', etiqueta: 'Registrar la devolución del equipo temporal', tipo: 'casilla' },
          { nombre: 'darDeBaja', etiqueta: 'Dar de baja el activo (solo si es irreparable)', tipo: 'casilla', visible: (v) => v.resultado === 'IRREPARABLE' },
        ]}
        inicial={{ resultado: 'OPERATIVO', devolverTemporal: true, solucion: o.solucion ?? '' }}
        onEnviar={(d) => api.mantenimiento.cerrar(o.id, { ...d, costo: d.costo == null ? null : String(d.costo) })}
        onCerrar={onCerrar}
        onHecho={onHecho}
      />
    );
  }
  return (
    <PanelFormulario
      titulo={`Cancelar ${o.codigo}`}
      textoEnviar="Cancelar orden"
      campos={[{ nombre: 'observacion', etiqueta: 'Motivo de la cancelación', tipo: 'textarea', requerido: true }]}
      onEnviar={(d) => api.mantenimiento.cancelar(o.id, d)}
      onCerrar={onCerrar}
      onHecho={onHecho}
    />
  );
}

export function MantenimientoPage() {
  const [vista, setVista] = useState('abiertas');
  const datos = usePolling((s) => api.mantenimiento.listar(vista === 'abiertas' ? { abiertas: true } : {}, s), 30_000, vista);
  const activos = usePolling((s) => api.activos.listar({ porPagina: 500 }, s), 120_000);
  const talleres = useOpcionesUbicacion();
  const { puede } = useSesion();
  const navegar = useNavigate();
  const [accion, setAccion] = useState<{ tipo: AccionOrden; o: Orden } | null>(null);
  const [nueva, setNueva] = useState(false);
  const sinOrden = (activos.data?.items ?? []).filter((a) => !a.ordenAbierta).map((a) => ({ valor: a.id, etiqueta: `${a.codigoPatrimonial} · ${a.nombre}` }));
  return (
    <>
      <PageHeader titulo="Mantenimiento" subtitulo="Órdenes preventivas y correctivas de los activos." />
      <TablaOrdenesCrud
        filas={datos.data}
        error={datos.error}
        conActivo
        onAccion={(tipo, o) => setAccion({ tipo, o })}
        nuevo={puede('ADMIN', 'TECNICO') && { etiqueta: 'Nueva orden', onClick: () => setNueva(true) }}
        filtros={<SelectField etiqueta="Ver" value={vista} onChange={(e) => setVista(e.target.value)} opciones={[{ valor: 'abiertas', etiqueta: 'Abiertas' }, { valor: 'todas', etiqueta: 'Todas' }]} />}
      />
      {accion && <OrdenAcciones {...accion} onCerrar={() => setAccion(null)} onHecho={datos.recargar} />}
      {nueva && (
        <PanelFormulario
          titulo="Nueva orden de mantenimiento"
          descripcion="Para prestar un equipo temporal al trabajador, abre la orden desde la ficha del activo."
          textoEnviar="Abrir orden"
          campos={[
            { nombre: 'activoId', etiqueta: 'Activo', tipo: 'select', opciones: sinOrden, requerido: true },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(['CORRECTIVO', 'PREVENTIVO']), requerido: true },
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'fallaReportada', etiqueta: 'Falla reportada o trabajo a realizar', tipo: 'textarea', requerido: true },
            { nombre: 'estadoTecnico', etiqueta: 'Estado técnico con el que entra', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), vacio: 'Sin cambiar' },
            { nombre: 'ubicacionTallerId', etiqueta: 'Enviar a (taller o proveedor)', tipo: 'select', opciones: talleres, vacio: 'Se queda donde está' },
            { nombre: 'tecnico', etiqueta: 'Técnico responsable' },
            { nombre: 'proveedorExterno', etiqueta: 'Proveedor externo' },
          ]}
          inicial={{ tipo: 'CORRECTIVO', motivo: 'FALLA_TECNICA' }}
          onEnviar={(d) => api.mantenimiento.abrir({ ...d, estadoTecnico: d.estadoTecnico ?? undefined })}
          onHecho={(r) => navegar(`/mantenimiento/${(r as Orden).id}`)}
          onCerrar={() => setNueva(false)}
        />
      )}
    </>
  );
}

export function OrdenPage() {
  const { id = '' } = useParams();
  const datos = usePolling((s) => api.mantenimiento.obtener(id, s), 30_000, id);
  const { puede } = useSesion();
  const [accion, setAccion] = useState<AccionOrden | null>(null);
  if (datos.error && !datos.data) return <EmptyState icono={Wrench} titulo="Orden no encontrada" accion={<Button a="/mantenimiento">Ir a Mantenimiento</Button>} />;
  const o: Orden | undefined = datos.data;
  if (!o) return <LoadingState />;

  return (
    <>
      <PageHeader
        migas={[{ etiqueta: 'Mantenimiento', a: '/mantenimiento' }, { etiqueta: o.codigo }]}
        titulo={<>Orden {o.codigo} <span className="texto-terciario">· {et(o.tipo)}</span></>}
        subtitulo={o.activo && <Link to={`/activos/${o.activo.id}`}>{o.activo.codigoPatrimonial} · {o.activo.nombre}</Link>}
        acciones={abierta(o) && puede('ADMIN', 'TECNICO') && (
          <div className="acciones-pagina">
            <Button icono={Pencil} onClick={() => setAccion('avance')}>Registrar avance</Button>
            <Button variante="primario" icono={CheckCircle2} onClick={() => setAccion('cerrar')}>Cerrar orden</Button>
            <Button variante="fantasma" icono={Ban} onClick={() => setAccion('cancelar')}>Cancelar</Button>
          </div>
        )}
      />
      <div className="barra-estados">
        <span><span className="etq">Estado</span> <EstadoPunto valor={o.estado} /></span>
        <span><span className="etq">Motivo</span> {et(o.motivo)}</span>
        <span><span className="etq">Apertura</span> {fechaHora(o.fechaApertura)}</span>
        {o.fechaCierre && <span><span className="etq">Cierre</span> {fechaHora(o.fechaCierre)}</span>}
        {o.resultado && <span><span className="etq">Resultado</span> <EstadoPunto valor={o.resultado} /></span>}
      </div>
      <Section titulo="Trabajo">
        <KeyValueList datos={[
          { etiqueta: 'Falla reportada', valor: o.fallaReportada }, { etiqueta: 'Diagnóstico', valor: o.diagnostico },
          { etiqueta: 'Solución', valor: o.solucion }, { etiqueta: 'Técnico', valor: o.tecnico },
          { etiqueta: 'Proveedor externo', valor: o.proveedorExterno }, { etiqueta: 'Costo', valor: o.costo && Number(o.costo).toLocaleString('es', { minimumFractionDigits: 2 }) },
        ]} />
      </Section>
      <Section titulo="Equipo temporal entregado">
        <TablaAsignacionesCrud filas={o.temporales ?? []} mostrar="ambos" />
      </Section>
      <Section titulo="Componentes instalados en esta orden">
        {(o.componentes ?? []).length === 0 ? <p className="texto-terciario">Ninguno. Para cambiar piezas, usa la pestaña Componentes del activo.</p> : (
          <KeyValueList datos={(o.componentes ?? []).map((i) => ({ etiqueta: i.componente.tipoComponente?.nombre ?? 'Componente', valor: <Link to={`/componentes/${i.componente.id}`}>{i.componente.codigo} {i.componente.modelo ?? ''}</Link> }))} />
        )}
      </Section>
      <TabDocumentos entidad="ORDEN" entidadId={o.id} />
      {accion && <OrdenAcciones tipo={accion} o={o} onCerrar={() => setAccion(null)} onHecho={datos.recargar} />}
    </>
  );
}
