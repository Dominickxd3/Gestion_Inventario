/**
 * Contratos tal como los devuelve la API NestJS (no se modifican en el frontend).
 * Los campos del inventario reflejan el JSON que envía ScanGP.exe; cualquiera puede ser null
 * cuando el detector no pudo leerlo.
 */
export type TipoEquipo = 'LAPTOP' | 'ESCRITORIO' | 'ALL_IN_ONE' | 'TABLET' | 'SERVIDOR' | 'VIRTUAL' | 'DESCONOCIDO';

export interface ResumenEquipo {
  nombreEquipo: string;
  usuario: string | null;
  tipo: TipoEquipo;
  fabricante: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  procesador: string | null;
  nucleos: number | null;
  ramGB: number | null;
  almacenamientoGB: number | null;
  discos: string | null;
  gpu: string | null;
  sistemaOperativo: string | null;
  ip: string | null;
  mac: string | null;
}

export interface EquipoListado {
  id: string;
  primerRegistro: string;
  ultimoReporte: string;
  totalReportes: number;
  ipOrigen: string | null;
  cambiosRecientes: number;
  resumen: ResumenEquipo;
  /** Activo validado al que está vinculado (null = detectado sin registrar). */
  activoId?: string | null;
  codigoPatrimonial?: string | null;
}

export interface CambioHistorial {
  fecha: string;
  campo: string;
  anterior: string | null;
  nuevo: string | null;
}

export interface EquipoDetalle extends Omit<EquipoListado, 'cambiosRecientes'> {
  historial: CambioHistorial[];
  inventario: Inventario;
  escaneos?: { id: string; recibidoEn: string; agenteVersion: string | null }[];
  activo?: { id: string; codigoPatrimonial: string; nombre: string } | null;
}

export interface Estadisticas {
  total: number;
  porTipo: Record<string, number>;
  porFabricante: Record<string, number>;
  porSistema: Record<string, number>;
  sinReportar7dias: number;
}

export interface InfoScanGp {
  disponible: boolean;
  nombreArchivo: string;
  urlServidor: string;
  tamanoBytes: number | null;
  actualizado: string | null;
}

// ---------------------------------------------------------------- Inventario (ScanGP.exe)

type N<T> = T | null | undefined;

export interface InvEquipo {
  nombreEquipo: string;
  usuario: N<string>;
  usuarioEjecucion: N<string>;
  dominio: N<string>;
  enDominio: N<boolean>;
  fabricante: N<string>;
  modelo: N<string>;
  modeloCodigo: N<string>;
  familia: N<string>;
  sku: N<string>;
  numeroSerie: N<string>;
  uuid: N<string>;
  etiquetaActivo: N<string>;
  tipo: TipoEquipo;
  tipoDeteccion: N<string>;
  chasisCodigos: N<number[]>;
  tieneBateria: N<boolean>;
  ensamblada: N<boolean>;
}

export interface InvSistemaOperativo {
  nombre: N<string>;
  version: N<string>;
  build: N<string>;
  buildCompleto: N<string>;
  versionComercial: N<string>;
  arquitectura: N<string>;
  idioma: N<string>;
  fechaInstalacion: N<string>;
  ultimoArranque: N<string>;
}

export interface InvProcesador {
  nombre: N<string>;
  fabricante: N<string>;
  nucleos: N<number>;
  hilos: N<number>;
  velocidadMaxMHz: N<number>;
  socket: N<string>;
  cacheL2KB: N<number>;
  cacheL3KB: N<number>;
  idProcesador: N<string>;
  virtualizacionHabilitada: N<boolean>;
}

export interface InvModuloRam {
  banco: N<string>;
  capacidadBytes: N<number>;
  velocidadMHz: N<number>;
  velocidadMaxMHz: N<number>;
  fabricante: N<string>;
  numeroParte: N<string>;
  numeroSerie: N<string>;
  tipo: N<string>;
  formato: N<string>;
  /** Soldado a la placa (ScanGP 2026-11+). Ausente en reportes antiguos. */
  soldado?: N<boolean>;
}

export interface InvMemoria {
  instaladaBytes: N<number>;
  utilizableBytes: N<number>;
  ranurasTotales: N<number>;
  ranurasUsadas: N<number>;
  modulos: InvModuloRam[];
}

export interface InvDisco {
  modelo: N<string>;
  numeroSerie: N<string>;
  capacidadBytes: N<number>;
  tipo: string;
  interfaz: N<string>;
  externo: N<boolean>;
  firmware: N<string>;
  salud: N<string>;
}

export interface InvVolumen {
  letra: N<string>;
  etiqueta: N<string>;
  sistemaArchivos: N<string>;
  capacidadBytes: N<number>;
  libreBytes: N<number>;
}

export interface InvPlacaBase {
  fabricante: N<string>;
  modelo: N<string>;
  version: N<string>;
  numeroSerie: N<string>;
}

export interface InvBios {
  fabricante: N<string>;
  version: N<string>;
  fecha: N<string>;
  versionSMBIOS: N<string>;
  modoArranque: N<string>;
}

export interface InvGrafica {
  nombre: N<string>;
  fabricante: N<string>;
  memoriaBytes: N<number>;
  versionDriver: N<string>;
  resolucion: N<string>;
  frecuenciaHz: N<number>;
}

export interface InvMonitor {
  fabricante: N<string>;
  modelo: N<string>;
  codigoProducto: N<string>;
  numeroSerie: N<string>;
  anioFabricacion: N<number>;
}

export interface InvRed {
  nombre: N<string>;
  conexion: N<string>;
  mac: N<string>;
  tipo: N<string>;
  conectado: N<boolean>;
  velocidadBps: N<number>;
  ips: N<string[]>;
  dhcp: N<boolean>;
}

export interface InvBateria {
  nombre: N<string>;
  cargaPorcentaje: N<number>;
  capacidadDisenoMWh: N<number>;
  capacidadActualMWh: N<number>;
  saludPorcentaje: N<number>;
}

export interface InvAntivirus {
  nombre: N<string>;
  activo: N<boolean>;
  actualizado: N<boolean>;
}

export interface InvSoftware {
  nombre: string;
  version: N<string>;
  editor: N<string>;
  fechaInstalacion: N<string>;
}

export interface Inventario {
  agenteVersion: string;
  fechaRecoleccion: string;
  equipo: InvEquipo;
  sistemaOperativo: N<InvSistemaOperativo>;
  procesadores: N<InvProcesador[]>;
  memoria: N<InvMemoria>;
  discos: N<InvDisco[]>;
  volumenes: N<InvVolumen[]>;
  placaBase: N<InvPlacaBase>;
  bios: N<InvBios>;
  graficos: N<InvGrafica[]>;
  monitores: N<InvMonitor[]>;
  red: N<InvRed[]>;
  bateria: N<InvBateria>;
  antivirus: N<InvAntivirus[]>;
  software: N<InvSoftware[]>;
  advertencias: N<string[]>;
}
