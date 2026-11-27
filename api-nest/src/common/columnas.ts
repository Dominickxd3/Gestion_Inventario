import { Column, ColumnOptions, CreateDateColumn, PrimaryColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

/** Transformador JSON para columnas NVARCHAR(MAX). */
export function json() {
  return {
    to: (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v)),
    from: (v: string | null) => (v == null ? null : JSON.parse(v)),
  };
}

/** Clave primaria UUID v7 asignada por la aplicación. */
export const ColId = (tabla: string) => PrimaryColumn('uniqueidentifier', { primaryKeyConstraintName: `PK_${tabla}` });

export const ColUuid = (nombre: string, opts: ColumnOptions = {}) =>
  Column({ name: nombre, type: 'uniqueidentifier', nullable: true, ...opts });

export const ColFecha = (nombre: string, opts: ColumnOptions = {}) =>
  Column({ name: nombre, type: 'datetime2', precision: 3, ...opts });

export const ColTexto = (largo: number, opts: ColumnOptions = {}) => Column({ type: 'nvarchar', length: largo, ...opts });

export const ColJson = (opts: ColumnOptions = {}) =>
  Column({ type: 'nvarchar', length: 'MAX', nullable: true, transformer: json(), ...opts });

/** Enumeración guardada como texto con CHECK generado por TypeORM. */
export const ColEnum = (valores: readonly string[], opts: ColumnOptions = {}) =>
  Column({ type: 'simple-enum', enum: valores as string[], length: 32, ...opts });

export const ColCreado = () => CreateDateColumn({ name: 'creado_en', type: 'datetime2', precision: 3 });
export const ColActualizado = () => UpdateDateColumn({ name: 'actualizado_en', type: 'datetime2', precision: 3 });
export const ColVersion = () => VersionColumn();
