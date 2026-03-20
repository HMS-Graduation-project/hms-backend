#!/bin/sh
set -e

echo "Pushing Prisma schema to database..."
npx prisma db push --skip-generate

echo "Seeding database..."
npx prisma db seed || echo "Seed completed (or already applied)"

echo "Starting NestJS..."
exec npm run start:dev
