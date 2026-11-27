import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Boxes, LogOut, MapPin, Pencil, Power, PowerOff, ScanSearch, Stethoscope, Trash2, User, UserPlus, Wrench } from 'lucide-react';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { MenuMas, PestanasFicha, ResumenFicha, type AccionMenu } from '../../components/ficha/Ficha';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { useAhora } from '../../hooks/useAhora';
import { api } from '../../services/gestion.service';
import { fecha, haceCuanto, unir } from '../../lib/formato';
import { et, type ActivoDetalle } from '../../types/gestion';
import { EstadoPunto } from '../gestion/comun';
import { ActivoAcciones, type AccionActivo } from './ActivoAcciones';
import {
  TabAsignaciones, TabComponentes, TabDeteccion, TabDocumentos, TabGarantias, TabGeneral, TabHistorial, TabMantenimientos,
} from './ActivoTabs';

const PESTANAS = [
  ['general', 'General'],
  ['componentes', 'Componentes'],
  ['asignaciones', 'Asignaciones'],
  ['mantenimientos', 'Mantenimientos'],
  ['garantias', 'Garantías'],
  ['documentos', 'Documentos'],
  ['historial', 'Historial'],
  ['deteccion', 'Detección'],
] as const;

/** Ficha del activo (DESIGN.md §4.3). */
export function ActivoPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const tab = params.get('tab') ?? 'general';
  const datos = usePolling((s) => api.activos.obtener(id, s), 30_000, id);
  const [accion, setAccion] = useState<AccionActivo | null>(null);
  const [version, setVersion] = useState(0);
  const recargar = () => {
    datos.recargar();
    setVersion((v) => v + 1);
  };

  if (datos.error && !datos.data) {
    return datos.error.message.includes('no encontrado')
      ? <EmptyState icono={Boxes} titulo="Activo no encontrado" accion={<Button a="/activos">Ir a Activos</Button>} />
      : <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} />;
  }
  const a = datos.data;
  if (!a) return <LoadingState />;

  return (
    <>
      <div className="ficha-cabecera">
        <PageHeader
          migas={[{ etiqueta: 'Activos', a: '/activos' }, { etiqueta: a.codigoPatrimonial }]}
          titulo={<>{a.nombre} <span className="codigo-chip">{a.codigoPatrimonial}</span></>}
          subtitulo={
            <span className="ficha-subtitulo">
              <span>{a.tipo.nombre}</span>
              {unir([a.marca, a.modelo]) && <><span className="separador">·</span><span>{unir([a.marca, a.modelo])}</span></>}
              <span className="separador">·</span>
              {a.numeroSerie ? <span>Serie <span className="mono">{a.numeroSerie}</span></span> : <span className="texto-terciario">Sin número de serie</span>}
            </span>
          }
          acciones={<Acciones a={a} abrir={setAccion} />}
        />
      </div>
      <Resumen a={a} />

      <PestanasFicha
        etiqueta="Secciones del activo"
        actual={tab}
        pestanas={PESTANAS.map(([clave, nombre]) => ({ clave, nombre, contador: clave === 'deteccion' ? a.discrepanciasPendientes : undefined }))}
      />

      <div key={version}>
        {tab === 'general' && <TabGeneral a={a} />}
        {tab === 'componentes' && <TabComponentes a={a} onCambio={recargar} />}
        {tab === 'asignaciones' && <TabAsignaciones a={a} />}
        {tab === 'mantenimientos' && <TabMantenimientos a={a} />}
        {tab === 'garantias' && <TabGarantias a={a} />}
        {tab === 'documentos' && <TabDocumentos entidad="ACTIVO" entidadId={a.id} />}
        {tab === 'historial' && <TabHistorial a={a} />}
        {tab === 'deteccion' && <TabDeteccion a={a} onCambio={recargar} />}
      </div>

      {accion && <ActivoAcciones accion={accion} activo={a} onCerrar={() => setAccion(null)} onHecho={recargar} />}
    </>
  );
}

/** Resumen: quién lo tiene, dónde está, en qué estado y si ScanGP lo ve al día. */
function Resumen({ a }: { a: ActivoDetalle }) {
  const ahora = useAhora(60_000);
  const asig = a.asignacion;
  return (
    <ResumenFicha
      datos={[
        asig
          ? {
              etiqueta: 'Asignado a', icono: User, destacado: true,
              a: asig.personaId ? `/personas/${asig.personaId}` : undefined,
              valor: asig.responsable ?? '—',
              detalle: asig.tipo === 'PERMANENTE' ? 'Sin fecha de devolución' : `${et(asig.tipo)} hasta ${fecha(asig.hastaPrevisto)}`,
            }
          : { etiqueta: 'Asignación', icono: User, destacado: true, valor: 'Disponible', detalle: 'Nadie lo tiene asignado' },
        { etiqueta: 'Ubicación', icono: MapPin, valor: a.ubicacionNombre ?? <span className="texto-terciario">Sin ubicación</span> },
        { etiqueta: 'Estado técnico', icono: Stethoscope, valor: <EstadoPunto valor={a.estadoTecnico} />, detalle: <>Ciclo: {et(a.cicloVida)}</> },
        a.ordenAbierta
          ? { etiqueta: 'En mantenimiento', icono: Wrench, a: `/mantenimiento/${a.ordenAbierta.id}`, valor: a.ordenAbierta.codigo, detalle: 'Ver la orden abierta' }
          : { etiqueta: 'ScanGP', icono: ScanSearch, valor: <EstadoPunto valor={a.sincronizacion} />, detalle: a.ultimoReporte ? `Último reporte ${haceCuanto(a.ultimoReporte, ahora)}` : 'Sin reportes' },
      ]}
    />
  );
}

/** Cabecera: la acción del momento en primario, las de uso diario visibles y el resto en "Más acciones". */
function Acciones({ a, abrir }: { a: ActivoDetalle; abrir: (x: AccionActivo) => void }) {
  const { puede } = useSesion();
  if (!puede('ADMIN', 'TECNICO') || a.cicloVida === 'DADO_DE_BAJA') return null;
  const enServicio = a.cicloVida === 'EN_SERVICIO';
  const mas: AccionMenu[] = [
    { etiqueta: 'Cambiar estado técnico', icono: Stethoscope, onClick: () => abrir('estado') },
    { etiqueta: 'Cambiar ubicación', icono: MapPin, onClick: () => abrir('ubicacion') },
    enServicio
      ? { etiqueta: 'Poner fuera de servicio', icono: PowerOff, onClick: () => abrir('fuera') }
      : { etiqueta: 'Poner en servicio', icono: Power, onClick: () => abrir('servicio') },
    ...(puede('ADMIN') ? [{ etiqueta: 'Dar de baja', icono: Trash2, peligro: true, onClick: () => abrir('baja') }] : []),
  ];
  return (
    <div className="acciones-pagina">
      {a.asignacion ? (
        <>
          <Button variante="primario" icono={ArrowLeftRight} onClick={() => abrir('transferir')}>Transferir</Button>
          <Button icono={LogOut} onClick={() => abrir('devolver')}>Registrar devolución</Button>
        </>
      ) : (
        enServicio && !a.ordenAbierta && <Button variante="primario" icono={UserPlus} onClick={() => abrir('asignar')}>Asignar</Button>
      )}
      {a.ordenAbierta ? (
        <Button icono={Wrench} a={`/mantenimiento/${a.ordenAbierta.id}`}>Ver orden {a.ordenAbierta.codigo}</Button>
      ) : (
        <Button icono={Wrench} onClick={() => abrir('mantenimiento')}>Mantenimiento</Button>
      )}
      <Button icono={Pencil} onClick={() => abrir('editar')}>Editar</Button>
      <MenuMas acciones={mas} />
    </div>
  );
}
