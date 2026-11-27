/**
 * Crea un usuario ADMIN con contraseña temporal (se muestra una sola vez y debe cambiarse al entrar).
 * Pensado para el primer acceso o para recuperar el acceso si no queda ningún administrador.
 *
 *   npm run admin:crear -- <usuario> "<Nombre completo>"
 */
import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { RegistroAuditoria } from '../auditoria/registro-auditoria.entity';
import { uuid7 } from '../common/uuid7';
import { opcionesSqlServer } from '../database/opciones';
import { hashPassword, passwordTemporal } from '../identidad/password';
import { Usuario } from '../identidad/usuario.entity';

async function main() {
  const [nombreUsuario, nombre] = process.argv.slice(2);
  if (!nombreUsuario || !nombre || !/^[a-z0-9._-]{3,64}$/i.test(nombreUsuario)) {
    console.error('Uso: npm run admin:crear -- <usuario> "<Nombre completo>"');
    process.exit(2);
  }

  const env = resolve(__dirname, '../../.env');
  if (existsSync(env)) process.loadEnvFile(env);
  const db = await new DataSource(opcionesSqlServer(process.env, 'app')).initialize();

  try {
    const temporal = passwordTemporal();
    const hash = await hashPassword(temporal);
    const usuario = nombreUsuario.toLowerCase();
    await db.transaction(async (em) => {
      if (await em.existsBy(Usuario, { nombreUsuario: usuario })) throw new Error(`Ya existe el usuario "${usuario}"`);
      const u = em.create(Usuario, {
        nombreUsuario: usuario,
        nombre,
        rol: 'ADMIN',
        hashPassword: hash,
        activo: true,
        debeCambiarPassword: true,
        credencialesCambiadasEn: new Date(),
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoAcceso: null,
      });
      await em.save(u);
      await em.insert(
        RegistroAuditoria,
        em.create(RegistroAuditoria, {
          id: uuid7(),
          fecha: new Date(),
          usuarioNombre: 'consola',
          accion: 'usuarios.crear-admin',
          entidad: 'usuario',
          entidadId: u.id,
          resultado: 'OK',
          despues: { nombreUsuario: usuario, nombre, rol: 'ADMIN' },
          detalle: 'Creado con npm run admin:crear',
        }),
      );
    });
    console.log(`\nAdministrador "${usuario}" creado.`);
    console.log(`Contraseña temporal: ${temporal}`);
    console.log('Se pedirá cambiarla en el primer inicio de sesión. No se volverá a mostrar.\n');
  } finally {
    await db.destroy();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
