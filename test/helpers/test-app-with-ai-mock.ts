import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { AiService } from '../../src/ai/ai.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  MOCK_SINGLE_RESULT,
  MOCK_EXPLAIN_RESULT,
  MOCK_ENSEMBLE_RESULT,
} from './ai-mock';

// Reuse env from test-app (must be imported first in test files)
import './test-app';

let app: INestApplication;
let prisma: PrismaService;
let mockAiService: Partial<AiService>;

export async function createTestAppWithAiMock(): Promise<INestApplication> {
  mockAiService = {
    pneumoniaPredict: jest.fn().mockResolvedValue(MOCK_SINGLE_RESULT),
    pneumoniaExplain: jest.fn().mockResolvedValue(MOCK_EXPLAIN_RESULT),
    pneumoniaEnsemble: jest.fn().mockResolvedValue(MOCK_ENSEMBLE_RESULT),
    pneumoniaHealth: jest.fn().mockResolvedValue({ status: 'ok' }),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AiService)
    .useValue(mockAiService)
    .compile();

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

export function getMockAiService() {
  return mockAiService;
}

export async function closeTestApp(): Promise<void> {
  if (app) await app.close();
}
