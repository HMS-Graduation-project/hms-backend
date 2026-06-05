import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

// Test environment configuration
// Uses TEST_DATABASE_URL if set, otherwise hms_test on the Docker Postgres port
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://hms:hms_password@localhost:55432/hms_test';

process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';
process.env.NODE_ENV = 'test';
process.env.AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Safety: refuse to run tests against a non-test database
if (!TEST_DB_URL.includes('hms_test') && !TEST_DB_URL.includes('_test')) {
  throw new Error(
    `SAFETY: DATABASE_URL "${TEST_DB_URL}" does not contain "hms_test" or "_test". ` +
    'Refusing to run tests against a non-test database. ' +
    'Set TEST_DATABASE_URL to a test database URL.',
  );
}

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
