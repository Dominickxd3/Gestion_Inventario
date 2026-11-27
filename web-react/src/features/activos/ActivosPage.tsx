import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CircleAlert, CloudOff, Eye, Pencil, Trash2, UserPlus, Wrench } from 'lucide-react';
import { Button, Icon, ModalFlotante, PageHeader, SelectField, TextField } from '../../components/ui';
import { TablaCrud, type AccionFila } from '../../components/crud/TablaCrud';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { useEquipos } from '../../hooks/EquiposContext';
import { api } from '../../services/gestion.service';
import { ESTADOS_TECNICOS, opcionesDe, type ActivoDetalle, type ActivoVista, type SugerenciaActivo } from '../../types/gestion';
import { EstadoPunto, useOpcionesPersona, useOpcionesTipoActivo, useOpcionesUbicacion } from '../gestion/comun';
import { ActivoAcciones, type AccionActivo } from './ActivoAcciones';

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
  const navegar = useNavigate();
  const [nuevo, setNuevo] = useState(false);
  const [rapida, setRapida] = useState<{ id: string; accion: AccionActivo } | null>(null);
  const escribe = puede('ADMIN', 'TECNICO');
  const ver = (a: ActivoVista) => navegar(`/activos/${a.id}`);

  const acciones: AccionFila<ActivoVista>[] = [{ etiqueta: 'Ver ficha', icono: Eye, onClick: ver }];
  if (escribe) {
    const vivo = (a: ActivoVista) => a.cicloVida !== 'DADO_DE_BAJA';
    acciones.push(
      { etiqueta: 'Editar', icono: Pencil, onClick: (a) => setRapida({ id: a.id, accion: 'editar' }), visible: vivo },
      { etiqueta: 'Asignar', icono: UserPlus, onClick: (a) => setRapida({ id: a.id, accion: 'asignar' }), visible: (a) => a.cicloVida === 'EN_SERVICIO' && !a.asignacion && !a.ordenAbierta },
      { etiqueta: 'Enviar a mantenimiento', icono: Wrench, onClick: (a) => setRapida({ id: a.id, accion: 'mantenimiento' }), visible: (a) => vivo(a) && !a.ordenAbierta },
    );
    if (puede('ADMIN')) {
      acciones.push({ etiqueta: 'Dar de baja', icono: Trash2, peligro: true, onClick: (a) => setRapida({ id: a.id, accion: 'baja' }), visible: (a) => a.cicloVida !== 'DADO_DE_BAJA' });
    }
  }

  return (
    <>
      <PageHeader titulo="Activos" subtitulo="Inventario validado: lo que TI registró, asignó y controla." />
      <TablaCrud<ActivoVista>
        titulo="Activos"
        filas={datos.data?.items}
        error={datos.error}
        onReintentar={datos.recargar}
        busqueda={{ valor: filtro('q'), onCambio: (v) => poner('q', v), placeholder: 'Código, nombre, serie, responsable, modelo…' }}
        servidor={{ total: datos.data?.total ?? 0, pagina, porPagina: POR_PAGINA, onPagina: (p) => poner('pagina', String(p)) }}
        filtros={
          <>
            <SelectField etiqueta="Tipo" value={filtro('tipo')} onChange={(e) => poner('tipo', e.target.value)} opciones={[{ valor: '', etiqueta: 'Todos' }, ...tipos.map((t) => ({ valor: t.codigo, etiqueta: t.nombre }))]} />
            <SelectField etiqueta="Situación" value={filtro('situacion')} onChange={(e) => poner('situacion', e.target.value)} opciones={[{ valor: '', etiqueta: 'Todas' }, ...SITUACIONES]} />
            <SelectField
              etiqueta="Ciclo"
              value={filtro('cicloVida')}
              onChange={(e) => poner('cicloVida', e.target.value)}
              opciones={[{ valor: '', etiqueta: 'Sin bajas' }, ...opcionesDe(['EN_SERVICIO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'])]}
            />
          </>
        }
        nuevo={escribe && { etiqueta: 'Nuevo activo', onClick: () => setNuevo(true) }}
        acciones={acciones}
        onFila={ver}
        vacio={params.toString() ? 'Ningún activo coincide con los filtros.' : 'Aún no hay activos. Regístralos desde «Equipos detectados» o con «Nuevo activo».'}
        columnas={[
          { encabezado: 'Código', mono: true, ancho: '110px', valor: (a) => <Link to={`/activos/${a.id}`} onClick={(e) => e.stopPropagation()}>{a.codigoPatrimonial}</Link> },
          { encabezado: 'Equipo', valor: (a) => a.nombre },
          { encabezado: 'Tipo', valor: (a) => a.tipo.nombre },
          { encabezado: 'Marca', valor: (a) => a.marca, secundaria: true },
          { encabezado: 'Modelo', valor: (a) => a.modelo, secundaria: true },
          { encabezado: 'Responsable', valor: (a) => a.asignacion?.responsable ?? <span className="texto-terciario">Sin asignar</span> },
          { encabezado: 'Ubicación', valor: (a) => a.ubicacionNombre, secundaria: true },
          { encabezado: 'Estado', valor: (a) => <EstadoColumna a={a} /> },
        ]}
      />
      {nuevo && <NuevoActivo onCerrar={() => setNuevo(false)} />}
      {rapida && <AccionRapida {...rapida} onCerrar={() => setRapida(null)} onHecho={datos.recargar} />}
    </>
  );
}

/** Carga la ficha del activo y abre el formulario de la acción elegida desde la lista. */
function AccionRapida({ id, accion, onCerrar, onHecho }: { id: string; accion: AccionActivo; onCerrar: () => void; onHecho: () => void }) {
  const a = usePolling((s) => api.activos.obtener(id, s), 600_000, id).data;
  if (!a) return null;
  return <ActivoAcciones accion={accion} activo={a} onCerrar={onCerrar} onHecho={onHecho} />;
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
  const personas = useOpcionesPersona();
  const { equipos } = useEquipos();
  const navegar = useNavigate();

  const sinVincular = (equipos ?? []).filter((e) => !e.activoId).map((e) => ({
    valor: e.id,
    etiqueta: `${e.resumen.nombreEquipo} · ${[e.resumen.fabricante, e.resumen.modelo].filter(Boolean).join(' ')} · serie ${e.resumen.numeroSerie ?? '—'}`,
  }));

  const [dispositivoId, setDispositivoId] = useState('');
  const [sugerencia, setSugerencia] = useState<SugerenciaActivo | null>(null);
  const [cargandoSug, setCargandoSug] = useState(false);

  const [valores, setValores] = useState<Record<string, string>>({
    nombre: '', tipoActivoId: '', marcaNombre: '', modeloNombre: '', numeroSerie: '',
    codigoPatrimonial: '', ubicacionId: '', estadoTecnico: '', fechaAdquisicion: '',
    proveedor: '', numeroFactura: '', costo: '', observaciones: '', personaId: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const poner = (k: string, v: string) => setValores((prev) => ({ ...prev, [k]: v }));

  // Cuando el usuario elige un equipo detectado, cargar la sugerencia
  const elegirEquipo = async (devId: string) => {
    setDispositivoId(devId);
    if (!devId) {
      setSugerencia(null);
      return;
    }
    setCargandoSug(true);
    try {
      const sug = await api.detectados.sugerencia(devId);
      setSugerencia(sug);
      setValores((prev) => ({
        ...prev,
        nombre: sug.nombre,
        tipoActivoId: sug.tipoActivoId,
        marcaNombre: sug.marcaNombre ?? '',
        modeloNombre: sug.modeloNombre ?? '',
        numeroSerie: sug.numeroSerie ?? '',
        codigoPatrimonial: sug.etiquetaActivoBios ?? '',
        estadoTecnico: 'OPERATIVO',
      }));
    } catch {
      setSugerencia(null);
    } finally {
      setCargandoSug(false);
    }
  };

  const enviar = async () => {
    const requeridos = ['nombre', 'tipoActivoId'];
    const faltan: Record<string, string> = {};
    for (const k of requeridos) {
      if (!valores[k]?.trim()) faltan[k] = 'Obligatorio';
    }
    setErrores(faltan);
    if (Object.keys(faltan).length) return;

    setEnviando(true);
    setError(null);
    try {
      const limpiar = (v: string) => v.trim() || null;
      let activo: ActivoDetalle;

      if (dispositivoId && sugerencia) {
        // Registrar desde equipo detectado
        activo = await api.detectados.alta({
          dispositivoId,
          nombre: valores.nombre,
          tipoActivoId: valores.tipoActivoId,
          marcaNombre: limpiar(valores.marcaNombre),
          modeloNombre: limpiar(valores.modeloNombre),
          numeroSerie: limpiar(valores.numeroSerie),
          codigoPatrimonial: limpiar(valores.codigoPatrimonial),
          ubicacionId: limpiar(valores.ubicacionId),
          estadoTecnico: valores.estadoTecnico || undefined,
          especificaciones: sugerencia.especificaciones,
          componentes: sugerencia.componentes,
        });
      } else {
        // Registro manual
        activo = await api.activos.crear({
          nombre: valores.nombre,
          tipoActivoId: valores.tipoActivoId,
          marcaNombre: limpiar(valores.marcaNombre),
          modeloNombre: limpiar(valores.modeloNombre),
          numeroSerie: limpiar(valores.numeroSerie),
          codigoPatrimonial: limpiar(valores.codigoPatrimonial),
          ubicacionId: limpiar(valores.ubicacionId),
          estadoTecnico: valores.estadoTecnico || undefined,
          fechaAdquisicion: limpiar(valores.fechaAdquisicion),
          proveedor: limpiar(valores.proveedor),
          numeroFactura: limpiar(valores.numeroFactura),
          costo: valores.costo ? String(valores.costo) : null,
          observaciones: limpiar(valores.observaciones),
        });
      }

      // Asignación inmediata si eligió un trabajador
      if (valores.personaId) {
        try {
          await api.asignaciones.asignar({
            activoId: activo.id,
            personaId: valores.personaId,
            tipo: 'PERMANENTE',
          });
        } catch {
          // El activo se creó correctamente, la asignación falló pero no es crítico
        }
      }

      navegar(`/activos/${activo.id}`);
      onCerrar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalFlotante
      titulo="Nuevo activo"
      descripcion="Para computadoras, lo más rápido es elegir un equipo detectado por ScanGP: se completan los datos y componentes automáticamente."
      onCerrar={onCerrar}
      pie={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button variante="primario" onClick={() => void enviar()} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar activo'}
          </Button>
        </>
      }
    >
      {/* Selector de equipo detectado */}
      {sinVincular.length > 0 && (
        <div className="form-campo form-campo-ancho" style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)' }}>
          <SelectField
            etiqueta="Registrar desde un equipo detectado por ScanGP (opcional)"
            value={dispositivoId}
            onChange={(e) => void elegirEquipo(e.target.value)}
            opciones={[{ valor: '', etiqueta: 'Ninguno — registrar manualmente' }, ...sinVincular]}
            ayuda={cargandoSug ? 'Cargando datos del equipo…' : dispositivoId ? 'Los campos se pre-llenaron. Puedes editarlos.' : 'Si eliges un equipo, se completan automáticamente los datos y sus componentes.'}
          />
        </div>
      )}

      {error && (
        <div className="aviso-formulario aviso-formulario-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <Icon icono={CircleAlert} />
          <span>{error}</span>
        </div>
      )}

      <div className="formulario-2col">
        <TextField
          etiqueta="Nombre o descripción"
          value={valores.nombre}
          onChange={(e) => poner('nombre', e.target.value)}
          placeholder="Impresora recepción, LAP-VENTAS02…"
          error={errores.nombre}
        />
        <SelectField
          etiqueta="Tipo"
          value={valores.tipoActivoId}
          onChange={(e) => poner('tipoActivoId', e.target.value)}
          opciones={[{ valor: '', etiqueta: 'Elegir…' }, ...tipos]}
          error={errores.tipoActivoId}
        />
        <TextField
          etiqueta="Marca (opcional)"
          value={valores.marcaNombre}
          onChange={(e) => poner('marcaNombre', e.target.value)}
        />
        <TextField
          etiqueta="Modelo (opcional)"
          value={valores.modeloNombre}
          onChange={(e) => poner('modeloNombre', e.target.value)}
          ayuda="Si la marca o el modelo no existen en el catálogo, se crean."
        />
        <TextField
          etiqueta="Número de serie (opcional)"
          value={valores.numeroSerie}
          onChange={(e) => poner('numeroSerie', e.target.value)}
        />
        <TextField
          etiqueta="Código patrimonial (opcional)"
          value={valores.codigoPatrimonial}
          onChange={(e) => poner('codigoPatrimonial', e.target.value)}
          ayuda="Déjalo vacío para generarlo (p. ej. TI-000012)."
        />
        <SelectField
          etiqueta="Ubicación (opcional)"
          value={valores.ubicacionId}
          onChange={(e) => poner('ubicacionId', e.target.value)}
          opciones={[{ valor: '', etiqueta: 'Sin ubicación' }, ...ubicaciones]}
        />
        <SelectField
          etiqueta="Estado técnico (opcional)"
          value={valores.estadoTecnico}
          onChange={(e) => poner('estadoTecnico', e.target.value)}
          opciones={[{ valor: '', etiqueta: 'Sin evaluar' }, ...opcionesDe(ESTADOS_TECNICOS)]}
        />
        <TextField
          etiqueta="Fecha de adquisición (opcional)"
          type="date"
          value={valores.fechaAdquisicion}
          onChange={(e) => poner('fechaAdquisicion', e.target.value)}
        />
        <TextField
          etiqueta="Proveedor (opcional)"
          value={valores.proveedor}
          onChange={(e) => poner('proveedor', e.target.value)}
        />
        <TextField
          etiqueta="N.º de factura (opcional)"
          value={valores.numeroFactura}
          onChange={(e) => poner('numeroFactura', e.target.value)}
        />
        <TextField
          etiqueta="Costo (opcional)"
          type="number"
          value={valores.costo}
          onChange={(e) => poner('costo', e.target.value)}
        />

        {/* Asignación directa */}
        <div className="form-campo-ancho" style={{ borderTop: 'var(--border-hairline)', paddingTop: 'var(--space-4)' }}>
          <SelectField
            etiqueta="Responsable — asignar al registrar (opcional)"
            value={valores.personaId}
            onChange={(e) => poner('personaId', e.target.value)}
            opciones={[{ valor: '', etiqueta: 'No asignar ahora' }, ...personas]}
            ayuda="Si eliges un trabajador, el activo se asigna de forma permanente automáticamente."
          />
        </div>

        {/* Observaciones ocupa todo el ancho */}
        <div className="form-campo form-campo-ancho">
          <label className="campo-etiqueta">Observaciones (opcional)</label>
          <textarea
            className="campo-control campo-area"
            rows={3}
            value={valores.observaciones}
            onChange={(e) => poner('observaciones', e.target.value)}
          />
        </div>
      </div>
    </ModalFlotante>
  );
}

