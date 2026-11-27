import { useCallback, useEffect, useState } from 'react';
import { equiposService } from '../services/equipos.service';
import type { EquipoDetalle, EquipoListado } from '../types/api';

/**
 * La lista de la API no incluye el inventario completo, que se necesita para calcular el
 * diagnóstico de cada equipo. Este hook pide el detalle solo de los equipos cuyo
 * `ultimoReporte` cambió y lo guarda en una caché compartida.
 * Límite: pensado para flotas pequeñas/medianas (ver DESIGN.md §11).
 */
const LIMITE = 200;
const CONCURRENCIA = 4;
const cache = new Map<string, { ultimoReporte: string; detalle: EquipoDetalle }>();

const vigente = (e: EquipoListado) => cache.get(e.id)?.ultimoReporte === e.ultimoReporte;

export function useDetalles(equipos: EquipoListado[] | undefined) {
  const [, setVersion] = useState(0);
  const firma = equipos?.map((e) => `${e.id}:${e.ultimoReporte}`).join('|') ?? '';

  useEffect(() => {
    if (!equipos) return;
    const cola = equipos.filter((e) => !vigente(e)).slice(0, LIMITE);
    if (cola.length === 0) return;
    let vivo = true;

    const trabajador = async () => {
      for (let e = cola.shift(); e; e = cola.shift()) {
        try {
          const detalle = await equiposService.obtener(e.id);
          cache.set(e.id, { ultimoReporte: e.ultimoReporte, detalle });
        } catch {
          /* se reintenta en la siguiente actualización de la lista */
        }
      }
    };
    Promise.all(Array.from({ length: Math.min(CONCURRENCIA, cola.length) }, trabajador)).then(() => {
      if (vivo) setVersion((v) => v + 1);
    });
    return () => {
      vivo = false;
    };
    // `firma` resume la lista; evita repetir consultas en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  const obtener = useCallback((id: string) => cache.get(id)?.detalle, []);
  const listo = !!equipos && equipos.every(vigente);
  return { obtener, listo };
}
