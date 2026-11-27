import { useOutletContext } from 'react-router-dom';
import type { EquipoDetalle } from '../../types/api';

/** Equipo cargado por EquipoLayout, disponible para todas sus subpáginas. */
export function useEquipoActual() {
  return useOutletContext<EquipoDetalle>();
}
