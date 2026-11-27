/** Contratos de la API de gestión de activos (ITAM). */

export const ETIQUETAS: Record<string, string> = {
  EN_SERVICIO: 'En servicio', FUERA_DE_SERVICIO: 'Fuera de servicio', DADO_DE_BAJA: 'Dado de baja',
  SIN_EVALUAR: 'Sin evaluar', OPERATIVO: 'Operativo', CON_FALLAS: 'Con fallas', AVERIADO: 'Averiado', IRREPARABLE: 'Irreparable',
  FALLA_TECNICA: 'Falla técnica', PREVENTIVO: 'Preventivo', CORRECTIVO: 'Correctivo', GARANTIA: 'Garantía', ACTUALIZACION: 'Actualización',
  DANO_FISICO: 'Daño físico', REASIGNACION: 'Reasignación', OTRO: 'Otro',
  PERMANENTE: 'Asignación sin fecha de devolución', PRESTAMO: 'Préstamo con fecha de devolución', TEMPORAL_REEMPLAZO: 'Reemplazo temporal',
  INSTALADO: 'Instalado', EN_ALMACEN: 'En almacén', EN_MANTENIMIENTO: 'En mantenimiento',
  ABIERTA: 'Abierta', EN_CURSO: 'En curso', EN_ESPERA: 'En espera', CERRADA: 'Cerrada', CANCELADA: 'Cancelada',
  PUESTO: 'Puesto de trabajo', ALMACEN: 'Almacén', TALLER: 'Taller', PROVEEDOR: 'Proveedor',
  NO_APLICA: 'No aplica', SIN_VINCULAR: 'Sin vincular', SINCRONIZADO: 'Sincronizado', CON_DISCREPANCIAS: 'Con discrepancias', SIN_REPORTE: 'Sin reporte',
  COMPONENTE_NUEVO: 'Componente no registrado', COMPONENTE_MOVIDO: 'Componente de otro equipo', COMPONENTE_AUSENTE: 'Componente no detectado',
  ATRIBUTO_DIFERENTE: 'Dato diferente', USUARIO_DISTINTO: 'Usuario distinto',
  PENDIENTE: 'Pendiente', ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', RESUELTA_AUTO: 'Resuelta por ScanGP',
  FABRICANTE: 'Fabricante', EXTENDIDA: 'Extendida', SOPORTE: 'Soporte', OTRA: 'Otra',
  FACTURA: 'Factura', ACTA_ENTREGA: 'Acta de entrega', INFORME_TECNICO: 'Informe técnico', FOTO: 'Foto',
  ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE: 'Ajuste',
  ASIGNADO: 'Asignado', DISPONIBLE: 'Disponible',
};
export const et = (v: string | null | undefined) => (v ? (ETIQUETAS[v] ?? v) : '');
export const opcionesDe = (valores: readonly string[]) => valores.map((v) => ({ valor: v, etiqueta: et(v) }));

export const ESTADOS_TECNICOS = ['SIN_EVALUAR', 'OPERATIVO', 'CON_FALLAS', 'AVERIADO', 'IRREPARABLE'] as const;
export const MOTIVOS = ['FALLA_TECNICA', 'PREVENTIVO', 'GARANTIA', 'ACTUALIZACION', 'DANO_FISICO', 'REASIGNACION', 'OTRO'] as const;
export const TIPOS_ASIGNACION = ['PERMANENTE', 'PRESTAMO', 'TEMPORAL_REEMPLAZO'] as const;
export const TIPOS_UBICACION = ['PUESTO', 'ALMACEN', 'TALLER', 'PROVEEDOR', 'OTRO'] as const;
export const TIPOS_GARANTIA = ['FABRICANTE', 'EXTENDIDA', 'SOPORTE', 'OTRA'] as const;
export const TIPOS_DOCUMENTO = ['FACTURA', 'ACTA_ENTREGA', 'INFORME_TECNICO', 'GARANTIA', 'FOTO', 'OTRO'] as const;

export interface Pagina<T> { items: T[]; total: number; pagina: number; porPagina: number }
export interface Ref { id: string; nombre: string }

export interface TipoActivo { id: string; codigo: string; nombre: string; detectable: boolean }
export interface TipoComponente { id: string; codigo: string; nombre: string }
export interface Marca { id: string; nombre: string; activo: boolean }
export interface Modelo { id: string; nombre: string; marcaId: string; tipoActivoId: string; marca?: Marca; tipoActivo?: TipoActivo; activo: boolean }
export interface Sede { id: string; nombre: string; direccion: string | null; prefijoRed: string | null; activo: boolean }
export interface Area { id: string; nombre: string; activo: boolean }
export interface Ubicacion { id: string; nombre: string; tipo: string; sedeId: string; areaId: string | null; sede?: Sede; area?: Area | null; activo: boolean }
export interface Persona {
  id: string; nombre: string; documento: string | null; correo: string | null; cargo: string | null;
  areaId: string | null; area?: Area | null; usuarioWindows: string | null; activo: boolean;
}
export interface Config {
  nombre: string; prefijoActivo: string; prefijoComponente: string; prefijoOrden: string; digitosCodigo: number; diasSinReporte: number; diasAvisoGarantia: number;
}

export interface ActivoVista {
  id: string;
  codigoPatrimonial: string;
  nombre: string;
  numeroSerie: string | null;
  cicloVida: string;
  estadoTecnico: string;
  tipo: { codigo: string; nombre: string };
  marca: string | null;
  modelo: string | null;
  ubicacionId: string | null;
  ubicacionNombre: string | null;
  asignacion: { id: string; tipo: string; personaId: string | null; responsable: string | null; hastaPrevisto: string | null } | null;
  ordenAbierta: { id: string; codigo: string } | null;
  dispositivoId: string | null;
  ultimoReporte: string | null;
  discrepanciasPendientes: number;
  sincronizacion: string;
}

export interface ActivoDetalle extends ActivoVista {
  tipoActivoId: string;
  modeloId: string | null;
  fechaAdquisicion: string | null;
  proveedor: string | null;
  numeroFactura: string | null;
  costo: string | null;
  especificaciones: Record<string, unknown> | null;
  observaciones: string | null;
  fechaBaja: string | null;
  creadoEn: string;
}

export interface ComponenteVista {
  id: string;
  codigo: string;
  tipo: { codigo: string; nombre: string };
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  capacidad: string | null;
  situacion: string;
  estadoTecnico: string;
  ubicacion: { id: string; nombre: string } | null;
  activo: { id: string; codigoPatrimonial: string; nombre: string } | null;
  instaladoDesde: string | null;
  confirmadoPorScanGP: boolean;
}

export interface InstalacionVista {
  id: string; desde: string; hasta: string | null; motivoInstalacion: string | null; motivoRetiro: string | null; confirmadaEn: string | null;
  activo?: { id: string; codigoPatrimonial: string; nombre: string } | null;
  componente?: { id: string; codigo: string; tipo: { codigo: string; nombre: string }; marca: string | null; modelo: string | null; numeroSerie: string | null; capacidad: string | null; estadoTecnico: string };
}

export interface ComponenteDetalle extends ComponenteVista {
  observaciones: string | null;
  instalaciones: InstalacionVista[];
  historial: Movimiento[];
}

export interface Movimiento {
  id: string; fecha: string; tipo: string; motivo: string | null; descripcion: string; observacion: string | null;
  detalle: Record<string, unknown> | null; referenciaTipo: string | null; referenciaId: string | null; usuarioNombre: string | null;
}

export interface Asignacion {
  id: string; activoId: string; tipo: string; personaId: string | null; areaId: string | null;
  desde: string; hastaPrevisto: string | null; hasta: string | null; motivoCierre: string | null; ordenMantenimientoId: string | null; observaciones: string | null;
  activo?: { id: string; codigoPatrimonial: string; nombre: string; tipoActivo?: TipoActivo };
  persona?: Persona | null; area?: Area | null;
}

export interface Orden {
  id: string; codigo: string; activoId: string; tipo: string; motivo: string; estado: string;
  fallaReportada: string | null; diagnostico: string | null; solucion: string | null; tecnico: string | null; proveedorExterno: string | null;
  fechaApertura: string; fechaCierre: string | null; costo: string | null; resultado: string | null;
  activo?: { id: string; codigoPatrimonial: string; nombre: string; tipoActivo?: TipoActivo };
  temporales?: Asignacion[];
  componentes?: (InstalacionVista & { componente: { id: string; codigo: string; tipoComponente?: TipoComponente; modelo: string | null } })[];
}

export interface Discrepancia {
  id: string; tipo: string; clave: string; descripcion: string; detalle: Record<string, unknown> | null; estado: string;
  creadoEn: string; resueltaEn: string | null; resueltaPor: string | null; resolucion: string | null;
  dispositivoId: string; activoId: string; activoCodigo: string; activoNombre: string;
}

export interface Garantia {
  id: string; activoId: string | null; componenteId: string | null; tipo: string; proveedor: string; numeroContrato: string | null;
  inicio: string; fin: string; observaciones: string | null; vigente: boolean;
  activoCodigo?: string | null; activoNombre?: string | null; componenteCodigo?: string | null;
}

export interface Documento {
  id: string; entidad: string; entidadId: string; tipo: string; nombreArchivo: string; tipoMime: string; tamanoBytes: number; descripcion: string | null; creadoEn: string;
}

export interface Articulo { id: string; nombre: string; unidad: string; stockMinimo: number; activo: boolean }
export interface Existencia {
  articuloId: string; nombre: string; unidad: string; stockMinimo: number; ubicacionId: string | null; ubicacion: string | null; sede: string | null; cantidad: number; totalArticulo: number;
}
export interface MovimientoAlmacen {
  id: string; fecha: string; tipo: string; cantidad: number; saldo: number; motivo: string | null; usuarioNombre: string | null;
  articulo: string; unidad: string; ubicacion: string; activo: string | null; orden: string | null;
}

export interface Panel {
  contadores: Record<string, number>;
  actividad: Movimiento[];
}

export interface SugerenciaActivo {
  dispositivoId: string; nombre: string; tipoActivoId: string; tipoNombre: string; marcaNombre: string | null; modeloNombre: string | null;
  numeroSerie: string | null; etiquetaActivoBios: string | null; especificaciones: Record<string, unknown>;
  componentes: { tipo: string; marca: string | null; modelo: string | null; numeroSerie: string | null; capacidad: string | null }[];
  integrados: { tipo: string; descripcion: string }[];
}
