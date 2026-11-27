import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Boxes, LogOut, MapPin, Pencil, Stethoscope, Trash2, UserPlus, Wrench } from 'lucide-react';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { useAhora } from '../../hooks/useAhora';
import { api } from '../../services/gestion.service';
import { haceCuanto, unir } from '../../lib/formato';
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
      <PageHeader
        migas={[{ etiqueta: 'Activos', a: '/activos' }, { etiqueta: a.codigoPatrimonial }]}
        titulo={<>{a.nombre} <span className="texto-terciario mono">{a.codigoPatrimonial}</span></>}
        subtitulo={unir([a.tipo.nombre, unir([a.marca, a.modelo]), a.numeroSerie && `Serie ${a.numeroSerie}`], ' · ')}
        acciones={<Acciones a={a} abrir={setAccion} />}
      />
      <BarraEstados a={a} />

      <nav className="pestanas" aria-label="Secciones del activo">
        {PESTANAS.map(([clave, nombre]) => (
          <Link key={clave} to={`?tab=${clave}`} replace className={tab === clave ? 'activo' : undefined}>
            {nombre}
            {clave === 'deteccion' && a.discrepanciasPendientes > 0 && <span className="contador">{a.discrepanciasPendientes}</span>}
          </Link>
        ))}
      </nav>

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

function BarraEstados({ a }: { a: ActivoDetalle }) {
  const ahora = useAhora(60_000);
  return (
    <div className="barra-estados">
      <span><span className="etq">Ciclo de vida</span> <EstadoPunto valor={a.cicloVida} /></span>
      <span><span className="etq">Técnico</span> <EstadoPunto valor={a.estadoTecnico} /></span>
      <span>
        <span className="etq">Asignación</span>{' '}
        {a.asignacion ? (
          a.asignacion.personaId
            ? <Link to={`/personas/${a.asignacion.personaId}`}>{a.asignacion.responsable}</Link>
            : a.asignacion.responsable
        ) : 'Disponible'}
        {a.asignacion && a.asignacion.tipo !== 'PERMANENTE' && ` (${et(a.asignacion.tipo).toLowerCase()} hasta ${a.asignacion.hastaPrevisto})`}
      </span>
      <span><span className="etq">Ubicación</span> {a.ubicacionNombre ?? 'Sin ubicación'}</span>
      <span>
        <span className="etq">ScanGP</span> <EstadoPunto valor={a.sincronizacion} />
        {a.ultimoReporte && <span className="texto-terciario">· {haceCuanto(a.ultimoReporte, ahora)}</span>}
      </span>
      {a.ordenAbierta && (
        <span>
          <span className="etq">Mantenimiento</span> <Link to={`/mantenimiento/${a.ordenAbierta.id}`}>{a.ordenAbierta.codigo}</Link>
        </span>
      )}
    </div>
  );
}

function Acciones({ a, abrir }: { a: ActivoDetalle; abrir: (x: AccionActivo) => void }) {
  const { puede } = useSesion();
  if (!puede('ADMIN', 'TECNICO') || a.cicloVida === 'DADO_DE_BAJA') return null;
  const enServicio = a.cicloVida === 'EN_SERVICIO';
  return (
    <div className="acciones-pagina">
      {a.asignacion ? (
        <>
          <Button icono={ArrowLeftRight} onClick={() => abrir('transferir')}>Transferir</Button>
          <Button icono={LogOut} onClick={() => abrir('devolver')}>Devolución</Button>
        </>
      ) : (
        enServicio && !a.ordenAbierta && <Button variante="primario" icono={UserPlus} onClick={() => abrir('asignar')}>Asignar</Button>
      )}
      {a.ordenAbierta ? (
        <Button icono={Wrench} a={`/mantenimiento/${a.ordenAbierta.id}`}>Ver orden {a.ordenAbierta.codigo}</Button>
      ) : (
        <Button icono={Wrench} onClick={() => abrir('mantenimiento')}>Mantenimiento</Button>
      )}
      <Button icono={Stethoscope} onClick={() => abrir('estado')}>Estado técnico</Button>
      <Button icono={MapPin} onClick={() => abrir('ubicacion')}>Ubicación</Button>
      <Button icono={Pencil} onClick={() => abrir('editar')}>Editar</Button>
      {enServicio ? <Button variante="fantasma" onClick={() => abrir('fuera')}>Fuera de servicio</Button> : <Button variante="fantasma" onClick={() => abrir('servicio')}>Poner en servicio</Button>}
      {puede('ADMIN') && <Button variante="fantasma" icono={Trash2} onClick={() => abrir('baja')}>Dar de baja</Button>}
    </div>
  );
}
