import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { opcionesSqlServer } from './database/opciones';
import { IdentidadModule } from './identidad/identidad.module';
import { AlmacenModule } from './almacen/almacen.controller';
import { CatalogoModule } from './catalogo/catalogo.controller';
import { GarantiasModule } from './garantias/garantias.controller';
import { GestionModule } from './gestion.module';
import { OrganizacionModule } from './organizacion/organizacion.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        opcionesSqlServer(
          {
            DB_HOST: config.get('DB_HOST'),
            DB_PORT: config.get('DB_PORT'),
            DB_NAME: config.get('DB_NAME'),
            DB_APP_USER: config.get('DB_APP_USER'),
            DB_APP_PASSWORD: config.get('DB_APP_PASSWORD'),
            DB_ENCRYPT: config.get('DB_ENCRYPT'),
            DB_TRUST_SERVER_CERTIFICATE: config.get('DB_TRUST_SERVER_CERTIFICATE'),
          },
          'app',
        ),
    }),
    AuditoriaModule,
    IdentidadModule,
    CatalogoModule,
    OrganizacionModule,
    GestionModule,
    AlmacenModule,
    GarantiasModule,
  ],
})
export class AppModule {}
