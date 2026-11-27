import { PanelFormulario, type Campo } from '../../components/forms/PanelFormulario';
import { api } from '../../services/gestion.service';
import { ESTADOS_TECNICOS, MOTIVOS, TIPOS_ASIGNACION, et, opcionesDe, type ActivoDetalle } from '../../types/gestion';
import { hoyMas, useOpcionesActivoDisponible, useOpcionesArea, useOpcionesPersona, useOpcionesUbicacion } from '../gestion/comun';

export type AccionActivo =
  | 'asignar' | 'devolver' | 'transferir' | 'mantenimiento' | 'estado' | 'ubicacion' | 'fuera' | 'servicio' | 'baja' | 'editar';

interface Props {
  accion: AccionActivo;
  activo: ActivoDetalle;
  onCerrar: () => void;
  onHecho: () => void;
}

const sinFecha = (v: Record<string, unknown>) => v.tipo !== 'PERMANENTE';

/** Formularios de las operaciones sobre un activo. Cada una deja su registro en el historial. */
export function ActivoAcciones({ accion, activo: a, onCerrar, onHecho }: Props) {
  const personas = useOpcionesPersona();
  const areas = useOpcionesArea();
  const ubicaciones = useOpcionesUbicacion();
  const talleres = useOpcionesUbicacion();
  const disponibles = useOpcionesActivoDisponible(a.id);
  const comun = { onCerrar, onHecho };

  switch (accion) {
    case 'asignar':
      return (
        <PanelFormulario
          {...comun}
          titulo={`Asignar ${a.codigoPatrimonial}`}
          textoEnviar="Asignar"
          campos={[
            { nombre: 'tipo', etiqueta: 'Modalidad de entrega', tipo: 'select', opciones: opcionesDe(TIPOS_ASIGNACION.filter((t) => t !== 'TEMPORAL_REEMPLAZO')), requerido: true },
            { nombre: 'personaId', etiqueta: 'Trabajador', tipo: 'select', opciones: personas, vacio: 'Ninguno (asignar a un área)' },
            { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, visible: (v) => !v.personaId },
            { nombre: 'hastaPrevisto', etiqueta: 'Devolución prevista', tipo: 'fecha', requerido: true, visible: sinFecha },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea', ayuda: 'Estado en que se entrega, accesorios (cargador, mouse)…' },
          ]}
          inicial={{ tipo: 'PERMANENTE', hastaPrevisto: hoyMas(7) }}
          onEnviar={(d) => api.asignaciones.asignar({ ...d, activoId: a.id })}
        />
      );
    case 'devolver':
      return (
        <PanelFormulario
          {...comun}
          titulo={`Registrar devolución de ${a.codigoPatrimonial}`}
          descripcion={`Lo tiene ${a.asignacion?.responsable ?? ''} (${et(a.asignacion?.tipo)}).`}
          textoEnviar="Registrar devolución"
          campos={[
            { nombre: 'ubicacionId', etiqueta: 'Dónde queda', tipo: 'select', opciones: ubicaciones, vacio: 'Sin cambiar la ubicación' },
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea', ayuda: 'Estado en que se devuelve, faltantes…' },
          ]}
          onEnviar={(d) => api.asignaciones.devolver(a.asignacion!.id, d)}
        />
      );
    case 'transferir':
      return (
        <PanelFormulario
          {...comun}
          titulo={`Transferir ${a.codigoPatrimonial}`}
          descripcion={`Ahora lo tiene ${a.asignacion?.responsable ?? ''}. Se cierra su asignación y se abre otra, sin pasar por el almacén.`}
          textoEnviar="Transferir"
          campos={[
            { nombre: 'personaId', etiqueta: 'Nuevo responsable', tipo: 'select', opciones: personas, vacio: 'Ninguno (asignar a un área)' },
            { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, visible: (v) => !v.personaId },
            { nombre: 'observacion', etiqueta: 'Motivo u observación', tipo: 'textarea' },
          ]}
          onEnviar={(d) => api.asignaciones.transferir(a.asignacion!.id, d)}
        />
      );
    case 'mantenimiento': {
      const campos: Campo[] = [
        { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(['CORRECTIVO', 'PREVENTIVO']), requerido: true },
        { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
        { nombre: 'fallaReportada', etiqueta: 'Falla reportada o trabajo a realizar', tipo: 'textarea', requerido: true },
        { nombre: 'estadoTecnico', etiqueta: 'Estado técnico con el que entra', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), vacio: `Sin cambiar (${et(a.estadoTecnico)})` },
        { nombre: 'ubicacionTallerId', etiqueta: 'Enviar a (taller o proveedor)', tipo: 'select', opciones: talleres, vacio: 'Se queda donde está' },
        { nombre: 'tecnico', etiqueta: 'Técnico responsable' },
        { nombre: 'proveedorExterno', etiqueta: 'Proveedor externo' },
      ];
      if (a.asignacion?.personaId) {
        campos.push(
          { nombre: 'activoTemporalId', etiqueta: `Equipo temporal para ${a.asignacion.responsable}`, tipo: 'select', opciones: disponibles, vacio: 'No prestar equipo temporal', ayuda: 'Solo aparecen equipos disponibles (sin asignar ni en mantenimiento).' },
          { nombre: 'hastaPrevistoTemporal', etiqueta: 'Devolución prevista del temporal', tipo: 'fecha', visible: (v) => !!v.activoTemporalId },
        );
      }
      return (
        <PanelFormulario
          {...comun}
          titulo={`Enviar ${a.codigoPatrimonial} a mantenimiento`}
          textoEnviar="Abrir orden"
          campos={campos}
          inicial={{ tipo: 'CORRECTIVO', motivo: 'FALLA_TECNICA', hastaPrevistoTemporal: hoyMas(14) }}
          onEnviar={(d) => api.mantenimiento.abrir({ ...d, activoId: a.id, estadoTecnico: d.estadoTecnico ?? undefined })}
        />
      );
    }
    case 'estado':
      return (
        <PanelFormulario
          {...comun}
          titulo="Cambiar estado técnico"
          campos={[
            { nombre: 'estadoTecnico', etiqueta: 'Estado técnico', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
          ]}
          inicial={{ estadoTecnico: a.estadoTecnico }}
          onEnviar={(d) => api.activos.estadoTecnico(a.id, d)}
        />
      );
    case 'ubicacion':
      return (
        <PanelFormulario
          {...comun}
          titulo="Cambiar ubicación"
          textoEnviar="Trasladar"
          campos={[
            { nombre: 'ubicacionId', etiqueta: 'Nueva ubicación', tipo: 'select', opciones: ubicaciones, requerido: true },
            { nombre: 'observacion', etiqueta: 'Motivo u observación', tipo: 'textarea' },
          ]}
          onEnviar={(d) => api.activos.ubicacion(a.id, d)}
        />
      );
    case 'fuera':
    case 'servicio':
      return (
        <PanelFormulario
          {...comun}
          titulo={accion === 'fuera' ? 'Poner fuera de servicio' : 'Volver a poner en servicio'}
          campos={[
            ...(accion === 'fuera' ? [{ nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select' as const, opciones: opcionesDe(MOTIVOS), requerido: true }] : []),
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
          ]}
          onEnviar={(d) => api.activos.ciclo(a.id, { ...d, cicloVida: accion === 'fuera' ? 'FUERA_DE_SERVICIO' : 'EN_SERVICIO' })}
        />
      );
    case 'baja':
      return (
        <PanelFormulario
          {...comun}
          titulo={`Dar de baja ${a.codigoPatrimonial}`}
          descripcion="El activo deja de estar en servicio de forma definitiva. Su historia y la de sus componentes se conservan."
          textoEnviar="Dar de baja"
          campos={[
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Explicación', tipo: 'textarea', requerido: true },
          ]}
          onEnviar={(d) => api.activos.baja(a.id, d)}
        />
      );
    case 'editar':
      return (
        <PanelFormulario
          {...comun}
          titulo="Editar datos del activo"
          campos={[
            { nombre: 'nombre', etiqueta: 'Nombre o descripción', requerido: true },
            { nombre: 'numeroSerie', etiqueta: 'Número de serie' },
            { nombre: 'fechaAdquisicion', etiqueta: 'Fecha de adquisición', tipo: 'fecha' },
            { nombre: 'proveedor', etiqueta: 'Proveedor' },
            { nombre: 'numeroFactura', etiqueta: 'N.º de factura' },
            { nombre: 'costo', etiqueta: 'Costo', tipo: 'numero' },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
          ]}
          inicial={{
            nombre: a.nombre, numeroSerie: a.numeroSerie ?? '', fechaAdquisicion: a.fechaAdquisicion?.slice(0, 10) ?? '', proveedor: a.proveedor ?? '',
            numeroFactura: a.numeroFactura ?? '', costo: a.costo ?? '', observaciones: a.observaciones ?? '',
          }}
          onEnviar={(d) => api.activos.editar(a.id, { ...d, costo: d.costo == null ? null : String(d.costo) })}
        />
      );
  }
}
