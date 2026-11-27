import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ColEnum, ColFecha, ColTexto } from '../common/columnas';
import { EntidadConEstado } from '../common/entidad-base';
import { Activo, ESTADOS_TECNICOS, type EstadoTecnico } from '../activos/activo.entity';

export const TIPOS_MANTENIMIENTO = ['PREVENTIVO', 'CORRECTIVO'] as const;
export type TipoMantenimiento = (typeof TIPOS_MANTENIMIENTO)[number];

/** Por qué sale el equipo: se usa también como motivo de retiro de componentes. */
export const MOTIVOS = ['FALLA_TECNICA', 'PREVENTIVO', 'GARANTIA', 'ACTUALIZACION', 'DANO_FISICO', 'REASIGNACION', 'OTRO'] as const;
export type Motivo = (typeof MOTIVOS)[number];

export const ESTADOS_ORDEN = ['ABIERTA', 'EN_CURSO', 'EN_ESPERA', 'CERRADA', 'CANCELADA'] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

/** Orden de mantenimiento de un activo. Mientras está abierta, el activo figura "en mantenimiento". */
@Entity({ name: 'orden_mantenimiento' })
@Index('UQ_orden_abierta', ['activoId'], { unique: true, where: "[estado] IN ('ABIERTA', 'EN_CURSO', 'EN_ESPERA')" })
@Index('IX_orden_estado', ['estado', 'fechaApertura'])
export class OrdenMantenimiento extends EntidadConEstado {
  @Index('UQ_orden_codigo', { unique: true })
  @Column({ type: 'varchar', length: 32 })
  codigo: string;

  @Column({ name: 'activo_id', type: 'uniqueidentifier' })
  activoId: string;

  @ManyToOne(() => Activo)
  @JoinColumn({ name: 'activo_id' })
  activo?: Activo;

  @ColEnum(TIPOS_MANTENIMIENTO)
  tipo: TipoMantenimiento;

  @ColEnum(MOTIVOS)
  motivo: Motivo;

  @ColEnum(ESTADOS_ORDEN, { default: 'ABIERTA' })
  estado: EstadoOrden;

  @ColTexto(2000, { name: 'falla_reportada', nullable: true })
  fallaReportada: string | null;

  @ColTexto(2000, { nullable: true })
  diagnostico: string | null;

  @ColTexto(2000, { nullable: true })
  solucion: string | null;

  /** Técnico interno responsable (usuario de la plataforma). */
  @Column({ name: 'tecnico', type: 'nvarchar', length: 128, nullable: true })
  tecnico: string | null;

  @ColTexto(160, { name: 'proveedor_externo', nullable: true })
  proveedorExterno: string | null;

  @ColFecha('fecha_apertura')
  fechaApertura: Date;

  @ColFecha('fecha_cierre', { nullable: true })
  fechaCierre: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  costo: string | null;

  /** Estado técnico del activo al cerrar la orden. */
  @ColEnum(ESTADOS_TECNICOS, { name: 'resultado', nullable: true })
  resultado: EstadoTecnico | null;

  /** Ubicación del activo antes de entrar a mantenimiento, para devolverlo al cerrar. */
  @Column({ name: 'ubicacion_anterior_id', type: 'uniqueidentifier', nullable: true })
  ubicacionAnteriorId: string | null;
}
