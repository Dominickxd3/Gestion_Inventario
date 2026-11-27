import { CircleCheck, CircleHelp, CircleMinus, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react';

/** Estado de una comprobación (diagnóstico, compatibilidad). */
export type Estado = 'ok' | 'aviso' | 'problema' | 'na' | 'desconocido';

export const ESTADOS: Record<Estado, { etiqueta: string; icono: LucideIcon; clase: string }> = {
  ok: { etiqueta: 'Correcto', icono: CircleCheck, clase: 'estado-ok' },
  aviso: { etiqueta: 'Advertencia', icono: TriangleAlert, clase: 'estado-aviso' },
  problema: { etiqueta: 'Problema', icono: CircleX, clase: 'estado-problema' },
  na: { etiqueta: 'No aplica', icono: CircleMinus, clase: 'estado-neutro' },
  desconocido: { etiqueta: 'Sin datos', icono: CircleHelp, clase: 'estado-neutro' },
};

/** Resultado de una comprobación calculada a partir del inventario real. */
export interface Comprobacion {
  id: string;
  titulo: string;
  estado: Estado;
  detalle: string;
}

const GRAVEDAD: Record<Estado, number> = { problema: 3, aviso: 2, desconocido: 1, ok: 0, na: 0 };

/** El estado más grave de una lista (para el estado general de un equipo). */
export function peorEstado(estados: Estado[]): Estado {
  return estados.reduce<Estado>((peor, e) => (GRAVEDAD[e] > GRAVEDAD[peor] ? e : peor), 'ok');
}
