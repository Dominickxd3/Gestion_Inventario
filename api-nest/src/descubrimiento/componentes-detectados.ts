import { capacidadLegible, huellaComponente } from '../common/identificacion';
import type { InventarioPayload } from './inventario.types';

/** Componente que ScanGP ve en el equipo, con la huella con la que se compara con el inventario. */
export interface ComponenteDetectado {
  tipo: 'DISCO' | 'RAM' | 'MONITOR';
  huella: string | null;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  capacidad: string | null;
  /** Integrado (RAM soldada, sin serie): forma parte del equipo y no se rastrea por separado. */
  integrado: boolean;
}

/** Tipos cuya ausencia se reporta como discrepancia. Los monitores externos se desconectan a menudo: no. */
export const TIPOS_CON_AUSENCIA = new Set(['DISCO', 'RAM']);

type Modulo = { capacidadBytes?: number; fabricante?: string | null; numeroParte?: string | null; numeroSerie?: string | null; tipo?: string | null; formato?: string | null; soldado?: boolean | null; banco?: string | null };
type Monitor = { fabricante?: string | null; modelo?: string | null; codigoProducto?: string | null; numeroSerie?: string | null };

export function componentesDetectados(p: InventarioPayload): ComponenteDetectado[] {
  const r: ComponenteDetectado[] = [];
  for (const d of p.discos ?? []) {
    if (d.externo) continue;
    const huella = huellaComponente('DISCO', d.numeroSerie);
    r.push({
      tipo: 'DISCO', huella, marca: null, modelo: d.modelo, numeroSerie: d.numeroSerie,
      capacidad: capacidadLegible(d.capacidadBytes, 1000), integrado: !huella,
    });
  }
  for (const m of (p.memoria?.modulos ?? []) as Modulo[]) {
    const soldado = m.soldado ?? (/^LPDDR/i.test(m.tipo ?? '') || m.formato === 'Soldada');
    const huella = soldado ? null : huellaComponente('RAM', m.numeroSerie);
    r.push({
      tipo: 'RAM', huella, marca: m.fabricante ?? null, modelo: [m.tipo, m.numeroParte].filter(Boolean).join(' ') || null,
      numeroSerie: m.numeroSerie ?? null, capacidad: capacidadLegible(m.capacidadBytes), integrado: soldado || !huella,
    });
  }
  for (const m of (p.monitores ?? []) as Monitor[]) {
    const huella = huellaComponente('MONITOR', m.numeroSerie);
    if (!huella) continue; // la pantalla interna de una laptop no trae serie: no es un componente aparte
    r.push({
      tipo: 'MONITOR', huella, marca: m.fabricante ?? null, modelo: m.modelo ?? m.codigoProducto ?? null,
      numeroSerie: m.numeroSerie ?? null, capacidad: null, integrado: false,
    });
  }
  return r;
}

/** Agrupa la memoria soldada en una sola línea legible ("16 GB LPDDR5 soldada"). */
export function resumenIntegrados(lista: ComponenteDetectado[]) {
  const ram = lista.filter((c) => c.tipo === 'RAM' && c.integrado);
  const otros = lista.filter((c) => c.tipo !== 'RAM' && c.integrado);
  const bytes = (s: string | null) => {
    const [n, u] = (s ?? '').split(' ');
    return Number(n) * (u === 'GB' ? 1024 ** 3 : u === 'MB' ? 1024 ** 2 : u === 'TB' ? 1024 ** 4 : 1);
  };
  const totalRam = ram.reduce((s, c) => s + bytes(c.capacidad), 0);
  return [
    ...(ram.length ? [{ tipo: 'RAM', descripcion: `${Math.round(totalRam / 1024 ** 3)} GB ${ram[0].modelo?.split(' ')[0] ?? ''} integrada (sin número de serie)`.replace('  ', ' ') }] : []),
    ...otros.map((c) => ({ tipo: c.tipo, descripcion: `${c.modelo ?? c.tipo} ${c.capacidad ?? ''} (sin número de serie)`.trim() })),
  ];
}
