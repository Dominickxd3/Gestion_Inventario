import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventarioModule } from './inventario/inventario.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), InventarioModule],
})
export class AppModule {}
