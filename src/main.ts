import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter, PrismaExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Structured logging via pino
  app.useLogger(app.get(Logger));

  // Security headers
  app.use(helmet());
  app.use(cookieParser());

  // Serve uploaded files as static assets at /uploads/*
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Order matters: PrismaExceptionFilter (more specific) runs first,
  // then HttpExceptionFilter catches any remaining HttpExceptions.
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new HttpExceptionFilter(),
  );

  // CORS with configurable origin (explicit origin required for cookie credentials)
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('HMS API')
    .setDescription('Hospital Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`HMS Backend running on: ${await app.getUrl()}`);
}

bootstrap();
