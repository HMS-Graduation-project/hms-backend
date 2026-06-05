import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

// Set required env vars for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://hms:hms_password@localhost:5432/hms';
process.env.AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

let app: INestApplication;
let prisma: PrismaService;

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  prisma = app.get(PrismaService);
  await app.init();
  return app;
}

export function getApp(): INestApplication {
  return app;
}

export function getPrisma(): PrismaService {
  return prisma;
}

export async function closeTestApp(): Promise<void> {
  if (app) await app.close();
}
