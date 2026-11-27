import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Button, ErrorState, LoadingState, PageHeader, SelectField, SpecTable } from '../../components/ui';
import { PanelFormulario, type Campo } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { fechaHora } from '../../lib/formato';
import { MOTIVOS, et, opcionesDe, type Discrepancia } from '../../types/gestion';
import { EstadoPunto, useOpcionesUbicacion } from '../gestion/comun';

/** Qué hace "Aceptar" en cada tipo: se muestra antes de confirmar (DESIGN.md §4.5). */
const EFECTO: Record<string, string> = {
  COMPONENTE_NUEVO: 'Se registra el componente (si no existe) y queda instalado en este equipo.',
  COMPONENTE_MOVIDO: 'Se retira del equipo donde figuraba y se instala en este.',
  COMPONENTE_AUSENTE: 'Se retira del equipo. Indica a dónde fue.',
  ATRIBUTO_DIFERENTE: 'Se actualiza el dato del activo con lo que detectó ScanGP.',
  USUARIO_DISTINTO: 'Queda como revisado. Si el equipo cambió de manos, registra una transferencia.',
};

export function DiscrepanciasPage() {
  const [estado, setEstado] = useState('PENDIENTE');
  return (
    <>
      <PageHeader
        titulo="Discrepancias"
        subtitulo="Diferencias entre lo que detecta ScanGP y el inventario validado. Nada cambia hasta que TI las acepta."
      />
      <div className="filtros-fila">
        <SelectField
          etiqueta="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          opciones={[...opcionesDe(['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'RESUELTA_AUTO']), { valor: 'TODAS', etiqueta: 'Todas' }]}
        />
      </div>
      <ListaDiscrepancias estado={estado} conActivo />
    </>
  );
}

export function ListaDiscrepancias({ activoId, estado = 'PENDIENTE', conActivo, onCambio }: { activoId?: string; estado?: string; conActivo?: boolean; onCambio?: () => void }) {
  const datos = usePolling((s) => api.discrepancias.listar({ estado, activoId }, s), 30_000, `${estado}${activoId}`);
  const { puede } = useSesion();
  const almacenes = useOpcionesUbicacion();
  const [panel, setPanel] = useState<{ d: Discrepancia; accion: 'aceptar' | 'rechazar' } | null>(null);
  const listo = () => {
    datos.recargar();
    onCambio?.();
  };

  if (datos.error && !datos.data) return <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} />;
  if (!datos.data) return <LoadingState />;

  const camposAceptar = (d: Discrepancia): Campo[] =>
    d.tipo === 'COMPONENTE_AUSENTE'
      ? [
          { nombre: 'destino', etiqueta: 'A dónde fue', tipo: 'select', requerido: true, opciones: [{ valor: 'ALMACEN', etiqueta: 'Almacén' }, { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento / garantía' }, { valor: 'BAJA', etiqueta: 'Baja (dañado o extraviado)' }] },
          { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true, visible: (v) => v.destino === 'ALMACEN' },
          { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
          { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
        ]
      : [{ nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' }];

  return (
    <>
      <SpecTable<Discrepancia>
        titulo="Discrepancias"
        filas={datos.data}
        vacio={estado === 'PENDIENTE' ? 'No hay discrepancias pendientes: lo detectado coincide con lo registrado.' : 'Sin registros.'}
        columnas={[
          ...(conActivo ? [{ encabezado: 'Activo', valor: (d: Discrepancia) => <Link to={`/activos/${d.activoId}?tab=deteccion`}>{d.activoCodigo} · {d.activoNombre}</Link> }] : []),
          { encabezado: 'Tipo', valor: (d) => et(d.tipo) },
          { encabezado: 'Detalle', valor: (d) => d.descripcion },
          { encabezado: 'Detectado', valor: (d) => fechaHora(d.creadoEn) },
          ...(estado !== 'PENDIENTE'
            ? [{ encabezado: 'Resolución', valor: (d: Discrepancia) => <span><EstadoPunto valor={d.estado} />{d.resolucion && <span className="texto-terciario"> · {d.resolucion}</span>}</span> }]
            : []),
          ...(estado === 'PENDIENTE' && puede('ADMIN', 'TECNICO')
            ? [{
                encabezado: '',
                ancho: '96px',
                valor: (d: Discrepancia) => (
                  <span className="acciones-fila">
                    <Button variante="fantasma" icono={Check} aria-label="Aceptar" onClick={() => setPanel({ d, accion: 'aceptar' })} />
                    <Button variante="fantasma" icono={X} aria-label="Rechazar" onClick={() => setPanel({ d, accion: 'rechazar' })} />
                  </span>
                ),
              }]
            : []),
        ]}
      />
      {panel?.accion === 'aceptar' && (
        <PanelFormulario
          titulo="Aceptar lo detectado"
          descripcion={<><p>{panel.d.descripcion}</p><p><strong>Qué se hará:</strong> {EFECTO[panel.d.tipo]}</p></>}
          textoEnviar="Aceptar"
          campos={camposAceptar(panel.d)}
          inicial={{ motivo: 'OTRO' }}
          onEnviar={(v) => api.discrepancias.aceptar(panel.d.id, v)}
          onCerrar={() => setPanel(null)}
          onHecho={listo}
        />
      )}
      {panel?.accion === 'rechazar' && (
        <PanelFormulario
          titulo="Rechazar"
          descripcion={<><p>{panel.d.descripcion}</p><p>El inventario no cambia. Si ScanGP vuelve a detectar exactamente lo mismo, no se volverá a abrir.</p></>}
          textoEnviar="Rechazar"
          campos={[{ nombre: 'motivo', etiqueta: 'Por qué se rechaza', tipo: 'textarea', requerido: true }]}
          onEnviar={(v) => api.discrepancias.rechazar(panel.d.id, v)}
          onCerrar={() => setPanel(null)}
          onHecho={listo}
        />
      )}
    </>
  );
}
