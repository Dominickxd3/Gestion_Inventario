import { API_KEY, crearAppPruebas, inventario, sufijo } from './app-pruebas';

/**
 * Flujo completo de trazabilidad: detección → activo → asignación → falla y retiro de un componente →
 * reemplazo → confirmación de ScanGP → discrepancias → mantenimiento con equipo temporal → transferencia →
 * baja; más almacén, garantías, documentos, panel e inmutabilidad del historial.
 */
describe('Gestión de activos (e2e, SQL Server)', () => {
  let ctx: Awaited<ReturnType<typeof crearAppPruebas>>;
  let auth: Record<string, string>;
  const s = sufijo();
  const api = () => ctx.api();
  const get = (url: string) => api().get(url).set(auth);
  const post = (url: string, body: object = {}) => api().post(url).set(auth).send(body);
  const patch = (url: string, body: object) => api().patch(url).set(auth).send(body);

  // Equipo detectado propio de este archivo (UUID y serie únicos).
  const NOMBRE = `PC-${s}`.toUpperCase();
  const UUID = `22222222-3333-4444-5555-${Date.now().toString().slice(-12)}`;
  const DISCO = `WD-ORIGINAL-${s}`;
  const escanear = (cambios: (i: ReturnType<typeof inventario>) => void = () => {}) =>
    api().post('/api/inventario').set('X-Api-Key', API_KEY).send(
      inventario((i) => {
        i.equipo.nombreEquipo = NOMBRE;
        i.equipo.uuid = UUID;
        i.equipo.numeroSerie = `SERIE-${s}`;
        i.discos[0].numeroSerie = DISCO;
        i.monitores = i.monitores.filter((m) => !m.numeroSerie); // solo la pantalla interna
        cambios(i);
      }),
    );

  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await crearAppPruebas();
    auth = (await ctx.crearUsuario('ADMIN')).auth;
  });
  afterAll(() => ctx?.app.close());

  it('ScanGP guarda un escaneo solo cuando cambia algo más que los datos volátiles', async () => {
    const r1 = await escanear().expect(200);
    ids.dispositivo = r1.body.id;
    expect(r1.body).toMatchObject({ nuevo: true, cambios: 0 });
    await escanear((i) => {
      i.fechaRecoleccion = new Date().toISOString();
      i.volumenes[0].libreBytes = 123;
      i.bateria.cargaPorcentaje = 42;
    }).expect(200);
    let d = await get(`/api/equipos/${ids.dispositivo}`).expect(200);
    expect(d.body.escaneos).toHaveLength(1);
    expect(d.body.totalReportes).toBe(2);
    expect(d.body.inventario.volumenes[0].libreBytes).toBe(123); // el último inventario siempre está al día

    await escanear((i) => (i.sistemaOperativo.versionComercial = '27H1')).expect(200);
    d = await get(`/api/equipos/${ids.dispositivo}`).expect(200);
    expect(d.body.escaneos).toHaveLength(2);
    expect(d.body.historial[0]).toMatchObject({ campo: 'sistemaOperativo' });
  });

  it('organización: sede, ubicaciones, área y trabajadores', async () => {
    ids.sede = (await post('/api/organizacion/sedes', { nombre: `Sede ${s}`, prefijoRed: '192.0.2.' }).expect(201)).body.id;
    ids.area = (await post('/api/organizacion/areas', { nombre: `Sistemas ${s}` }).expect(201)).body.id;
    ids.oficina = (await post('/api/organizacion/ubicaciones', { nombre: 'Oficina 1', tipo: 'PUESTO', sedeId: ids.sede, areaId: ids.area }).expect(201)).body.id;
    ids.almacen = (await post('/api/organizacion/ubicaciones', { nombre: 'Almacén TI', tipo: 'ALMACEN', sedeId: ids.sede }).expect(201)).body.id;
    ids.taller = (await post('/api/organizacion/ubicaciones', { nombre: 'Taller', tipo: 'TALLER', sedeId: ids.sede }).expect(201)).body.id;
    ids.ana = (await post('/api/organizacion/personas', { nombre: `Ana ${s}`, documento: `D-${s}`, areaId: ids.area, usuarioWindows: 'EQUIPO-PRUEBA\\usuario.prueba' }).expect(201)).body.id;
    ids.luis = (await post('/api/organizacion/personas', { nombre: `Luis ${s}`, areaId: ids.area }).expect(201)).body.id;
    await post('/api/organizacion/personas', { nombre: 'Duplicado', documento: `D-${s}` }).expect(409);
  });

  it('alta del activo desde la detección: código patrimonial, catálogo, vínculo y componentes', async () => {
    const sug = (await get(`/api/equipos/${ids.dispositivo}/sugerencia-activo`).expect(200)).body;
    expect(sug).toMatchObject({ nombre: NOMBRE, tipoNombre: 'Laptop', marcaNombre: 'Dell', modeloNombre: 'Inspiron 16 7630 2-in-1' });
    expect(sug.componentes).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'DISCO', numeroSerie: DISCO, capacidad: '1 TB' })]));
    expect(sug.integrados[0].descripcion).toMatch(/16 GB LPDDR5 integrada/);

    const a = (await post('/api/equipos/alta-activo', { ...sug, ubicacionId: ids.oficina, estadoTecnico: 'OPERATIVO' }).expect(201)).body;
    ids.activo = a.id;
    expect(a.codigoPatrimonial).toMatch(/^TI-\d{6}$/);

    const ficha = (await get(`/api/activos/${ids.activo}`).expect(200)).body;
    expect(ficha).toMatchObject({ dispositivoId: ids.dispositivo, marca: 'Dell', sincronizacion: 'SINCRONIZADO', estadoTecnico: 'OPERATIVO' });
    const comps = (await get(`/api/activos/${ids.activo}/componentes`).expect(200)).body;
    expect(comps.instalaciones).toHaveLength(1);
    ids.discoOriginal = comps.instalaciones[0].componente.id;
    await get(`/api/equipos/${ids.dispositivo}/sugerencia-activo`).expect(400); // ya vinculado
  });

  it('el siguiente escaneo confirma el disco instalado, sin discrepancias', async () => {
    await escanear().expect(200);
    const c = (await get(`/api/componentes/${ids.discoOriginal}`).expect(200)).body;
    expect(c.confirmadoPorScanGP).toBe(true);
    expect((await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body).toHaveLength(0);
  });

  it('asignación al trabajador (una sola vigente)', async () => {
    ids.asignacion = (await post('/api/asignaciones', { activoId: ids.activo, tipo: 'PERMANENTE', personaId: ids.ana }).expect(201)).body.id;
    await post('/api/asignaciones', { activoId: ids.activo, tipo: 'PERMANENTE', personaId: ids.luis }).expect(400);
    await post('/api/asignaciones', { activoId: ids.activo, tipo: 'PRESTAMO', personaId: ids.luis }).expect(400); // préstamo sin fecha
    const ficha = (await get(`/api/activos/${ids.activo}`).expect(200)).body;
    expect(ficha.asignacion).toMatchObject({ responsable: `Ana ${s}`, tipo: 'PERMANENTE' });
  });

  it('ScanGP avisa si la sesión abierta no es de la persona asignada', async () => {
    await escanear((i) => (i.equipo.usuario = 'EQUIPO-PRUEBA\\otra.persona')).expect(200);
    const d = (await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body;
    expect(d).toEqual([expect.objectContaining({ tipo: 'USUARIO_DISTINTO' })]);
    await post(`/api/discrepancias/${d[0].id}/aceptar`, { observacion: 'Préstamo informal, avisado' }).expect(201);
  });

  it('falla del disco: se retira a mantenimiento, se instala uno del almacén y ScanGP confirma el cambio', async () => {
    const tipos = (await get('/api/catalogo/tipos-componente').expect(200)).body;
    const disco = tipos.find((t: { codigo: string }) => t.codigo === 'DISCO').id;
    ids.discoNuevo = (await post('/api/componentes', { tipoComponenteId: disco, marca: 'Samsung', modelo: '980', numeroSerie: `SAMSUNG-${s}`, capacidad: '1 TB', ubicacionId: ids.almacen }).expect(201)).body.id;

    await post(`/api/componentes/${ids.discoOriginal}/retirar`, { destino: 'ALMACEN', motivo: 'FALLA_TECNICA' }).expect(400); // falta almacén
    await post(`/api/activos/${ids.activo}/reemplazar-componente`, {
      componenteRetiradoId: ids.discoOriginal, componenteNuevoId: ids.discoNuevo, destino: 'MANTENIMIENTO', motivo: 'FALLA_TECNICA', observacion: 'SMART con sectores reasignados',
    }).expect((r) => { if (r.status !== 201) throw new Error(JSON.stringify(r.body)); });

    const viejo = (await get(`/api/componentes/${ids.discoOriginal}`).expect(200)).body;
    expect(viejo).toMatchObject({ situacion: 'EN_MANTENIMIENTO', estadoTecnico: 'CON_FALLAS', activo: null });
    expect(viejo.instalaciones[0]).toMatchObject({ motivoRetiro: 'FALLA_TECNICA' });
    expect(viejo.instalaciones[0].hasta).not.toBeNull();

    // Todavía no se cambió físicamente: ScanGP ve el disco viejo y no el nuevo.
    await escanear().expect(200);
    let d = (await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body.map((x: { tipo: string }) => x.tipo).sort();
    expect(d).toEqual(['COMPONENTE_AUSENTE', 'COMPONENTE_NUEVO']);

    // El técnico cambia el disco: el siguiente escaneo confirma y cierra solas las discrepancias.
    await escanear((i) => (i.discos[0].numeroSerie = `SAMSUNG-${s}`)).expect(200);
    d = (await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body;
    expect(d).toHaveLength(0);
    expect((await get(`/api/componentes/${ids.discoNuevo}`).expect(200)).body.confirmadoPorScanGP).toBe(true);

    // El disco viejo vuelve reparado al almacén.
    await post(`/api/componentes/${ids.discoOriginal}/reingresar`, { ubicacionId: ids.almacen, estadoTecnico: 'OPERATIVO' }).expect(201);
  });

  it('un disco que aparece sin registrar se acepta; el que desaparece se retira; el rechazado no se reabre', async () => {
    const extra = `KINGSTON-${s}`;
    const conExtra = (i: ReturnType<typeof inventario>) => {
      i.discos[0].numeroSerie = `SAMSUNG-${s}`;
      i.discos.push({ ...i.discos[0], numeroSerie: extra, modelo: 'Kingston A2000' });
    };
    await escanear(conExtra).expect(200);
    let [nuevo] = (await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body;
    expect(nuevo).toMatchObject({ tipo: 'COMPONENTE_NUEVO' });
    await post(`/api/discrepancias/${nuevo.id}/aceptar`, {}).expect(201);
    expect((await get(`/api/activos/${ids.activo}/componentes`).expect(200)).body.instalaciones).toHaveLength(2);

    await escanear((i) => (i.discos[0].numeroSerie = `SAMSUNG-${s}`)).expect(200);
    const [ausente] = (await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body;
    expect(ausente).toMatchObject({ tipo: 'COMPONENTE_AUSENTE' });
    await post(`/api/discrepancias/${ausente.id}/aceptar`, {}).expect(400); // falta el destino
    await post(`/api/discrepancias/${ausente.id}/aceptar`, { destino: 'ALMACEN', ubicacionId: ids.almacen, motivo: 'REASIGNACION' }).expect(201);

    const raro = (i: ReturnType<typeof inventario>) => {
      i.discos[0].numeroSerie = `SAMSUNG-${s}`;
      i.discos.push({ ...i.discos[0], numeroSerie: `USB-RARO-${s}`, modelo: 'Disco de un técnico' });
    };
    await escanear(raro).expect(200);
    [nuevo] = (await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body;
    await post(`/api/discrepancias/${nuevo.id}/rechazar`, { motivo: 'Disco de diagnóstico del técnico' }).expect(201);
    await escanear(raro).expect(200);
    expect((await get(`/api/discrepancias?activoId=${ids.activo}`).expect(200)).body).toHaveLength(0);
  });

  it('mantenimiento por falla técnica con equipo temporal para la trabajadora', async () => {
    const laptop = (await get('/api/catalogo/tipos-activo').expect(200)).body.find((t: { codigo: string }) => t.codigo === 'LAPTOP').id;
    ids.temporal = (await post('/api/activos', { nombre: `RESPALDO-${s}`, tipoActivoId: laptop, marcaNombre: 'Lenovo', modeloNombre: 'ThinkPad E14', ubicacionId: ids.almacen, estadoTecnico: 'OPERATIVO' }).expect(201)).body.id;

    const orden = (await post('/api/mantenimiento', {
      activoId: ids.activo, tipo: 'CORRECTIVO', motivo: 'FALLA_TECNICA', fallaReportada: 'No enciende la pantalla', estadoTecnico: 'AVERIADO',
      ubicacionTallerId: ids.taller, activoTemporalId: ids.temporal,
    }).expect(201)).body;
    ids.orden = orden.id;
    expect(orden.codigo).toMatch(/^OT-\d{6}$/);
    await post('/api/mantenimiento', { activoId: ids.activo, tipo: 'CORRECTIVO', motivo: 'OTRO', fallaReportada: 'Otra orden' }).expect(409);

    let principal = (await get(`/api/activos/${ids.activo}`).expect(200)).body;
    expect(principal).toMatchObject({ estadoTecnico: 'AVERIADO', ubicacionId: ids.taller, ordenAbierta: { id: ids.orden } });
    const temporal = (await get(`/api/activos/${ids.temporal}`).expect(200)).body;
    expect(temporal.asignacion).toMatchObject({ tipo: 'TEMPORAL_REEMPLAZO', personaId: ids.ana });
    const enMant = (await get('/api/activos?situacion=EN_MANTENIMIENTO&porPagina=500').expect(200)).body.items.map((x: { id: string }) => x.id);
    expect(enMant).toContain(ids.activo);

    await patch(`/api/mantenimiento/${ids.orden}`, { estado: 'EN_CURSO', diagnostico: 'Cable flex dañado' }).expect(200);
    await post(`/api/mantenimiento/${ids.orden}/cerrar`, { resultado: 'OPERATIVO', solucion: 'Se reemplazó el cable flex', costo: '45.50' }).expect(201);

    principal = (await get(`/api/activos/${ids.activo}`).expect(200)).body;
    expect(principal).toMatchObject({ estadoTecnico: 'OPERATIVO', ubicacionId: ids.oficina, ordenAbierta: null });
    expect(principal.asignacion).toMatchObject({ personaId: ids.ana });
    expect((await get(`/api/activos/${ids.temporal}`).expect(200)).body.asignacion).toBeNull();
  });

  it('transferencia a otro trabajador y baja con reglas', async () => {
    await post(`/api/asignaciones/${ids.asignacion}/transferir`, { personaId: ids.luis, observacion: 'Cambio de puesto' }).expect(201);
    expect((await get(`/api/activos/${ids.activo}`).expect(200)).body.asignacion).toMatchObject({ personaId: ids.luis });
    const deAna = (await get(`/api/asignaciones?personaId=${ids.ana}`).expect(200)).body;
    expect(deAna.every((x: { hasta: string | null }) => x.hasta)).toBe(true);

    await post(`/api/activos/${ids.temporal}/baja`, { motivo: 'DANO_FISICO' }).expect(400); // sin explicación
    await post(`/api/activos/${ids.temporal}/baja`, { motivo: 'DANO_FISICO', observacion: 'Pantalla rota' }).expect(201);
    await post('/api/asignaciones', { activoId: ids.temporal, tipo: 'PERMANENTE', personaId: ids.ana }).expect(400);
  });

  it('el historial del activo cuenta toda la historia', async () => {
    const h = (await get(`/api/activos/${ids.activo}/historial`).expect(200)).body.map((m: { tipo: string }) => m.tipo);
    for (const t of ['ALTA', 'VINCULACION', 'INSTALACION', 'ASIGNACION', 'RETIRO', 'MANTENIMIENTO_APERTURA', 'ESTADO_TECNICO', 'TRASLADO', 'MANTENIMIENTO_CIERRE', 'TRANSFERENCIA']) {
      expect(h).toContain(t);
    }
    const disco = (await get(`/api/componentes/${ids.discoOriginal}`).expect(200)).body.historial.map((m: { tipo: string }) => m.tipo);
    expect(disco).toEqual(expect.arrayContaining(['ALTA', 'INSTALACION', 'CONFIRMACION', 'RETIRO', 'REINGRESO']));
  });

  it('almacén: entradas, salidas sin saldo negativo y ajustes con motivo', async () => {
    const art = (await post('/api/almacen/articulos', { nombre: `Pasta térmica ${s}`, unidad: 'jeringa', stockMinimo: 5 }).expect(201)).body.id;
    await post('/api/almacen/movimientos', { articuloId: art, ubicacionId: ids.almacen, tipo: 'ENTRADA', cantidad: 10 }).expect(201);
    await post('/api/almacen/movimientos', { articuloId: art, ubicacionId: ids.almacen, tipo: 'SALIDA', cantidad: 3, ordenMantenimientoId: ids.orden }).expect(201);
    await post('/api/almacen/movimientos', { articuloId: art, ubicacionId: ids.almacen, tipo: 'SALIDA', cantidad: 20 }).expect(400);
    await post('/api/almacen/movimientos', { articuloId: art, ubicacionId: ids.almacen, tipo: 'AJUSTE', cantidad: 4 }).expect(400);
    const r = await post('/api/almacen/movimientos', { articuloId: art, ubicacionId: ids.almacen, tipo: 'AJUSTE', cantidad: 4, motivo: 'Inventario físico' }).expect(201);
    expect(r.body.saldo).toBe(4);
    const kardex = (await get(`/api/almacen/movimientos?articuloId=${art}`).expect(200)).body.map((m: { cantidad: number }) => m.cantidad);
    expect(kardex).toEqual([-3, -3, 10]);
  });

  it('garantías por vencer y documentos adjuntos', async () => {
    const hoy = new Date();
    const fin = new Date(hoy.getTime() + 10 * 86_400_000).toISOString().slice(0, 10);
    await post('/api/garantias', { activoId: ids.activo, tipo: 'FABRICANTE', proveedor: 'Dell', inicio: '2025-01-01', fin }).expect(201);
    const porVencer = (await get('/api/garantias?porVencer=30').expect(200)).body;
    expect(porVencer.some((g: { activoId: string }) => g.activoId === ids.activo)).toBe(true);

    const pdf = Buffer.from('%PDF-1.4\n% acta de entrega de prueba\n');
    const doc = (await api().post('/api/documentos').set(auth).field('entidad', 'ACTIVO').field('entidadId', ids.activo).field('tipo', 'ACTA_ENTREGA')
      .attach('archivo', pdf, { filename: 'acta-entrega-ñandú.pdf', contentType: 'application/pdf' }).expect(201)).body;
    expect(doc).toMatchObject({ nombreArchivo: 'acta-entrega-ñandú.pdf', tamanoBytes: pdf.length });
    const lista = (await get(`/api/documentos?entidad=ACTIVO&entidadId=${ids.activo}`).expect(200)).body;
    expect(lista).toHaveLength(1);
    const bajada = await get(`/api/documentos/${doc.id}/descargar`).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    }).expect(200);
    expect(Buffer.compare(bajada.body as Buffer, pdf)).toBe(0);
    await api().post('/api/documentos').set(auth).field('entidad', 'ACTIVO').field('entidadId', ids.activo).field('tipo', 'OTRO')
      .attach('archivo', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' }).expect(400);
  });

  it('panel de inicio y lista de activos con filtros', async () => {
    const p = (await get('/api/panel').expect(200)).body;
    expect(p.contadores.enServicio).toBeGreaterThanOrEqual(1);
    expect(p.contadores.garantiasPorVencer).toBeGreaterThanOrEqual(1);
    expect(p.actividad.length).toBeGreaterThan(0);
    const lista = (await get(`/api/activos?q=${NOMBRE}`).expect(200)).body;
    expect(lista.total).toBe(1);
    expect(lista.items[0]).toMatchObject({ nombre: NOMBRE, sincronizacion: 'SINCRONIZADO', asignacion: { responsable: `Luis ${s}` } });
    expect((await get(`/api/activos?q=RESPALDO-${s}`).expect(200)).body.total).toBe(0); // dado de baja: oculto por defecto
    expect((await get(`/api/activos?q=RESPALDO-${s}&cicloVida=DADO_DE_BAJA`).expect(200)).body.total).toBe(1);
  });

  it('la historia es inmutable para la API (permisos de SQL Server)', async () => {
    for (const sql of [
      'DELETE FROM [itam].[movimiento] WHERE 1 = 0',
      'UPDATE [itam].[movimiento] SET descripcion = N\'x\' WHERE 1 = 0',
      'DELETE FROM [itam].[escaneo] WHERE 1 = 0',
      'DELETE FROM [itam].[activo] WHERE 1 = 0',
      'DELETE FROM [itam].[instalacion] WHERE 1 = 0',
      'DELETE FROM [itam].[asignacion] WHERE 1 = 0',
    ]) {
      await expect(ctx.db.query(sql)).rejects.toThrow(/permission was denied/i);
    }
  });
});
