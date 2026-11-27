import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { InventarioService } from './inventario.service';
import { InventarioPayload } from './inventario.types';

@Controller()
export class InventarioController {
  constructor(private readonly service: InventarioService) {}

  /** Endpoint que usa el agente de Windows. */
  @Post('inventario')
  @HttpCode(200)
  @UseGuards(ApiKeyGuard)
  registrar(@Body() payload: InventarioPayload, @Ip() ip: string) {
    return this.service.registrar(payload, ip?.replace('::ffff:', '') ?? null);
  }

  // Endpoints de lectura para el frontend.
  // TODO: protegerlos con JWT cuando se integre el login de la web.
  @Get('equipos')
  listar() {
    return this.service.listar();
  }

  @Get('equipos/:id')
  obtener(@Param('id') id: string) {
    return this.service.obtener(id);
  }

  @Delete('equipos/:id')
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(id);
  }

  @Get('estadisticas')
  estadisticas() {
    return this.service.estadisticas();
  }
}
