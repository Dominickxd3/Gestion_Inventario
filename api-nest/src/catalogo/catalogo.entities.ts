import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ColJson, ColTexto } from '../common/columnas';
import { EntidadBase, EntidadConEstado } from '../common/entidad-base';

/** Clase de activo: Laptop, Impresora, Celular… Los códigos de los tipos base los usa ScanGP. */
@Entity({ name: 'tipo_activo' })
export class TipoActivo extends EntidadBase {
  @Index('UQ_tipo_activo_codigo', { unique: true })
  @Column({ type: 'varchar', length: 32 })
  codigo: string;

  @ColTexto(64)
  nombre: string;

  /** ScanGP puede detectarlo automáticamente (computadoras). */
  @Column({ type: 'bit', default: false })
  detectable: boolean;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

/** Clase de componente físico: RAM, disco, batería, monitor… */
@Entity({ name: 'tipo_componente' })
export class TipoComponente extends EntidadBase {
  @Index('UQ_tipo_componente_codigo', { unique: true })
  @Column({ type: 'varchar', length: 32 })
  codigo: string;

  @ColTexto(64)
  nombre: string;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

@Entity({ name: 'marca' })
export class Marca extends EntidadConEstado {
  @Index('UQ_marca_nombre', { unique: true })
  @ColTexto(80)
  nombre: string;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

@Entity({ name: 'modelo' })
@Index('UQ_modelo_marca_nombre', ['marcaId', 'nombre'], { unique: true })
export class Modelo extends EntidadConEstado {
  @Column({ name: 'marca_id', type: 'uniqueidentifier' })
  marcaId: string;

  @ManyToOne(() => Marca, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'marca_id' })
  marca?: Marca;

  @Column({ name: 'tipo_activo_id', type: 'uniqueidentifier' })
  tipoActivoId: string;

  @ManyToOne(() => TipoActivo, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'tipo_activo_id' })
  tipoActivo?: TipoActivo;

  @ColTexto(120)
  nombre: string;

  /** Especificaciones de catálogo (CPU, RAM de fábrica, pantalla…). */
  @ColJson()
  especificaciones: object | null;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

/** Tipos base que se cargan en la migración. Los códigos coinciden con `equipo.tipo` de ScanGP. */
export const TIPOS_ACTIVO_BASE: [string, string, boolean][] = [
  ['LAPTOP', 'Laptop', true],
  ['ESCRITORIO', 'PC de escritorio', true],
  ['ALL_IN_ONE', 'All-in-One', true],
  ['TABLET', 'Tablet', true],
  ['SERVIDOR', 'Servidor', true],
  ['VIRTUAL', 'Máquina virtual', true],
  ['CELULAR', 'Celular', false],
  ['IMPRESORA', 'Impresora', false],
  ['MONITOR', 'Monitor', false],
  ['PERIFERICO', 'Periférico', false],
  ['RED', 'Equipo de red', false],
  ['OTRO', 'Otro', false],
];

export const TIPOS_COMPONENTE_BASE: [string, string][] = [
  ['RAM', 'Memoria RAM'],
  ['DISCO', 'Disco / almacenamiento'],
  ['BATERIA', 'Batería'],
  ['MONITOR', 'Monitor'],
  ['GPU', 'Tarjeta gráfica'],
  ['CARGADOR', 'Cargador'],
  ['TECLADO', 'Teclado'],
  ['MOUSE', 'Mouse'],
  ['RED', 'Tarjeta de red'],
  ['OTRO', 'Otro'],
];
