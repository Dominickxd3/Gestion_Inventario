import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DataSource, IsNull } from 'typeorm';
import { Activo, ESTADOS_TECNICOS, type EstadoTecnico } from '../activos/activo.entity';
import { ActivosService } from '../activos/activos.service';
import { Asignacion } from '../asignaciones/asignacion.entity';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { Actor, etiqueta, limpio, mismoId, obtenerOFallar, regla, siguienteCodigo } from '../common/dominio';
import { Instalacion } from '../componentes/componentes.entities';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { MOTIVOS, type Motivo, OrdenMantenimiento, TIPOS_MANTENIMIENTO, type TipoMantenimiento } from './orden-mantenimiento.entity';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
const ABIERTAS = ['ABIERTA', 'EN_CURSO', 'EN_ESPERA'];

export class AbrirOrdenDto {
  @IsUUID() activoId: string;
  @IsIn(TIPOS_MANTENIMIENTO) tipo: TipoMantenimiento;
  @IsIn(MOTIVOS) motivo: Motivo;
  @Transform(recortar) @IsString() @MinLength(3, { message: 'Describe la falla o el trabajo a realizar' }) @MaxLength(2000) fallaReportada: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(128) tecnico?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(160) proveedorExterno?: string | null;
  /** Taller o proveedor donde queda el equipo. */
  @IsOptional() @IsUUID() ubicacionTallerId?: string | null;
  /** Estado técnico con el que entra (p. ej. AVERIADO). */
  @IsOptional() @IsIn(ESTADOS_TECNICOS) estadoTecnico?: EstadoTecnico;
  /** Equipo que se presta al trabajador mientras dura el mantenimiento. */
  @IsOptional() @IsUUID() activoTemporalId?: string | null;
  @IsOptional() @IsDateString() hastaPrevistoTemporal?: string | null;
}

export class ActualizarOrdenDto {
  @IsOptional() @IsIn(['ABIERTA', 'EN_CURSO', 'EN_ESPERA']) estado?: 'ABIERTA' | 'EN_CURSO' | 'EN_ESPERA';
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(2000) diagnostico?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(2000) solucion?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(128) tecnico?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(160) proveedorExterno?: string | null;
  @IsOptional() @IsNumberString() costo?: string | null;
}

export class CerrarOrdenDto {
  @IsIn(ESTADOS_TECNICOS) resultado: EstadoTecnico;
  @Transform(recortar) @IsString() @MinLength(3, { message: 'Describe la solución aplicada' }) @MaxLength(2000) solucion: string;
  @IsOptional() @IsNumberString() costo?: string | null;
  /** Dónde queda el equipo; por defecto, donde estaba antes de entrar al taller. */
  @IsOptional() @IsUUID() ubicacionId?: string | null;
  @IsOptional() @IsBoolean() devolverTemporal?: boolean;
  /** Si es irreparable: devolver la asignación y dar de baja el activo. */
  @IsOptional() @IsBoolean() darDeBaja?: boolean;
}

export class CancelarOrdenDto {
  @Transform(recortar) @IsString() @MinLength(3) @MaxLength(1000) observacion: string;
}

@Injectable()
export class MantenimientoService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly trazabilidad: TrazabilidadService,
    private readonly activos: ActivosService,
    private readonly asignaciones: AsignacionesService,
  ) {}

  listar(f: { estado?: string; activoId?: string; abiertas?: boolean }) {
    const q = this.db
      .getRepository(OrdenMantenimiento)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.activo', 'activo')
      .leftJoinAndSelect('activo.tipoActivo', 'tipoActivo')
      .orderBy('o.fechaApertura', 'DESC');
    if (f.abiertas) q.andWhere('o.estado IN (:...abiertas)', { abiertas: ABIERTAS });
    if (f.estado) q.andWhere('o.estado = :estado', { estado: f.estado });
    if (f.activoId) q.andWhere('o.activoId = :activoId', { activoId: f.activoId });
    return q.take(500).getMany();
  }

  async obtener(id: string) {
    const orden = await this.db.getRepository(OrdenMantenimiento).findOne({ where: { id }, relations: { activo: { tipoActivo: true } } });
    regla(!!orden, 'Orden no encontrada');
    const [temporales, componentes] = await Promise.all([
      this.db.getRepository(Asignacion).find({ where: { ordenMantenimientoId: id }, relations: { activo: true, persona: true } }),
      this.db.getRepository(Instalacion).find({ where: { ordenMantenimientoId: id }, relations: { componente: { tipoComponente: true } } }),
    ]);
    return { ...orden!, temporales, componentes };
  }

  async abrir(actor: Actor, dto: AbrirOrdenDto) {
    return this.db.transaction(async (em) => {
      const a = await obtenerOFallar(em, Activo, { id: dto.activoId }, 'Activo');
      regla(a.cicloVida !== 'DADO_DE_BAJA', 'El activo está dado de baja');
      const orden = em.create(OrdenMantenimiento, {
        codigo: await siguienteCodigo(em, 'orden'),
        activoId: a.id,
        tipo: dto.tipo,
        motivo: dto.motivo,
        estado: 'ABIERTA',
        fallaReportada: dto.fallaReportada,
        diagnostico: null,
        solucion: null,
        tecnico: limpio(dto.tecnico) ?? actor.nombreUsuario,
        proveedorExterno: limpio(dto.proveedorExterno),
        fechaApertura: new Date(),
        fechaCierre: null,
        costo: null,
        resultado: null,
        ubicacionAnteriorId: dto.ubicacionTallerId ? a.ubicacionId : null,
        creadoPor: actor.id,
      });
      await em.save(orden);
      const ref = { tipo: 'ORDEN', id: orden.id };
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: a.id,
        tipo: 'MANTENIMIENTO_APERTURA',
        motivo: dto.motivo,
        descripcion: `Ingresa a mantenimiento ${etiqueta(dto.tipo).toLowerCase()} ${orden.codigo} (${etiqueta(dto.motivo)})`,
        observacion: dto.fallaReportada,
        referencia: ref,
      });
      if (dto.estadoTecnico) await this.activos.cambiarEstadoTecnico(actor, a.id, { estadoTecnico: dto.estadoTecnico }, em, ref);
      if (dto.ubicacionTallerId) await this.activos.transferirUbicacion(actor, a.id, dto.ubicacionTallerId, `Enviado al taller (${orden.codigo})`, em, ref);

      if (dto.activoTemporalId) {
        const principal = await em.findOneBy(Asignacion, { activoId: a.id, hasta: IsNull() });
        regla(!!principal?.personaId, 'El equipo no está asignado a una persona: no hay a quién prestar un equipo temporal');
        regla(!mismoId(dto.activoTemporalId, a.id), 'El equipo temporal debe ser otro');
        const hasta = dto.hastaPrevistoTemporal ?? new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
        await this.asignaciones.asignar(
          actor,
          {
            activoId: dto.activoTemporalId,
            tipo: 'TEMPORAL_REEMPLAZO',
            personaId: principal!.personaId,
            hastaPrevisto: hasta,
            ordenMantenimientoId: orden.id,
            observaciones: `Reemplazo de ${a.codigoPatrimonial} mientras está en mantenimiento (${orden.codigo})`,
          },
          em,
        );
      }
      return orden;
    });
  }

  async actualizar(actor: Actor, id: string, dto: ActualizarOrdenDto) {
    return this.db.transaction(async (em) => {
      const o = await obtenerOFallar(em, OrdenMantenimiento, { id }, 'Orden');
      regla(ABIERTAS.includes(o.estado), 'La orden ya está cerrada');
      const estadoAnterior = o.estado;
      for (const [k, v] of Object.entries(dto)) if (v !== undefined) (o as unknown as Record<string, unknown>)[k] = v;
      await em.save(o);
      if (dto.estado && dto.estado !== estadoAnterior) {
        await this.trazabilidad.registrar(em, actor, {
          entidad: 'ACTIVO',
          entidadId: o.activoId,
          tipo: 'MANTENIMIENTO_ESTADO',
          descripcion: `${o.codigo}: ${etiqueta(estadoAnterior)} → ${etiqueta(dto.estado)}`,
          observacion: dto.diagnostico,
          referencia: { tipo: 'ORDEN', id: o.id },
        });
      }
      return o;
    });
  }

  async cerrar(actor: Actor, id: string, dto: CerrarOrdenDto) {
    return this.db.transaction(async (em) => {
      const o = await obtenerOFallar(em, OrdenMantenimiento, { id }, 'Orden');
      regla(ABIERTAS.includes(o.estado), 'La orden ya está cerrada');
      regla(!dto.darDeBaja || dto.resultado === 'IRREPARABLE', 'Solo se da de baja un equipo irreparable');
      const ref = { tipo: 'ORDEN', id: o.id };

      o.estado = 'CERRADA';
      o.fechaCierre = new Date();
      o.resultado = dto.resultado;
      o.solucion = dto.solucion;
      if (dto.costo !== undefined) o.costo = dto.costo;
      await em.save(o);

      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: o.activoId,
        tipo: 'MANTENIMIENTO_CIERRE',
        descripcion: `Sale de mantenimiento ${o.codigo}: ${etiqueta(dto.resultado)}`,
        observacion: dto.solucion,
        referencia: ref,
      });
      await this.activos.cambiarEstadoTecnico(actor, o.activoId, { estadoTecnico: dto.resultado }, em, ref);

      const destino = dto.ubicacionId ?? o.ubicacionAnteriorId;
      if (destino) await this.activos.transferirUbicacion(actor, o.activoId, destino, `Regresa del taller (${o.codigo})`, em, ref);

      if (dto.devolverTemporal !== false) await this.devolverTemporales(actor, o.id, em);

      if (dto.darDeBaja) {
        const principal = await em.findOneBy(Asignacion, { activoId: o.activoId, hasta: IsNull() });
        if (principal) await this.asignaciones.devolver(actor, principal.id, { motivo: 'BAJA', observacion: `Equipo irreparable (${o.codigo})` }, em);
        await this.activos.darDeBaja(actor, o.activoId, { motivo: o.motivo, observacion: `Irreparable según ${o.codigo}: ${dto.solucion}` }, em);
      }
      return o;
    });
  }

  async cancelar(actor: Actor, id: string, dto: CancelarOrdenDto) {
    return this.db.transaction(async (em) => {
      const o = await obtenerOFallar(em, OrdenMantenimiento, { id }, 'Orden');
      regla(ABIERTAS.includes(o.estado), 'La orden ya está cerrada');
      o.estado = 'CANCELADA';
      o.fechaCierre = new Date();
      await em.save(o);
      const ref = { tipo: 'ORDEN', id: o.id };
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO', entidadId: o.activoId, tipo: 'MANTENIMIENTO_CANCELADO',
        descripcion: `Orden ${o.codigo} cancelada`, observacion: dto.observacion, referencia: ref,
      });
      if (o.ubicacionAnteriorId) await this.activos.transferirUbicacion(actor, o.activoId, o.ubicacionAnteriorId, `Orden ${o.codigo} cancelada`, em, ref);
      await this.devolverTemporales(actor, o.id, em);
      return o;
    });
  }

  private async devolverTemporales(actor: Actor, ordenId: string, em: Parameters<AsignacionesService['devolver']>[3]) {
    const temporales = await em!.findBy(Asignacion, { ordenMantenimientoId: ordenId, tipo: 'TEMPORAL_REEMPLAZO', hasta: IsNull() });
    for (const t of temporales) {
      await this.asignaciones.devolver(actor, t.id, { motivo: 'FIN_REEMPLAZO', observacion: 'El equipo principal salió de mantenimiento' }, em);
    }
  }
}
