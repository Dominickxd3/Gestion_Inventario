import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Activo } from '../activos/activo.entity';
import { ActivosService } from '../activos/activos.service';
import { Actor, enTransaccion, etiqueta, limpio, obtenerOFallar, regla } from '../common/dominio';
import { Area, Persona } from '../organizacion/organizacion.entities';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { Asignacion, TIPOS_ASIGNACION, type TipoAsignacion } from './asignacion.entity';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class AsignarDto {
  @IsUUID() activoId: string;
  @IsIn(TIPOS_ASIGNACION) tipo: TipoAsignacion;
  @IsOptional() @IsUUID() personaId?: string | null;
  @IsOptional() @IsUUID() areaId?: string | null;
  @IsOptional() @IsDateString() hastaPrevisto?: string | null;
  @IsOptional() @IsUUID() ordenMantenimientoId?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observaciones?: string | null;
}

export class DevolverDto {
  /** A dónde vuelve el activo (almacén de TI, por ejemplo). */
  @IsOptional() @IsUUID() ubicacionId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) motivo?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class TransferirDto {
  @IsOptional() @IsUUID() personaId?: string | null;
  @IsOptional() @IsUUID() areaId?: string | null;
  @IsOptional() @IsIn(TIPOS_ASIGNACION) tipo?: TipoAsignacion;
  @IsOptional() @IsDateString() hastaPrevisto?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export interface FiltroAsignaciones {
  vigentes?: boolean;
  vencidas?: boolean;
  personaId?: string;
  activoId?: string;
  tipo?: string;
}

@Injectable()
export class AsignacionesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly trazabilidad: TrazabilidadService,
    private readonly activos: ActivosService,
  ) {}

  async listar(f: FiltroAsignaciones) {
    const q = this.db
      .getRepository(Asignacion)
      .createQueryBuilder('x')
      .leftJoinAndSelect('x.activo', 'activo')
      .leftJoinAndSelect('activo.tipoActivo', 'tipoActivo')
      .leftJoinAndSelect('x.persona', 'persona')
      .leftJoinAndSelect('x.area', 'area')
      .orderBy('x.desde', 'DESC');
    if (f.vigentes || f.vencidas) q.andWhere('x.hasta IS NULL');
    if (f.vencidas) q.andWhere('x.hastaPrevisto < CAST(SYSUTCDATETIME() AS date)');
    if (f.personaId) q.andWhere('x.personaId = :personaId', { personaId: f.personaId });
    if (f.activoId) q.andWhere('x.activoId = :activoId', { activoId: f.activoId });
    if (f.tipo) q.andWhere('x.tipo = :tipo', { tipo: f.tipo });
    return q.take(500).getMany();
  }

  async asignar(actor: Actor, dto: AsignarDto, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      regla(!!dto.personaId || !!dto.areaId, 'Indica la persona o el área que recibe el activo');
      regla(dto.tipo === 'PERMANENTE' || !!dto.hastaPrevisto, 'Indica la fecha prevista de devolución');
      const a = await obtenerOFallar(em, Activo, { id: dto.activoId }, 'Activo');
      regla(a.cicloVida === 'EN_SERVICIO', `No se puede asignar un activo ${etiqueta(a.cicloVida).toLowerCase()}`);
      regla(!(await em.existsBy(Asignacion, { activoId: a.id, hasta: IsNull() })), 'El activo ya tiene una asignación vigente: usa "Transferir"');
      const [{ abiertas }] = await em.query(
        `SELECT COUNT(*) AS abiertas FROM [itam].[orden_mantenimiento] WHERE activo_id = @0 AND estado IN ('ABIERTA', 'EN_CURSO', 'EN_ESPERA')`,
        [a.id],
      );
      regla(abiertas === 0, 'El activo está en mantenimiento');
      const destinatario = await this.destinatario(em, dto.personaId, dto.areaId);

      const x = em.create(Asignacion, {
        activoId: a.id,
        tipo: dto.tipo,
        personaId: dto.personaId ?? null,
        areaId: dto.personaId ? null : (dto.areaId ?? null),
        desde: new Date(),
        hastaPrevisto: dto.hastaPrevisto ?? null,
        hasta: null,
        motivoCierre: null,
        ordenMantenimientoId: dto.ordenMantenimientoId ?? null,
        observaciones: limpio(dto.observaciones),
        creadoPor: actor.id,
      });
      await em.save(x);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: a.id,
        tipo: 'ASIGNACION',
        motivo: dto.tipo,
        descripcion: `${etiqueta(dto.tipo)} a ${destinatario}${dto.hastaPrevisto ? ` hasta el ${dto.hastaPrevisto}` : ''}`,
        observacion: dto.observaciones,
        referencia: { tipo: dto.ordenMantenimientoId ? 'ORDEN' : 'ASIGNACION', id: dto.ordenMantenimientoId ?? x.id },
      });
      return x;
    });
  }

  async devolver(actor: Actor, id: string, dto: DevolverDto, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const x = await obtenerOFallar(em, Asignacion, { id }, 'Asignación', ['persona', 'area']);
      regla(!x.hasta, 'La asignación ya está cerrada');
      x.hasta = new Date();
      x.motivoCierre = dto.motivo ?? 'DEVOLUCION';
      const quien = x.persona?.nombre ?? x.area?.nombre ?? '';
      x.persona = undefined;
      x.area = undefined;
      await em.save(x);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: x.activoId,
        tipo: 'DEVOLUCION',
        descripcion: `Devuelto por ${quien}`,
        observacion: dto.observacion,
        referencia: { tipo: 'ASIGNACION', id: x.id },
      });
      if (dto.ubicacionId) await this.activos.transferirUbicacion(actor, x.activoId, dto.ubicacionId, 'Ubicación al devolverlo', em);
      return x;
    });
  }

  /** Pasa el activo a otra persona o área: cierra la asignación vigente y abre otra, en una transacción. */
  async transferir(actor: Actor, id: string, dto: TransferirDto) {
    return this.db.transaction(async (em) => {
      const x = await obtenerOFallar(em, Asignacion, { id }, 'Asignación', ['persona', 'area']);
      regla(!x.hasta, 'La asignación ya está cerrada');
      const anterior = x.persona?.nombre ?? x.area?.nombre ?? '';
      const destinatario = await this.destinatario(em, dto.personaId, dto.areaId);
      x.hasta = new Date();
      x.motivoCierre = 'TRANSFERENCIA';
      x.persona = undefined;
      x.area = undefined;
      await em.save(x);
      const tipo = dto.tipo ?? x.tipo;
      regla(tipo === 'PERMANENTE' || !!(dto.hastaPrevisto ?? x.hastaPrevisto), 'Indica la fecha prevista de devolución');
      const nueva = em.create(Asignacion, {
        activoId: x.activoId,
        tipo,
        personaId: dto.personaId ?? null,
        areaId: dto.personaId ? null : (dto.areaId ?? null),
        desde: new Date(),
        hastaPrevisto: tipo === 'PERMANENTE' ? null : (dto.hastaPrevisto ?? x.hastaPrevisto),
        hasta: null,
        motivoCierre: null,
        ordenMantenimientoId: x.ordenMantenimientoId,
        observaciones: limpio(dto.observacion),
        creadoPor: actor.id,
      });
      await em.save(nueva);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: x.activoId,
        tipo: 'TRANSFERENCIA',
        descripcion: `Transferido de ${anterior} a ${destinatario}`,
        observacion: dto.observacion,
        referencia: { tipo: 'ASIGNACION', id: nueva.id },
      });
      return nueva;
    });
  }

  private async destinatario(em: EntityManager, personaId?: string | null, areaId?: string | null) {
    if (personaId) {
      const p = await obtenerOFallar(em, Persona, { id: personaId }, 'Persona');
      regla(p.activo, `${p.nombre} está inactivo`);
      return p.nombre;
    }
    regla(!!areaId, 'Indica la persona o el área que recibe el activo');
    return `el área ${(await obtenerOFallar(em, Area, { id: areaId! }, 'Área')).nombre}`;
  }
}
