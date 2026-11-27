import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ErroresSqlFilter } from './common/errores-sql.filter';
import { IdsMinusculaInterceptor } from './common/ids-minuscula.interceptor';

/** Configuración común a la aplicación real y a las pruebas e2e. */
export function configurarApp(app: NestExpressApplication) {
  // El inventario (con la lista de software) puede pesar varios cientos de KB.
  app.useBodyParser('json', { limit: '10mb' });
  app.setGlobalPrefix('api');
  app.enableCors();
  // Valida y limpia los DTO (clases). El inventario de ScanGP es una interfaz y se valida en su servicio,
  // así no se descartan campos que agreguen versiones futuras del detector.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ErroresSqlFilter());
  app.useGlobalInterceptors(new IdsMinusculaInterceptor());
  return app;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configurarApp(app);

  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0 para que los equipos de la red local puedan enviar su inventario.
  await app.listen(port, '0.0.0.0');
  console.log(`API de inventario escuchando en http://localhost:${port}/api`);
}

if (require.main === module) void bootstrap();
