import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, X } from 'lucide-react';
import { PageHeader, SelectField } from '../../components/ui';
import { TablaCrud, type AccionFila } from '../../components/crud/TablaCrud';
import { PanelFormulario, type Campo } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { useNavigate } from 'react-router-dom';
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
      <ListaDiscrepancias
        estado={estado}
        conActivo
        filtros={
          <SelectField
            etiqueta="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            opciones={[...opcionesDe(['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'RESUELTA_AUTO']), { valor: 'TODAS', etiqueta: 'Todas' }]}
          />
        }
      />
    </>
  );
}

export function ListaDiscrepancias({ activoId, estado = 'PENDIENTE', conActivo, onCambio, filtros }: {
  activoId?: string;
  estado?: string;
  conActivo?: boolean;
  onCambio?: () => void;
  filtros?: React.ReactNode;
}) {
  const datos = usePolling((s) => api.discrepancias.listar({ estado, activoId }, s), 30_000, `${estado}${activoId}`);
  const { puede } = useSesion();
  const navegar = useNavigate();
  const almacenes = useOpcionesUbicacion();
  const [panel, setPanel] = useState<{ d: Discrepancia; accion: 'aceptar' | 'rechazar' } | null>(null);
  const listo = () => {
    datos.recargar();
    onCambio?.();
  };

  const pendiente = (d: Discrepancia) => d.estado === 'PENDIENTE';
  const acciones: AccionFila<Discrepancia>[] = [
    ...(conActivo ? [{ etiqueta: 'Ver activo', icono: Eye, onClick: (d: Discrepancia) => navegar(`/activos/${d.activoId}?tab=deteccion`) }] : []),
    ...(puede('ADMIN', 'TECNICO')
      ? [
          { etiqueta: 'Aceptar', icono: Check, onClick: (d: Discrepancia) => setPanel({ d, accion: 'aceptar' }), visible: pendiente },
          { etiqueta: 'Rechazar', icono: X, peligro: true, onClick: (d: Discrepancia) => setPanel({ d, accion: 'rechazar' }), visible: pendiente },
        ]
      : []),
  ];

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
      <TablaCrud<Discrepancia>
        titulo="Discrepancias"
        filas={datos.data}
        error={datos.error}
        onReintentar={datos.recargar}
        filtros={filtros}
        acciones={acciones}
        textoBusqueda={(d) => `${d.activoCodigo} ${d.activoNombre} ${d.descripcion} ${et(d.tipo)}`}
        vacio={estado === 'PENDIENTE' ? 'No hay discrepancias pendientes: lo detectado coincide con lo registrado.' : 'Sin registros.'}
        columnas={[
          ...(conActivo ? [{ encabezado: 'Activo', ordenar: (d: Discrepancia) => d.activoCodigo, valor: (d: Discrepancia) => <Link to={`/activos/${d.activoId}?tab=deteccion`}>{d.activoCodigo} · {d.activoNombre}</Link> }] : []),
          { encabezado: 'Tipo', ordenar: (d) => d.tipo, valor: (d) => et(d.tipo) },
          { encabezado: 'Detalle', valor: (d) => d.descripcion, envolver: true },
          { encabezado: 'Detectado', ordenar: (d) => d.creadoEn, valor: (d) => fechaHora(d.creadoEn), secundaria: true },
          ...(estado !== 'PENDIENTE'
            ? [{ encabezado: 'Resolución', valor: (d: Discrepancia) => <span><EstadoPunto valor={d.estado} />{d.resolucion && <span className="texto-terciario"> · {d.resolucion}</span>}</span> }]
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
