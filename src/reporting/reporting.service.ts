import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { ReportingQueryDto, ReportingPeriod } from './dto/reporting-query.dto';

/**
 * Regional & Ministry dashboards.
 *
 * Scope rules (enforced here, not via tenant middleware — these queries
 * deliberately read across hospitals):
 *   - REGIONAL_ADMIN  → bound to user.cityId.
 *   - MINISTRY_ADMIN  → unbounded (may still pass cityId to drill down).
 *   - SUPER_ADMIN     → unbounded.
 *
 * All aggregations are executed in Postgres (Prisma groupBy / aggregate /
 * $queryRaw CTEs) to keep the Node process lightweight.
 */
@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────────────

  private periodDays(period: ReportingPeriod | undefined): number {
    switch (period) {
      case '7d':
        return 7;
      case '90d':
        return 90;
      case '365d':
        return 365;
      default:
        return 30;
    }
  }

  private periodStart(period: ReportingPeriod | undefined): Date {
    const days = this.periodDays(period);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days + 1);
    return d;
  }

  /**
   * Resolve the set of hospitalIds the caller is allowed to see, honouring
   * role and an optional cityId drill-down.
   */
  private async resolveScope(
    user: AuthUser,
    cityIdFilter: string | undefined,
  ): Promise<{
    hospitalIds: string[];
    cityIds: string[];
    cityId: string | null;
  }> {
    // REGIONAL_ADMIN: must have a cityId; cannot drill into other cities.
    if (user.role === 'REGIONAL_ADMIN') {
      if (!user.cityId) {
        throw new ForbiddenException('Regional admin has no city scope');
      }
      if (cityIdFilter && cityIdFilter !== user.cityId) {
        throw new ForbiddenException(
          'Regional admin cannot query outside their assigned city',
        );
      }
      const hospitals = await this.prisma.hospital.findMany({
        where: { cityId: user.cityId, isActive: true },
        select: { id: true },
      });
      return {
        hospitalIds: hospitals.map((h) => h.id),
        cityIds: [user.cityId],
        cityId: user.cityId,
      };
    }

    // MINISTRY_ADMIN / SUPER_ADMIN: unbounded, optional drill-down.
    if (cityIdFilter) {
      const city = await this.prisma.city.findUnique({
        where: { id: cityIdFilter },
        select: { id: true },
      });
      if (!city) throw new NotFoundException('City not found');
      const hospitals = await this.prisma.hospital.findMany({
        where: { cityId: cityIdFilter, isActive: true },
        select: { id: true },
      });
      return {
        hospitalIds: hospitals.map((h) => h.id),
        cityIds: [cityIdFilter],
        cityId: cityIdFilter,
      };
    }

    // All active hospitals nation-wide.
    const [hospitals, cities] = await Promise.all([
      this.prisma.hospital.findMany({
        where: { isActive: true },
        select: { id: true },
      }),
      this.prisma.city.findMany({ select: { id: true } }),
    ]);
    return {
      hospitalIds: hospitals.map((h) => h.id),
      cityIds: cities.map((c) => c.id),
      cityId: null,
    };
  }

  // ─── Per-hospital KPI row ──────────────────────────────────────────

  private async hospitalKpis(
    hospitalIds: string[],
    periodStart: Date,
    limit: number,
  ) {
    if (hospitalIds.length === 0) return [];

    const hospitals = await this.prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: {
        id: true,
        code: true,
        name: true,
        nameAr: true,
        city: { select: { id: true, name: true, nameAr: true } },
      },
      orderBy: [{ city: { name: 'asc' } }, { name: 'asc' }],
    });

    // Run many lightweight Prisma aggregations in parallel per hospital.
    const results = await Promise.all(
      hospitals.map(async (h) => {
        const [
          totalBeds,
          occupiedBeds,
          openAdmissions,
          erToday,
          erTriageSlowMs,
          incomingReferrals,
          outgoingReferrals,
          periodAppointments,
          totalPatients,
        ] = await Promise.all([
          this.prisma.bed.count({ where: { hospitalId: h.id } }),
          this.prisma.bed.count({
            where: { hospitalId: h.id, status: 'OCCUPIED' },
          }),
          this.prisma.admission.count({
            where: {
              hospitalId: h.id,
              status: { in: ['ADMITTED', 'TRANSFERRED'] },
            },
          }),
          this.prisma.emergencyVisit.count({
            where: {
              hospitalId: h.id,
              arrivedAt: { gte: periodStart },
            },
          }),
          // Average ER triage time (ms) within the period
          this.prisma.$queryRaw<{ avg_ms: number | null }[]>`
            SELECT AVG(EXTRACT(EPOCH FROM (triaged_at - arrived_at)) * 1000)::float8 AS avg_ms
              FROM emergency_visits
             WHERE hospital_id = ${h.id}
               AND triaged_at IS NOT NULL
               AND arrived_at >= ${periodStart}
          `,
          this.prisma.referral.count({
            where: {
              toHospitalId: h.id,
              createdAt: { gte: periodStart },
            },
          }),
          this.prisma.referral.count({
            where: {
              fromHospitalId: h.id,
              createdAt: { gte: periodStart },
            },
          }),
          this.prisma.appointment.count({
            where: { hospitalId: h.id, date: { gte: periodStart } },
          }),
          this.prisma.patientProfile.count({ where: { hospitalId: h.id } }),
        ]);

        const bedOccupancyPct =
          totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;
        const avgTriageMin =
          erTriageSlowMs[0]?.avg_ms != null
            ? Math.round((erTriageSlowMs[0].avg_ms / 60000) * 10) / 10
            : null;

        return {
          hospital: {
            id: h.id,
            code: h.code,
            name: h.name,
            nameAr: h.nameAr,
            city: h.city,
          },
          totalBeds,
          occupiedBeds,
          bedOccupancyPct,
          openAdmissions,
          erVisitsInPeriod: erToday,
          avgTriageMinutes: avgTriageMin,
          incomingReferrals,
          outgoingReferrals,
          appointmentsInPeriod: periodAppointments,
          totalPatients,
        };
      }),
    );

    return results.slice(0, limit);
  }

  // ─── Top diagnoses for a hospital set ──────────────────────────────

  private async topDiagnoses(
    hospitalIds: string[],
    periodStart: Date,
    limit: number,
  ) {
    if (hospitalIds.length === 0) return [];
    // Diagnosis is free-text at MVP. Group case-insensitively on non-empty.
    const rows = await this.prisma.$queryRaw<
      { diagnosis: string; count: bigint }[]
    >(Prisma.sql`
      SELECT TRIM(LOWER(diagnosis)) AS diagnosis,
             COUNT(*)::bigint        AS count
        FROM medical_records
       WHERE hospital_id IN (${Prisma.join(hospitalIds)})
         AND created_at  >= ${periodStart}
         AND diagnosis   IS NOT NULL
         AND TRIM(diagnosis) <> ''
    GROUP BY TRIM(LOWER(diagnosis))
    ORDER BY count DESC
       LIMIT ${limit}
    `);
    return rows.map((r) => ({
      diagnosis: r.diagnosis,
      count: Number(r.count),
    }));
  }

  // ─── Daily patient volume (appointments-based) ─────────────────────

  private async dailyPatientVolume(
    hospitalIds: string[],
    periodStart: Date,
  ) {
    if (hospitalIds.length === 0) return [];
    // Use appointments.date for volume — far more data than ER-only visits.
    const rows = await this.prisma.$queryRaw<
      { day: Date; visits: bigint }[]
    >(Prisma.sql`
      SELECT date_trunc('day', date) AS day,
             COUNT(*)::bigint        AS visits
        FROM appointments
       WHERE hospital_id IN (${Prisma.join(hospitalIds)})
         AND date        >= ${periodStart}
    GROUP BY day
    ORDER BY day
    `);
    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      visits: Number(r.visits),
    }));
  }

  // ─── KPI trends (current vs previous period) ─────────────────────

  private async nationalTrends(
    hospitalIds: string[],
    periodStart: Date,
    periodDays: number,
  ) {
    const previousStart = new Date(periodStart);
    previousStart.setDate(previousStart.getDate() - periodDays);

    if (hospitalIds.length === 0) {
      return { patientsTrend: null, referralsTrend: null, erTrend: null };
    }

    const [
      currentPatients,
      previousPatients,
      currentReferrals,
      previousReferrals,
      currentEr,
      previousEr,
    ] = await Promise.all([
      this.prisma.patientProfile.count({
        where: {
          hospitalId: { in: hospitalIds },
          createdAt: { gte: periodStart },
        },
      }),
      this.prisma.patientProfile.count({
        where: {
          hospitalId: { in: hospitalIds },
          createdAt: { gte: previousStart, lt: periodStart },
        },
      }),
      this.prisma.referral.count({
        where: {
          createdAt: { gte: periodStart },
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      }),
      this.prisma.referral.count({
        where: {
          createdAt: { gte: previousStart, lt: periodStart },
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      }),
      this.prisma.emergencyVisit.count({
        where: {
          hospitalId: { in: hospitalIds },
          arrivedAt: { gte: periodStart },
        },
      }),
      this.prisma.emergencyVisit.count({
        where: {
          hospitalId: { in: hospitalIds },
          arrivedAt: { gte: previousStart, lt: periodStart },
        },
      }),
    ]);

    const pct = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

    return {
      patientsTrend: pct(currentPatients, previousPatients),
      referralsTrend: pct(currentReferrals, previousReferrals),
      erTrend: pct(currentEr, previousEr),
    };
  }

  // ─── Emergency load per city ──────────────────────────────────────

  private async emergencyLoad(hospitalIds: string[], periodStart: Date) {
    if (hospitalIds.length === 0) {
      return { activeCases: 0, totalVisits: 0 };
    }

    const [activeCases, totalVisits] = await Promise.all([
      // Active = not yet closed (all statuses except terminal ones)
      this.prisma.emergencyVisit.count({
        where: {
          hospitalId: { in: hospitalIds },
          status: {
            in: ['ARRIVED', 'IN_TRIAGE', 'IN_TREATMENT'],
          },
        },
      }),
      this.prisma.emergencyVisit.count({
        where: {
          hospitalId: { in: hospitalIds },
          arrivedAt: { gte: periodStart },
        },
      }),
    ]);

    return { activeCases, totalVisits };
  }

  // ─── Public: regional summary ──────────────────────────────────────

  async regionalSummary(user: AuthUser, query: ReportingQueryDto) {
    const scope = await this.resolveScope(user, query.cityId);
    const periodStart = this.periodStart(query.period);
    const limit = query.limit ?? 10;

    const city = scope.cityId
      ? await this.prisma.city.findUnique({
          where: { id: scope.cityId },
          select: { id: true, name: true, nameAr: true },
        })
      : null;

    const [hospitals, diagnoses, dailyVolume] = await Promise.all([
      this.hospitalKpis(scope.hospitalIds, periodStart, 50),
      this.topDiagnoses(scope.hospitalIds, periodStart, limit),
      this.dailyPatientVolume(scope.hospitalIds, periodStart),
    ]);

    const totals = hospitals.reduce(
      (acc, h) => ({
        totalHospitals: acc.totalHospitals + 1,
        totalBeds: acc.totalBeds + h.totalBeds,
        occupiedBeds: acc.occupiedBeds + h.occupiedBeds,
        openAdmissions: acc.openAdmissions + h.openAdmissions,
        erVisitsInPeriod: acc.erVisitsInPeriod + h.erVisitsInPeriod,
        incomingReferrals: acc.incomingReferrals + h.incomingReferrals,
        outgoingReferrals: acc.outgoingReferrals + h.outgoingReferrals,
        appointmentsInPeriod:
          acc.appointmentsInPeriod + h.appointmentsInPeriod,
        totalPatients: acc.totalPatients + h.totalPatients,
      }),
      {
        totalHospitals: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        openAdmissions: 0,
        erVisitsInPeriod: 0,
        incomingReferrals: 0,
        outgoingReferrals: 0,
        appointmentsInPeriod: 0,
        totalPatients: 0,
      },
    );

    const bedOccupancyPct =
      totals.totalBeds > 0
        ? Math.round((totals.occupiedBeds / totals.totalBeds) * 1000) / 10
        : 0;

    return {
      scope: {
        role: user.role,
        cityId: scope.cityId,
        city,
        period: query.period ?? '30d',
        periodStart,
      },
      totals: { ...totals, bedOccupancyPct },
      hospitals,
      topDiagnoses: diagnoses,
      dailyPatientVolume: dailyVolume,
    };
  }

  // ─── Public: national summary ──────────────────────────────────────

  async nationalSummary(user: AuthUser, query: ReportingQueryDto) {
    if (user.role === 'REGIONAL_ADMIN') {
      throw new ForbiddenException(
        'Regional admins cannot access the national summary — use /regional/summary',
      );
    }

    const scope = await this.resolveScope(user, query.cityId);
    const periodStart = this.periodStart(query.period);
    const limit = query.limit ?? 10;

    // Per-city rollup
    const cities = await this.prisma.city.findMany({
      where: scope.cityId ? { id: scope.cityId } : undefined,
      select: {
        id: true,
        name: true,
        nameAr: true,
        hospitals: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const cityRollups = await Promise.all(
      cities.map(async (city) => {
        const hospitalIds = city.hospitals.map((h) => h.id);
        if (hospitalIds.length === 0) {
          return {
            city: { id: city.id, name: city.name, nameAr: city.nameAr },
            hospitalCount: 0,
            totalBeds: 0,
            occupiedBeds: 0,
            bedOccupancyPct: 0,
            openAdmissions: 0,
            erVisitsInPeriod: 0,
            totalPatients: 0,
            referralsIn: 0,
            referralsOut: 0,
          };
        }
        const [
          totalBeds,
          occupiedBeds,
          openAdmissions,
          erVisits,
          totalPatients,
          referralsIn,
          referralsOut,
        ] = await Promise.all([
          this.prisma.bed.count({
            where: { hospitalId: { in: hospitalIds } },
          }),
          this.prisma.bed.count({
            where: {
              hospitalId: { in: hospitalIds },
              status: 'OCCUPIED',
            },
          }),
          this.prisma.admission.count({
            where: {
              hospitalId: { in: hospitalIds },
              status: { in: ['ADMITTED', 'TRANSFERRED'] },
            },
          }),
          this.prisma.emergencyVisit.count({
            where: {
              hospitalId: { in: hospitalIds },
              arrivedAt: { gte: periodStart },
            },
          }),
          this.prisma.patientProfile.count({
            where: { hospitalId: { in: hospitalIds } },
          }),
          this.prisma.referral.count({
            where: {
              toHospitalId: { in: hospitalIds },
              createdAt: { gte: periodStart },
            },
          }),
          this.prisma.referral.count({
            where: {
              fromHospitalId: { in: hospitalIds },
              createdAt: { gte: periodStart },
            },
          }),
        ]);
        return {
          city: { id: city.id, name: city.name, nameAr: city.nameAr },
          hospitalCount: hospitalIds.length,
          totalBeds,
          occupiedBeds,
          bedOccupancyPct:
            totalBeds > 0
              ? Math.round((occupiedBeds / totalBeds) * 1000) / 10
              : 0,
          openAdmissions,
          erVisitsInPeriod: erVisits,
          totalPatients,
          referralsIn,
          referralsOut,
        };
      }),
    );

    // National totals
    const [
      nationalPatients,
      activeReferrals,
      totalHospitals,
      totalCities,
    ] = await Promise.all([
      this.prisma.nationalPatient.count(),
      this.prisma.referral.count({
        where: {
          status: { in: ['PENDING', 'ACCEPTED'] },
          createdAt: { gte: periodStart },
        },
      }),
      this.prisma.hospital.count({ where: { isActive: true } }),
      this.prisma.city.count(),
    ]);

    const days = this.periodDays(query.period);

    const [topDiagnoses, dailyVolume, trends, erLoad] = await Promise.all([
      this.topDiagnoses(scope.hospitalIds, periodStart, limit),
      this.dailyPatientVolume(scope.hospitalIds, periodStart),
      this.nationalTrends(scope.hospitalIds, periodStart, days),
      this.emergencyLoad(scope.hospitalIds, periodStart),
    ]);

    return {
      scope: {
        role: user.role,
        cityId: scope.cityId,
        period: query.period ?? '30d',
        periodStart,
      },
      national: {
        totalCities,
        totalHospitals,
        nationalPatients,
        activeReferralsInPeriod: activeReferrals,
      },
      trends,
      emergency: erLoad,
      cities: cityRollups,
      topDiagnoses,
      dailyPatientVolume: dailyVolume,
    };
  }

  // ─── Public: referral-flow matrix ──────────────────────────────────

  async referralFlow(user: AuthUser, query: ReportingQueryDto) {
    const scope = await this.resolveScope(user, query.cityId);
    const periodStart = this.periodStart(query.period);

    // For REGIONAL_ADMIN we only include flows where either side lives in
    // their city. For national roles we include every flow.
    const allowedHospitalIds = new Set(scope.hospitalIds);
    const isNational = user.role !== 'REGIONAL_ADMIN' && !query.cityId;

    const rows = await this.prisma.$queryRaw<
      {
        from_city_id: string;
        from_city_name: string;
        to_city_id: string;
        to_city_name: string;
        count: bigint;
      }[]
    >`
      SELECT fc.id   AS from_city_id,
             fc.name AS from_city_name,
             tc.id   AS to_city_id,
             tc.name AS to_city_name,
             COUNT(*)::bigint AS count
        FROM referrals  r
        JOIN hospitals  fh ON fh.id = r.from_hospital_id
        JOIN cities     fc ON fc.id = fh.city_id
        JOIN hospitals  th ON th.id = r.to_hospital_id
        JOIN cities     tc ON tc.id = th.city_id
       WHERE r.created_at >= ${periodStart}
    GROUP BY fc.id, fc.name, tc.id, tc.name
    ORDER BY count DESC
    `;

    const filtered = isNational
      ? rows
      : rows.filter(
          (r) =>
            allowedHospitalIds.size === 0 ||
            scope.cityIds.includes(r.from_city_id) ||
            scope.cityIds.includes(r.to_city_id),
        );

    return {
      scope: {
        role: user.role,
        cityId: scope.cityId,
        period: query.period ?? '30d',
        periodStart,
      },
      flows: filtered.map((r) => ({
        fromCity: { id: r.from_city_id, name: r.from_city_name },
        toCity: { id: r.to_city_id, name: r.to_city_name },
        count: Number(r.count),
      })),
    };
  }

  // ─── Public: disease trends ────────────────────────────────────────

  async diseaseTrends(user: AuthUser, query: ReportingQueryDto) {
    const scope = await this.resolveScope(user, query.cityId);
    const periodStart = this.periodStart(query.period);
    const limit = query.limit ?? 10;

    if (scope.hospitalIds.length === 0) {
      return {
        scope: {
          role: user.role,
          cityId: scope.cityId,
          period: query.period ?? '30d',
          periodStart,
        },
        diagnoses: [],
        series: [],
      };
    }

    // Top N diagnoses overall for the window
    const top = await this.topDiagnoses(
      scope.hospitalIds,
      periodStart,
      limit,
    );
    const topList = top.map((t) => t.diagnosis);

    // Daily series for each of those diagnoses
    const bucket = this.periodDays(query.period) <= 30 ? 'day' : 'week';
    const series =
      topList.length === 0
        ? []
        : await this.prisma.$queryRaw<
            { bucket: Date; diagnosis: string; count: bigint }[]
          >(Prisma.sql`
            SELECT date_trunc(${bucket}, created_at) AS bucket,
                   TRIM(LOWER(diagnosis))            AS diagnosis,
                   COUNT(*)::bigint                   AS count
              FROM medical_records
             WHERE hospital_id IN (${Prisma.join(scope.hospitalIds)})
               AND created_at  >= ${periodStart}
               AND TRIM(LOWER(diagnosis)) IN (${Prisma.join(topList)})
          GROUP BY bucket, TRIM(LOWER(diagnosis))
          ORDER BY bucket
          `);

    return {
      scope: {
        role: user.role,
        cityId: scope.cityId,
        period: query.period ?? '30d',
        periodStart,
        bucket,
      },
      diagnoses: top,
      series: series.map((s) => ({
        bucket:
          s.bucket instanceof Date
            ? s.bucket.toISOString().slice(0, 10)
            : String(s.bucket).slice(0, 10),
        diagnosis: s.diagnosis,
        count: Number(s.count),
      })),
    };
  }
}
