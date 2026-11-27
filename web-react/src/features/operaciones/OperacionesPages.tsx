import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, CheckCircle2, Pencil, Users, Wrench } from 'lucide-react';
import { Button, EmptyState, KeyValueList, LoadingState, PageHeader, Section, SelectField, SpecTable } from '../../components/ui';
import { CAMPO_ACTIVO, TablaMaestra } from '../../components/forms/TablaMaestra';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { fechaHora, unir } from '../../lib/formato';
import { ESTADOS_TECNICOS, et, opcionesDe, type Asignacion, type Orden, type Persona } from '../../types/gestion';
import { EstadoPunto, useOpcionesArea, useOpcionesUbicacion } from '../gestion/comun';
import { TablaAsignaciones, TablaOrdenes, TabDocumentos } from '../activos/ActivoTabs';

// ------------------------------------------------------------------ Trabajadores

export function PersonasPage() {
  const areas = useOpcionesArea();
  return (
    <>
      <PageHeader titulo="Trabajadores" subtitulo="Personas que pueden recibir equipos. No son usuarios de la plataforma." />
      <TablaMaestra<Persona>
        titulo="Trabajadores"
        singular="trabajador"
        cargar={(s) => api.org.personas(s)}
        columnas={[
          { encabezado: 'Nombre', valor: (p) => <Link to={`/personas/${p.id}`}>{p.nombre}</Link> },
          { encabezado: 'Documento', valor: (p) => p.documento ?? '—' },
          { encabezado: 'Área', valor: (p) => p.area?.nombre ?? '—' },
          { encabezado: 'Cargo', valor: (p) => p.cargo ?? '—' },
          { encabezado: 'Usuario de Windows', mono: true, valor: (p) => p.usuarioWindows ?? '—' },
          { encabezado: 'Estado', valor: (p) => (p.activo ? 'Activo' : <span className="texto-terciario">Inactivo</span>) },
        ]}
        campos={(editando) => [
          { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true },
          { nombre: 'documento', etiqueta: 'Documento de identidad' },
          { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, vacio: 'Sin área' },
          { nombre: 'cargo', etiqueta: 'Cargo' },
          { nombre: 'correo', etiqueta: 'Correo' },
          { nombre: 'usuarioWindows', etiqueta: 'Usuario de Windows', placeholder: 'DOMINIO\\usuario', ayuda: 'ScanGP avisará si su equipo asignado lo usa otra persona.' },
          ...(editando ? [CAMPO_ACTIVO] : []),
        ]}
        aValores={(p) => ({ nombre: p.nombre, documento: p.documento ?? '', areaId: p.areaId ?? '', cargo: p.cargo ?? '', correo: p.correo ?? '', usuarioWindows: p.usuarioWindows ?? '', activo: p.activo })}
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
  if (persona.error) return <EmptyState icono={Users} titulo="Trabajador no encontrado" accion={<Button a="/personas">Ir a Trabajadores</Button>} />;
  const p = persona.data;
  if (!p) return <LoadingState />;
  const vigentes = (asignaciones.data ?? []).filter((a) => !a.hasta);
  const pasadas = (asignaciones.data ?? []).filter((a) => a.hasta);
  return (
    <>
      <PageHeader migas={[{ etiqueta: 'Trabajadores', a: '/personas' }, { etiqueta: p.nombre }]} titulo={p.nombre} subtitulo={unir([p.cargo, p.area?.nombre], ' · ')} />
      <Section titulo="Datos">
        <KeyValueList datos={[
          { etiqueta: 'Documento', valor: p.documento }, { etiqueta: 'Correo', valor: p.correo },
          { etiqueta: 'Usuario de Windows', valor: p.usuarioWindows, mono: true }, { etiqueta: 'Estado', valor: p.activo ? 'Activo' : 'Inactivo' },
        ]} />
      </Section>
      <Section titulo={`Equipos a su cargo (${vigentes.length})`}>
        {!asignaciones.data ? <LoadingState /> : <TablaAsignaciones filas={vigentes} mostrar="activo" />}
      </Section>
      <Section titulo="Equipos que tuvo">
        {!asignaciones.data ? <LoadingState /> : <TablaAsignaciones filas={pasadas} mostrar="activo" />}
      </Section>
      <TabDocumentos entidad="PERSONA" entidadId={p.id} />
    </>
  );
}

// ------------------------------------------------------------------ Asignaciones

export function AsignacionesPage() {
  const [vista, setVista] = useState('vigentes');
  const filtro = vista === 'vigentes' ? { vigentes: true } : vista === 'vencidas' ? { vencidas: true } : vista === 'temporales' ? { vigentes: true, tipo: 'TEMPORAL_REEMPLAZO' } : {};
  const datos = usePolling((s) => api.asignaciones.listar(filtro, s), 30_000, vista);
  return (
    <>
      <PageHeader titulo="Asignaciones" subtitulo="Quién tiene cada equipo. Para asignar, abre la ficha del activo." />
      <div className="filtros-fila">
        <SelectField etiqueta="Ver" value={vista} onChange={(e) => setVista(e.target.value)} opciones={[
          { valor: 'vigentes', etiqueta: 'Vigentes' }, { valor: 'vencidas', etiqueta: 'Préstamos vencidos' },
          { valor: 'temporales', etiqueta: 'Reemplazos temporales' }, { valor: 'todas', etiqueta: 'Historial completo' },
        ]} />
        <span className="filtros-total">{datos.data?.length ?? 0} asignaciones</span>
      </div>
      {!datos.data ? <LoadingState /> : <TablaAsignacionesCompleta filas={datos.data} />}
    </>
  );
}

function TablaAsignacionesCompleta({ filas }: { filas: Asignacion[] }) {
  return (
    <SpecTable<Asignacion>
      titulo="Asignaciones"
      filas={filas}
      vacio="Sin asignaciones."
      columnas={[
        { encabezado: 'Activo', valor: (x) => x.activo && <Link to={`/activos/${x.activo.id}?tab=asignaciones`}>{x.activo.codigoPatrimonial} · {x.activo.nombre}</Link> },
        { encabezado: 'Responsable', valor: (x) => (x.persona ? <Link to={`/personas/${x.persona.id}`}>{x.persona.nombre}</Link> : x.area?.nombre) },
        { encabezado: 'Tipo', valor: (x) => et(x.tipo) },
        { encabezado: 'Desde', valor: (x) => fechaHora(x.desde) },
        { encabezado: 'Hasta', valor: (x) => (x.hasta ? fechaHora(x.hasta) : x.hastaPrevisto ? `Previsto ${x.hastaPrevisto}` : 'Vigente') },
      ]}
    />
  );
}

// ------------------------------------------------------------------ Mantenimiento

export function MantenimientoPage() {
  const [vista, setVista] = useState('abiertas');
  const datos = usePolling((s) => api.mantenimiento.listar(vista === 'abiertas' ? { abiertas: true } : {}, s), 30_000, vista);
  return (
    <>
      <PageHeader titulo="Mantenimiento" subtitulo="Órdenes preventivas y correctivas. Para abrir una, usa «Mantenimiento» en la ficha del activo." />
      <div className="filtros-fila">
        <SelectField etiqueta="Ver" value={vista} onChange={(e) => setVista(e.target.value)} opciones={[{ valor: 'abiertas', etiqueta: 'Abiertas' }, { valor: 'todas', etiqueta: 'Todas' }]} />
        <span className="filtros-total">{datos.data?.length ?? 0} órdenes</span>
      </div>
      {!datos.data ? <LoadingState /> : <TablaOrdenes filas={datos.data} conActivo />}
    </>
  );
}

export function OrdenPage() {
  const { id = '' } = useParams();
  const datos = usePolling((s) => api.mantenimiento.obtener(id, s), 30_000, id);
  const ubicaciones = useOpcionesUbicacion();
  const { puede } = useSesion();
  const [accion, setAccion] = useState<'avance' | 'cerrar' | 'cancelar' | null>(null);
  if (datos.error && !datos.data) return <EmptyState icono={Wrench} titulo="Orden no encontrada" accion={<Button a="/mantenimiento">Ir a Mantenimiento</Button>} />;
  const o: Orden | undefined = datos.data;
  if (!o) return <LoadingState />;
  const abierta = ['ABIERTA', 'EN_CURSO', 'EN_ESPERA'].includes(o.estado);
  const cerrar = () => setAccion(null);

  return (
    <>
      <PageHeader
        migas={[{ etiqueta: 'Mantenimiento', a: '/mantenimiento' }, { etiqueta: o.codigo }]}
        titulo={<>Orden {o.codigo} <span className="texto-terciario">· {et(o.tipo)}</span></>}
        subtitulo={o.activo && <Link to={`/activos/${o.activo.id}`}>{o.activo.codigoPatrimonial} · {o.activo.nombre}</Link>}
        acciones={abierta && puede('ADMIN', 'TECNICO') && (
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
        <TablaAsignaciones filas={o.temporales ?? []} mostrar="activo" />
      </Section>
      <Section titulo="Componentes instalados en esta orden">
        {(o.componentes ?? []).length === 0 ? <p className="texto-terciario">Ninguno. Para cambiar piezas, usa la pestaña Componentes del activo indicando esta orden.</p> : (
          <KeyValueList datos={(o.componentes ?? []).map((i) => ({ etiqueta: i.componente.tipoComponente?.nombre ?? 'Componente', valor: <Link to={`/componentes/${i.componente.id}`}>{i.componente.codigo} {i.componente.modelo ?? ''}</Link> }))} />
        )}
      </Section>
      <TabDocumentos entidad="ORDEN" entidadId={o.id} />

      {accion === 'avance' && (
        <PanelFormulario
          titulo="Registrar avance"
          campos={[
            { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: opcionesDe(['ABIERTA', 'EN_CURSO', 'EN_ESPERA']), requerido: true },
            { nombre: 'diagnostico', etiqueta: 'Diagnóstico', tipo: 'textarea' },
            { nombre: 'tecnico', etiqueta: 'Técnico' },
            { nombre: 'proveedorExterno', etiqueta: 'Proveedor externo' },
            { nombre: 'costo', etiqueta: 'Costo', tipo: 'numero' },
          ]}
          inicial={{ estado: o.estado, diagnostico: o.diagnostico ?? '', tecnico: o.tecnico ?? '', proveedorExterno: o.proveedorExterno ?? '', costo: o.costo ?? '' }}
          onEnviar={(d) => api.mantenimiento.actualizar(o.id, { ...d, costo: d.costo == null ? null : String(d.costo) })}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
      {accion === 'cerrar' && (
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
          inicial={{ resultado: 'OPERATIVO', devolverTemporal: true }}
          onEnviar={(d) => api.mantenimiento.cerrar(o.id, { ...d, costo: d.costo == null ? null : String(d.costo) })}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
      {accion === 'cancelar' && (
        <PanelFormulario
          titulo={`Cancelar ${o.codigo}`}
          textoEnviar="Cancelar orden"
          campos={[{ nombre: 'observacion', etiqueta: 'Motivo de la cancelación', tipo: 'textarea', requerido: true }]}
          onEnviar={(d) => api.mantenimiento.cancelar(o.id, d)}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
    </>
  );
}
