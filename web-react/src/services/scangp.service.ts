import { getJson, urlApi } from './http';
import type { InfoScanGp } from '../types/api';

export const scangpService = {
  info: (signal?: AbortSignal) => getJson<InfoScanGp>('/scangp/info', signal),
  urlDescarga: urlApi('/scangp/descargar'),
};
