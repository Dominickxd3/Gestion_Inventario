import {
  Box,
  CircleHelp,
  Cloud,
  Laptop,
  Monitor,
  MonitorSmartphone,
  Server,
  Tablet,
  type LucideIcon,
} from 'lucide-react';
import type { Inventario, TipoEquipo } from '../types/api';

export const TIPOS: Record<TipoEquipo, { etiqueta: string; plural: string; icono: LucideIcon }> = {
  LAPTOP: { etiqueta: 'Laptop', plural: 'Laptops', icono: Laptop },
  ESCRITORIO: { etiqueta: 'PC de escritorio', plural: 'Escritorio', icono: Monitor },
  ALL_IN_ONE: { etiqueta: 'All-in-One', plural: 'All-in-One', icono: MonitorSmartphone },
  TABLET: { etiqueta: 'Tablet', plural: 'Tablets', icono: Tablet },
  SERVIDOR: { etiqueta: 'Servidor', plural: 'Servidores', icono: Server },
  VIRTUAL: { etiqueta: 'Máquina virtual', plural: 'Virtuales', icono: Cloud },
  DESCONOCIDO: { etiqueta: 'Tipo desconocido', plural: 'Desconocidos', icono: CircleHelp },
};

export const ORDEN_TIPOS: TipoEquipo[] = ['LAPTOP', 'ESCRITORIO', 'ALL_IN_ONE', 'TABLET', 'SERVIDOR', 'VIRTUAL', 'DESCONOCIDO'];

export const infoTipo = (t: string | null | undefined) => TIPOS[(t as TipoEquipo) ?? 'DESCONOCIDO'] ?? TIPOS.DESCONOCIDO;

/** Formato del chasis según SMBIOS. Dato real de la BIOS (Win32_SystemEnclosure). */
export function formatoChasis(inv: Inventario): { etiqueta: string; icono: LucideIcon } | null {
  const c = inv.equipo.chasisCodigos ?? [];
  if (c.includes(35)) return { etiqueta: 'Mini PC', icono: Box };
  if (c.includes(36)) return { etiqueta: 'Stick PC', icono: Box };
  return null;
}

const CPU_ESTACION = /\b(xeon|threadripper|epyc)\b/i;
const GPU_ESTACION = /\b(quadro|rtx a\d{3,4}|rtx \d{4} ada|radeon pro|firepro|nvidia t\d{3,4})\b/i;

/**
 * SMBIOS no distingue una estación de trabajo. Se estima por procesador o GPU profesional
 * y la interfaz siempre lo presenta como "estimado".
 */
export function estimarEstacionDeTrabajo(inv: Inventario): string | null {
  const cpu = inv.procesadores?.find((p) => p.nombre && CPU_ESTACION.test(p.nombre));
  if (cpu?.nombre) return `procesador ${cpu.nombre}`;
  const gpu = inv.graficos?.find((g) => g.nombre && GPU_ESTACION.test(g.nombre));
  if (gpu?.nombre) return `tarjeta gráfica ${gpu.nombre}`;
  return null;
}

/** "chasis 3" -> "el tipo de chasis informado por la BIOS" (texto para no técnicos). */
export function explicarDeteccion(metodo: string | null | undefined): string | null {
  if (!metodo) return null;
  if (metodo.startsWith('chasis') && metodo.includes('batería')) return 'Chasis de la BIOS y presencia de batería';
  if (metodo.startsWith('chasis')) return `Tipo de chasis informado por la BIOS (código ${metodo.replace(/\D+/g, '')})`;
  if (metodo.startsWith('batería')) return 'Presencia de batería';
  if (metodo.startsWith('modelo')) return 'Nombre del modelo';
  return metodo;
}
