import { Body, Controller, Get, HttpCode, Injectable, Ip, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CrearActivoDto } from '../activos/activos.dto';
import { ActivosService } from '../activos/activos.service';
import { TipoActivo, TipoComponente } from '../catalogo/catalogo.entities';
import { Actor, regla } from '../common/dominio';
import { ComponentesService } from '../componentes/componentes.service';
import { ActorActual, Publico, Roles } from '../identidad/decoradores';
import { ApiKeyGuard } from './api-key.guard';
import { componentesDetectados, integradosDelInventario } from './componentes-detectados';
import { CambioDetectado, DispositivoDetectado } from './descubrimiento.entities';
import { IngestaService } from './ingesta.service';
import type { InventarioPayload } from './inventario.types';
import { AceptarDiscrepanciaDto, ReconciliacionService, RechazarDiscrepanciaDto } from './reconciliacion.service';

@Injectable()
export class DetectadosService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly activos: ActivosService,
    private readonly componentes: ComponentesService,
  ) {}

  /** Lista de equipos detectados (misma forma que la versión con archivo JSON, más el vínculo con el activo). */
  async listar() {
    const filas: Record<string, unknown>[] = await this.db.query(
      `SELECT d.id, d.primer_registro, d.ultimo_reporte, d.total_reportes, d.ip_origen, d.resumen, d.activo_id,
              a.codigo_patrimonial,
              (SELECT COUNT(*) FROM [itam].[cambio_detectado] c WHERE c.dispositivo_id = d.id) AS cambios
       FROM [itam].[dispositivo_detectado] d LEFT JOIN [itam].[activo] a ON a.id = d.activo_id
       WHERE d.archivado = 0 ORDER BY d.ultimo_reporte DESC`,
    );
    return filas.map((f) => ({
      id: f.id,
      primerRegistro: f.primer_registro,
      ultimoReporte: f.ultimo_reporte,
      totalReportes: f.total_reportes,
      ipOrigen: f.ip_origen,
      resumen: JSON.parse(f.resumen as string),
      cambiosRecientes: f.cambios,
      activoId: f.activo_id,
      codigoPatrimonial: f.codigo_patrimonial ?? null,
    }));
  }

  async obtener(id: string) {
    const d = await this.db.getRepository(DispositivoDetectado).findOneBy({ id });
    if (!d) throw new NotFoundException('Equipo no encontrado');
    const [historial, escaneos, activo] = await Promise.all([
      this.db.getRepository(CambioDetectado).find({ where: { dispositivoId: id }, order: { fecha: 'DESC' }, take: 500 }),
      this.db.query(`SELECT id, recibido_en AS recibidoEn, agente_version AS agenteVersion FROM [itam].[escaneo] WHERE dispositivo_id = @0 ORDER BY recibido_en DESC`, [id]),
      d.activoId ? this.db.query(`SELECT id, codigo_patrimonial AS codigoPatrimonial, nombre FROM [itam].[activo] WHERE id = @0`, [d.activoId]) : [],
    ]);
    return {
      id: d.id,
      primerRegistro: d.primerRegistro,
      ultimoReporte: d.ultimoReporte,
      totalReportes: d.totalReportes,
      ipOrigen: d.ipOrigen,
      resumen: d.resumen,
      historial: historial.map((c) => ({ fecha: c.fecha, campo: c.campo, anterior: c.anterior, nuevo: c.nuevo })),
      inventario: d.ultimoInventario,
      escaneos,
      activo: activo[0] ?? null,
    };
  }

  async escaneo(id: string, escaneoId: string) {
    const [e] = await this.db.query(`SELECT datos FROM [itam].[escaneo] WHERE id = @0 AND dispositivo_id = @1`, [escaneoId, id]);
    if (!e) throw new NotFoundException('Escaneo no encontrado');
    return JSON.parse(e.datos);
  }

  async archivar(id: string) {
    const repo = this.db.getRepository(DispositivoDetectado);
    const d = await repo.findOneBy({ id });
    if (!d) throw new NotFoundException('Equipo no encontrado');
    d.archivado = true;
    await repo.save(d);
    return { archivado: id };
  }

  async estadisticas() {
    const equipos = await this.listar();
    const contar = (f: (e: (typeof equipos)[number]) => unknown) =>
      equipos.reduce<Record<string, number>>((acc, e) => {
        const k = String(f(e) ?? 'Sin dato');
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    const hace7 = Date.now() - 7 * 86_400_000;
    return {
      total: equipos.length,
      porTipo: contar((e) => e.resumen.tipo),
      porFabricante: contar((e) => e.resumen.fabricante),
      porSistema: contar((e) => e.resumen.sistemaOperativo),
      sinReportar7dias: equipos.filter((e) => new Date(e.ultimoReporte as string).getTime() < hace7).length,
    };
  }

  /** Datos propuestos para dar de alta el activo a partir de lo que detectó ScanGP. */
  async sugerencia(id: string) {
    const d = await this.db.getRepository(DispositivoDetectado).findOneBy({ id });
    if (!d) throw new NotFoundException('Equipo no encontrado');
    regla(!d.activoId, 'Este equipo ya está vinculado a un activo');
    const p = d.ultimoInventario as unknown as InventarioPayload;
    const r = d.resumen as Record<string, unknown>;
    const tipo = await this.db.getRepository(TipoActivo).findOneBy({ codigo: String(p.equipo.tipo ?? 'OTRO') })
      ?? await this.db.getRepository(TipoActivo).findOneByOrFail({ codigo: 'OTRO' });
    const detectados = componentesDetectados(p);
    return {
      dispositivoId: d.id,
      nombre: p.equipo.nombreEquipo,
      tipoActivoId: tipo.id,
      tipoNombre: tipo.nombre,
      marcaNombre: p.equipo.fabricante?.replace(/\s+(Inc\.?|Corporation|Corp\.?|Co\.,? Ltd\.?)$/i, '').trim() || null,
      modeloNombre: p.equipo.modelo ?? null,
      numeroSerie: p.equipo.numeroSerie ?? null,
      etiquetaActivoBios: p.equipo.etiquetaActivo ?? null,
      especificaciones: {
        procesador: r.procesador, nucleos: r.nucleos, ramGB: r.ramGB, almacenamiento: r.discos, graficos: r.gpu, sistemaOperativo: r.sistemaOperativo,
      },
      componentes: detectados.filter((c) => !c.integrado).map(({ tipo, marca, modelo, numeroSerie, capacidad }) => ({ tipo, marca, modelo, numeroSerie, capacidad })),
      integrados: integradosDelInventario(p),
    };
  }

  /** Alta del activo desde lo detectado: activo + vínculo + componentes rastreables instalados, en una transacción. */
  async altaDesdeDeteccion(actor: Actor, dto: CrearActivoDto) {
    regla(!!dto.dispositivoId, 'Falta el equipo detectado');
    return this.db.transaction(async (em) => {
      const activo = await this.activos.crear(actor, dto, em);
      for (const c of dto.componentes ?? []) {
        const tipo = await em.findOneBy(TipoComponente, { codigo: c.tipo });
        regla(!!tipo, `Tipo de componente desconocido: ${c.tipo}`);
        await this.componentes.crear(actor, {
          tipoComponenteId: tipo!.id, marca: c.marca, modelo: c.modelo, numeroSerie: c.numeroSerie, capacidad: c.capacidad,
          activoId: activo.id, motivo: 'ACTUALIZACION', observaciones: 'Registrado desde la detección de ScanGP',
        }, em);
      }
      return activo;
    });
  }
}

@Controller()
export class EquiposController {
  constructor(
    private readonly ingesta: IngestaService,
    private readonly detectados: DetectadosService,
    private readonly reconciliacion: ReconciliacionService,
  ) {}

  /** Endpoint que usa el agente de Windows: sin sesión, protegido por API key. El contrato no cambia. */
  @Publico()
  @Post('inventario')
  @HttpCode(200)
  @UseGuards(ApiKeyGuard)
  registrar(@Body() payload: InventarioPayload, @Ip() ip: string) {
    return this.ingesta.registrar(payload, ip?.replace('::ffff:', '') ?? null);
  }

  // Equipos detectados (respuestas compatibles con la versión anterior de la web).
  @Get('equipos') listar() {
    return this.detectados.listar();
  }
  @Get('equipos/:id') obtener(@Param('id') id: string) {
    return this.detectados.obtener(id);
  }
  @Get('equipos/:id/escaneos/:escaneoId') escaneo(@Param('id') id: string, @Param('escaneoId', ParseUUIDPipe) escaneoId: string) {
    return this.detectados.escaneo(id, escaneoId);
  }
  /** Ya no borra: archiva (los escaneos y el historial se conservan). */
  @Roles('ADMIN') @Post('equipos/:id/archivar') archivar(@Param('id') id: string) {
    return this.detectados.archivar(id);
  }
  @Get('estadisticas') estadisticas() {
    return this.detectados.estadisticas();
  }

  @Roles('ADMIN', 'TECNICO') @Get('equipos/:id/sugerencia-activo') sugerencia(@Param('id') id: string) {
    return this.detectados.sugerencia(id);
  }
  @Roles('ADMIN', 'TECNICO') @Post('equipos/alta-activo') alta(@Body() dto: CrearActivoDto, @ActorActual() a: Actor) {
    return this.detectados.altaDesdeDeteccion(a, dto);
  }

  // Discrepancias.
  @Get('discrepancias') discrepancias(@Query('estado') estado?: string, @Query('activoId') activoId?: string) {
    return this.reconciliacion.listar(estado ?? 'PENDIENTE', activoId);
  }
  @Roles('ADMIN', 'TECNICO') @Post('discrepancias/:id/aceptar') aceptar(@Param('id', ParseUUIDPipe) id: string, @Body() d: AceptarDiscrepanciaDto, @ActorActual() a: Actor) {
    return this.reconciliacion.aceptar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post('discrepancias/:id/rechazar') rechazar(@Param('id', ParseUUIDPipe) id: string, @Body() d: RechazarDiscrepanciaDto, @ActorActual() a: Actor) {
    return this.reconciliacion.rechazar(a, id, d);
  }
}
