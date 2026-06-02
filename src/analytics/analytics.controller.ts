import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

/**
 * Read-only analytics endpoints for admin dashboards.
 * All routes require ADMIN or SUPER_ADMIN role.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ──────────────────── Dashboard Summary ────────────────────────────────────

  @Get('dashboard')
  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
    Role.PHARMACIST,
    Role.LAB_TECHNICIAN,
  )
  @ApiOperation({
    summary: 'Get dashboard summary stats',
    description:
      'Returns patient count, doctor count, today appointments, pending lab orders, monthly revenue, and pending invoices.',
  })
  async getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  // ──────────────────── Appointment Stats ────────────────────────────────────

  @Get('appointments')
  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
    Role.PHARMACIST,
    Role.LAB_TECHNICIAN,
  )
  @ApiOperation({
    summary: 'Get appointment counts grouped by period',
    description:
      'Returns appointment counts with status breakdown (total, confirmed, completed, cancelled).',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'week', 'month', 'year'],
    description: 'Time period to aggregate over (default: week)',
    example: 'week',
  })
  async getAppointmentStats(
    @Query('period') period: 'daily' | 'week' | 'month' | 'year' = 'week',
  ) {
    return this.analyticsService.getAppointmentStats(period);
  }

  // ──────────────────── Revenue Stats ────────────────────────────────────────

  @Get('revenue')
  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
    Role.PHARMACIST,
    Role.LAB_TECHNICIAN,
  )
  @ApiOperation({
    summary: 'Get revenue breakdown by category with growth percentage',
    description:
      'Returns total revenue, growth vs previous period, and per-category breakdown.',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['month', 'quarter', 'year'],
    description: 'Aggregation period (default: month)',
    example: 'month',
  })
  async getRevenueStats(
    @Query('period') period: 'month' | 'quarter' | 'year' = 'month',
  ) {
    return this.analyticsService.getRevenueStats(period);
  }

  // ──────────────────── Department Stats ─────────────────────────────────────

  @Get('departments')
  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
    Role.PHARMACIST,
    Role.LAB_TECHNICIAN,
  )
  @ApiOperation({
    summary: 'Get per-department statistics',
    description:
      'Returns doctor count, appointment count, and unique patient count for each active department.',
  })
  async getDepartmentStats() {
    return this.analyticsService.getDepartmentStats();
  }
}
