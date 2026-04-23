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
      this.prisma.appointment.count({
        where: { date: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.labOrder.count({
        where: { status: { in: ['ORDERED', 'IN_PROGRESS'] } },
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

  async getAppointmentStats(period: 'week' | 'month' | 'year') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
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

    // Truncate to appropriate precision in Postgres
    const trunc = period === 'year' ? 'month' : 'day';

    const rows = await this.prisma.$queryRaw<
      { period: Date; count: bigint }[]
    >`
      SELECT date_trunc(${trunc}, date) AS period,
             COUNT(*)::bigint           AS count
        FROM appointments
       WHERE date >= ${startDate}
       GROUP BY period
       ORDER BY period
    `;

    return rows.map((r) => ({
      period: r.period,
      count: Number(r.count),
    }));
  }

  // ───────────────────── Revenue Stats ──────────────────────────────────────

  async getRevenueStats(period: 'month') {
    // Default: last 12 months of revenue by invoice-item category
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - 12);

    if (period === 'month') {
      const rows = await this.prisma.$queryRaw<
        { month: Date; category: string; revenue: number }[]
      >`
        SELECT date_trunc('month', p.paid_at)  AS month,
               ii.category,
               SUM(ii.total)::float8            AS revenue
          FROM payments   p
          JOIN invoices    i  ON i.id = p.invoice_id
          JOIN invoice_items ii ON ii.invoice_id = i.id
         WHERE p.paid_at >= ${monthsAgo}
         GROUP BY month, ii.category
         ORDER BY month, ii.category
      `;

      return rows.map((r) => ({
        month: r.month,
        category: r.category,
        revenue: Number(r.revenue),
      }));
    }

    return [];
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

    const patientMap = new Map(
      patientCounts.map((r) => [r.department_id, Number(r.patient_count)]),
    );

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      doctorCount: dept._count.doctors,
      appointmentCount: dept._count.appointments,
      patientCount: patientMap.get(dept.id) ?? 0,
    }));
  }
}
