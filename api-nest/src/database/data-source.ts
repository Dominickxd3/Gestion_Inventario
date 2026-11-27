/**
 * DataSource para la CLI de TypeORM (migraciones). Usa el usuario de migraciones.
 *   npm run db:migrate      aplica las migraciones pendientes
 *   npm run db:check        falla si las entidades no coinciden con la base
 */
import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { opcionesSqlServer } from './opciones';

const env = resolve(__dirname, '../../.env');
if (existsSync(env)) process.loadEnvFile(env);

export default new DataSource(opcionesSqlServer(process.env, 'migraciones'));
