import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ColEnum, ColFecha, ColJson, ColTexto } from '../common/columnas';
import { EntidadBase, EntidadConEstado } from '../common/entidad-base';
import { TipoComponente } from '../catalogo/catalogo.entities';
import { ESTADOS_TECNICOS, type EstadoTecnico } from '../activos/activo.entity';
import { Activo } from '../activos/activo.entity';
import { Ubicacion } from '../organizacion/organizacion.entities';

/** Dónde está físicamente el componente. */
export const SITUACIONES_COMPONENTE = ['INSTALADO', 'EN_ALMACEN', 'EN_MANTENIMIENTO', 'DADO_DE_BAJA'] as const;
export type SituacionComponente = (typeof SITUACIONES_COMPONENTE)[number];

/**
 * Componente físico rastreable con identidad propia (código interno). Puede pasar por varios equipos,
 * el almacén y mantenimiento; su historia queda en `instalacion` y `movimiento`.
 */
@Entity({ name: 'componente' })
export class Componente extends EntidadConEstado {
  @Index('UQ_componente_codigo', { unique: true })
  @Column({ type: 'varchar', length: 32 })
  codigo: string;

  @Column({ name: 'tipo_componente_id', type: 'uniqueidentifier' })
  tipoComponenteId: string;

  @ManyToOne(() => TipoComponente)
  @JoinColumn({ name: 'tipo_componente_id' })
  tipoComponente?: TipoComponente;

  @ColTexto(80, { nullable: true })
  marca: string | null;

  @ColTexto(160, { nullable: true })
  modelo: string | null;

  @Index('IX_componente_numero_serie')
  @Column({ name: 'numero_serie', type: 'nvarchar', length: 120, nullable: true })
  numeroSerie: string | null;

  /** Tipo + serie normalizados: lo que ScanGP usa para reconocer el componente. */
  @Index('UQ_componente_huella', { unique: true, where: '[huella] IS NOT NULL' })
  @Column({ type: 'nvarchar', length: 160, nullable: true })
  huella: string | null;

  /** Texto legible: "16 GB", "1 TB", "86 Wh". */
  @Column({ type: 'nvarchar', length: 40, nullable: true })
  capacidad: string | null;

  @ColJson()
  atributos: object | null;

  @ColEnum(SITUACIONES_COMPONENTE, { default: 'EN_ALMACEN' })
  situacion: SituacionComponente;

  @ColEnum(ESTADOS_TECNICOS, { name: 'estado_tecnico', default: 'OPERATIVO' })
  estadoTecnico: EstadoTecnico;

  /** Almacén u otra ubicación cuando no está instalado. */
  @Column({ name: 'ubicacion_id', type: 'uniqueidentifier', nullable: true })
  ubicacionId: string | null;

  @ManyToOne(() => Ubicacion)
  @JoinColumn({ name: 'ubicacion_id' })
  ubicacion?: Ubicacion | null;

  @ColTexto(1000, { nullable: true })
  observaciones: string | null;
}

/**
 * Periodo en que un componente estuvo instalado en un activo. Retirarlo solo rellena `hasta`:
 * la fila nunca se borra, así se puede saber qué tenía cada equipo en cualquier fecha.
 */
@Entity({ name: 'instalacion' })
@Index('UQ_instalacion_vigente', ['componenteId'], { unique: true, where: '[hasta] IS NULL' })
@Index('IX_instalacion_activo', ['activoId', 'hasta'])
export class Instalacion extends EntidadBase {
  @Column({ name: 'componente_id', type: 'uniqueidentifier' })
  componenteId: string;

  @ManyToOne(() => Componente)
  @JoinColumn({ name: 'componente_id' })
  componente?: Componente;

  @Column({ name: 'activo_id', type: 'uniqueidentifier' })
  activoId: string;

  @ManyToOne(() => Activo)
  @JoinColumn({ name: 'activo_id' })
  activo?: Activo;

  @ColFecha('desde')
  desde: Date;

  @ColFecha('hasta', { nullable: true })
  hasta: Date | null;

  @Column({ name: 'motivo_instalacion', type: 'varchar', length: 40, nullable: true })
  motivoInstalacion: string | null;

  @Column({ name: 'motivo_retiro', type: 'varchar', length: 40, nullable: true })
  motivoRetiro: string | null;

  @Column({ name: 'orden_mantenimiento_id', type: 'uniqueidentifier', nullable: true })
  ordenMantenimientoId: string | null;

  /** Primera vez que ScanGP vio el componente en el equipo después de registrarse la instalación. */
  @ColFecha('confirmada_en', { nullable: true })
  confirmadaEn: Date | null;
}
