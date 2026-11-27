import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ColEnum, ColFecha, ColTexto } from '../common/columnas';
import { EntidadBase, EntidadConEstado } from '../common/entidad-base';
import { Ubicacion } from '../organizacion/organizacion.entities';

/**
 * Repuesto o consumible SIN número de serie que se controla por cantidad (tóner, cables, pasta térmica).
 * Los repuestos CON serie son componentes con situación EN_ALMACEN.
 */
@Entity({ name: 'articulo' })
export class Articulo extends EntidadConEstado {
  @Index('UQ_articulo_nombre', { unique: true })
  @ColTexto(160)
  nombre: string;

  @Column({ type: 'nvarchar', length: 20 })
  unidad: string;

  /** Aviso cuando la existencia total baja de este número. */
  @Column({ name: 'stock_minimo', type: 'int', default: 0 })
  stockMinimo: number;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

@Entity({ name: 'existencia' })
@Index('UQ_existencia', ['articuloId', 'ubicacionId'], { unique: true })
export class Existencia extends EntidadConEstado {
  @Column({ name: 'articulo_id', type: 'uniqueidentifier' })
  articuloId: string;

  @ManyToOne(() => Articulo)
  @JoinColumn({ name: 'articulo_id' })
  articulo?: Articulo;

  @Column({ name: 'ubicacion_id', type: 'uniqueidentifier' })
  ubicacionId: string;

  @ManyToOne(() => Ubicacion)
  @JoinColumn({ name: 'ubicacion_id' })
  ubicacion?: Ubicacion;

  @Column({ type: 'int' })
  cantidad: number;
}

export const TIPOS_MOVIMIENTO_ALMACEN = ['ENTRADA', 'SALIDA', 'AJUSTE'] as const;
export type TipoMovimientoAlmacen = (typeof TIPOS_MOVIMIENTO_ALMACEN)[number];

/** Kardex inmutable de artículos. */
@Entity({ name: 'movimiento_almacen' })
@Index('IX_movimiento_almacen', ['articuloId', 'fecha'])
export class MovimientoAlmacen extends EntidadBase {
  @Column({ name: 'articulo_id', type: 'uniqueidentifier' })
  articuloId: string;

  @Column({ name: 'ubicacion_id', type: 'uniqueidentifier' })
  ubicacionId: string;

  @ColEnum(TIPOS_MOVIMIENTO_ALMACEN)
  tipo: TipoMovimientoAlmacen;

  /** Positiva en entradas, negativa en salidas; en ajustes, la diferencia aplicada. */
  @Column({ type: 'int' })
  cantidad: number;

  @Column({ name: 'saldo', type: 'int' })
  saldo: number;

  @ColFecha('fecha')
  fecha: Date;

  @ColTexto(500, { nullable: true })
  motivo: string | null;

  @Column({ name: 'orden_mantenimiento_id', type: 'uniqueidentifier', nullable: true })
  ordenMantenimientoId: string | null;

  @Column({ name: 'activo_id', type: 'uniqueidentifier', nullable: true })
  activoId: string | null;

  @Column({ name: 'usuario_nombre', type: 'nvarchar', length: 64, nullable: true })
  usuarioNombre: string | null;
}
