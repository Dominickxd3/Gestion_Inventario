/**
 * Jest globalSetup de las pruebas e2e: deja la base de pruebas vacía y con todas las migraciones aplicadas.
 * Usa una base aparte (DB_NAME_PRUEBAS, por defecto ScanGP_Pruebas), creada una vez con db/setup.sql.
 * Nunca toca la base real.
 */
import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { opcionesSqlServer } from '../src/database/opciones';

export const BASE_PRUEBAS = () => process.env.DB_NAME_PRUEBAS ?? 'ScanGP_Pruebas';

export function entornoPruebas() {
  const env = resolve(__dirname, '../.env');
  if (existsSync(env)) process.loadEnvFile(env);
  process.env.DB_NAME = BASE_PRUEBAS();
}

export default async function prepararBase() {
  entornoPruebas();
  if (!/prueba|test/i.test(process.env.DB_NAME!)) throw new Error(`Por seguridad, la base de pruebas debe llamarse *Pruebas* o *Test* (es ${process.env.DB_NAME})`);
  const db = await new DataSource({ ...opcionesSqlServer(process.env, 'migraciones'), logging: false }).initialize();
  try {
    // Deshace todas las migraciones (tablas vacías) y las vuelve a aplicar.
    while ((await db.query(`SELECT COUNT(*) AS n FROM sys.tables WHERE name = 'migraciones' AND schema_id = SCHEMA_ID('itam')`))[0].n > 0
      && (await db.query(`SELECT COUNT(*) AS n FROM [itam].[migraciones]`))[0].n > 0) {
      await db.undoLastMigration({ transaction: 'each' });
    }
    await db.runMigrations({ transaction: 'each' });
  } finally {
    await db.destroy();
  }
}
