import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  /**
   * CORS restringido a los origenes configurados (`CORS_ORIGIN`, lista
   * separada por comas). Sin `enableCors()` con origenes abiertos, cualquier
   * sitio podria leer las respuestas de la API desde el navegador.
   */
  const corsOrigin = config.get<string[]>('cors.origin') ?? [];
  if (corsOrigin.length > 0) {
    app.enableCors({ origin: corsOrigin, credentials: true });
  } else {
    new Logger('Bootstrap').warn(
      'CORS_ORIGIN no configurado: el navegador no podra llamar a la API directamente',
    );
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('GoRoDeals API')
    .setDescription(
      'API de seguimiento de precios de videojuegos y rutas de sagas',
    )
    .setVersion('0.1.0')
    .addTag('deals')
    .addTag('games')
    .addTag('catalog')
    .addTag('prices')
    .addTag('franchises')
    .addTag('igdb')
    .addTag('steam')
    .addTag('price-sync')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}
void bootstrap();
