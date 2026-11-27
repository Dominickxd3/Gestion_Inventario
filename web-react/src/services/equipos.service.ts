import { getJson } from './http';
import type { EquipoDetalle, EquipoListado, Estadisticas } from '../types/api';

export const equiposService = {
  listar: (signal?: AbortSignal) => getJson<EquipoListado[]>('/equipos', signal),
  obtener: (id: string, signal?: AbortSignal) => getJson<EquipoDetalle>(`/equipos/${encodeURIComponent(id)}`, signal),
  estadisticas: (signal?: AbortSignal) => getJson<Estadisticas>('/estadisticas', signal),
};
