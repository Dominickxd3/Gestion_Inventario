import type { DataSourceOptions } from 'typeorm';
import { Usuario } from '../identidad/usuario.entity';
import { RegistroAuditoria } from '../auditoria/registro-auditoria.entity';
import { Marca, Modelo, TipoActivo, TipoComponente } from '../catalogo/catalogo.entities';
import { Area, OrganizacionConfig, Persona, Sede, Ubicacion } from '../organizacion/organizacion.entities';
import { Activo } from '../activos/activo.entity';
import { Movimiento } from '../trazabilidad/movimiento.entity';
import { CambioDetectado, Discrepancia, DispositivoDetectado, Escaneo } from '../descubrimiento/descubrimiento.entities';
import { Componente, Instalacion } from '../componentes/componentes.entities';
import { Asignacion } from '../asignaciones/asignacion.entity';
import { OrdenMantenimiento } from '../mantenimiento/orden-mantenimiento.entity';
import { Articulo, Existencia, MovimientoAlmacen } from '../almacen/almacen.entities';
import { Documento, Garantia } from '../garantias/garantias.entities';

/** Entidades del modelo. Cada módulo agrega aquí las suyas. */
export const ENTIDADES = [
  Usuario, RegistroAuditoria,
  TipoActivo, TipoComponente, Marca, Modelo,
  Sede, Area, Ubicacion, Persona, OrganizacionConfig,
  Activo, Movimiento,
  DispositivoDetectado, Escaneo, CambioDetectado, Discrepancia,
  Componente, Instalacion, Asignacion, OrdenMantenimiento,
  Articulo, Existencia, MovimientoAlmacen, Garantia, Documento,
];

type Env = Record<string, string | undefined>;

/**
 * Conexión a SQL Server.
 * `rol` elige las credenciales: la API usa `app` (permisos limitados), las migraciones usan `migraciones`.
 */
export function opcionesSqlServer(env: Env, rol: 'app' | 'migraciones'): DataSourceOptions {
  const usuario = rol === 'app' ? env.DB_APP_USER : env.DB_MIGRATIONS_USER;
  const password = rol === 'app' ? env.DB_APP_PASSWORD : env.DB_MIGRATIONS_PASSWORD;
  if (!usuario || !password) {
    throw new Error(`Faltan DB_${rol === 'app' ? 'APP' : 'MIGRATIONS'}_USER / _PASSWORD en .env`);
  }
  return {
    type: 'mssql',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 1433),
    database: env.DB_NAME ?? 'ScanGP',
    username: usuario,
    password,
    schema: 'itam',
    entities: ENTIDADES,
    migrations: [__dirname + '/migraciones/*.{ts,js}'],
    migrationsTableName: 'migraciones',
    synchronize: false,
    migrationsRun: false,
    options: {
      encrypt: env.DB_ENCRYPT !== 'false',
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      useUTC: true,
    },
  };
}
