import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from './usuario.entity';

export const CLAVE_PUBLICO = 'identidad:publico';
export const CLAVE_ROLES = 'identidad:roles';

/** La ruta no requiere sesión (login, endpoint del agente ScanGP protegido por API key). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Solo estos roles pueden usar la ruta. Sin el decorador, cualquier usuario con sesión. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

export interface UsuarioSesion {
  id: string;
  nombreUsuario: string;
  rol: Rol;
  debeCambiarPassword: boolean;
}

export type RequestConSesion = Request & { usuario?: UsuarioSesion };

/** Usuario autenticado de la petición. */
export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<RequestConSesion>().usuario,
);

/** Quién hace la operación (usuario de la sesión + IP), para auditoría e historial. */
export const ActorActual = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<RequestConSesion>();
  return { id: req.usuario?.id ?? null, nombreUsuario: req.usuario?.nombreUsuario ?? null, ip: ipCliente(req) };
});

/** IP del cliente sin el prefijo IPv4-mapeado. */
export function ipCliente(req: Request): string | null {
  return req.ip?.replace('::ffff:', '') ?? null;
}
