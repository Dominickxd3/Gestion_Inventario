/** Cliente HTTP único: la única capa que usa fetch. Añade el token de sesión y publica el estado de conexión. */

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const CLAVE_TOKEN = 'scangp.token';

export type TipoErrorApi = 'conexion' | 'no-autenticado' | 'prohibido' | 'no-encontrado' | 'validacion' | 'servidor';

export class ApiError extends Error {
  constructor(
    mensaje: string,
    readonly tipo: TipoErrorApi,
    readonly status?: number,
  ) {
    super(mensaje);
  }
}

// ---------------------------------------------------------------- Estado de conexión

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

// ---------------------------------------------------------------- Sesión

/**
 * El token vive en localStorage para que la sesión sirva en todas las pestañas (enlaces "abrir en pestaña nueva").
 * Caduca en el servidor (JWT_EXPIRES_IN) y se invalida al cambiar la contraseña o desactivar al usuario.
 */
export const tokenSesion = {
  obtener(): string | null {
    try {
      return localStorage.getItem(CLAVE_TOKEN);
    } catch {
      return null;
    }
  },
  guardar(t: string | null) {
    try {
      if (t) localStorage.setItem(CLAVE_TOKEN, t);
      else localStorage.removeItem(CLAVE_TOKEN);
    } catch {
      /* almacenamiento no disponible: la sesión dura lo que la pestaña */
    }
  },
};

const oyentesSesionInvalida = new Set<() => void>();
/** Avisa cuando el servidor rechaza el token (expiró, se cambió la contraseña o se desactivó el usuario). */
export function alInvalidarSesion(f: () => void) {
  oyentesSesionInvalida.add(f);
  return () => {
    oyentesSesionInvalida.delete(f);
  };
}

// ---------------------------------------------------------------- Peticiones

async function mensajeDe(r: Response): Promise<string | null> {
  try {
    const cuerpo = (await r.json()) as { message?: string | string[] };
    if (Array.isArray(cuerpo.message)) return cuerpo.message.join('. ');
    return cuerpo.message ?? null;
  } catch {
    return null;
  }
}

async function peticion(metodo: string, ruta: string, cuerpo?: unknown, signal?: AbortSignal): Promise<Response> {
  const token = tokenSesion.obtener();
  const cabeceras: Record<string, string> = {};
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const esArchivo = cuerpo instanceof FormData;
  if (cuerpo !== undefined && !esArchivo) cabeceras['Content-Type'] = 'application/json';

  let r: Response;
  try {
    r = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : esArchivo ? (cuerpo as FormData) : JSON.stringify(cuerpo),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    publicar(false);
    throw new ApiError('No se pudo conectar con el servidor.', 'conexion');
  }

  if (r.status >= 500) {
    // El proxy de desarrollo responde 5xx cuando la API está apagada.
    publicar(false);
    throw new ApiError((await mensajeDe(r)) ?? `El servidor no respondió correctamente (HTTP ${r.status}).`, 'servidor', r.status);
  }
  publicar(true);
  if (r.ok) return r;

  const mensaje = await mensajeDe(r);
  if (r.status === 401) {
    if (token && !ruta.startsWith('/auth/login')) {
      tokenSesion.guardar(null);
      oyentesSesionInvalida.forEach((f) => f());
    }
    throw new ApiError(mensaje ?? 'Inicia sesión para continuar.', 'no-autenticado', 401);
  }
  if (r.status === 403) throw new ApiError(mensaje ?? 'No tienes permiso para esta operación.', 'prohibido', 403);
  if (r.status === 404) throw new ApiError(mensaje ?? 'No encontrado.', 'no-encontrado', 404);
  if (r.status === 400 || r.status === 409) throw new ApiError(mensaje ?? 'Datos no válidos.', 'validacion', r.status);
  throw new ApiError(mensaje ?? `Error al consultar el servidor (HTTP ${r.status}).`, 'servidor', r.status);
}

export async function getJson<T>(ruta: string, signal?: AbortSignal): Promise<T> {
  return (await peticion('GET', ruta, undefined, signal)).json() as Promise<T>;
}

export async function enviarJson<T>(metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await peticion(metodo, ruta, cuerpo);
  const texto = await r.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

/** Descarga un archivo protegido (no se puede usar un <a href> porque necesita el token). */
export async function descargarArchivo(ruta: string, nombre: string) {
  const r = await peticion('GET', ruta);
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Sube un archivo (multipart/form-data). */
export async function subirArchivo<T>(ruta: string, datos: FormData): Promise<T> {
  return (await peticion('POST', ruta, datos)).json() as Promise<T>;
}
