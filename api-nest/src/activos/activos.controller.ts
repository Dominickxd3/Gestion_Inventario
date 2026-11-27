import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Actor } from '../common/dominio';
import { ReemplazarDto } from '../componentes/componentes.dto';
import { ComponentesService } from '../componentes/componentes.service';
import { integradosDelInventario } from '../descubrimiento/componentes-detectados';
import type { InventarioPayload } from '../descubrimiento/inventario.types';
import { ActorActual, Roles } from '../identidad/decoradores';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BajaDto, CicloDto, CrearActivoDto, DatosActivoDto, EstadoTecnicoDto, FiltroActivosDto, UbicacionDto, VincularDto } from './activos.dto';
import { RegistroAutomaticoService } from '../descubrimiento/registro-automatico.service';
import { DispositivoDetectado } from '../descubrimiento/descubrimiento.entities';
import { resumir } from '../descubrimiento/ingesta.service';
import { ActivosService } from './activos.service';

@Controller('activos')
export class ActivosController {
  constructor(
    private readonly activos: ActivosService,
    private readonly componentes: ComponentesService,
    private readonly automatico: RegistroAutomaticoService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  @Get() listar(@Query() f: FiltroActivosDto) {
    return this.activos.listar(f);
  }
  @Get(':id') obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.activos.obtener(id);
  }
  @Get(':id/historial') historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.activos.historial(id);
  }

  /** Componentes rastreables instalados (y retirados, con `retirados=true`) + integrados según la última detección. */
  @Get(':id/componentes')
  async componentesDe(@Param('id', ParseUUIDPipe) id: string, @Query('retirados') retirados?: string) {
    const instalaciones = await this.componentes.instalacionesDe(id, retirados === 'true');
    const [d] = await this.db.query(`SELECT ultimo_inventario FROM [itam].[dispositivo_detectado] WHERE activo_id = @0`, [id]);
    const integrados = d?.ultimo_inventario ? integradosDelInventario(JSON.parse(d.ultimo_inventario) as InventarioPayload) : [];
    return {
      instalaciones: instalaciones.map((i) => ({
        id: i.id,
        desde: i.desde,
        hasta: i.hasta,
        motivoInstalacion: i.motivoInstalacion,
        motivoRetiro: i.motivoRetiro,
        confirmadaEn: i.confirmadaEn,
        componente: {
          id: i.componente!.id,
          codigo: i.componente!.codigo,
          tipo: { codigo: i.componente!.tipoComponente!.codigo, nombre: i.componente!.tipoComponente!.nombre },
          marca: i.componente!.marca,
          modelo: i.componente!.modelo,
          numeroSerie: i.componente!.numeroSerie,
          capacidad: i.componente!.capacidad,
          estadoTecnico: i.componente!.estadoTecnico,
        },
      })),
      integrados,
    };
  }

  @Roles('ADMIN', 'TECNICO') @Post() crear(@Body() d: CrearActivoDto, @ActorActual() a: Actor) {
    return this.activos.crear(a, d);
  }
  @Roles('ADMIN', 'TECNICO') @Patch(':id') editar(@Param('id', ParseUUIDPipe) id: string, @Body() d: DatosActivoDto, @ActorActual() a: Actor) {
    return this.activos.editar(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/estado-tecnico') estado(@Param('id', ParseUUIDPipe) id: string, @Body() d: EstadoTecnicoDto, @ActorActual() a: Actor) {
    return this.activos.cambiarEstadoTecnico(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/ciclo') ciclo(@Param('id', ParseUUIDPipe) id: string, @Body() d: CicloDto, @ActorActual() a: Actor) {
    return this.activos.cambiarCiclo(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/ubicacion') ubicacion(@Param('id', ParseUUIDPipe) id: string, @Body() d: UbicacionDto, @ActorActual() a: Actor) {
    return this.activos.transferirUbicacion(a, id, d.ubicacionId, d.observacion);
  }
  @Roles('ADMIN') @Post(':id/baja') baja(@Param('id', ParseUUIDPipe) id: string, @Body() d: BajaDto, @ActorActual() a: Actor) {
    return this.activos.darDeBaja(a, id, d);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/vincular') vincular(@Param('id', ParseUUIDPipe) id: string, @Body() d: VincularDto, @ActorActual() a: Actor) {
    return this.db.transaction(async (em) => {
      await this.activos.vincular(a, id, d.dispositivoId, em);
      const equipo = await em.findOneByOrFail(DispositivoDetectado, { id: d.dispositivoId });
      if (equipo.ultimoInventario) {
        const p = equipo.ultimoInventario as InventarioPayload;
        await this.automatico.sincronizar(em, equipo, p, resumir(p), true);
      }
      return equipo;
    });
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/desvincular') desvincular(@Param('id', ParseUUIDPipe) id: string, @ActorActual() a: Actor) {
    return this.activos.desvincular(a, id);
  }
  @Roles('ADMIN', 'TECNICO') @Post(':id/reemplazar-componente') reemplazar(@Param('id', ParseUUIDPipe) id: string, @Body() d: ReemplazarDto, @ActorActual() a: Actor) {
    return this.componentes.reemplazar(a, id, d);
  }
}
