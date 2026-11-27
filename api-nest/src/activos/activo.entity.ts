import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ColEnum, ColFecha, ColJson, ColTexto } from '../common/columnas';
import { EntidadConEstado } from '../common/entidad-base';
import { Modelo, TipoActivo } from '../catalogo/catalogo.entities';
import { Ubicacion } from '../organizacion/organizacion.entities';

/** Ciclo de vida administrativo (separado del estado técnico, la asignación y la ubicación). */
export const CICLOS_VIDA = ['EN_SERVICIO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'] as const;
export type CicloVida = (typeof CICLOS_VIDA)[number];

export const ESTADOS_TECNICOS = ['SIN_EVALUAR', 'OPERATIVO', 'CON_FALLAS', 'AVERIADO', 'IRREPARABLE'] as const;
export type EstadoTecnico = (typeof ESTADOS_TECNICOS)[number];

/** Activo administrativo validado por TI: tiene código patrimonial propio, independiente de lo que detecte ScanGP. */
@Entity({ name: 'activo' })
@Index('IX_activo_estado', ['cicloVida', 'estadoTecnico'])
export class Activo extends EntidadConEstado {
  @Index('UQ_activo_codigo_patrimonial', { unique: true })
  @Column({ name: 'codigo_patrimonial', type: 'varchar', length: 32 })
  codigoPatrimonial: string;

  /** Nombre del equipo (hostname) o descripción corta. */
  @Index('IX_activo_nombre')
  @ColTexto(128)
  nombre: string;

  @Column({ name: 'tipo_activo_id', type: 'uniqueidentifier' })
  tipoActivoId: string;

  @ManyToOne(() => TipoActivo)
  @JoinColumn({ name: 'tipo_activo_id' })
  tipoActivo?: TipoActivo;

  @Column({ name: 'modelo_id', type: 'uniqueidentifier', nullable: true })
  modeloId: string | null;

  @ManyToOne(() => Modelo)
  @JoinColumn({ name: 'modelo_id' })
  modelo?: Modelo | null;

  @Index('IX_activo_numero_serie')
  @Column({ name: 'numero_serie', type: 'nvarchar', length: 80, nullable: true })
  numeroSerie: string | null;

  @Column({ name: 'ubicacion_id', type: 'uniqueidentifier', nullable: true })
  ubicacionId: string | null;

  @ManyToOne(() => Ubicacion)
  @JoinColumn({ name: 'ubicacion_id' })
  ubicacion?: Ubicacion | null;

  @ColEnum(CICLOS_VIDA, { name: 'ciclo_vida', default: 'EN_SERVICIO' })
  cicloVida: CicloVida;

  @ColEnum(ESTADOS_TECNICOS, { name: 'estado_tecnico', default: 'SIN_EVALUAR' })
  estadoTecnico: EstadoTecnico;

  @Column({ name: 'fecha_adquisicion', type: 'date', nullable: true })
  fechaAdquisicion: string | null;

  @ColTexto(160, { nullable: true })
  proveedor: string | null;

  @Column({ name: 'numero_factura', type: 'nvarchar', length: 64, nullable: true })
  numeroFactura: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  costo: string | null;

  /** Especificaciones validadas (CPU, RAM, disco…). Las detectadas viven en el último escaneo. */
  @ColJson()
  especificaciones: object | null;

  @ColTexto(2000, { nullable: true })
  observaciones: string | null;

  @ColFecha('fecha_baja', { nullable: true })
  fechaBaja: Date | null;
}
