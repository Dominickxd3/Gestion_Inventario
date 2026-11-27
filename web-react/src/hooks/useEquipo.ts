import { usePolling } from './usePolling';
import { equiposService } from '../services/equipos.service';

/** Inventario completo de un equipo, actualizado periódicamente. */
export function useEquipo(id: string) {
  return usePolling((s) => equiposService.obtener(id, s), 15_000, id);
}
