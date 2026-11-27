/** Estructura del JSON que envía AgenteInventario.exe */
export type TipoEquipo =
  | 'LAPTOP'
  | 'ESCRITORIO'
  | 'ALL_IN_ONE'
  | 'TABLET'
  | 'SERVIDOR'
  | 'VIRTUAL'
  | 'DESCONOCIDO';

export interface InventarioPayload {
  agenteVersion: string;
  fechaRecoleccion: string;
  equipo: {
    nombreEquipo: string;
    usuario: string | null;
    usuarioEjecucion: string;
    dominio: string | null;
    enDominio: boolean | null;
    fabricante: string | null;
    modelo: string | null;
    modeloCodigo: string | null;
    numeroSerie: string | null;
    uuid: string | null;
    tipo: TipoEquipo;
    tipoDeteccion: string;
    chasisCodigos: number[];
    tieneBateria: boolean;
    ensamblada: boolean;
    [k: string]: unknown;
  };
  sistemaOperativo: {
    nombre: string | null;
    version: string | null;
    versionComercial?: string | null;
    arquitectura: string | null;
    [k: string]: unknown;
  } | null;
  procesadores: Array<{ nombre: string | null; nucleos: number | null; hilos: number | null; [k: string]: unknown }> | null;
  memoria: { instaladaBytes: number; modulos: Array<Record<string, unknown>>; [k: string]: unknown } | null;
  discos: Array<{ modelo: string | null; numeroSerie: string | null; capacidadBytes: number | null; tipo: string; externo: boolean; [k: string]: unknown }> | null;
  graficos: Array<{ nombre: string | null; [k: string]: unknown }> | null;
  red: Array<{ mac: string | null; ips: string[]; conectado: boolean; [k: string]: unknown }> | null;
  software: Array<{ nombre: string; version: string | null; [k: string]: unknown }> | null;
  advertencias: string[];
  [k: string]: unknown;
}

export interface CambioHistorial {
  fecha: string;
  campo: string;
  anterior: string | null;
  nuevo: string | null;
}

export interface EquipoRegistrado {
  id: string;
  primerRegistro: string;
  ultimoReporte: string;
  totalReportes: number;
  ipOrigen: string | null;
  resumen: ResumenEquipo;
  historial: CambioHistorial[];
  inventario: InventarioPayload;
}

/** Datos planos para listar en tablas sin enviar todo el inventario. */
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
