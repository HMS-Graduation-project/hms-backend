# HMS Backend

Backend API for the Hospital Management System, built with NestJS, Prisma ORM, and PostgreSQL.

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** NestJS 10
- **ORM:** Prisma 5 (PostgreSQL)
- **Auth:** JWT with Passport, bcryptjs for password hashing
- **Validation:** class-validator + class-transformer
- **Docs:** Swagger (OpenAPI) at `/api/docs`

## Local Development

### Prerequisites

- Node.js >= 20
- PostgreSQL instance (or use Docker Compose from `hms-infra`)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed the admin user
npx prisma db seed

# Start in development mode
npm run start:dev
```

The server starts on `http://localhost:3000`.

## API Endpoints

| Method | Path                      | Auth     | Description                     |
|--------|---------------------------|----------|---------------------------------|
| POST   | `/api/v1/auth/register`   | Public   | Register a new user             |
| POST   | `/api/v1/auth/login`      | Public   | Login with email and password   |
| GET    | `/api/v1/me`              | Bearer   | Get current authenticated user  |
| GET    | `/api/health`             | Public   | Health check (not versioned)    |
| GET    | `/api/docs`               | Public   | Swagger UI documentation        |

## Docker

This service is typically run via Docker Compose from the `hms-infra` repository. A `Dockerfile` and `docker-entrypoint.sh` are provided for containerized builds. The entrypoint automatically runs Prisma migrations and seeds the database before starting the application.

## Project Structure

```
src/
  main.ts                  # Application bootstrap
  app.module.ts            # Root module
  prisma/                  # Prisma module and service
  auth/                    # Authentication (JWT, login, register)
    dto/                   # Request validation DTOs
    strategies/            # Passport JWT strategy
    guards/                # Auth guards
    decorators/            # Custom decorators (CurrentUser)
  users/                   # Users module (profile endpoint)
  health/                  # Health check endpoint
prisma/
  schema.prisma            # Database schema
  seed.ts                  # Database seed script
```
