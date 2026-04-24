import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { ReportingService } from './reporting.service';
import { ReportingQueryDto } from './dto/reporting-query.dto';

/**
 * Regional & ministry dashboards.
 *
 * All endpoints deliberately read across hospitals — role guards here are
 * the authoritative boundary.
 */
@ApiTags('Reporting')
@ApiBearerAuth()
@Controller('reporting')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('regional/summary')
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN, Role.REGIONAL_ADMIN)
  @ApiOperation({
    summary:
      'Regional KPI rollup — per-hospital bed occupancy, ER volume, referral I/O, top diagnoses, daily patient volume.',
  })
  regionalSummary(
    @Query() query: ReportingQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.regionalSummary(user, query);
  }

  @Get('national/summary')
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN)
  @ApiOperation({
    summary:
      'National overview — per-city rollup, national totals, top diagnoses, daily patient volume.',
  })
  nationalSummary(
    @Query() query: ReportingQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.nationalSummary(user, query);
  }

  @Get('referral-flow')
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN, Role.REGIONAL_ADMIN)
  @ApiOperation({
    summary:
      'Referral-flow matrix: counts of referrals between each (fromCity, toCity) pair.',
  })
  referralFlow(
    @Query() query: ReportingQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.referralFlow(user, query);
  }

  @Get('disease-trends')
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN, Role.REGIONAL_ADMIN)
  @ApiOperation({
    summary:
      'Top-N diagnosis frequency over time, bucketed by day (<=30d window) or week.',
  })
  diseaseTrends(
    @Query() query: ReportingQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.diseaseTrends(user, query);
  }
}
