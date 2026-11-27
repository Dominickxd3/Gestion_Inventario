export type Rol = 'ADMIN' | 'TECNICO' | 'CONSULTA';

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  TECNICO: 'Técnico',
  CONSULTA: 'Consulta',
};

export const DESCRIPCION_ROL: Record<Rol, string> = {
  ADMIN: 'Todo, incluida la gestión de usuarios y la auditoría',
  TECNICO: 'Consultar y operar el inventario; descargar ScanGP',
  CONSULTA: 'Solo consultar',
};

export interface UsuarioPlataforma {
  id: string;
  nombreUsuario: string;
  nombre: string;
  correo: string | null;
  rol: Rol;
  activo: boolean;
  debeCambiarPassword: boolean;
  ultimoAcceso: string | null;
  creadoEn: string;
}

export interface RespuestaSesion {
  token: string;
  usuario: UsuarioPlataforma;
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  ip: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  resultado: 'OK' | 'ERROR' | 'DENEGADO';
  antes: unknown;
  despues: unknown;
  detalle: string | null;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}
