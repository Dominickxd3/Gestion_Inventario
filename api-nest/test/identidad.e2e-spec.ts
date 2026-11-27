import { DataSource } from 'typeorm';
import { RegistroAuditoria } from '../src/auditoria/registro-auditoria.entity';
import { hashPassword } from '../src/identidad/password';
import { Usuario } from '../src/identidad/usuario.entity';
import { API_KEY, crearAppPruebas, inventario, sufijo } from './app-pruebas';

const PASSWORD_INICIAL = 'temporal-inicial-123';
const PASSWORD_NUEVA = 'una frase nueva y larga';

describe('Identidad, roles y auditoría (e2e, SQL Server)', () => {
  let ctx: Awaited<ReturnType<typeof crearAppPruebas>>;
  let db: DataSource;
  const usuario = `admin-${sufijo()}`;
  const api = () => ctx.api();
  const login = (u: string, p: string) => api().post('/api/auth/login').send({ usuario: u, password: p });

  beforeAll(async () => {
    ctx = await crearAppPruebas();
    db = ctx.db;
    await db.getRepository(Usuario).save(
      db.getRepository(Usuario).create({
        nombreUsuario: usuario, nombre: 'Administrador de prueba', rol: 'ADMIN', activo: true, hashPassword: await hashPassword(PASSWORD_INICIAL),
        debeCambiarPassword: true, credencialesCambiadasEn: new Date(Date.now() - 60_000), intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: null,
      }),
    );
    await api().post('/api/inventario').set('X-Api-Key', API_KEY).send(inventario((i) => (i.equipo.nombreEquipo = 'EQUIPO-IDENTIDAD'))).expect(200);
  });
  afterAll(() => ctx?.app.close());

  let token: string;

  it('las rutas de la web exigen sesión', async () => {
    await api().get('/api/equipos').expect(401);
    await api().get('/api/activos').expect(401);
    await api().get('/api/equipos').set('Authorization', 'Bearer no-es-un-token').expect(401);
  });

  it('no revela si el usuario existe', async () => {
    const a = await login(usuario, 'incorrecta').expect(401);
    const b = await login(`nadie-${sufijo()}`, 'incorrecta').expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('con contraseña temporal solo permite su perfil y cambiarla', async () => {
    const r = await login(usuario.toUpperCase(), PASSWORD_INICIAL).expect(200);
    token = r.body.token;
    expect(r.body.usuario).toMatchObject({ nombreUsuario: usuario, debeCambiarPassword: true });
    expect(r.body.usuario.hashPassword).toBeUndefined();
    await api().get('/api/auth/yo').set('Authorization', `Bearer ${token}`).expect(200);
    await api().get('/api/equipos').set('Authorization', `Bearer ${token}`).expect(403);
    await api().post('/api/auth/cambiar-password').set('Authorization', `Bearer ${token}`).send({ actual: PASSWORD_INICIAL, nueva: 'corta' }).expect(400);
  });

  it('al cambiarla entrega un token nuevo e invalida los anteriores', async () => {
    await new Promise((r) => setTimeout(r, 1100));
    const r = await api().post('/api/auth/cambiar-password').set('Authorization', `Bearer ${token}`).send({ actual: PASSWORD_INICIAL, nueva: PASSWORD_NUEVA }).expect(200);
    await api().get('/api/equipos').set('Authorization', `Bearer ${token}`).expect(401);
    token = r.body.token;
    await api().get('/api/equipos').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('bloquea temporalmente tras 5 intentos fallidos', async () => {
    for (let i = 0; i < 5; i++) await login(usuario, 'mal').expect(401);
    expect((await login(usuario, PASSWORD_NUEVA).expect(401)).body.message).toMatch(/Demasiados intentos/);
    await db.getRepository(Usuario).update({ nombreUsuario: usuario }, { bloqueadoHasta: null, intentosFallidos: 0 });
    token = (await login(usuario, PASSWORD_NUEVA).expect(200)).body.token;
  });

  it('ADMIN crea usuarios; CONSULTA solo consulta', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const nombre = `lectora-${sufijo()}`;
    const r = await api().post('/api/usuarios').set(auth).send({ nombreUsuario: ` ${nombre.toUpperCase()} `, nombre: 'Usuaria de consulta', rol: 'CONSULTA', extra: 'x' }).expect(201);
    expect(r.body.usuario).toMatchObject({ nombreUsuario: nombre, rol: 'CONSULTA', activo: true, debeCambiarPassword: true });
    await api().post('/api/usuarios').set(auth).send({ nombreUsuario: nombre, nombre: 'Duplicada', rol: 'CONSULTA' }).expect(409);

    const t = (await login(nombre, r.body.passwordTemporal).expect(200)).body.token;
    await new Promise((res) => setTimeout(res, 1100));
    const tc = (await api().post('/api/auth/cambiar-password').set('Authorization', `Bearer ${t}`).send({ actual: r.body.passwordTemporal, nueva: 'otra frase larga de consulta' }).expect(200)).body.token;
    const consulta = { Authorization: `Bearer ${tc}` };

    const lista = await api().get('/api/equipos').set(consulta).expect(200);
    await api().post(`/api/equipos/${lista.body[0].id}/archivar`).set(consulta).expect(403);
    await api().get('/api/scangp/descargar').set(consulta).expect(403);
    await api().get('/api/usuarios').set(consulta).expect(403);
    await api().post('/api/organizacion/sedes').set(consulta).send({ nombre: 'No debe crearse' }).expect(403);

    await api().patch(`/api/usuarios/${r.body.usuario.id}`).set(auth).send({ activo: false }).expect(200);
    await api().get('/api/equipos').set(consulta).expect(401);
  });

  it('un administrador no puede quitarse el rol a sí mismo', async () => {
    const yo = await db.getRepository(Usuario).findOneByOrFail({ nombreUsuario: usuario });
    const r = await api().patch(`/api/usuarios/${yo.id}`).set('Authorization', `Bearer ${token}`).send({ rol: 'TECNICO' }).expect(400);
    expect(r.body.message).toMatch(/administrador/);
  });

  it('audita accesos y operaciones sin datos sensibles; la API no puede borrar la auditoría', async () => {
    const filas = await db.getRepository(RegistroAuditoria).find({ where: { usuarioNombre: usuario } });
    const acciones = filas.map((a) => `${a.accion}:${a.resultado}`);
    expect(acciones).toEqual(expect.arrayContaining(['auth.login:DENEGADO', 'auth.login:OK', 'auth.cambiar-password:OK', 'usuarios.crear:OK', 'usuarios.actualizar:OK']));
    expect(JSON.stringify(filas)).not.toMatch(/scrypt\$|temporal-inicial|frase nueva/);
    await expect(db.query(`DELETE FROM [itam].[auditoria] WHERE 1 = 0`)).rejects.toThrow(/permission was denied/i);
    await expect(db.query(`UPDATE [itam].[auditoria] SET detalle = NULL WHERE 1 = 0`)).rejects.toThrow(/permission was denied/i);
  });
});
