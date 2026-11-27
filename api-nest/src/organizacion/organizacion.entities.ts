import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ColEnum, ColTexto } from '../common/columnas';
import { EntidadConEstado } from '../common/entidad-base';

@Entity({ name: 'sede' })
export class Sede extends EntidadConEstado {
  @Index('UQ_sede_nombre', { unique: true })
  @ColTexto(120)
  nombre: string;

  @ColTexto(250, { nullable: true })
  direccion: string | null;

  /** Prefijo de red para reconocer la sede por la IP que reporta ScanGP (p. ej. 192.168.1.). */
  @Column({ name: 'prefijo_red', type: 'varchar', length: 45, nullable: true })
  prefijoRed: string | null;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

@Entity({ name: 'area' })
export class Area extends EntidadConEstado {
  @Index('UQ_area_nombre', { unique: true })
  @ColTexto(120)
  nombre: string;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

export const TIPOS_UBICACION = ['PUESTO', 'ALMACEN', 'TALLER', 'PROVEEDOR', 'OTRO'] as const;
export type TipoUbicacion = (typeof TIPOS_UBICACION)[number];

/** Lugar físico donde puede estar un activo o un componente. Los almacenes también son ubicaciones. */
@Entity({ name: 'ubicacion' })
@Index('UQ_ubicacion_sede_nombre', ['sedeId', 'nombre'], { unique: true })
export class Ubicacion extends EntidadConEstado {
  @ColTexto(120)
  nombre: string;

  @ColEnum(TIPOS_UBICACION)
  tipo: TipoUbicacion;

  @Column({ name: 'sede_id', type: 'uniqueidentifier' })
  sedeId: string;

  @ManyToOne(() => Sede)
  @JoinColumn({ name: 'sede_id' })
  sede?: Sede;

  @Column({ name: 'area_id', type: 'uniqueidentifier', nullable: true })
  areaId: string | null;

  @ManyToOne(() => Area)
  @JoinColumn({ name: 'area_id' })
  area?: Area | null;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

/** Trabajador que puede recibir activos. No es un usuario de la plataforma. */
@Entity({ name: 'persona' })
export class Persona extends EntidadConEstado {
  @ColTexto(160)
  nombre: string;

  @Index('UQ_persona_documento', { unique: true, where: '[documento] IS NOT NULL' })
  @Column({ type: 'nvarchar', length: 32, nullable: true })
  documento: string | null;

  @ColTexto(256, { nullable: true })
  correo: string | null;

  @ColTexto(120, { nullable: true })
  cargo: string | null;

  @Column({ name: 'area_id', type: 'uniqueidentifier', nullable: true })
  areaId: string | null;

  @ManyToOne(() => Area)
  @JoinColumn({ name: 'area_id' })
  area?: Area | null;

  /** Usuario de Windows (p. ej. DOMINIO\\jperez): ScanGP avisa si otra persona usa su equipo. */
  @Column({ name: 'usuario_windows', type: 'nvarchar', length: 128, nullable: true })
  usuarioWindows: string | null;

  @Column({ type: 'bit', default: true })
  activo: boolean;
}

/** Configuración de la organización (una sola fila, id = 1). */
@Entity({ name: 'organizacion_config' })
export class OrganizacionConfig {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @ColTexto(160)
  nombre: string;

  @Column({ name: 'prefijo_activo', type: 'varchar', length: 12 })
  prefijoActivo: string;

  @Column({ name: 'prefijo_componente', type: 'varchar', length: 12 })
  prefijoComponente: string;

  @Column({ name: 'prefijo_orden', type: 'varchar', length: 12 })
  prefijoOrden: string;

  @Column({ name: 'digitos_codigo', type: 'int' })
  digitosCodigo: number;

  @Column({ name: 'dias_sin_reporte', type: 'int' })
  diasSinReporte: number;

  @Column({ name: 'dias_aviso_garantia', type: 'int' })
  diasAvisoGarantia: number;
}
