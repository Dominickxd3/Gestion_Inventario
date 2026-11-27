import { EntityManager } from 'typeorm';
import { Activo } from '../activos/activo.entity';
import { ActivosService } from '../activos/activos.service';
import { TipoActivo, TipoComponente } from '../catalogo/catalogo.entities';
import { Componente, Instalacion } from '../componentes/componentes.entities';
import { ComponentesService } from '../componentes/componentes.service';
import { componentesDetectados, integradosDelInventario } from './componentes-detectados';
import { DispositivoDetectado } from './descubrimiento.entities';
import { diferenciasHardware, resumir } from './ingesta.service';
import type { InventarioPayload } from './inventario.types';
import { ausenciaConfirmada, RegistroAutomaticoService } from './registro-automatico.service';
import fixture from '../../test/fixtures/inventario-scangp-1.1.json';

const payload = (n = 1): InventarioPayload => {
  const p = JSON.parse(JSON.stringify(fixture)) as InventarioPayload;
  p.equipo.nombreEquipo = 'PC-' + n;
  p.equipo.numeroSerie = 'EQUIPO-SERIE-' + n;
  p.discos![0].numeroSerie = 'DISCO-SERIE-' + n;
  p.monitores = [];
  return p;
};

/** Repositorio en memoria: prueba la orquestación sin tocar la base real. */
function preparar() {
  const tablas = new Map<unknown, any[]>([[Activo, []], [Componente, []], [Instalacion, []], [DispositivoDetectado, []]]);
  let secuencia = 0;
  const filas = (t: unknown) => tablas.get(t)!;
  const buscar = (t: unknown, w: any) => filas(t).filter((x) => Object.entries(w).every(([k, v]) => x[k] === v));
  const em = {
    findBy: jest.fn(async (t, w) => buscar(t, w)),
    existsBy: jest.fn(async (t, w) => buscar(t, w).length > 0),
    findOneBy: jest.fn(async (t, w) => t === TipoActivo || t === TipoComponente ? { id: w.codigo, codigo: w.codigo } : buscar(t, w)[0] ?? null),
    findOneByOrFail: jest.fn(async (t, w) => t === TipoActivo || t === TipoComponente ? { id: w.codigo } : buscar(t, w)[0]),
    update: jest.fn(async () => undefined),
  };
  const instalar = async (_actor: unknown, id: string, dto: any) => {
    filas(Instalacion).push({ componenteId: id, activoId: dto.activoId });
    filas(Componente).find((x) => x.id === id).situacion = 'INSTALADO';
  };
  // IsNull es una expresión de TypeORM, no un literal de JavaScript.
  em.findOneBy.mockImplementation(async (t, w) => {
    if (t === TipoActivo || t === TipoComponente) return { id: w.codigo, codigo: w.codigo };
    const plain = { ...w }; delete plain.hasta;
    return buscar(t, plain)[0] ?? null;
  });
  const activos = {
    crear: jest.fn(async (_actor, dto) => {
      const a = { id: 'A-' + ++secuencia, ...dto, cicloVida: 'EN_SERVICIO' };
      filas(Activo).push(a);
      filas(DispositivoDetectado).find((x) => x.id === dto.dispositivoId).activoId = a.id;
      return a;
    }),
    vincular: jest.fn(async (_actor, id, dispositivoId) => { filas(DispositivoDetectado).find((x) => x.id === dispositivoId).activoId = id; }),
  };
  const componentes = {
    crear: jest.fn(async (_actor, dto) => {
      const c = { id: 'C-' + ++secuencia, ...dto, huella: dto.tipoComponenteId + ':' + dto.numeroSerie.toUpperCase(), situacion: 'INSTALADO' };
      filas(Componente).push(c); await instalar(null, c.id, dto); return c;
    }),
    instalar: jest.fn(instalar),
    trasladar: jest.fn(async (_actor, id, destino) => {
      const inst = filas(Instalacion).find((x) => x.componenteId === id);
      inst.activoId = destino;
    }),
  };
  const servicio = new RegistroAutomaticoService(activos as unknown as ActivosService, componentes as unknown as ComponentesService);
  const dispositivo = (p: InventarioPayload) => {
    const d = { id: p.equipo.nombreEquipo, activoId: null, ultimoInventario: p, ultimoReporte: new Date() } as unknown as DispositivoDetectado;
    filas(DispositivoDetectado).push(d); return d;
  };
  const sincronizar = (d: DispositivoDetectado, p: InventarioPayload, soloAltas = false) => servicio.sincronizar(em as unknown as EntityManager, d, p, resumir(p), soloAltas);
  return { filas, em, activos, componentes, dispositivo, sincronizar };
}

describe('Registro automático de ScanGP', () => {
  it('desglosa diez máquinas y no duplica al repetir el mapeo', async () => {
    const c = preparar();
    for (let n = 1; n <= 10; n++) {
      const p = payload(n), d = c.dispositivo(p);
      await c.sincronizar(d, p); await c.sincronizar(d, p);
    }
    expect(c.activos.crear).toHaveBeenCalledTimes(10);
    expect(c.componentes.crear).toHaveBeenCalledTimes(10);
    expect(c.filas(Instalacion)).toHaveLength(10);
    expect(c.em.update).toHaveBeenCalled();
  });
  it('registra disco, RAM extraíble y monitor con identidades separadas', async () => {
    const c = preparar(), p = payload();
    p.memoria!.modulos = [{ capacidadBytes: 8589934592, numeroSerie: 'RAM-12345', tipo: 'DDR4', soldado: false }];
    p.monitores = [{ fabricante: 'Dell', modelo: 'P2419H', numeroSerie: 'MONITOR-12345' }];
    await c.sincronizar(c.dispositivo(p), p);
    expect(c.filas(Componente).map((x) => x.tipoComponenteId).sort()).toEqual(['DISCO', 'MONITOR', 'RAM']);
  });
  it('completa un escaneo guardado sin duplicar y sin mover piezas conocidas', async () => {
    const c = preparar(), p = payload(), d = c.dispositivo(p);
    await c.sincronizar(d, p, true); await c.sincronizar(d, p, true);
    expect(c.activos.crear).toHaveBeenCalledTimes(1);
    expect(c.componentes.crear).toHaveBeenCalledTimes(1);
    expect(c.componentes.trasladar).not.toHaveBeenCalled();
    expect(c.componentes.instalar).not.toHaveBeenCalled();
  });
  it('el completado histórico no reinstala una pieza que ya está en almacén', async () => {
    const c = preparar(), p = payload();
    c.filas(Componente).push({ id: 'pieza', huella: 'DISCO:DISCO-SERIE-1', situacion: 'EN_ALMACEN' });
    await c.sincronizar(c.dispositivo(p), p, true);
    expect(c.componentes.instalar).not.toHaveBeenCalled();
  });
  it('reutiliza un activo existente con serie inequívoca', async () => {
    const c = preparar(), p = payload(), d = c.dispositivo(p);
    c.filas(Activo).push({ id: 'existente', numeroSerie: p.equipo.numeroSerie, cicloVida: 'EN_SERVICIO' });
    await c.sincronizar(d, p);
    expect(c.activos.crear).not.toHaveBeenCalled(); expect(d.activoId).toBe('existente');
  });
  it('no crea ni fusiona equipos con series ambiguas o ya vinculadas', async () => {
    const c = preparar(), p = payload(), d = c.dispositivo(p);
    c.filas(Activo).push({ id: 'uno', numeroSerie: p.equipo.numeroSerie }, { id: 'dos', numeroSerie: p.equipo.numeroSerie });
    await c.sincronizar(d, p);
    expect(c.activos.crear).not.toHaveBeenCalled(); expect(d.activoId).toBeNull();
  });
  it('no traslada si ambos equipos aún reportan la misma pieza', async () => {
    const c = preparar(), p = payload(1), origen = c.dispositivo(p);
    await c.sincronizar(origen, p);
    const destino = payload(2); destino.discos![0].numeroSerie = p.discos![0].numeroSerie;
    await c.sincronizar(c.dispositivo(destino), destino);
    expect(c.componentes.trasladar).not.toHaveBeenCalled();
    expect(c.componentes.crear).toHaveBeenCalledTimes(1);
  });
  it('traslada la misma identidad si el origen ya no reporta la pieza', async () => {
    const c = preparar(), p = payload(1), origen = c.dispositivo(p);
    await c.sincronizar(origen, p);
    const sinDisco = payload(1); sinDisco.discos = []; origen.ultimoInventario = sinDisco;
    const destino = payload(2); destino.discos![0].numeroSerie = p.discos![0].numeroSerie;
    const d = c.dispositivo(destino); await c.sincronizar(d, destino);
    expect(c.componentes.trasladar).toHaveBeenCalledWith(expect.objectContaining({ nombreUsuario: 'ScanGP' }), expect.any(String), d.activoId, expect.any(String), expect.anything());
    expect(c.componentes.crear).toHaveBeenCalledTimes(1);
  });
  it('no reactiva piezas dadas de baja o en mantenimiento', async () => {
    for (const situacion of ['DADO_DE_BAJA', 'EN_MANTENIMIENTO']) {
      const c = preparar(), p = payload();
      c.filas(Componente).push({ id: 'pieza', huella: 'DISCO:DISCO-SERIE-1', situacion });
      await c.sincronizar(c.dispositivo(p), p);
      expect(c.componentes.instalar).not.toHaveBeenCalled(); expect(c.componentes.crear).not.toHaveBeenCalled();
    }
  });
  it('reinstala desde almacén conservando la identidad', async () => {
    const c = preparar(), p = payload();
    c.filas(Componente).push({ id: 'pieza', huella: 'DISCO:DISCO-SERIE-1', situacion: 'EN_ALMACEN' });
    await c.sincronizar(c.dispositivo(p), p);
    expect(c.componentes.instalar).toHaveBeenCalled(); expect(c.componentes.crear).not.toHaveBeenCalled();
  });
  it('las piezas sin serie quedan integradas; no se les inventa identidad', () => {
    const p = payload(); p.discos![0].numeroSerie = 'UNKNOWN';
    expect(componentesDetectados(p).every((x) => x.integrado)).toBe(true);
    expect(integradosDelInventario(p)).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'CPU' }), expect.objectContaining({ tipo: 'GPU' }), expect.objectContaining({ tipo: 'PLACA' })]));
  });
  it('una lectura fallida no demuestra ausencia', () => {
    const p = payload(); p.discos = null;
    expect(ausenciaConfirmada(p, 'DISCO', 'DISCO:DISCO-SERIE-1')).toBe(false);
    p.discos = []; expect(ausenciaConfirmada(p, 'DISCO', 'DISCO:DISCO-SERIE-1')).toBe(true);
  });
  it('el cambio de serie deja historial aunque no cambie modelo ni capacidad', () => {
    const antes = payload(), ahora = payload(); ahora.discos![0].numeroSerie = 'OTRA-SERIE';
    expect(diferenciasHardware(antes, ahora)).toEqual([expect.objectContaining({ campo: 'hardware.discos' })]);
    expect(diferenciasHardware(antes, antes)).toEqual([]);
  });
});
