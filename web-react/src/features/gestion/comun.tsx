import { Link } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../services/gestion.service';
import { fechaHora } from '../../lib/formato';
import { et, type Movimiento } from '../../types/gestion';
import type { Opcion } from '../../components/forms/PanelFormulario';

/** Color del punto según el valor de cualquiera de los ejes de estado (DESIGN.md §4.2). */
const TONO: Record<string, 'ok' | 'aviso' | 'problema' | 'neutro'> = {
  EN_SERVICIO: 'ok', OPERATIVO: 'ok', SINCRONIZADO: 'ok', INSTALADO: 'ok', CERRADA: 'ok', ACEPTADA: 'ok', RESUELTA_AUTO: 'ok', EN_ALMACEN: 'ok',
  FUERA_DE_SERVICIO: 'aviso', CON_FALLAS: 'aviso', CON_DISCREPANCIAS: 'aviso', SIN_REPORTE: 'aviso', EN_MANTENIMIENTO: 'aviso',
  ABIERTA: 'aviso', EN_CURSO: 'aviso', EN_ESPERA: 'aviso', PENDIENTE: 'aviso', SIN_VINCULAR: 'aviso',
  AVERIADO: 'problema', IRREPARABLE: 'problema',
};

export function EstadoPunto({ valor, texto }: { valor: string | null | undefined; texto?: string }) {
  if (!valor) return null;
  const tono = TONO[valor] ?? 'neutro';
  return (
    <span className="insignia">
      <span className={`punto-estado punto-${tono}`} aria-hidden="true" />
      {texto ?? et(valor)}
    </span>
  );
}

const REFERENCIAS: Record<string, (id: string) => string> = {
  ACTIVO: (id) => `/activos/${id}`,
  COMPONENTE: (id) => `/componentes/${id}`,
  ORDEN: (id) => `/mantenimiento/${id}`,
};

/** Historial unificado: fecha · descripción · motivo, usuario, observación y enlace a la referencia. */
export function LineaTiempo({ movimientos }: { movimientos: Movimiento[] }) {
  if (!movimientos.length) return <p className="texto-terciario">Sin movimientos registrados.</p>;
  return (
    <ol className="linea-tiempo">
      {movimientos.map((m) => {
        const enlace = m.referenciaTipo && m.referenciaId && REFERENCIAS[m.referenciaTipo]?.(m.referenciaId);
        return (
          <li key={m.id}>
            <time dateTime={m.fecha}>{fechaHora(m.fecha)}</time>
            <div>
              <div className="tl-desc">{m.descripcion}</div>
              {m.observacion && <div className="texto-secundario">{m.observacion}</div>}
              <div className="tl-meta">
                {[m.usuarioNombre ?? 'ScanGP', m.motivo && et(m.motivo)].filter(Boolean).join(' · ')}
                {enlace && (
                  <>
                    {' · '}
                    <Link to={enlace}>Ver {m.referenciaTipo === 'ORDEN' ? 'orden' : m.referenciaTipo === 'COMPONENTE' ? 'componente' : 'activo'}</Link>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- Listas de opciones para formularios

const CINCO_MIN = 300_000;

export function useOpcionesUbicacion(tipo?: string): Opcion[] {
  const r = usePolling((s) => api.org.ubicaciones(s, tipo), CINCO_MIN, tipo ?? 'todas');
  return (r.data ?? []).filter((u) => u.activo).map((u) => ({ valor: u.id, etiqueta: `${u.sede?.nombre ?? ''} › ${u.nombre}${tipo ? '' : ` (${et(u.tipo)})`}` }));
}

export function useOpcionesPersona(): Opcion[] {
  const r = usePolling((s) => api.org.personas(s), CINCO_MIN);
  return (r.data ?? []).filter((p) => p.activo).map((p) => ({ valor: p.id, etiqueta: p.area ? `${p.nombre} — ${p.area.nombre}` : p.nombre }));
}

export function useOpcionesArea(): Opcion[] {
  const r = usePolling((s) => api.org.areas(s), CINCO_MIN);
  return (r.data ?? []).filter((a) => a.activo).map((a) => ({ valor: a.id, etiqueta: a.nombre }));
}

export function useOpcionesTipoActivo(): Opcion[] {
  const r = usePolling((s) => api.catalogo.tiposActivo(s), CINCO_MIN);
  return (r.data ?? []).map((t) => ({ valor: t.id, etiqueta: t.nombre }));
}

export function useTiposComponente() {
  return usePolling((s) => api.catalogo.tiposComponente(s), CINCO_MIN).data ?? [];
}

/** Activos en servicio y disponibles (sin asignación ni mantenimiento), para préstamos y reemplazos. */
export function useOpcionesActivoDisponible(excluir?: string): Opcion[] {
  const r = usePolling((s) => api.activos.listar({ situacion: 'DISPONIBLE', porPagina: 500 }, s), 60_000);
  return (r.data?.items ?? []).filter((a) => a.id !== excluir).map((a) => ({ valor: a.id, etiqueta: `${a.codigoPatrimonial} · ${a.nombre} (${a.tipo.nombre})` }));
}

export const hoyMas = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
