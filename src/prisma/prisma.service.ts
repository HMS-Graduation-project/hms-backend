import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestContext } from '../common/context/request-context';

/**
 * Models scoped to a single hospital. Reads against these models are
 * auto-filtered by the caller's hospitalId via middleware below.
 * Writes are expected to set hospitalId explicitly at the service layer.
 *
 * Models NOT in this set are global or span hospitals:
 *   Hospital, City, VitalSigns (child of MedicalRecord), LabResult (child
 *   of LabOrder), PrescriptionItem (child of Prescription), InvoiceItem
 *   (child of Invoice), Payment (child of Invoice).
 */
const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
  'User',
  'Department',
  'DoctorProfile',
  'PatientProfile',
  'DoctorSchedule',
  'Appointment',
  'MedicalRecord',
  'Prescription',
  'Medication',
  'Dispensing',
  'LabOrder',
  'Invoice',
  'Notification',
  'AuditLog',
  'Holiday',
  'Setting',
  'AIAnalysisResult',
]);

const READ_ACTIONS = new Set<Prisma.PrismaAction>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.installTenantMiddleware();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Auto-scope read queries on tenant-scoped models by the caller's
   * hospitalId (pulled from AsyncLocalStorage).
   *
   * Rules:
   *  - Only touches read actions (findMany, findFirst, findUnique, etc.).
   *  - Skipped when no request context (unauthenticated / background jobs).
   *  - Skipped when caller is cross-hospital (SUPER_ADMIN / MINISTRY_ADMIN /
   *    REGIONAL_ADMIN → hospitalId=null).
   *  - Skipped when the caller has already set hospitalId in the where
   *    clause (explicit cross-hospital query by a privileged caller).
   *  - For findUnique/findUniqueOrThrow, converts the action to
   *    findFirst/findFirstOrThrow so the added hospitalId filter can
   *    coexist with non-unique where fields.
   */
  private installTenantMiddleware() {
    this.$use(async (params, next) => {
      if (!params.model || !TENANT_SCOPED_MODELS.has(params.model)) {
        return next(params);
      }
      if (!READ_ACTIONS.has(params.action)) {
        return next(params);
      }

      const ctx = RequestContext.get();
      const hospitalId = ctx?.hospitalId ?? null;

      // No active request context (e.g., seed/CLI) OR cross-hospital role.
      if (!hospitalId) {
        return next(params);
      }

      const existingWhere = (params.args?.where ?? {}) as Record<string, unknown>;
      const hasHospitalConstraint = Object.keys(existingWhere).some(
        (k) => k === 'hospitalId' || k.startsWith('hospitalId_'),
      );
      if (hasHospitalConstraint) {
        // Caller already constrains by hospitalId (directly or via a
        // compound unique key like hospitalId_nationalPatientId).
        return next(params);
      }

      // findUnique/findUniqueOrThrow only accept the unique-key fields in
      // where — adding hospitalId would violate the type. Degrade to the
      // findFirst variant, which is semantically equivalent for UUID PKs.
      if (params.action === 'findUnique') {
        params.action = 'findFirst';
      } else if (params.action === 'findUniqueOrThrow') {
        params.action = 'findFirstOrThrow';
      }

      params.args = {
        ...params.args,
        where: { ...existingWhere, hospitalId },
      };

      return next(params);
    });

    this.logger.log('Tenant middleware installed for hospital-scoped reads');
  }
}
