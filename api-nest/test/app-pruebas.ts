import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { hashPassword } from '../src/identidad/password';
import { Usuario } from '../src/identidad/usuario.entity';
import inventarioReal from './fixtures/inventario-scangp-1.1.json';
import { entornoPruebas } from './preparar-base';

export const API_KEY = 'clave-de-prueba-del-agente';

/** Copia profunda del inventario real anonimizado, con cambios opcionales. */
export function inventario(cambios: (i: typeof inventarioReal) => void = () => {}) {
  const i = JSON.parse(JSON.stringify(inventarioReal)) as typeof inventarioReal;
  cambios(i);
  return i;
}

/** Sufijo único para que cada archivo de pruebas use sus propios datos en la base compartida. */
export const sufijo = () => Math.random().toString(36).slice(2, 8);

/** API real (AppModule completo) contra la base de pruebas + un administrador listo para usar. */
export async function crearAppPruebas() {
  entornoPruebas();
  process.env.API_KEY = API_KEY;
  process.env.DOCUMENTOS_DIR = mkdtempSync(join(tmpdir(), 'scangp-docs-'));
  const { AppModule } = await import('../src/app.module');
  const { configurarApp } = await import('../src/main');
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configurarApp(modulo.createNestApplication<NestExpressApplication>({ bodyParser: false }));
  await app.init();
  const db = app.get<DataSource>(getDataSourceToken());
  const api = () => request(app.getHttpServer());

  const crearUsuario = async (rol: 'ADMIN' | 'TECNICO' | 'CONSULTA', password = 'una frase de prueba larga') => {
    const nombreUsuario = `${rol.toLowerCase()}-${sufijo()}`;
    await db.getRepository(Usuario).save(
      db.getRepository(Usuario).create({
        nombreUsuario, nombre: `Usuario ${rol}`, rol, activo: true, hashPassword: await hashPassword(password), debeCambiarPassword: false,
        credencialesCambiadasEn: new Date(Date.now() - 60_000), intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: null,
      }),
    );
    const r = await api().post('/api/auth/login').send({ usuario: nombreUsuario, password }).expect(200);
    return { nombreUsuario, token: r.body.token as string, auth: { Authorization: `Bearer ${r.body.token}` } };
  };

  return { app, db, api, crearUsuario };
}
