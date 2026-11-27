import { Column, Entity, Index } from 'typeorm';
import { ColEnum, ColFecha, ColJson, ColTexto } from '../common/columnas';
import { EntidadBase } from '../common/entidad-base';

export const ENTIDADES_TRAZABLES = ['ACTIVO', 'COMPONENTE'] as const;
export type EntidadTrazable = (typeof ENTIDADES_TRAZABLES)[number];

/**
 * Historia inmutable de activos y componentes. Cada operación de dominio (alta, asignación, instalación,
 * retiro, mantenimiento, baja…) agrega una fila; nunca se modifica ni se borra (DENY en la base).
 */
@Entity({ name: 'movimiento' })
@Index('IX_movimiento_entidad', ['entidad', 'entidadId', 'fecha'])
export class Movimiento extends EntidadBase {
  @ColEnum(ENTIDADES_TRAZABLES)
  entidad: EntidadTrazable;

  @Column({ name: 'entidad_id', type: 'uniqueidentifier' })
  entidadId: string;

  @ColFecha('fecha')
  fecha: Date;

  /** Verbo: ALTA, EDICION, ASIGNACION, DEVOLUCION, TRANSFERENCIA, INSTALACION, RETIRO, MANTENIMIENTO_APERTURA… */
  @Column({ type: 'varchar', length: 40 })
  tipo: string;

  /** Motivo elegido de la lista (FALLA_TECNICA, PREVENTIVO…) cuando aplica. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  motivo: string | null;

  /** Texto que se muestra en el historial ("Asignado a Ana Pérez"). */
  @ColTexto(500)
  descripcion: string;

  @ColTexto(1000, { nullable: true })
  observacion: string | null;

  @ColJson()
  detalle: object | null;

  /** Otra entidad relacionada (orden de mantenimiento, asignación, discrepancia, activo…). */
  @Column({ name: 'referencia_tipo', type: 'varchar', length: 32, nullable: true })
  referenciaTipo: string | null;

  @Column({ name: 'referencia_id', type: 'uniqueidentifier', nullable: true })
  referenciaId: string | null;

  @Column({ name: 'usuario_nombre', type: 'nvarchar', length: 64, nullable: true })
  usuarioNombre: string | null;
}
