import { API_KEY, crearAppPruebas, inventario, sufijo } from './app-pruebas';

describe('Mapeo automático (SQL Server)', () => {
  let ctx: Awaited<ReturnType<typeof crearAppPruebas>>;
  let auth: Record<string, string>;
  const s = sufijo();
  const anteriores = process.env.SCANGP_REGISTRO_AUTOMATICO;
  const equipos: { dispositivo: string; activo: string; pieza: string }[] = [];
  const datos = (n: number, disco = true) => inventario((p) => {
    p.equipo.nombreEquipo = 'AUTO-' + s + '-' + n;
    p.equipo.uuid = '99999999-8888-7777-6666-' + (s + n).padStart(12, '0').replace(/[^0-9a-f]/g, 'a');
    p.equipo.numeroSerie = 'AUTO-SERIE-' + s + '-' + n;
    p.discos[0].numeroSerie = 'AUTO-DISCO-' + s + '-' + n;
    if (!disco) p.discos = [];
    p.monitores = [];
  });
  const escanear = (p: object) => ctx.api().post('/api/inventario').set('X-Api-Key', API_KEY).send(p).expect(200);
  const get = (url: string) => ctx.api().get(url).set(auth).expect(200);
  beforeAll(async () => {
    ctx = await crearAppPruebas();
    process.env.SCANGP_REGISTRO_AUTOMATICO = 'true';
    auth = (await ctx.crearUsuario('ADMIN')).auth;
  });
  afterAll(async () => {
    if (anteriores === undefined) delete process.env.SCANGP_REGISTRO_AUTOMATICO;
    else process.env.SCANGP_REGISTRO_AUTOMATICO = anteriores;
    await ctx?.app.close();
  });
  it('registra diez máquinas concurrentes con sus discos, catálogo e historial', async () => {
    const respuestas = await Promise.all(Array.from({ length: 10 }, (_, n) => escanear(datos(n))));
    for (const r of respuestas) {
      expect(r.body.activoId).toBeTruthy();
      const c = (await get('/api/activos/' + r.body.activoId + '/componentes')).body;
      expect(c.instalaciones).toHaveLength(1);
      expect(c.instalaciones[0].confirmadaEn).toBeTruthy();
      expect(c.integrados).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'CPU' })]));
      equipos.push({ dispositivo: r.body.id, activo: r.body.activoId, pieza: c.instalaciones[0].componente.id });
    }
  });
  it('repetir un escaneo conserva el mismo activo y la misma instalación', async () => {
    const r = await escanear(datos(0));
    expect(r.body).toMatchObject({ nuevo: false, activoId: equipos[0].activo });
    const c = (await get('/api/componentes/' + equipos[0].pieza)).body;
    expect(c.instalaciones).toHaveLength(1);
  });
  it('traslada una pieza conocida conservando las dos máquinas en su historia', async () => {
    await escanear(datos(0, false));
    const destino = datos(1);
    destino.discos.push({ ...datos(0).discos[0] });
    await escanear(destino);
    const c = (await get('/api/componentes/' + equipos[0].pieza)).body;
    expect(c.instalaciones).toHaveLength(2);
    expect(c.instalaciones.some((i: any) => i.activo.id.toLowerCase() === equipos[0].activo.toLowerCase() && i.hasta)).toBe(true);
    expect(c.activo.id.toLowerCase()).toBe(equipos[1].activo.toLowerCase());
    expect(c.historial).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'RETIRO', usuarioNombre: 'ScanGP' })]));
  });
});
