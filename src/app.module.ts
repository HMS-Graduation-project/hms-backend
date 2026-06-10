import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { DepartmentsModule } from './departments/departments.module';
import { DoctorsModule } from './doctors/doctors.module';
import { PatientsModule } from './patients/patients.module';
import { SchedulesModule } from './schedules/schedules.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { BillingModule } from './billing/billing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { AiModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { CitiesModule } from './cities/cities.module';
import { NationalRegistryModule } from './national-registry/national-registry.module';
import { EmergencyModule } from './emergency/emergency.module';
import { InpatientModule } from './inpatient/inpatient.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ReportingModule } from './reporting/reporting.module';
import { PortalModule } from './portal/portal.module';
import { AiAnalysesModule } from './ai-analyses/ai-analyses.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AuditInterceptor, RequestContextInterceptor } from './common/interceptors';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5000 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    DepartmentsModule,
    DoctorsModule,
    PatientsModule,
    SchedulesModule,
    AppointmentsModule,
    MedicalRecordsModule,
    PrescriptionsModule,
    LaboratoryModule,
    PharmacyModule,
    BillingModule,
    AnalyticsModule,
    SettingsModule,
    NotificationsModule,
    UploadsModule,
    AiModule,
    AuditModule,
    HospitalsModule,
    CitiesModule,
    NationalRegistryModule,
    EmergencyModule,
    InpatientModule,
    ReferralsModule,
    ReportingModule,
    PortalModule,
    AiAnalysesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // RequestContextInterceptor must run BEFORE AuditInterceptor so that
    // downstream logic (including audit logging of hospital-scoped actions)
    // sees the AsyncLocalStorage context.
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
