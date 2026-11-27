import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { Activo } from '../activos/activo.entity';
import { ActivosService } from '../activos/activos.service';
import { serieValida, uuidValido } from '../common/identificacion';
import { uuid7 } from '../common/uuid7';
import { CambioDetectado, DispositivoDetectado, Escaneo } from './descubrimiento.entities';
import { InventarioPayload, ResumenEquipo } from './inventario.types';
import { ReconciliacionService } from './reconciliacion.service';
import { erroresInventario } from './validacion';

const GB = 1024 ** 3;

/** Campos del resumen cuyo cambio queda en el historial del equipo detectado. */
const CAMPOS_HISTORIAL: (keyof ResumenEquipo)[] = [
  'nombreEquipo', 'usuario', 'procesador', 'ramGB', 'discos', 'gpu', 'sistemaOperativo', 'numeroSerie',
];

/**
 * Recepción de inventarios de ScanGP (mundo detectado). El contrato de POST /api/inventario no cambia.
 * Nunca modifica el inventario validado: si el equipo está vinculado a un activo, la reconciliación
 * genera discrepancias para que TI las revise.
 */
@Injectable()
export class IngestaService {
  private readonly logger = new Logger(IngestaService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly reconciliacion: ReconciliacionService,
    private readonly activos: ActivosService,
  ) {}

  async registrar(payload: InventarioPayload, ipOrigen: string | null, recibidoEn = new Date()) {
    const errores = erroresInventario(payload);
    if (errores.length) throw new BadRequestException({ message: errores, error: 'Inventario inválido' });

    const { id, clave } = identificar(payload);
    const resumen = resumir(payload);
    const hash = hashContenido(payload);

    const r = await this.db.transaction(async (em) => {
      const [bloqueado] = await em.query(`SELECT id FROM [itam].[dispositivo_detectado] WITH (UPDLOCK, HOLDLOCK) WHERE id = @0`, [id]);
      const existente = bloqueado ? await em.findOneByOrFail(DispositivoDetectado, { id }) : null;

      // Solo se guarda una instantánea nueva si cambió algo más que los datos volátiles.
      let escaneoId = existente?.ultimoEscaneoId ?? null;
      const [ultimo] = escaneoId ? await em.query(`SELECT datos_hash FROM [itam].[escaneo] WHERE id = @0`, [escaneoId]) : [];
      const escaneoNuevo = !ultimo || ultimo.datos_hash !== hash;
      if (escaneoNuevo) {
        escaneoId = uuid7();
        await em.insert(Escaneo, {
          id: escaneoId,
          dispositivoId: id,
          recibidoEn,
          ipOrigen,
          agenteVersion: payload.agenteVersion?.slice(0, 32) ?? null,
          datosHash: hash,
          datos: payload as unknown as Record<string, unknown>,
        });
      }

      const cambios = existente ? diferencias(existente.resumen as unknown as ResumenEquipo, resumen) : [];
      for (const c of cambios) {
        await em.insert(CambioDetectado, { id: uuid7(), dispositivoId: id, escaneoId, fecha: recibidoEn, ...c });
      }

      const d = existente ?? em.create(DispositivoDetectado, { id, primerRegistro: recibidoEn, totalReportes: 0, activoId: null, archivado: false });
      Object.assign(d, {
        clave,
        nombreEquipo: payload.equipo.nombreEquipo.slice(0, 256),
        resumen: resumen as unknown as Record<string, unknown>,
        ultimoReporte: recibidoEn,
        totalReportes: d.totalReportes + 1,
        ipOrigen,
        ultimoEscaneoId: escaneoId,
        ultimoInventario: payload as unknown as Record<string, unknown>,
        archivado: false,
      });
      await em.save(d);

      if (!d.activoId) await this.vincularPorEtiqueta(em, d, payload);
      return { dispositivo: d, nuevo: !existente, cambios: cambios.length, escaneoId: escaneoId!, escaneoNuevo };
    });

    this.logger.log(`${r.nuevo ? 'NUEVO' : 'Actualizado'} ${resumen.nombreEquipo} (${resumen.tipo}) desde ${ipOrigen}${r.escaneoNuevo ? '' : ' · sin cambios'}`);

    // La reconciliación va aparte: si falla, el escaneo ya quedó guardado y se reintenta en el próximo reporte.
    if (r.dispositivo.activoId) {
      try {
        await this.reconciliacion.reconciliar(r.dispositivo.activoId, r.dispositivo.id, r.escaneoId, payload);
      } catch (e) {
        this.logger.error(`Reconciliación de ${resumen.nombreEquipo} falló: ${(e as Error).message}`);
      }
    }
    return { id: r.dispositivo.id, nuevo: r.nuevo, cambios: r.cambios };
  }

  /**
   * Si en la BIOS se grabó el código patrimonial como etiqueta de activo (Asset Tag), el equipo
   * se vincula solo con ese activo, siempre que el activo no tenga ya otro equipo vinculado.
   */
  private async vincularPorEtiqueta(em: EntityManager, d: DispositivoDetectado, p: InventarioPayload) {
    const etiqueta = String(p.equipo.etiquetaActivo ?? '').trim().toUpperCase();
    if (!etiqueta || etiqueta.length > 32 || !serieValida(etiqueta)) return;
    const activo = await em.findOneBy(Activo, { codigoPatrimonial: etiqueta });
    if (!activo || activo.cicloVida === 'DADO_DE_BAJA') return;
    if (await em.existsBy(DispositivoDetectado, { activoId: activo.id })) return;
    await this.activos.vincular({ id: null, nombreUsuario: null, ip: null }, activo.id, d.id, em, true);
    d.activoId = activo.id;
  }
}

// -------------------------------------------------------------------------- Funciones puras

/** Prioridad: UUID de la placa → número de serie → MAC → nombre. Ignora valores de relleno (riesgo R4). */
export function identificar(p: InventarioPayload): { id: string; clave: string } {
  const eq = p.equipo;
  const mac = p.red?.map((r) => r.mac).find((m) => m && !/^(00[:-]?){5}00$/i.test(m));
  const clave = uuidValido(eq.uuid)
    ? `uuid:${eq.uuid.trim().toUpperCase()}`
    : serieValida(eq.numeroSerie)
      ? `serie:${eq.numeroSerie.trim().toUpperCase()}`
      : mac
        ? `mac:${mac.toUpperCase()}`
        : `nombre:${eq.nombreEquipo.trim().toUpperCase()}`;
  return { id: createHash('sha1').update(clave).digest('hex').slice(0, 16), clave };
}

export function resumir(p: InventarioPayload): ResumenEquipo {
  const cpu = p.procesadores?.[0];
  const discosInternos = (p.discos ?? []).filter((d) => !d.externo);
  const totalDisco = discosInternos.reduce((s, d) => s + (d.capacidadBytes ?? 0), 0);
  const red = p.red?.find((r) => r.conectado) ?? p.red?.[0];
  const so = p.sistemaOperativo;
  return {
    nombreEquipo: p.equipo.nombreEquipo,
    usuario: p.equipo.usuario,
    tipo: p.equipo.tipo ?? 'DESCONOCIDO',
    fabricante: p.equipo.fabricante,
    modelo: p.equipo.modelo,
    numeroSerie: p.equipo.numeroSerie,
    procesador: cpu?.nombre ?? null,
    nucleos: cpu?.nucleos ?? null,
    ramGB: p.memoria?.instaladaBytes ? Math.round(p.memoria.instaladaBytes / GB) : null,
    almacenamientoGB: totalDisco ? Math.round(totalDisco / 1e9) : null,
    discos: discosInternos.length
      ? discosInternos.map((d) => `${d.tipo} ${Math.round((d.capacidadBytes ?? 0) / 1e9)}GB`).join(' + ')
      : null,
    gpu: p.graficos?.map((g) => g.nombre).filter(Boolean).join(' / ') || null,
    sistemaOperativo: so?.nombre ? `${so.nombre}${so.versionComercial ? ' ' + so.versionComercial : ''}` : null,
    ip: red?.ips?.find((ip) => ip.includes('.')) ?? null,
    mac: red?.mac ?? null,
  };
}

export function diferencias(antes: ResumenEquipo, ahora: ResumenEquipo) {
  return CAMPOS_HISTORIAL.filter((c) => String(antes?.[c] ?? '') !== String(ahora[c] ?? '')).map((c) => ({
    campo: c,
    anterior: antes?.[c] == null ? null : String(antes[c]).slice(0, 500),
    nuevo: ahora[c] == null ? null : String(ahora[c]).slice(0, 500),
  }));
}

/** Datos que cambian en cada ejecución y no indican un cambio del equipo. */
const VOLATILES: Record<string, string[]> = {
  '': ['fechaRecoleccion'],
  sistemaOperativo: ['ultimoArranque'],
  bateria: ['cargaPorcentaje'],
  red: ['ips', 'velocidadBps', 'conectado'],
  volumenes: ['libreBytes'],
  antivirus: ['actualizado'],
};

export function hashContenido(p: InventarioPayload): string {
  const quitar = (o: unknown, campos: string[]): unknown =>
    Array.isArray(o)
      ? o.map((x) => quitar(x, campos))
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).filter(([k]) => !campos.includes(k)))
        : o;
  const copia: Record<string, unknown> = { ...(p as Record<string, unknown>) };
  for (const [seccion, campos] of Object.entries(VOLATILES)) {
    if (seccion === '') for (const c of campos) delete copia[c];
    else if (copia[seccion] != null) copia[seccion] = quitar(copia[seccion], campos);
  }
  return createHash('sha256').update(jsonEstable(copia)).digest('hex');
}

/** JSON con las claves ordenadas: el mismo contenido da siempre el mismo hash. */
function jsonEstable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${jsonEstable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
