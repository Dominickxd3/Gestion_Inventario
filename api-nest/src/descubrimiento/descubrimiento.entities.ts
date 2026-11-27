import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { ColEnum, ColFecha, ColJson, ColTexto } from '../common/columnas';
import { EntidadBase } from '../common/entidad-base';

/**
 * Equipo tal como lo identifica ScanGP (mundo detectado). Su id es la huella de 16 hex que la API
 * usa desde la primera versión, así las URLs y respuestas anteriores siguen valiendo.
 */
@Entity({ name: 'dispositivo_detectado' })
export class DispositivoDetectado {
  @PrimaryColumn({ type: 'varchar', length: 16, primaryKeyConstraintName: 'PK_dispositivo_detectado' })
  id: string;

  /** Identificador de origen: uuid:…, serie:…, mac:… o nombre:… */
  @Column({ type: 'nvarchar', length: 200 })
  clave: string;

  @ColTexto(256, { name: 'nombre_equipo' })
  nombreEquipo: string;

  @ColJson()
  resumen: object | null;

  @ColFecha('primer_registro')
  primerRegistro: Date;

  @Index('IX_dispositivo_ultimo_reporte')
  @ColFecha('ultimo_reporte')
  ultimoReporte: Date;

  @Column({ name: 'total_reportes', type: 'int' })
  totalReportes: number;

  @Column({ name: 'ip_origen', type: 'varchar', length: 45, nullable: true })
  ipOrigen: string | null;

  @Column({ name: 'ultimo_escaneo_id', type: 'uniqueidentifier', nullable: true })
  ultimoEscaneoId: string | null;

  /**
   * Último inventario recibido, completo (se sobrescribe en cada reporte). Mantiene al día datos volátiles
   * como el espacio libre o la carga de batería sin guardar un escaneo nuevo cada vez.
   */
  @ColJson({ name: 'ultimo_inventario' })
  ultimoInventario: object | null;

  /** Vínculo con el activo validado (como mucho un dispositivo por activo). */
  @Index('UQ_dispositivo_activo', { unique: true, where: '[activo_id] IS NOT NULL' })
  @Column({ name: 'activo_id', type: 'uniqueidentifier', nullable: true })
  activoId: string | null;

  /** Archivado: deja de mostrarse en la lista de detectados; sus escaneos se conservan. */
  @Column({ type: 'bit', default: false })
  archivado: boolean;
}

/** Instantánea inmutable de un envío de ScanGP. Solo se guarda cuando el contenido cambia (ver datos_hash). */
@Entity({ name: 'escaneo' })
@Index('IX_escaneo_dispositivo', ['dispositivoId', 'recibidoEn'])
export class Escaneo extends EntidadBase {
  @Column({ name: 'dispositivo_id', type: 'varchar', length: 16 })
  dispositivoId: string;

  @ColFecha('recibido_en')
  recibidoEn: Date;

  @Column({ name: 'ip_origen', type: 'varchar', length: 45, nullable: true })
  ipOrigen: string | null;

  @Column({ name: 'agente_version', type: 'varchar', length: 32, nullable: true })
  agenteVersion: string | null;

  /** SHA-256 del contenido sin campos volátiles (fechas, tiempo encendido, carga de batería, IP). */
  @Column({ name: 'datos_hash', type: 'char', length: 64 })
  datosHash: string;

  @ColJson({ nullable: false })
  datos: object;
}

/** Cambio de un dato resumido entre dos escaneos (usuario, RAM, discos…). */
@Entity({ name: 'cambio_detectado' })
@Index('IX_cambio_detectado_dispositivo', ['dispositivoId', 'fecha'])
export class CambioDetectado extends EntidadBase {
  @Column({ name: 'dispositivo_id', type: 'varchar', length: 16 })
  dispositivoId: string;

  @Column({ name: 'escaneo_id', type: 'uniqueidentifier', nullable: true })
  escaneoId: string | null;

  @ColFecha('fecha')
  fecha: Date;

  @Column({ type: 'varchar', length: 40 })
  campo: string;

  @ColTexto(500, { nullable: true })
  anterior: string | null;

  @ColTexto(500, { nullable: true })
  nuevo: string | null;
}

export const TIPOS_DISCREPANCIA = [
  'COMPONENTE_NUEVO',
  'COMPONENTE_MOVIDO',
  'COMPONENTE_AUSENTE',
  'ATRIBUTO_DIFERENTE',
  'USUARIO_DISTINTO',
] as const;
export type TipoDiscrepancia = (typeof TIPOS_DISCREPANCIA)[number];

export const ESTADOS_DISCREPANCIA = ['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'RESUELTA_AUTO'] as const;
export type EstadoDiscrepancia = (typeof ESTADOS_DISCREPANCIA)[number];

/** Diferencia entre lo detectado y lo validado, pendiente de que TI la acepte o rechace. */
@Entity({ name: 'discrepancia' })
@Index('IX_discrepancia_estado', ['estado', 'activoId'])
export class Discrepancia extends EntidadBase {
  @Column({ name: 'activo_id', type: 'uniqueidentifier' })
  activoId: string;

  @Column({ name: 'dispositivo_id', type: 'varchar', length: 16 })
  dispositivoId: string;

  @Column({ name: 'escaneo_id', type: 'uniqueidentifier', nullable: true })
  escaneoId: string | null;

  @ColEnum(TIPOS_DISCREPANCIA)
  tipo: TipoDiscrepancia;

  /** Qué se compara (p. ej. DISCO:WD-123). Evita duplicar discrepancias abiertas. */
  @Column({ type: 'nvarchar', length: 200 })
  clave: string;

  @ColTexto(500)
  descripcion: string;

  @ColJson()
  detalle: object | null;

  @ColEnum(ESTADOS_DISCREPANCIA, { default: 'PENDIENTE' })
  estado: EstadoDiscrepancia;

  @ColFecha('resuelta_en', { nullable: true })
  resueltaEn: Date | null;

  @Column({ name: 'resuelta_por', type: 'nvarchar', length: 64, nullable: true })
  resueltaPor: string | null;

  @ColTexto(1000, { nullable: true })
  resolucion: string | null;
}
