import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Cpu, Pencil, Plus, Trash2, Undo2, Wrench } from 'lucide-react';
import { Button, EmptyState, ErrorState, KeyValueList, LoadingState, PageHeader, Section, SelectField, SpecTable, TextField } from '../../components/ui';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { fecha, fechaHora, unir } from '../../lib/formato';
import { ESTADOS_TECNICOS, MOTIVOS, et, opcionesDe, type ComponenteDetalle, type ComponenteVista, type InstalacionVista } from '../../types/gestion';
import { EstadoPunto, LineaTiempo, useOpcionesUbicacion, useTiposComponente } from '../gestion/comun';
import { TabDocumentos } from '../activos/ActivoTabs';

const SITUACIONES = ['INSTALADO', 'EN_ALMACEN', 'EN_MANTENIMIENTO', 'DADO_DE_BAJA'];

export function ComponentesPage() {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [situacion, setSituacion] = useState('');
  const filtro = { q, tipo, situacion, porPagina: 500 };
  const datos = usePolling((s) => api.componentes.listar(filtro, s), 30_000, JSON.stringify(filtro));
  const tipos = useTiposComponente();
  const almacenes = useOpcionesUbicacion();
  const { puede } = useSesion();
  const [nuevo, setNuevo] = useState(false);

  return (
    <>
      <PageHeader
        titulo="Componentes"
        subtitulo="Piezas con identidad propia: dónde están, en qué equipo estuvieron y por qué salieron."
        acciones={puede('ADMIN', 'TECNICO') && <Button variante="primario" icono={Plus} onClick={() => setNuevo(true)}>Ingresar al almacén</Button>}
      />
      <div className="filtros-fila" role="search">
        <div className="filtro-busqueda"><TextField etiqueta="Buscar" placeholder="Código, serie, modelo, activo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <SelectField etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} opciones={[{ valor: '', etiqueta: 'Todos' }, ...tipos.map((t) => ({ valor: t.codigo, etiqueta: t.nombre }))]} />
        <SelectField etiqueta="Situación" value={situacion} onChange={(e) => setSituacion(e.target.value)} opciones={[{ valor: '', etiqueta: 'Todas (sin bajas)' }, ...opcionesDe(SITUACIONES)]} />
        <span className="filtros-total">{datos.data?.total ?? 0} componentes</span>
      </div>
      {datos.error && !datos.data ? <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} /> : !datos.data ? <LoadingState /> : (
        <TablaComponentes filas={datos.data.items} />
      )}
      {nuevo && (
        <PanelFormulario
          titulo="Ingresar componente al almacén"
          textoEnviar="Registrar"
          campos={[
            { nombre: 'tipoComponenteId', etiqueta: 'Tipo', tipo: 'select', opciones: tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })), requerido: true },
            { nombre: 'marca', etiqueta: 'Marca' },
            { nombre: 'modelo', etiqueta: 'Modelo' },
            { nombre: 'numeroSerie', etiqueta: 'Número de serie', ayuda: 'Permite que ScanGP lo reconozca al instalarlo en un equipo.' },
            { nombre: 'capacidad', etiqueta: 'Capacidad', placeholder: '16 GB, 1 TB…' },
            { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true },
            { nombre: 'estadoTecnico', etiqueta: 'Estado técnico', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), vacio: 'Operativo' },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
          ]}
          onEnviar={(d) => api.componentes.crear({ ...d, estadoTecnico: d.estadoTecnico ?? undefined })}
          onCerrar={() => setNuevo(false)}
          onHecho={datos.recargar}
        />
      )}
    </>
  );
}

export function TablaComponentes({ filas }: { filas: ComponenteVista[] }) {
  return (
    <SpecTable<ComponenteVista>
      titulo="Componentes"
      filas={filas}
      vacio="No hay componentes con esos filtros."
      columnas={[
        { encabezado: 'Código', mono: true, valor: (c) => <Link to={`/componentes/${c.id}`}>{c.codigo}</Link> },
        { encabezado: 'Tipo', valor: (c) => c.tipo.nombre },
        { encabezado: 'Modelo', valor: (c) => unir([c.marca, c.modelo]) ?? '—' },
        { encabezado: 'Capacidad', valor: (c) => c.capacidad ?? '—' },
        { encabezado: 'Serie', mono: true, valor: (c) => c.numeroSerie ?? '—' },
        { encabezado: 'Situación', valor: (c) => <EstadoPunto valor={c.situacion} /> },
        { encabezado: 'Dónde', valor: (c) => (c.activo ? <Link to={`/activos/${c.activo.id}?tab=componentes`}>{c.activo.codigoPatrimonial} · {c.activo.nombre}</Link> : (c.ubicacion?.nombre ?? '—')) },
        { encabezado: 'Estado técnico', valor: (c) => <EstadoPunto valor={c.estadoTecnico} /> },
      ]}
    />
  );
}

type Accion = 'editar' | 'instalar' | 'retirar' | 'reingresar' | 'baja';

export function ComponentePage() {
  const { id = '' } = useParams();
  const datos = usePolling((s) => api.componentes.obtener(id, s), 30_000, id);
  const activos = usePolling((s) => api.activos.listar({ porPagina: 500 }, s), 120_000);
  const almacenes = useOpcionesUbicacion();
  const { puede } = useSesion();
  const [accion, setAccion] = useState<Accion | null>(null);

  if (datos.error && !datos.data) return <EmptyState icono={Cpu} titulo="Componente no encontrado" accion={<Button a="/componentes">Ir a Componentes</Button>} />;
  const c: ComponenteDetalle | undefined = datos.data;
  if (!c) return <LoadingState />;
  const escribe = puede('ADMIN', 'TECNICO') && c.situacion !== 'DADO_DE_BAJA';
  const cerrar = () => setAccion(null);

  return (
    <>
      <PageHeader
        migas={[{ etiqueta: 'Componentes', a: '/componentes' }, { etiqueta: c.codigo }]}
        titulo={<>{c.tipo.nombre} {unir([c.marca, c.modelo, c.capacidad])} <span className="texto-terciario mono">{c.codigo}</span></>}
        subtitulo={c.numeroSerie ? `Serie ${c.numeroSerie}` : 'Sin número de serie'}
        acciones={escribe && (
          <div className="acciones-pagina">
            {c.situacion === 'EN_ALMACEN' && <Button variante="primario" onClick={() => setAccion('instalar')}>Instalar en un equipo</Button>}
            {c.situacion === 'INSTALADO' && <Button icono={Undo2} onClick={() => setAccion('retirar')}>Retirar</Button>}
            {c.situacion === 'EN_MANTENIMIENTO' && <Button icono={Wrench} onClick={() => setAccion('reingresar')}>Volvió de mantenimiento</Button>}
            <Button icono={Pencil} onClick={() => setAccion('editar')}>Editar</Button>
            {c.situacion !== 'INSTALADO' && <Button variante="fantasma" icono={Trash2} onClick={() => setAccion('baja')}>Dar de baja</Button>}
          </div>
        )}
      />
      <div className="barra-estados">
        <span><span className="etq">Situación</span> <EstadoPunto valor={c.situacion} /></span>
        <span><span className="etq">Estado técnico</span> <EstadoPunto valor={c.estadoTecnico} /></span>
        <span><span className="etq">Dónde</span> {c.activo ? <Link to={`/activos/${c.activo.id}`}>{c.activo.codigoPatrimonial} · {c.activo.nombre}</Link> : (c.ubicacion?.nombre ?? '—')}</span>
        {c.activo && <span><span className="etq">ScanGP</span> {c.confirmadoPorScanGP ? 'Instalación confirmada' : 'Aún no confirmado'}</span>}
      </div>

      <Section titulo="Equipos en los que estuvo">
        <SpecTable<InstalacionVista>
          titulo="Instalaciones"
          filas={c.instalaciones}
          vacio="Nunca se instaló en un equipo."
          columnas={[
            { encabezado: 'Activo', valor: (i) => i.activo && <Link to={`/activos/${i.activo.id}`}>{i.activo.codigoPatrimonial} · {i.activo.nombre}</Link> },
            { encabezado: 'Desde', valor: (i) => fechaHora(i.desde) },
            { encabezado: 'Hasta', valor: (i) => (i.hasta ? fechaHora(i.hasta) : <strong>Instalado</strong>) },
            { encabezado: 'Motivo de instalación', valor: (i) => et(i.motivoInstalacion) || '—' },
            { encabezado: 'Motivo de retiro', valor: (i) => et(i.motivoRetiro) || '—' },
            { encabezado: 'Confirmado por ScanGP', valor: (i) => (i.confirmadaEn ? fecha(i.confirmadaEn) : '—') },
          ]}
        />
      </Section>
      <Section titulo="Datos"><KeyValueList datos={[{ etiqueta: 'Observaciones', valor: c.observaciones }]} /></Section>
      <Section titulo="Historial"><LineaTiempo movimientos={c.historial} /></Section>
      <TabDocumentos entidad="COMPONENTE" entidadId={c.id} />

      {accion === 'instalar' && (
        <PanelFormulario
          titulo={`Instalar ${c.codigo}`}
          textoEnviar="Instalar"
          campos={[
            { nombre: 'activoId', etiqueta: 'Equipo', tipo: 'select', requerido: true, opciones: (activos.data?.items ?? []).map((a) => ({ valor: a.id, etiqueta: `${a.codigoPatrimonial} · ${a.nombre}` })) },
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
          ]}
          inicial={{ motivo: 'ACTUALIZACION' }}
          onEnviar={(d) => api.componentes.instalar(c.id, d)}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
      {accion === 'retirar' && (
        <PanelFormulario
          titulo={`Retirar ${c.codigo}`}
          textoEnviar="Retirar"
          campos={[
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'destino', etiqueta: 'A dónde va', tipo: 'select', requerido: true, opciones: [{ valor: 'ALMACEN', etiqueta: 'Almacén' }, { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento / garantía' }, { valor: 'BAJA', etiqueta: 'Baja' }] },
            { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true, visible: (v) => v.destino === 'ALMACEN' },
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
          ]}
          inicial={{ motivo: 'FALLA_TECNICA', destino: 'MANTENIMIENTO' }}
          onEnviar={(d) => api.componentes.retirar(c.id, d)}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
      {accion === 'reingresar' && (
        <PanelFormulario
          titulo="Volvió de mantenimiento"
          textoEnviar="Ingresar al almacén"
          campos={[
            { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true },
            { nombre: 'estadoTecnico', etiqueta: 'Estado técnico', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Resultado del mantenimiento', tipo: 'textarea' },
          ]}
          inicial={{ estadoTecnico: 'OPERATIVO' }}
          onEnviar={(d) => api.componentes.reingresar(c.id, d)}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
      {accion === 'baja' && (
        <PanelFormulario
          titulo={`Dar de baja ${c.codigo}`}
          textoEnviar="Dar de baja"
          campos={[
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Explicación', tipo: 'textarea', requerido: true },
          ]}
          onEnviar={(d) => api.componentes.baja(c.id, d)}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
      {accion === 'editar' && (
        <PanelFormulario
          titulo={`Editar ${c.codigo}`}
          campos={[
            { nombre: 'marca', etiqueta: 'Marca' },
            { nombre: 'modelo', etiqueta: 'Modelo' },
            { nombre: 'numeroSerie', etiqueta: 'Número de serie' },
            { nombre: 'capacidad', etiqueta: 'Capacidad' },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
          ]}
          inicial={{ marca: c.marca ?? '', modelo: c.modelo ?? '', numeroSerie: c.numeroSerie ?? '', capacidad: c.capacidad ?? '', observaciones: c.observaciones ?? '' }}
          onEnviar={(d) => api.componentes.editar(c.id, d)}
          onCerrar={cerrar}
          onHecho={datos.recargar}
        />
      )}
    </>
  );
}
