import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ColEnum, ColFecha, ColTexto } from '../common/columnas';
import { EntidadBase } from '../common/entidad-base';
import { Activo } from '../activos/activo.entity';
import { Area, Persona } from '../organizacion/organizacion.entities';

export const TIPOS_ASIGNACION = ['PERMANENTE', 'PRESTAMO', 'TEMPORAL_REEMPLAZO'] as const;
export type TipoAsignacion = (typeof TIPOS_ASIGNACION)[number];

/**
 * Entrega de un activo a una persona (o a un área). Una sola asignación vigente por activo (índice filtrado).
 * Devolver o transferir cierra la fila con `hasta`; nunca se borra.
 */
@Entity({ name: 'asignacion' })
@Index('UQ_asignacion_vigente', ['activoId'], { unique: true, where: '[hasta] IS NULL' })
@Index('IX_asignacion_persona', ['personaId', 'hasta'])
export class Asignacion extends EntidadBase {
  @Column({ name: 'activo_id', type: 'uniqueidentifier' })
  activoId: string;

  @ManyToOne(() => Activo)
  @JoinColumn({ name: 'activo_id' })
  activo?: Activo;

  @ColEnum(TIPOS_ASIGNACION)
  tipo: TipoAsignacion;

  @Column({ name: 'persona_id', type: 'uniqueidentifier', nullable: true })
  personaId: string | null;

  @ManyToOne(() => Persona)
  @JoinColumn({ name: 'persona_id' })
  persona?: Persona | null;

  @Column({ name: 'area_id', type: 'uniqueidentifier', nullable: true })
  areaId: string | null;

  @ManyToOne(() => Area)
  @JoinColumn({ name: 'area_id' })
  area?: Area | null;

  @ColFecha('desde')
  desde: Date;

  /** Fecha prevista de devolución (préstamos y reemplazos temporales). */
  @Column({ name: 'hasta_previsto', type: 'date', nullable: true })
  hastaPrevisto: string | null;

  @ColFecha('hasta', { nullable: true })
  hasta: Date | null;

  @Column({ name: 'motivo_cierre', type: 'varchar', length: 40, nullable: true })
  motivoCierre: string | null;

  /** Reemplazo temporal ligado a la orden de mantenimiento del equipo principal. */
  @Column({ name: 'orden_mantenimiento_id', type: 'uniqueidentifier', nullable: true })
  ordenMantenimientoId: string | null;

  @ColTexto(1000, { nullable: true })
  observaciones: string | null;
}
