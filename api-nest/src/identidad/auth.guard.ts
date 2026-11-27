import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CLAVE_PUBLICO, CLAVE_ROLES, RequestConSesion } from './decoradores';
import { Rol, Usuario } from './usuario.entity';

/** Rutas que un usuario con contraseña temporal puede usar antes de cambiarla. */
const PERMITIDAS_CON_PASSWORD_TEMPORAL = new Set(['/api/auth/yo', '/api/auth/cambiar-password']);

export interface PayloadToken {
  sub: string;
  iat: number;
}

/**
 * Guardia global: toda ruta requiere sesión salvo las marcadas con @Publico().
 * Relee el usuario en cada petición para que desactivar a alguien o cambiar su rol tenga efecto inmediato.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) return true;

    const req = ctx.switchToHttp().getRequest<RequestConSesion>();
    const [tipo, token] = (req.header('authorization') ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar');

    let payload: PayloadToken;
    try {
      payload = await this.jwt.verifyAsync<PayloadToken>(token);
    } catch {
      throw new UnauthorizedException('La sesión expiró. Vuelve a iniciar sesión');
    }

    const u = await this.usuarios.findOneBy({ id: payload.sub });
    // iat va en segundos: un token emitido antes del último cambio de contraseña ya no vale.
    if (!u || !u.activo || payload.iat < Math.floor(u.credencialesCambiadasEn.getTime() / 1000)) {
      throw new UnauthorizedException('La sesión ya no es válida. Vuelve a iniciar sesión');
    }
    req.usuario = { id: u.id, nombreUsuario: u.nombreUsuario, rol: u.rol, debeCambiarPassword: u.debeCambiarPassword };

    if (u.debeCambiarPassword && !PERMITIDAS_CON_PASSWORD_TEMPORAL.has(req.path)) {
      throw new ForbiddenException('Debes cambiar tu contraseña temporal');
    }

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, objetivos);
    if (roles && !roles.includes(u.rol)) throw new ForbiddenException('Tu rol no permite esta operación');
    return true;
  }
}
