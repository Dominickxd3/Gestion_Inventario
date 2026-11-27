import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EquiposRepository } from './equipos.repository';
import { CambioHistorial, EquipoRegistrado, InventarioPayload, ResumenEquipo } from './inventario.types';

const GB = 1024 ** 3;

@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(private readonly repo: EquiposRepository) {}

  /** Crea o actualiza el equipo. El mismo equipo siempre genera el mismo id. */
  async registrar(payload: InventarioPayload, ipOrigen: string | null) {
    if (!payload?.equipo?.nombreEquipo) {
      throw new BadRequestException('El inventario no contiene equipo.nombreEquipo');
    }

    const id = this.identificar(payload);
    const ahora = new Date().toISOString();
    const resumen = this.resumir(payload);
    const existente = this.repo.obtener(id);

    let historial: CambioHistorial[] = [];
    if (existente) {
      historial = [...this.detectarCambios(existente.resumen, resumen, ahora), ...existente.historial].slice(0, 200);
    }

    const equipo: EquipoRegistrado = {
      id,
      primerRegistro: existente?.primerRegistro ?? ahora,
      ultimoReporte: ahora,
      totalReportes: (existente?.totalReportes ?? 0) + 1,
      ipOrigen,
      resumen,
      historial,
      inventario: payload,
    };
    await this.repo.guardar(equipo);

    this.logger.log(`${existente ? 'Actualizado' : 'NUEVO'} ${resumen.nombreEquipo} (${resumen.tipo}) desde ${ipOrigen}`);
    return { id, nuevo: !existente, cambios: historial.length - (existente?.historial.length ?? 0) };
  }

  listar() {
    return this.repo
      .listar()
      .map(({ inventario, historial, ...resto }) => ({ ...resto, cambiosRecientes: historial.length }))
      .sort((a, b) => b.ultimoReporte.localeCompare(a.ultimoReporte));
  }

  obtener(id: string) {
    const e = this.repo.obtener(id);
    if (!e) throw new NotFoundException('Equipo no encontrado');
    return e;
  }

  async eliminar(id: string) {
    if (!(await this.repo.eliminar(id))) throw new NotFoundException('Equipo no encontrado');
    return { eliminado: id };
  }

  estadisticas() {
    const equipos = this.repo.listar();
    const contar = (f: (e: EquipoRegistrado) => string | null | undefined) =>
      equipos.reduce<Record<string, number>>((acc, e) => {
        const k = f(e) ?? 'Sin dato';
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    const hace7dias = Date.now() - 7 * 24 * 3600 * 1000;
    return {
      total: equipos.length,
      porTipo: contar((e) => e.resumen.tipo),
      porFabricante: contar((e) => e.resumen.fabricante),
      porSistema: contar((e) => e.resumen.sistemaOperativo),
      sinReportar7dias: equipos.filter((e) => Date.parse(e.ultimoReporte) < hace7dias).length,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Prioridad: UUID de la placa -> número de serie -> MAC -> nombre del equipo.
   * Así, si renombran el equipo o cambia el usuario, sigue siendo el mismo registro.
   */
  private identificar(p: InventarioPayload): string {
    const eq = p.equipo;
    const mac = p.red?.find((r) => r.mac)?.mac;
    const clave = eq.uuid
      ? `uuid:${eq.uuid.toUpperCase()}`
      : eq.numeroSerie
        ? `serie:${eq.numeroSerie.toUpperCase()}`
        : mac
          ? `mac:${mac.toUpperCase()}`
          : `nombre:${eq.nombreEquipo.toUpperCase()}`;
    return createHash('sha1').update(clave).digest('hex').slice(0, 16);
  }

  private resumir(p: InventarioPayload): ResumenEquipo {
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

  /** Detecta cambios de hardware o de asignación entre reportes (p. ej. le quitaron RAM). */
  private detectarCambios(antes: ResumenEquipo, ahora: ResumenEquipo, fecha: string): CambioHistorial[] {
    const campos: (keyof ResumenEquipo)[] = [
      'nombreEquipo', 'usuario', 'procesador', 'ramGB', 'discos', 'gpu', 'sistemaOperativo', 'numeroSerie',
    ];
    return campos
      .filter((c) => String(antes[c] ?? '') !== String(ahora[c] ?? ''))
      .map((c) => ({
        fecha,
        campo: c,
        anterior: antes[c] == null ? null : String(antes[c]),
        nuevo: ahora[c] == null ? null : String(ahora[c]),
      }));
  }
}
