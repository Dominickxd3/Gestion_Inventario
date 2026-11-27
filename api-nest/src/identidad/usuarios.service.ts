import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Actor, AuditoriaService } from '../auditoria/auditoria.service';
import { mismoId } from '../common/dominio';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto';
import { hashPassword, passwordTemporal } from './password';
import { Usuario, vistaUsuario } from './usuario.entity';

/** Administración de usuarios de la plataforma. Cada operación es una transacción con su auditoría. */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar() {
    const lista = await this.db.getRepository(Usuario).find({ order: { nombre: 'ASC' } });
    return lista.map(vistaUsuario);
  }

  /** Crea el usuario con una contraseña temporal que se devuelve una sola vez. */
  async crear(actor: Actor, dto: CrearUsuarioDto) {
    const temporal = passwordTemporal();
    const hash = await hashPassword(temporal);
    return this.db.transaction(async (em) => {
      if (await em.existsBy(Usuario, { nombreUsuario: dto.nombreUsuario })) {
        throw new ConflictException(`Ya existe el usuario "${dto.nombreUsuario}"`);
      }
      const u = em.create(Usuario, {
        ...dto,
        correo: dto.correo || null,
        hashPassword: hash,
        activo: true,
        debeCambiarPassword: true,
        credencialesCambiadasEn: new Date(),
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoAcceso: null,
        creadoPor: actor.id,
      });
      await em.save(u);
      await this.auditoria.registrar({ actor, accion: 'usuarios.crear', entidad: 'usuario', entidadId: u.id, despues: vistaUsuario(u) }, em);
      return { usuario: vistaUsuario(u), passwordTemporal: temporal };
    });
  }

  async actualizar(actor: Actor & { id: string }, id: string, dto: ActualizarUsuarioDto) {
    return this.db.transaction(async (em) => {
      const u = await this.obtener(em, id);
      const antes = vistaUsuario(u);

      const pierdeAdmin = u.rol === 'ADMIN' && ((dto.rol && dto.rol !== 'ADMIN') || dto.activo === false);
      if (pierdeAdmin && mismoId(u.id, actor.id)) {
        throw new BadRequestException('No puedes quitarte el rol de administrador ni desactivarte a ti mismo');
      }
      if (pierdeAdmin && (await this.adminsActivos(em)) <= 1) {
        throw new BadRequestException('Debe quedar al menos un administrador activo');
      }

      if (dto.nombre !== undefined) u.nombre = dto.nombre;
      if (dto.correo !== undefined) u.correo = dto.correo || null;
      if (dto.rol !== undefined) u.rol = dto.rol;
      if (dto.activo !== undefined) u.activo = dto.activo;
      await em.save(u);

      await this.auditoria.registrar(
        { actor, accion: 'usuarios.actualizar', entidad: 'usuario', entidadId: u.id, antes, despues: vistaUsuario(u) },
        em,
      );
      return vistaUsuario(u);
    });
  }

  /** Genera una contraseña temporal nueva e invalida las sesiones abiertas del usuario. */
  async restablecerPassword(actor: Actor, id: string) {
    const temporal = passwordTemporal();
    const hash = await hashPassword(temporal);
    return this.db.transaction(async (em) => {
      const u = await this.obtener(em, id);
      await em.update(Usuario, u.id, {
        hashPassword: hash,
        debeCambiarPassword: true,
        credencialesCambiadasEn: new Date(),
        intentosFallidos: 0,
        bloqueadoHasta: null,
      });
      await this.auditoria.registrar({ actor, accion: 'usuarios.restablecer-password', entidad: 'usuario', entidadId: u.id }, em);
      return { passwordTemporal: temporal };
    });
  }

  private async obtener(em: EntityManager, id: string) {
    const u = await em.findOneBy(Usuario, { id });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  private adminsActivos(em: EntityManager) {
    return em.countBy(Usuario, { rol: 'ADMIN', activo: true });
  }
}
