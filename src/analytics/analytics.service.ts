import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Aggregation queries for admin dashboards.
 *
 * All heavy lifting is pushed to Postgres via Prisma `count`, `aggregate`,
 * `groupBy`, or `$queryRaw` so the Node process stays lightweight.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Dashboard Summary ──────────────────────────────────

  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalPatients,
      totalDoctors,
      todayAppointments,
      pendingLabOrders,
      monthlyRevenueAgg,
      pendingInvoices,
    ] = await Promise.all([
      this.prisma.patientProfile.count(),
      this.prisma.doctorProfile.count(),
      // Today's appointments — exclude CANCELLED and NO_SHOW
      this.prisma.appointment.count({
        where: {
          date: { gte: todayStart, lt: todayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      // Pending lab orders — all non-terminal statuses
      this.prisma.labOrder.count({
        where: { status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: monthStart, lt: monthEnd } },
      }),
      this.prisma.invoice.count({
        where: { status: { in: ['DRAFT', 'ISSUED'] } },
      }),
    ]);

    return {
      totalPatients,
      totalDoctors,
      todayAppointments,
      pendingLabOrders,
      monthlyRevenue: monthlyRevenueAgg._sum.amount ?? 0,
      pendingInvoices,
    };
  }

  // ───────────────────── Appointment Stats ──────────────────────────────────

  async getAppointmentStats(
    period: 'daily' | 'week' | 'month' | 'year',
  ) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 14); // last 14 days
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const trunc = period === 'year' ? 'month' : 'day';

    const rows = await this.prisma.$queryRaw<
      {
        bucket: Date;
        total: bigint;
        confirmed: bigint;
        completed: bigint;
        cancelled: bigint;
      }[]
    >`
      SELECT date_trunc(${trunc}, date)                                    AS bucket,
             COUNT(*)::bigint                                              AS total,
             COUNT(*) FILTER (WHERE status = 'CONFIRMED')::bigint          AS confirmed,
             COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint          AS completed,
             COUNT(*) FILTER (WHERE status = 'CANCELLED')::bigint          AS cancelled
        FROM appointments
       WHERE date >= ${startDate}
       GROUP BY bucket
       ORDER BY bucket
    `;

    return {
      period,
      data: rows.map((r) => ({
        label: r.bucket.toISOString().slice(0, 10),
        total: Number(r.total),
        confirmed: Number(r.confirmed),
        completed: Number(r.completed),
        cancelled: Number(r.cancelled),
      })),
    };
  }

  // ───────────────────── Revenue Stats ──────────────────────────────────────

  async getRevenueStats(period: 'month' | 'quarter' | 'year') {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;

    switch (period) {
      case 'month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3);
        currentStart = new Date(now.getFullYear(), q * 3, 1);
        previousStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
        break;
      }
      case 'year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        break;
    }

    const currentEnd = now;

    // Category breakdown for current period
    const categoryRows = await this.prisma.$queryRaw<
      { category: string; amount: number }[]
    >`
      SELECT ii.category,
             COALESCE(SUM(ii.total), 0)::float8 AS amount
        FROM payments      p
        JOIN invoices       i  ON i.id = p.invoice_id
        JOIN invoice_items  ii ON ii.invoice_id = i.id
       WHERE p.paid_at >= ${currentStart}
         AND p.paid_at <  ${currentEnd}
       GROUP BY ii.category
       ORDER BY amount DESC
    `;

    const totalRevenue = categoryRows.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    // Previous period total for growth calculation
    const prevRows = await this.prisma.$queryRaw<
      { amount: number }[]
    >`
      SELECT COALESCE(SUM(ii.total), 0)::float8 AS amount
        FROM payments      p
        JOIN invoices       i  ON i.id = p.invoice_id
        JOIN invoice_items  ii ON ii.invoice_id = i.id
       WHERE p.paid_at >= ${previousStart}
         AND p.paid_at <  ${currentStart}
    `;

    const previousRevenue = Number(prevRows[0]?.amount ?? 0);
    const growthPercentage =
      previousRevenue > 0
        ? Math.round(
            ((totalRevenue - previousRevenue) / previousRevenue) * 1000,
          ) / 10 // one decimal place
        : null; // avoid division by zero

    return {
      period,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      growthPercentage,
      categories: categoryRows.map((r) => ({
        category: r.category,
        amount: Math.round(Number(r.amount) * 100) / 100,
      })),
    };
  }

  // ───────────────────── Department Stats ───────────────────────────────────

  async getDepartmentStats() {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            doctors: true,
            appointments: true,
          },
        },
      },
    });

    // Compute unique patient count per department via appointments
    const patientCounts = await this.prisma.$queryRaw<
      { department_id: string; patient_count: bigint }[]
    >`
      SELECT department_id,
             COUNT(DISTINCT patient_id)::bigint AS patient_count
        FROM appointments
       WHERE department_id IS NOT NULL
       GROUP BY department_id
    `;

    // Compute revenue per department: Department → Appointment → Invoice → InvoiceItem (paid)
    const revenueCounts = await this.prisma.$queryRaw<
      { department_id: string; revenue: number }[]
    >`
      SELECT a.department_id,
             COALESCE(SUM(ii.total), 0)::float8 AS revenue
        FROM appointments    a
        JOIN invoices        i  ON i.appointment_id = a.id
        JOIN invoice_items   ii ON ii.invoice_id    = i.id
       WHERE a.department_id IS NOT NULL
       GROUP BY a.department_id
    `;

    const patientMap = new Map(
      patientCounts.map((r) => [r.department_id, Number(r.patient_count)]),
    );
    const revenueMap = new Map(
      revenueCounts.map((r) => [r.department_id, Math.round(Number(r.revenue) * 100) / 100]),
    );

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      doctorCount: dept._count.doctors,
      appointmentCount: dept._count.appointments,
      patientCount: patientMap.get(dept.id) ?? 0,
      revenue: revenueMap.get(dept.id) ?? 0,
    }));
  }
}
