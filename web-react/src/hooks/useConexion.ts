import { useSyncExternalStore } from 'react';
import { conexion } from '../services/http';

/** Estado de conexión con la API, compartido por toda la aplicación. */
export function useConexion() {
  return useSyncExternalStore(conexion.suscribir, conexion.obtener);
}
