import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import {
  LoggingInterceptor,
  TransformInterceptor,
  TimeoutInterceptor,
} from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api');

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Interceptors
  // Order matters: Timeout -> Logging -> Transform
  app.useGlobalInterceptors(
    new TimeoutInterceptor(),   // 30s default timeout
    new LoggingInterceptor(),   // Request/Response logging
    new TransformInterceptor(), // Standardized response format
  );

  // CORS for VPN access
  app.enableCors({
    origin: configService.get<string>('cors.origins')?.split(',') || ['http://localhost:4200'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-App-Version',
      'X-Device-Id',
      'X-Platform',
      'X-Idempotency-Key',
      'X-Correlation-Id',
    ],
  });

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Logistics ERP API')
    .setDescription('Backend API for Logistics ERP System')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-App-Version', in: 'header' },
      'app-version',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Device-Id', in: 'header' },
      'device-id',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Platform', in: 'header' },
      'platform',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Start server
  const port = configService.get<number>('port') || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/docs`);
}

bootstrap();
