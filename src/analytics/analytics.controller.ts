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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get appointment counts grouped by period',
    description:
      'Returns appointment counts grouped by day (for week/month) or by month (for year).',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month', 'year'],
    description: 'Time period to aggregate over (default: week)',
    example: 'week',
  })
  async getAppointmentStats(
    @Query('period') period: 'week' | 'month' | 'year' = 'week',
  ) {
    return this.analyticsService.getAppointmentStats(period);
  }

  // ──────────────────── Revenue Stats ────────────────────────────────────────

  @Get('revenue')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get revenue breakdown by category and month',
    description:
      'Returns revenue from invoice items grouped by month and category for the last 12 months.',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['month'],
    description: 'Aggregation period (default: month)',
    example: 'month',
  })
  async getRevenueStats(@Query('period') period: 'month' = 'month') {
    return this.analyticsService.getRevenueStats(period);
  }

  // ──────────────────── Department Stats ─────────────────────────────────────

  @Get('departments')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get per-department statistics',
    description:
      'Returns doctor count, appointment count, and unique patient count for each active department.',
  })
  async getDepartmentStats() {
    return this.analyticsService.getDepartmentStats();
  }
}
