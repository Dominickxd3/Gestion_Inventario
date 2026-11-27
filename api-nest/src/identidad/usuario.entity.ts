import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { uuid7 } from '../common/uuid7';

export const ROLES = ['ADMIN', 'TECNICO', 'CONSULTA'] as const;
export type Rol = (typeof ROLES)[number];

/** Usuario de la plataforma (quien inicia sesión). No confundir con las personas custodias de activos. */
@Entity({ name: 'usuario' })
@Check('CK_usuario_rol', "[rol] IN ('ADMIN', 'TECNICO', 'CONSULTA')")
export class Usuario {
  @PrimaryColumn('uniqueidentifier', { primaryKeyConstraintName: 'PK_usuario' })
  id: string;

  @Index('UQ_usuario_nombre_usuario', { unique: true })
  @Column({ name: 'nombre_usuario', type: 'nvarchar', length: 64 })
  nombreUsuario: string;

  @Column({ type: 'nvarchar', length: 128 })
  nombre: string;

  @Column({ type: 'nvarchar', length: 256, nullable: true })
  correo: string | null;

  @Column({ type: 'varchar', length: 16 })
  rol: Rol;

  @Column({ name: 'hash_password', type: 'varchar', length: 256, select: false })
  hashPassword: string;

  @Column({ type: 'bit', default: true })
  activo: boolean;

  @Column({ name: 'debe_cambiar_password', type: 'bit', default: true })
  debeCambiarPassword: boolean;

  /** Los tokens emitidos antes de esta fecha dejan de valer (cambio o restablecimiento de contraseña). */
  @Column({ name: 'credenciales_cambiadas_en', type: 'datetime2', precision: 3 })
  credencialesCambiadasEn: Date;

  @Column({ name: 'intentos_fallidos', type: 'int', default: 0 })
  intentosFallidos: number;

  @Column({ name: 'bloqueado_hasta', type: 'datetime2', precision: 3, nullable: true })
  bloqueadoHasta: Date | null;

  @Column({ name: 'ultimo_acceso', type: 'datetime2', precision: 3, nullable: true })
  ultimoAcceso: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime2', precision: 3 })
  creadoEn: Date;

  @Column({ name: 'creado_por', type: 'uniqueidentifier', nullable: true })
  creadoPor: string | null;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime2', precision: 3 })
  actualizadoEn: Date;

  @VersionColumn()
  version: number;

  @BeforeInsert()
  asignarId() {
    this.id ??= uuid7();
  }
}

/** Datos del usuario que se pueden devolver por la API. */
export function vistaUsuario(u: Usuario) {
  return {
    id: u.id,
    nombreUsuario: u.nombreUsuario,
    nombre: u.nombre,
    correo: u.correo,
    rol: u.rol,
    activo: u.activo,
    debeCambiarPassword: u.debeCambiarPassword,
    ultimoAcceso: u.ultimoAcceso,
    creadoEn: u.creadoEn,
  };
}
