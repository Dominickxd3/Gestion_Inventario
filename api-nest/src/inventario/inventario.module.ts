import { Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';
import { EquiposRepository } from './equipos.repository';
import { ScanGpController } from './scangp.controller';

@Module({
  controllers: [InventarioController, ScanGpController],
  providers: [InventarioService, EquiposRepository],
})
export class InventarioModule {}
