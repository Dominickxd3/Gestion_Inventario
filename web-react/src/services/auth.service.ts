import { enviarJson, getJson } from './http';
import type { RespuestaSesion, Rol, UsuarioPlataforma } from '../types/identidad';

export const authService = {
  login: (usuario: string, password: string) => enviarJson<RespuestaSesion>('POST', '/auth/login', { usuario, password }),
  yo: (signal?: AbortSignal) => getJson<UsuarioPlataforma>('/auth/yo', signal),
  cambiarPassword: (actual: string, nueva: string) =>
    enviarJson<RespuestaSesion>('POST', '/auth/cambiar-password', { actual, nueva }),
};

export const usuariosService = {
  listar: (signal?: AbortSignal) => getJson<UsuarioPlataforma[]>('/usuarios', signal),
  crear: (d: { nombreUsuario: string; nombre: string; correo?: string | null; rol: Rol }) =>
    enviarJson<{ usuario: UsuarioPlataforma; passwordTemporal: string }>('POST', '/usuarios', d),
  actualizar: (id: string, d: Partial<Pick<UsuarioPlataforma, 'nombre' | 'correo' | 'rol' | 'activo'>>) =>
    enviarJson<UsuarioPlataforma>('PATCH', `/usuarios/${encodeURIComponent(id)}`, d),
  restablecerPassword: (id: string) =>
    enviarJson<{ passwordTemporal: string }>('POST', `/usuarios/${encodeURIComponent(id)}/restablecer-password`),
};
