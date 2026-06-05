import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestUser {
  id: string;
  email: string;
  role: string;
  hospitalId: string | null;
}

/**
 * Create a user directly in the database for testing.
 */
export async function seedUser(
  prisma: PrismaService,
  data: {
    email: string;
    password: string;
    role: string;
    hospitalId?: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<TestUser> {
  const passwordHash = await bcrypt.hash(data.password, 4); // fast rounds for tests
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      role: data.role as any,
      hospitalId: data.hospitalId ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
    },
  });
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    hospitalId: user.hospitalId,
  };
}

/**
 * Create a hospital (and its city if needed) directly in the database.
 */
export async function seedHospital(
  prisma: PrismaService,
  data: { name: string; code: string },
): Promise<string> {
  // Reuse existing test city or create one
  let city = await prisma.city.findFirst({ where: { name: 'Test City' } });
  if (!city) {
    city = await prisma.city.create({
      data: { name: 'Test City' },
    });
  }
  const hospital = await prisma.hospital.create({
    data: { name: data.name, code: data.code, cityId: city.id },
  });
  return hospital.id;
}

/**
 * Login via API and return parsed cookies.
 */
export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookies: string[]; accessCookie: string; refreshCookie: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const cookies = ([] as string[]).concat(res.headers['set-cookie'] || []);
  const accessCookie = cookies.find((c) => c.startsWith('hms_access=')) || '';
  const refreshCookie = cookies.find((c) => c.startsWith('hms_refresh=')) || '';

  return { cookies, accessCookie, refreshCookie };
}

/**
 * Extract raw cookie value from a Set-Cookie header string.
 */
export function extractCookieValue(setCookieStr: string): string {
  return setCookieStr.split(';')[0].split('=').slice(1).join('=');
}

/**
 * Build Cookie header string from Set-Cookie array for subsequent requests.
 */
export function buildCookieHeader(cookies: string[]): string {
  return cookies.map((c: string) => c.split(';')[0]).join('; ');
}
