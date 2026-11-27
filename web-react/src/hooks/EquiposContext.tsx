import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePolling } from './usePolling';
import { equiposService } from '../services/equipos.service';
import type { EquipoListado, Estadisticas } from '../types/api';

const INTERVALO_MS = 10_000;

interface ValorEquipos {
  equipos: EquipoListado[] | undefined;
  estadisticas: Estadisticas | undefined;
  cargando: boolean;
  error: Error | undefined;
  recargar: () => void;
}

const Contexto = createContext<ValorEquipos | null>(null);

/** Una sola consulta periódica de la lista y las estadísticas para toda la aplicación. */
export function EquiposProvider({ children }: { children: ReactNode }) {
  const lista = usePolling((s) => equiposService.listar(s), INTERVALO_MS);
  const stats = usePolling((s) => equiposService.estadisticas(s), INTERVALO_MS);
  const { recargar: recargarLista } = lista;
  const { recargar: recargarStats } = stats;

  const valor = useMemo<ValorEquipos>(
    () => ({
      equipos: lista.data,
      estadisticas: stats.data,
      cargando: lista.cargando,
      error: lista.error,
      recargar: () => {
        recargarLista();
        recargarStats();
      },
    }),
    [lista.data, stats.data, lista.cargando, lista.error, recargarLista, recargarStats],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEquipos() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useEquipos debe usarse dentro de EquiposProvider');
  return v;
}
