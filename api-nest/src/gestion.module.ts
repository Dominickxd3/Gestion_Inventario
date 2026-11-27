import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActivosController } from './activos/activos.controller';
import { ActivosService } from './activos/activos.service';
import { AsignacionesService, AsignarDto, DevolverDto, TransferirDto } from './asignaciones/asignaciones.service';
import { Actor } from './common/dominio';
import { BajaComponenteDto, CrearComponenteDto, DatosComponenteDto, InstalarDto, ReingresarDto, RetirarDto } from './componentes/componentes.dto';
import { ComponentesService } from './componentes/componentes.service';
import { DetectadosService, EquiposController } from './descubrimiento/equipos.controller';
import { IngestaService } from './descubrimiento/ingesta.service';
import { ReconciliacionService } from './descubrimiento/reconciliacion.service';
import { ScanGpController } from './descubrimiento/scangp.controller';
import { ActorActual, Roles } from './identidad/decoradores';
import {
  AbrirOrdenDto, ActualizarOrdenDto, CancelarOrdenDto, CerrarOrdenDto, MantenimientoService,
} from './mantenimiento/mantenimiento.service';
import { TrazabilidadService } from './trazabilidad/trazabilidad.service';

@Controller('componentes')
export class ComponentesController {
  constructor(private readonly componentes: ComponentesService) {}

  @Get() listar(@Query() q: Record<string, string>) {
    return this.componentes.listar({ ...q, pagina: Number(q.pagina) || 1, porPagina: Number(q.porPagina) || 100 });
  }
  @Get(':id') obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.componentes.obtener(id);
  }
  @Roles('ADMIN', 'TECNICO') @Post() crear(@Body() d: CrearComponenteDto, @ActorActual() a: Actor) {
    return this.componentes.crear(a, d);
  }
  @Roles('ADMIN', 'TECNICO') @Patch(':id') editar(@Param('id', ParseUUIDPipe) id: string, @Body() d: DatosComponenteDto, @ActorActual() a: Actor) {
    return this.componentes.editar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/instalar') instalar(@Param('id', ParseUUIDPipe) id: string, @Body() d: InstalarDto, @ActorActual() a: Actor) {
    return this.componentes.instalar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/retirar') retirar(@Param('id', ParseUUIDPipe) id: string, @Body() d: RetirarDto, @ActorActual() a: Actor) {
    return this.componentes.retirar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/reingresar') reingresar(@Param('id', ParseUUIDPipe) id: string, @Body() d: ReingresarDto, @ActorActual() a: Actor) {
    return this.componentes.reingresar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/baja') baja(@Param('id', ParseUUIDPipe) id: string, @Body() d: BajaComponenteDto, @ActorActual() a: Actor) {
    return this.componentes.darDeBaja(a, id, d);
  }
}

@Controller('asignaciones')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get() listar(@Query() q: Record<string, string>) {
    return this.asignaciones.listar({
      vigentes: q.vigentes === 'true', vencidas: q.vencidas === 'true', personaId: q.personaId, activoId: q.activoId, tipo: q.tipo,
    });
  }
  @Roles('ADMIN', 'TECNICO') @Post() asignar(@Body() d: AsignarDto, @ActorActual() a: Actor) {
    return this.asignaciones.asignar(a, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/devolver') devolver(@Param('id', ParseUUIDPipe) id: string, @Body() d: DevolverDto, @ActorActual() a: Actor) {
    return this.asignaciones.devolver(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/transferir') transferir(@Param('id', ParseUUIDPipe) id: string, @Body() d: TransferirDto, @ActorActual() a: Actor) {
    return this.asignaciones.transferir(a, id, d);
  }
}

@Controller('mantenimiento')
export class MantenimientoController {
  constructor(private readonly mantenimiento: MantenimientoService) {}

  @Get() listar(@Query() q: Record<string, string>) {
    return this.mantenimiento.listar({ estado: q.estado, activoId: q.activoId, abiertas: q.abiertas === 'true' });
  }
  @Get(':id') obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.mantenimiento.obtener(id);
  }
  @Roles('ADMIN', 'TECNICO') @Post() abrir(@Body() d: AbrirOrdenDto, @ActorActual() a: Actor) {
    return this.mantenimiento.abrir(a, d);
  }
  @Roles('ADMIN', 'TECNICO') @Patch(':id') actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() d: ActualizarOrdenDto, @ActorActual() a: Actor) {
    return this.mantenimiento.actualizar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/cerrar') cerrar(@Param('id', ParseUUIDPipe) id: string, @Body() d: CerrarOrdenDto, @ActorActual() a: Actor) {
    return this.mantenimiento.cerrar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/cancelar') cancelar(@Param('id', ParseUUIDPipe) id: string, @Body() d: CancelarOrdenDto, @ActorActual() a: Actor) {
    return this.mantenimiento.cancelar(a, id, d);
  }
}

/** Panel de inicio: lo que requiere atención, en una sola consulta. */
@Controller('panel')
export class PanelController {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly trazabilidad: TrazabilidadService,
  ) {}

  @Get()
  async panel() {
    const [c] = await this.db.query(`
      DECLARE @hoy date = CAST(SYSUTCDATETIME() AS date);
      DECLARE @dias int = (SELECT dias_sin_reporte FROM [itam].[organizacion_config] WHERE id = 1);
      DECLARE @aviso int = (SELECT dias_aviso_garantia FROM [itam].[organizacion_config] WHERE id = 1);
      SELECT
        (SELECT COUNT(*) FROM [itam].[activo] WHERE ciclo_vida = 'EN_SERVICIO') AS enServicio,
        (SELECT COUNT(*) FROM [itam].[activo] WHERE ciclo_vida = 'FUERA_DE_SERVICIO') AS fueraDeServicio,
        (SELECT COUNT(*) FROM [itam].[asignacion] WHERE hasta IS NULL) AS asignados,
        (SELECT COUNT(*) FROM [itam].[activo] a WHERE a.ciclo_vida = 'EN_SERVICIO'
            AND NOT EXISTS (SELECT 1 FROM [itam].[asignacion] x WHERE x.activo_id = a.id AND x.hasta IS NULL)
            AND NOT EXISTS (SELECT 1 FROM [itam].[orden_mantenimiento] o WHERE o.activo_id = a.id AND o.estado IN ('ABIERTA','EN_CURSO','EN_ESPERA'))) AS disponibles,
        (SELECT COUNT(*) FROM [itam].[orden_mantenimiento] WHERE estado IN ('ABIERTA','EN_CURSO','EN_ESPERA')) AS enMantenimiento,
        (SELECT COUNT(*) FROM [itam].[componente] WHERE situacion = 'EN_ALMACEN') AS componentesEnAlmacen,
        (SELECT COUNT(*) FROM [itam].[componente] WHERE situacion = 'EN_MANTENIMIENTO') AS componentesEnMantenimiento,
        (SELECT COUNT(*) FROM [itam].[discrepancia] WHERE estado = 'PENDIENTE') AS discrepancias,
        (SELECT COUNT(*) FROM [itam].[asignacion] WHERE hasta IS NULL AND hasta_previsto < @hoy) AS prestamosVencidos,
        (SELECT COUNT(*) FROM [itam].[garantia] WHERE vigente = 1 AND fin BETWEEN @hoy AND DATEADD(day, @aviso, @hoy)) AS garantiasPorVencer,
        (SELECT COUNT(*) FROM [itam].[dispositivo_detectado] WHERE activo_id IS NULL AND archivado = 0) AS detectadosSinRegistrar,
        (SELECT COUNT(*) FROM [itam].[dispositivo_detectado] d JOIN [itam].[activo] a ON a.id = d.activo_id
            WHERE a.ciclo_vida <> 'DADO_DE_BAJA' AND d.ultimo_reporte < DATEADD(day, -@dias, SYSUTCDATETIME())) AS sinReporte,
        (SELECT COUNT(*) FROM [itam].[articulo] ar WHERE ar.activo = 1 AND ar.stock_minimo > 0
            AND (SELECT ISNULL(SUM(cantidad), 0) FROM [itam].[existencia] e WHERE e.articulo_id = ar.id) < ar.stock_minimo) AS articulosBajoMinimo,
        @dias AS diasSinReporte, @aviso AS diasAvisoGarantia`);
    return { contadores: c, actividad: await this.trazabilidad.recientes(15) };
  }
}

/** Gestión de activos: descubrimiento, activos, componentes, asignaciones y mantenimiento. */
@Module({
  controllers: [
    EquiposController, ScanGpController, ActivosController, ComponentesController, AsignacionesController, MantenimientoController, PanelController,
  ],
  providers: [
    TrazabilidadService, ActivosService, ComponentesService, AsignacionesService, MantenimientoService,
    IngestaService, ReconciliacionService, DetectadosService,
  ],
})
export class GestionModule {}
