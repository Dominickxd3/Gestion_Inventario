import { BeforeInsert, Column, CreateDateColumn, PrimaryColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { uuid7 } from './uuid7';

/** Id UUID v7 + quién y cuándo se creó. Base de todas las entidades del modelo ITAM. */
export abstract class EntidadBase {
  @PrimaryColumn('uniqueidentifier')
  id: string;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime2', precision: 3 })
  creadoEn: Date;

  @Column({ name: 'creado_por', type: 'uniqueidentifier', nullable: true })
  creadoPor: string | null;

  @BeforeInsert()
  asignarId() {
    this.id ??= uuid7();
  }
}

/** Entidad con estado que cambia: fecha de actualización y versión (bloqueo optimista). */
export abstract class EntidadConEstado extends EntidadBase {
  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime2', precision: 3 })
  actualizadoEn: Date;

  @VersionColumn()
  version: number;
}
