import { BeforeInsert, Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { uuid7 } from '../common/uuid7';

export type ResultadoAuditoria = 'OK' | 'ERROR' | 'DENEGADO';

/**
 * Registro inmutable de una operación. La base niega UPDATE y DELETE sobre esta tabla al usuario de la API.
 */
@Entity({ name: 'auditoria' })
@Check('CK_auditoria_resultado', "[resultado] IN ('OK', 'ERROR', 'DENEGADO')")
@Check('CK_auditoria_antes_json', '[antes] IS NULL OR ISJSON([antes]) = 1')
@Check('CK_auditoria_despues_json', '[despues] IS NULL OR ISJSON([despues]) = 1')
@Index('IX_auditoria_entidad', ['entidad', 'entidadId'])
@Index('IX_auditoria_usuario', ['usuarioId', 'fecha'])
export class RegistroAuditoria {
  @PrimaryColumn('uniqueidentifier', { primaryKeyConstraintName: 'PK_auditoria' })
  id: string;

  @Index('IX_auditoria_fecha')
  @Column({ type: 'datetime2', precision: 3 })
  fecha: Date;

  @Column({ name: 'usuario_id', type: 'uniqueidentifier', nullable: true })
  usuarioId: string | null;

  /** Nombre de usuario en el momento de la operación (se conserva aunque el usuario cambie). */
  @Column({ name: 'usuario_nombre', type: 'nvarchar', length: 64, nullable: true })
  usuarioNombre: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  /** Verbo en formato `modulo.accion`, p. ej. `usuarios.crear`, `auth.login`. */
  @Column({ type: 'varchar', length: 64 })
  accion: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entidad: string | null;

  @Column({ name: 'entidad_id', type: 'nvarchar', length: 64, nullable: true })
  entidadId: string | null;

  @Column({ type: 'varchar', length: 16 })
  resultado: ResultadoAuditoria;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true, transformer: json() })
  antes: object | null;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true, transformer: json() })
  despues: object | null;

  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  detalle: string | null;

  @BeforeInsert()
  asignarId() {
    this.id ??= uuid7();
    this.fecha ??= new Date();
  }
}

function json() {
  return {
    to: (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v)),
    from: (v: string | null) => (v == null ? null : JSON.parse(v)),
  };
}
