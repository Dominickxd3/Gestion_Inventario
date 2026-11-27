/** Cliente HTTP único: la única capa que usa fetch. Publica el estado de conexión con la API. */

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export type TipoErrorApi = 'conexion' | 'no-encontrado' | 'servidor';

export class ApiError extends Error {
  constructor(
    mensaje: string,
    readonly tipo: TipoErrorApi,
    readonly status?: number,
  ) {
    super(mensaje);
  }
}

export interface EstadoConexion {
  conectado: boolean;
  ultimoExito: number | null;
}

let estado: EstadoConexion = { conectado: true, ultimoExito: null };
const oyentes = new Set<() => void>();

function publicar(conectado: boolean) {
  const siguiente: EstadoConexion = { conectado, ultimoExito: conectado ? Date.now() : estado.ultimoExito };
  if (siguiente.conectado === estado.conectado && !conectado) return;
  estado = siguiente;
  oyentes.forEach((f) => f());
}

export const conexion = {
  obtener: () => estado,
  suscribir: (f: () => void) => {
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  },
};

export async function getJson<T>(ruta: string, signal?: AbortSignal): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}${ruta}`, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    publicar(false);
    throw new ApiError('No se pudo conectar con el servidor.', 'conexion');
  }

  if (r.status >= 500) {
    // El proxy de desarrollo responde 5xx cuando la API está apagada.
    publicar(false);
    throw new ApiError(`El servidor no respondió correctamente (HTTP ${r.status}).`, 'servidor', r.status);
  }
  publicar(true);
  if (r.status === 404) throw new ApiError('No encontrado.', 'no-encontrado', 404);
  if (!r.ok) throw new ApiError(`Error al consultar el servidor (HTTP ${r.status}).`, 'servidor', r.status);
  return r.json() as Promise<T>;
}

export const urlApi = (ruta: string) => `${BASE}${ruta}`;
