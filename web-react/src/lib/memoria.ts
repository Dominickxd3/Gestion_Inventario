import type { InvMemoria, InvModuloRam } from '../types/api';

/** Ubicaciones que la BIOS usa para memoria soldada a la placa (no son ranuras). */
const UBICACION_PLACA = /motherboard|system ?board|on-?board|soldered/i;

/**
 * Indica si un módulo está soldado a la placa base.
 * LPDDR siempre va soldada; DIMM/SODIMM siempre es extraíble.
 * Para reportes antiguos sin el campo `soldado` se deduce con las mismas reglas que usa ScanGP.
 */
export function esModuloSoldado(x: InvModuloRam): boolean {
  if (x.soldado != null) return x.soldado;
  if (x.tipo && /^LPDDR/i.test(x.tipo)) return true;
  if (x.formato === 'DIMM' || x.formato === 'SODIMM') return false;
  return !!x.banco && UBICACION_PLACA.test(x.banco);
}

export interface AnalisisMemoria {
  /** 'total': toda la RAM va soldada; 'parcial': parte soldada + ranuras; 'no': solo módulos extraíbles. */
  soldada: 'total' | 'parcial' | 'no';
  capacidadSoldadaBytes: number;
  extraibles: InvModuloRam[];
  /** Ranuras reales para módulos extraíbles (null si la placa no lo informa). */
  ranurasTotales: number | null;
  ranurasUsadas: number;
  ranurasLibres: number | null;
}

export function analizarMemoria(m: InvMemoria): AnalisisMemoria {
  const soldados = m.modulos.filter(esModuloSoldado);
  const extraibles = m.modulos.filter((x) => !esModuloSoldado(x));
  const soldada = soldados.length === 0 ? 'no' : extraibles.length === 0 ? 'total' : 'parcial';

  // La BIOS cuenta cada chip/canal soldado como un "dispositivo" de memoria. Los ScanGP nuevos (con `soldado`)
  // ya envían solo las ranuras reales; en reportes antiguos hay que descontarlos aquí.
  const yaCorregido = m.modulos.some((x) => x.soldado != null);
  const ranurasTotales =
    soldada === 'total'
      ? 0
      : m.ranurasTotales == null
        ? null
        : yaCorregido
          ? m.ranurasTotales
          : Math.max(0, m.ranurasTotales - soldados.length);
  const ranurasUsadas = extraibles.length;

  return {
    soldada,
    capacidadSoldadaBytes: soldados.reduce((s, x) => s + (x.capacidadBytes ?? 0), 0),
    extraibles,
    ranurasTotales,
    ranurasUsadas,
    ranurasLibres: ranurasTotales != null ? Math.max(0, ranurasTotales - ranurasUsadas) : null,
  };
}
