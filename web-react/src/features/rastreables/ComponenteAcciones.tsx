import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../services/gestion.service';
import { ESTADOS_TECNICOS, MOTIVOS, opcionesDe, type ComponenteVista } from '../../types/gestion';
import { useOpcionesUbicacion, useTiposComponente } from '../gestion/comun';
import { AYUDA_MEDIDA, medidaDe, tipoEnFrase } from './tiposComponente';

export type AccionComponente = 'nuevo' | 'editar' | 'instalar' | 'retirar' | 'reingresar' | 'baja';

const DESTINOS = [
  { valor: 'ALMACEN', etiqueta: 'Almacén' },
  { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento / garantía' },
  { valor: 'BAJA', etiqueta: 'Baja (dañado o extraviado)' },
];

interface Props {
  accion: AccionComponente;
  /** Componente sobre el que se actúa (no aplica a "nuevo"). */
  c?: ComponenteVista & { observaciones?: string | null };
  onCerrar: () => void;
  onHecho: () => void;
}

/** Formularios de las operaciones sobre un componente. Se usan desde la lista y desde la ficha. */
export function ComponenteAcciones({ accion, c, onCerrar, onHecho }: Props) {
  const almacenes = useOpcionesUbicacion();
  const tipos = useTiposComponente();
  const activos = usePolling((s) => api.activos.listar({ porPagina: 500 }, s), 120_000, accion === 'instalar' ? 'si' : 'no');
  const comun = { onCerrar, onHecho };

  switch (accion) {
    case 'nuevo':
      return (
        <PanelFormulario
          {...comun}
          titulo="Ingresar componente al almacén"
          textoEnviar="Registrar"
          campos={[
            { nombre: 'tipoComponenteId', etiqueta: 'Tipo', tipo: 'select', opciones: tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })), requerido: true },
            { nombre: 'marca', etiqueta: 'Marca' },
            { nombre: 'modelo', etiqueta: 'Modelo' },
            { nombre: 'numeroSerie', etiqueta: 'Número de serie', ayuda: 'Permite que ScanGP lo reconozca al instalarlo en un equipo.' },
            { nombre: 'capacidad', etiqueta: 'Capacidad o medida', placeholder: '1 TB, 24", 65 W…', ayuda: AYUDA_MEDIDA },
            { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true },
            { nombre: 'estadoTecnico', etiqueta: 'Estado técnico', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), vacio: 'Operativo' },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
          ]}
          onEnviar={(d) => api.componentes.crear({ ...d, estadoTecnico: d.estadoTecnico ?? undefined })}
        />
      );
    case 'editar': {
      const medida = medidaDe(c!.tipo.codigo);
      const nombre = [c!.marca, c!.modelo].filter(Boolean).join(' ');
      return (
        <PanelFormulario
          {...comun}
          titulo={`Editar ${tipoEnFrase(c!.tipo.nombre)}${nombre ? ` · ${nombre}` : ''}`}
          descripcion={
            <>
              {c!.tipo.nombre} <span className="mono">{c!.codigo}</span>
              {c!.activo ? <> · instalado en {c!.activo.codigoPatrimonial} {c!.activo.nombre}</> : c!.ubicacion ? <> · en {c!.ubicacion.nombre}</> : null}
            </>
          }
          campos={[
            { nombre: 'marca', etiqueta: 'Marca' },
            { nombre: 'modelo', etiqueta: 'Modelo' },
            { nombre: 'numeroSerie', etiqueta: 'Número de serie' },
            { nombre: 'capacidad', etiqueta: medida.etiqueta, placeholder: medida.ejemplo },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
          ]}
          inicial={{ marca: c!.marca ?? '', modelo: c!.modelo ?? '', numeroSerie: c!.numeroSerie ?? '', capacidad: c!.capacidad ?? '', observaciones: c!.observaciones ?? '' }}
          onEnviar={(d) => api.componentes.editar(c!.id, d)}
        />
      );
    }
    case 'instalar':
      return (
        <PanelFormulario
          {...comun}
          titulo={`Instalar ${c!.codigo}`}
          textoEnviar="Instalar"
          campos={[
            { nombre: 'activoId', etiqueta: 'Equipo', tipo: 'select', requerido: true, opciones: (activos.data?.items ?? []).map((a) => ({ valor: a.id, etiqueta: `${a.codigoPatrimonial} · ${a.nombre}` })) },
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
          ]}
          inicial={{ motivo: 'ACTUALIZACION' }}
          onEnviar={(d) => api.componentes.instalar(c!.id, d)}
        />
      );
    case 'retirar':
      return (
        <PanelFormulario
          {...comun}
          titulo={`Retirar ${c!.codigo}`}
          textoEnviar="Retirar"
          campos={[
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'destino', etiqueta: 'A dónde va', tipo: 'select', requerido: true, opciones: DESTINOS },
            { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true, visible: (v) => v.destino === 'ALMACEN' },
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea', ayuda: 'Qué falla tiene, diagnóstico, n.º de caso de garantía…' },
          ]}
          inicial={{ motivo: 'FALLA_TECNICA', destino: 'MANTENIMIENTO' }}
          onEnviar={(d) => api.componentes.retirar(c!.id, d)}
        />
      );
    case 'reingresar':
      return (
        <PanelFormulario
          {...comun}
          titulo="Volvió de mantenimiento"
          textoEnviar="Ingresar al almacén"
          campos={[
            { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true },
            { nombre: 'estadoTecnico', etiqueta: 'Estado técnico', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Resultado del mantenimiento', tipo: 'textarea' },
          ]}
          inicial={{ estadoTecnico: 'OPERATIVO' }}
          onEnviar={(d) => api.componentes.reingresar(c!.id, d)}
        />
      );
    case 'baja':
      return (
        <PanelFormulario
          {...comun}
          titulo={`Dar de baja ${c!.codigo}`}
          descripcion="El componente deja de estar disponible. Su historia se conserva."
          textoEnviar="Dar de baja"
          campos={[
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Explicación', tipo: 'textarea', requerido: true },
          ]}
          onEnviar={(d) => api.componentes.baja(c!.id, d)}
        />
      );
  }
}
