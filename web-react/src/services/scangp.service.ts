import { descargarArchivo, getJson } from './http';
import type { InfoScanGp } from '../types/api';

export const scangpService = {
  info: (signal?: AbortSignal) => getJson<InfoScanGp>('/scangp/info', signal),
  descargar: (nombre: string) => descargarArchivo('/scangp/descargar', nombre),
};
