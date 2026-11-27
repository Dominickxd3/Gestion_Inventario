/**
 * Importa los equipos detectados del archivo JSON de la versión anterior (data/equipos.json) a SQL Server.
 * No destructivo: por defecto solo simula; con --aplicar escribe. Es idempotente (lo ya importado se omite)
 * y nunca modifica el archivo JSON, que queda como respaldo.
 *
 *   npm run importar:json                 simulación con informe
 *   npm run importar:json -- --aplicar    importa
 */
import 'reflect-metadata';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { uuid7 } from '../common/uuid7';
import { opcionesSqlServer } from '../database/opciones';
import { CambioDetectado, DispositivoDetectado, Escaneo } from '../descubrimiento/descubrimiento.entities';
import { hashContenido, identificar } from '../descubrimiento/ingesta.service';
import type { InventarioPayload } from '../descubrimiento/inventario.types';
import { erroresInventario } from '../descubrimiento/validacion';

interface EquipoJson {
  id: string;
  primerRegistro: string;
  ultimoReporte: string;
  totalReportes: number;
  ipOrigen: string | null;
  resumen: Record<string, unknown>;
  historial: { fecha: string; campo: string; anterior: string | null; nuevo: string | null }[];
  inventario: InventarioPayload;
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const env = resolve(__dirname, '../../.env');
  if (existsSync(env)) process.loadEnvFile(env);
  const archivo = resolve(process.argv.find((a) => a.endsWith('.json')) ?? process.env.DATA_FILE ?? 'data/equipos.json');
  if (!existsSync(archivo)) {
    console.log(`No existe ${archivo}: no hay nada que importar.`);
    return;
  }
  const equipos: EquipoJson[] = JSON.parse(readFileSync(archivo, 'utf8'));
  console.log(`${aplicar ? 'IMPORTANDO' : 'SIMULACIÓN (usa --aplicar para importar)'} · ${equipos.length} equipos en ${archivo}\n`);

  const db = await new DataSource(opcionesSqlServer(process.env, 'app')).initialize();
  const informe = { importados: 0, yaExistian: 0, invalidos: 0, idCambiado: 0 };
  try {
    for (const e of equipos) {
      const errores = erroresInventario(e.inventario);
      if (errores.length) {
        informe.invalidos++;
        console.log(`  ✕ ${e.resumen?.nombreEquipo ?? e.id}: ${errores.join('; ')}`);
        continue;
      }
      const { id, clave } = identificar(e.inventario);
      if (id !== e.id) {
        informe.idCambiado++;
        console.log(`  ! ${e.resumen.nombreEquipo}: su identificador cambia (${e.id} → ${id}) por la identificación endurecida (${clave})`);
      }
      if (await db.getRepository(DispositivoDetectado).existsBy({ id })) {
        informe.yaExistian++;
        console.log(`  = ${e.resumen.nombreEquipo}: ya está en la base`);
        continue;
      }
      console.log(`  + ${e.resumen.nombreEquipo}: ${e.totalReportes} reportes, ${e.historial.length} cambios`);
      if (!aplicar) continue;

      await db.transaction(async (em) => {
        const escaneoId = uuid7(new Date(e.ultimoReporte).getTime());
        await em.insert(Escaneo, {
          id: escaneoId, dispositivoId: id, recibidoEn: new Date(e.ultimoReporte), ipOrigen: e.ipOrigen,
          agenteVersion: e.inventario.agenteVersion ?? null, datosHash: hashContenido(e.inventario), datos: e.inventario,
        });
        for (const c of e.historial) {
          await em.insert(CambioDetectado, {
            id: uuid7(new Date(c.fecha).getTime()), dispositivoId: id, escaneoId: null, fecha: new Date(c.fecha),
            campo: c.campo, anterior: c.anterior?.slice(0, 500) ?? null, nuevo: c.nuevo?.slice(0, 500) ?? null,
          });
        }
        await em.insert(DispositivoDetectado, {
          id, clave, nombreEquipo: e.inventario.equipo.nombreEquipo.slice(0, 256), resumen: e.resumen,
          primerRegistro: new Date(e.primerRegistro), ultimoReporte: new Date(e.ultimoReporte), totalReportes: e.totalReportes,
          ipOrigen: e.ipOrigen, ultimoEscaneoId: escaneoId, ultimoInventario: e.inventario, activoId: null, archivado: false,
        });
      });
      informe.importados++;
    }
  } finally {
    await db.destroy();
  }
  console.log(`\nResultado: ${JSON.stringify(informe)}${aplicar ? '' : ' (simulación: no se escribió nada)'}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
