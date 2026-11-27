import type { Inventario } from '../../types/api';
import { capacidad, memoria, plural, unir } from '../../lib/formato';

/** Resúmenes de una línea por componente (lenguaje claro), reutilizados en Resumen. */
export function resumenProcesador(inv: Inventario) {
  const p = inv.procesadores?.[0];
  if (!p?.nombre) return null;
  return unir([p.nombre, p.nucleos && p.hilos && `${p.nucleos} núcleos / ${p.hilos} hilos`], ' · ');
}

export function resumenMemoria(inv: Inventario) {
  const m = inv.memoria;
  if (!m?.instaladaBytes) return null;
  const tipo = m.modulos.find((x) => x.tipo)?.tipo;
  return unir(
    [
      unir([memoria(m.instaladaBytes), tipo]),
      m.ranurasTotales ? `${m.ranurasUsadas} de ${m.ranurasTotales} ranuras ocupadas` : null,
    ],
    ' · ',
  );
}

export function resumenAlmacenamiento(inv: Inventario) {
  const internos = (inv.discos ?? []).filter((d) => !d.externo);
  if (!internos.length) return null;
  const total = internos.reduce((s, d) => s + (d.capacidadBytes ?? 0), 0);
  const porTipo = Object.entries(
    internos.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.tipo]: (acc[d.tipo] ?? 0) + 1 }), {}),
  )
    .map(([t, n]) => `${n} ${t}`)
    .join(', ');
  return `${capacidad(total)} en ${plural(internos.length, 'disco', 'discos')} (${porTipo})`;
}

export function resumenGraficos(inv: Inventario) {
  const g = inv.graficos?.filter((x) => x.nombre && !/basic display|remote display/i.test(x.nombre)) ?? [];
  if (!g.length) return null;
  return g.map((x) => unir([x.nombre, memoria(x.memoriaBytes)], ' · ')).join(' / ');
}

export function resumenSistema(inv: Inventario) {
  const so = inv.sistemaOperativo;
  if (!so?.nombre) return null;
  return unir([unir([so.nombre.replace(/^Microsoft /, ''), so.versionComercial]), so.arquitectura], ' · ');
}
