import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Actor, AuditoriaService } from '../auditoria/auditoria.service';
import { HASH_FICTICIO, hashPassword, verificarPassword } from './password';
import { Usuario, vistaUsuario } from './usuario.entity';

export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;

const CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Mismo mensaje y tiempo de respuesta si el usuario no existe, está inactivo o la contraseña es incorrecta,
   * para no revelar qué usuarios existen. Bloqueo temporal tras varios intentos fallidos.
   */
  async login(nombreUsuario: string, password: string, ip: string | null) {
    const u = await this.usuarios.findOne({
      where: { nombreUsuario },
      select: { id: true, nombreUsuario: true, hashPassword: true, activo: true, intentosFallidos: true, bloqueadoHasta: true },
    });
    const ok = await verificarPassword(password, u?.hashPassword ?? HASH_FICTICIO);
    const actor: Actor = { id: u?.id ?? null, nombreUsuario, ip };

    if (u?.bloqueadoHasta && u.bloqueadoHasta > new Date()) {
      await this.auditoria.registrar({ actor, accion: 'auth.login', entidad: 'usuario', entidadId: u.id, resultado: 'DENEGADO', detalle: 'Usuario bloqueado temporalmente' });
      throw new UnauthorizedException(`Demasiados intentos fallidos. Vuelve a intentarlo en unos minutos`);
    }

    if (!u || !u.activo || !ok) {
      if (u?.activo) {
        const intentos = u.intentosFallidos + 1;
        const bloquear = intentos >= MAX_INTENTOS;
        await this.usuarios.update(u.id, {
          intentosFallidos: bloquear ? 0 : intentos,
          bloqueadoHasta: bloquear ? new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) : null,
        });
      }
      await this.auditoria.registrar({ actor, accion: 'auth.login', entidad: 'usuario', entidadId: u?.id ?? null, resultado: 'DENEGADO', detalle: !u ? 'Usuario inexistente' : !u.activo ? 'Usuario inactivo' : 'Contraseña incorrecta' });
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    await this.usuarios.update(u.id, { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() });
    await this.auditoria.registrar({ actor, accion: 'auth.login', entidad: 'usuario', entidadId: u.id });

    const completo = await this.usuarios.findOneByOrFail({ id: u.id });
    return { token: await this.jwt.signAsync({ sub: u.id }), usuario: vistaUsuario(completo) };
  }

  async yo(id: string) {
    return vistaUsuario(await this.usuarios.findOneByOrFail({ id }));
  }

  async cambiarPassword(actor: Actor & { id: string }, actual: string, nueva: string) {
    const u = await this.usuarios.findOneOrFail({ where: { id: actor.id }, select: { id: true, hashPassword: true } });
    if (!(await verificarPassword(actual, u.hashPassword))) throw new BadRequestException('La contraseña actual no es correcta');
    if (actual === nueva) throw new BadRequestException('La contraseña nueva debe ser distinta de la actual');

    const hash = await hashPassword(nueva);
    // Redondeado al segundo (precisión de `iat`) para que el token nuevo, emitido en este mismo segundo, sea válido.
    const cambio = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.db.transaction(async (em) => {
      await em.update(Usuario, u.id, { hashPassword: hash, debeCambiarPassword: false, credencialesCambiadasEn: cambio });
      await this.auditoria.registrar({ actor, accion: 'auth.cambiar-password', entidad: 'usuario', entidadId: u.id }, em);
    });
    // Los demás tokens del usuario quedan invalidados; se entrega uno nuevo para esta sesión.
    return { token: await this.jwt.signAsync({ sub: u.id }), usuario: await this.yo(u.id) };
  }
}
