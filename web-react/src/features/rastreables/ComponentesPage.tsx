import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Cpu, Eye, Monitor, PackageCheck, Pencil, ScanSearch, Trash2, Undo2, Warehouse, Wrench } from 'lucide-react';
import { Button, EmptyState, KeyValueList, LoadingState, PageHeader, SelectField } from '../../components/ui';
import { FichaColumnas, MenuMas, PestanasFicha, ResumenFicha } from '../../components/ficha/Ficha';
import { TablaCrud, type AccionFila } from '../../components/crud/TablaCrud';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { fecha, fechaHora, unir } from '../../lib/formato';
import { et, opcionesDe, type ComponenteDetalle, type ComponenteVista, type InstalacionVista } from '../../types/gestion';
import { EstadoPunto, LineaTiempo, useTiposComponente } from '../gestion/comun';
import { TabDocumentos } from '../activos/ActivoTabs';
import { ComponenteAcciones, type AccionComponente } from './ComponenteAcciones';
import { medidaDe } from './tiposComponente';

const SITUACIONES = ['INSTALADO', 'EN_ALMACEN', 'EN_MANTENIMIENTO', 'DADO_DE_BAJA'];

/** Acciones por fila según la situación del componente. */
export function accionesComponente(abrir: (a: AccionComponente, c: ComponenteVista) => void, ver?: (c: ComponenteVista) => void): AccionFila<ComponenteVista>[] {
  const vivo = (c: ComponenteVista) => c.situacion !== 'DADO_DE_BAJA';
  return [
    ...(ver ? [{ etiqueta: 'Ver ficha', icono: Eye, onClick: ver }] : []),
    { etiqueta: 'Instalar en un equipo', icono: PackageCheck, grupo: 'mover', onClick: (c) => abrir('instalar', c), visible: (c) => c.situacion === 'EN_ALMACEN' },
    { etiqueta: 'Retirar', icono: Undo2, grupo: 'mover', onClick: (c) => abrir('retirar', c), visible: (c) => c.situacion === 'INSTALADO' },
    { etiqueta: 'Volvió de mantenimiento', icono: Wrench, grupo: 'mover', onClick: (c) => abrir('reingresar', c), visible: (c) => c.situacion === 'EN_MANTENIMIENTO' },
    { etiqueta: 'Editar', icono: Pencil, onClick: (c) => abrir('editar', c), visible: vivo },
    { etiqueta: 'Dar de baja', icono: Trash2, peligro: true, onClick: (c) => abrir('baja', c), visible: (c) => vivo(c) && c.situacion !== 'INSTALADO' },
  ];
}

export function ComponentesPage() {
  const [tipo, setTipo] = useState('');
  const [situacion, setSituacion] = useState('');
  const filtro = { tipo, situacion, porPagina: 500 };
  const datos = usePolling((s) => api.componentes.listar(filtro, s), 30_000, JSON.stringify(filtro));
  const tipos = useTiposComponente();
  const { puede } = useSesion();
  const navegar = useNavigate();
  const [accion, setAccion] = useState<{ a: AccionComponente; c?: ComponenteVista } | null>(null);
  const escribe = puede('ADMIN', 'TECNICO');

  return (
    <>
      <PageHeader titulo="Componentes" subtitulo="Piezas con identidad propia: dónde están, en qué equipo estuvieron y por qué salieron." />
      <TablaComponentes
        filas={datos.data?.items}
        error={datos.error}
        onReintentar={datos.recargar}
        nuevo={escribe && { etiqueta: 'Ingresar al almacén', onClick: () => setAccion({ a: 'nuevo' }) }}
        acciones={escribe ? accionesComponente((a, c) => setAccion({ a, c }), (c) => navegar(`/componentes/${c.id}`)) : undefined}
        onFila={(c) => navegar(`/componentes/${c.id}`)}
        filtros={
          <>
            <SelectField etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} opciones={[{ valor: '', etiqueta: 'Todos' }, ...tipos.map((t) => ({ valor: t.codigo, etiqueta: t.nombre }))]} />
            <SelectField etiqueta="Situación" value={situacion} onChange={(e) => setSituacion(e.target.value)} opciones={[{ valor: '', etiqueta: 'Todas (sin bajas)' }, ...opcionesDe(SITUACIONES)]} />
          </>
        }
      />
      {accion && <ComponenteAcciones accion={accion.a} c={accion.c} onCerrar={() => setAccion(null)} onHecho={datos.recargar} />}
    </>
  );
}

interface TablaProps {
  filas: ComponenteVista[] | undefined;
  error?: Error;
  onReintentar?: () => void;
  nuevo?: { etiqueta: string; onClick: () => void } | false;
  acciones?: AccionFila<ComponenteVista>[];
  onFila?: (c: ComponenteVista) => void;
  filtros?: React.ReactNode;
}

export function TablaComponentes({ filas, error, onReintentar, nuevo, acciones, onFila, filtros }: TablaProps) {
  return (
    <TablaCrud<ComponenteVista>
      titulo="Componentes"
      filas={filas}
      error={error}
      onReintentar={onReintentar}
      nuevo={nuevo}
      acciones={acciones}
      onFila={onFila}
      filtros={filtros}
      textoBusqueda={(c) => [c.codigo, c.numeroSerie, c.marca, c.modelo, c.activo?.codigoPatrimonial, c.activo?.nombre].join(' ')}
      vacio="No hay componentes con esos filtros."
      columnas={[
        { encabezado: 'Código', mono: true, ordenar: (c) => c.codigo, valor: (c) => <Link to={`/componentes/${c.id}`} onClick={(e) => e.stopPropagation()}>{c.codigo}</Link> },
        { encabezado: 'Tipo', ordenar: (c) => c.tipo.nombre, valor: (c) => c.tipo.nombre },
        { encabezado: 'Modelo', ordenar: (c) => unir([c.marca, c.modelo]), valor: (c) => unir([c.marca, c.modelo]) },
        { encabezado: 'Capacidad / medida', ordenar: (c) => c.capacidad, valor: (c) => c.capacidad, secundaria: true },
        { encabezado: 'Serie', mono: true, ordenar: (c) => c.numeroSerie, valor: (c) => c.numeroSerie, secundaria: true },
        { encabezado: 'Situación', ordenar: (c) => c.situacion, valor: (c) => <EstadoPunto valor={c.situacion} /> },
        {
          encabezado: 'Dónde',
          ordenar: (c) => c.activo?.codigoPatrimonial ?? c.ubicacion?.nombre,
          valor: (c) => (c.activo ? <Link to={`/activos/${c.activo.id}?tab=componentes`} onClick={(e) => e.stopPropagation()}>{c.activo.codigoPatrimonial} · {c.activo.nombre}</Link> : c.ubicacion?.nombre),
        },
        { encabezado: 'Estado técnico', ordenar: (c) => c.estadoTecnico, valor: (c) => <EstadoPunto valor={c.estadoTecnico} />, secundaria: true },
      ]}
    />
  );
}

export function ComponentePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const datos = usePolling((s) => api.componentes.obtener(id, s), 30_000, id);
  const { puede } = useSesion();
  const [accion, setAccion] = useState<AccionComponente | null>(null);

  if (datos.error && !datos.data) return <EmptyState icono={Cpu} titulo="Componente no encontrado" accion={<Button a="/componentes">Ir a Componentes</Button>} />;
  const c: ComponenteDetalle | undefined = datos.data;
  if (!c) return <LoadingState />;
  const escribe = puede('ADMIN', 'TECNICO') && c.situacion !== 'DADO_DE_BAJA';
  const nombre = unir([c.marca, c.modelo]) || c.tipo.nombre;
  const vigente = c.instalaciones.find((i) => !i.hasta);
  const pestanas = [
    { clave: 'recorrido', nombre: 'Recorrido', contador: c.instalaciones.length },
    { clave: 'historial', nombre: 'Historial', contador: c.historial.length },
    { clave: 'documentos', nombre: 'Documentos' },
  ];
  const tab = pestanas.some((p) => p.clave === params.get('tab')) ? params.get('tab')! : 'recorrido';

  return (
    <>
      <div className="ficha-cabecera">
        <PageHeader
          migas={[{ etiqueta: 'Componentes', a: '/componentes' }, { etiqueta: c.codigo }]}
          titulo={<>{nombre} <span className="codigo-chip">{c.codigo}</span></>}
          subtitulo={
            <span className="ficha-subtitulo">
              <span>{c.tipo.nombre}</span>
              {c.capacidad && <><span className="separador">·</span><span>{c.capacidad}</span></>}
              <span className="separador">·</span>
              {c.numeroSerie ? <span>Serie <span className="mono">{c.numeroSerie}</span></span> : <span className="texto-terciario">Sin número de serie</span>}
            </span>
          }
          acciones={escribe && (
            <div className="acciones-pagina">
              {c.situacion === 'EN_ALMACEN' && <Button variante="primario" icono={PackageCheck} onClick={() => setAccion('instalar')}>Instalar en un equipo</Button>}
              {c.situacion === 'INSTALADO' && <Button variante="primario" icono={Undo2} onClick={() => setAccion('retirar')}>Retirar del equipo</Button>}
              {c.situacion === 'EN_MANTENIMIENTO' && <Button variante="primario" icono={Wrench} onClick={() => setAccion('reingresar')}>Volvió de mantenimiento</Button>}
              <Button icono={Pencil} onClick={() => setAccion('editar')}>Editar</Button>
              <MenuMas
                acciones={c.situacion !== 'INSTALADO' ? [{ etiqueta: 'Dar de baja', icono: Trash2, peligro: true, onClick: () => setAccion('baja') }] : []}
              />
            </div>
          )}
        />
      </div>

      <ResumenFicha
        datos={[
          c.activo
            ? { etiqueta: 'Instalado en', icono: Monitor, destacado: true, a: `/activos/${c.activo.id}`, valor: `${c.activo.codigoPatrimonial} · ${c.activo.nombre}`, detalle: vigente ? `Desde ${fecha(vigente.desde)}` : undefined }
            : { etiqueta: 'Guardado en', icono: Warehouse, destacado: true, valor: c.ubicacion?.nombre ?? 'Sin ubicación', detalle: c.situacion === 'EN_ALMACEN' ? 'Disponible para instalar' : undefined },
          { etiqueta: 'Situación', valor: <EstadoPunto valor={c.situacion} /> },
          { etiqueta: 'Estado técnico', valor: <EstadoPunto valor={c.estadoTecnico} /> },
          c.activo
            ? { etiqueta: 'Confirmado por ScanGP', icono: ScanSearch, valor: <EstadoPunto valor={c.confirmadoPorScanGP ? 'SINCRONIZADO' : 'PENDIENTE'} texto={c.confirmadoPorScanGP ? 'Sí, lo detectó' : 'Aún no'} />, detalle: vigente?.confirmadaEn ? `Visto el ${fecha(vigente.confirmadaEn)}` : 'Se confirma en el próximo escaneo' }
            : { etiqueta: 'Equipos en los que estuvo', icono: ScanSearch, valor: c.instalaciones.length, detalle: c.instalaciones.length ? 'Ver el recorrido' : 'Nunca se instaló' },
        ]}
      />

      <FichaColumnas
        principal={
          <>
            <PestanasFicha etiqueta="Secciones del componente" pestanas={pestanas} actual={tab} />
            {tab === 'recorrido' && <Recorrido instalaciones={c.instalaciones} />}
            {tab === 'historial' && <LineaTiempo movimientos={c.historial} />}
            {tab === 'documentos' && <TabDocumentos entidad="COMPONENTE" entidadId={c.id} />}
          </>
        }
        lateral={
          <section className="tarjeta-datos" aria-labelledby="datos-componente">
            <h2 id="datos-componente">Datos del componente</h2>
            <KeyValueList
              datos={[
                { etiqueta: 'Código', valor: c.codigo, mono: true },
                { etiqueta: 'Tipo', valor: c.tipo.nombre },
                { etiqueta: 'Marca', valor: c.marca },
                { etiqueta: 'Modelo', valor: c.modelo },
                { etiqueta: medidaDe(c.tipo.codigo).etiqueta, valor: c.capacidad, motivo: 'sin-registrar' },
                { etiqueta: 'N.º de serie', valor: c.numeroSerie, mono: true },
                { etiqueta: 'Observaciones', valor: c.observaciones, motivo: 'sin-registrar' },
              ]}
            />
          </section>
        }
      />

      {accion && <ComponenteAcciones accion={accion} c={c} onCerrar={() => setAccion(null)} onHecho={datos.recargar} />}
    </>
  );
}

/** Equipos en los que estuvo la pieza, del más reciente al más antiguo; el vigente, resaltado. */
function Recorrido({ instalaciones }: { instalaciones: InstalacionVista[] }) {
  if (!instalaciones.length) return <EmptyState icono={Cpu} titulo="Nunca se instaló en un equipo" descripcion="Cuando se instale, aquí verás en qué equipos estuvo, desde cuándo y por qué salió." />;
  const orden = [...instalaciones].sort((x, y) => (y.desde > x.desde ? 1 : -1));
  return (
    <ol className="recorrido">
      {orden.map((i) => (
        <li key={i.id} className={i.hasta ? undefined : 'recorrido-vigente'}>
          <span className="recorrido-punto" aria-hidden="true" />
          <div className="recorrido-tarjeta">
            <div className="recorrido-cabeza">
              {i.activo ? <Link to={`/activos/${i.activo.id}`}>{i.activo.codigoPatrimonial} · {i.activo.nombre}</Link> : <span>Equipo</span>}
              {i.hasta ? <span className="texto-terciario">{fecha(i.desde)} – {fecha(i.hasta)}</span> : <EstadoPunto valor="INSTALADO" texto={`Instalado desde ${fecha(i.desde)}`} />}
            </div>
            <div className="recorrido-meta">
              <span><span className="etq">Entró por</span> {et(i.motivoInstalacion) || '—'}</span>
              {i.hasta && <span><span className="etq">Salió por</span> {et(i.motivoRetiro) || '—'}</span>}
              <span><span className="etq">ScanGP</span> {i.confirmadaEn ? `confirmó el ${fechaHora(i.confirmadaEn)}` : 'sin confirmar'}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
