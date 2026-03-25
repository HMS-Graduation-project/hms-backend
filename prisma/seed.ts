import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'superadmin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'superadmin123';

  const hash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: Role.SUPER_ADMIN, firstName: 'System', lastName: 'Admin' },
    create: {
      email,
      passwordHash: hash,
      role: Role.SUPER_ADMIN,
      firstName: 'System',
      lastName: 'Admin',
    },
  });

  console.log(`Admin user seeded: ${admin.email} (${admin.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
