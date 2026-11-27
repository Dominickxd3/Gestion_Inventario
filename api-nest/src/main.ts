import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // El inventario (con la lista de software) puede pesar varios cientos de KB.
  app.useBodyParser('json', { limit: '10mb' });
  app.setGlobalPrefix('api');
  app.enableCors();

  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0 para que los equipos de la red local puedan enviar su inventario.
  await app.listen(port, '0.0.0.0');
  console.log(`API de inventario escuchando en http://localhost:${port}/api`);
}
bootstrap();
