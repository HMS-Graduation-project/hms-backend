import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { SchedulesService } from './schedules.service';

/**
 * Doctor schedule management endpoints.
 * Nested under /doctors/:doctorId for RESTful clarity.
 */
@ApiTags('Doctor Schedules')
@ApiBearerAuth()
@Controller('doctors/:doctorId')
export class SchedulesController {
  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly prisma: PrismaService,
  ) {}

  @Put('schedule')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Set/replace a doctor\'s weekly schedule' })
  @ApiParam({ name: 'doctorId', description: 'Doctor profile UUID' })
  async setSchedule(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: SetScheduleDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    await this.ensureSelfOrAdmin(doctorId, currentUser);
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.schedulesService.setSchedule(
      doctorId,
      dto,
      currentUser.hospitalId!,
    );
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get a doctor\'s weekly schedule' })
  @ApiParam({ name: 'doctorId', description: 'Doctor profile UUID' })
  async getSchedule(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.schedulesService.getSchedule(doctorId);
  }

  @Get('available-slots')
  @ApiOperation({
    summary: 'Get available appointment slots for a doctor on a given date',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor profile UUID' })
  @ApiQuery({
    name: 'date',
    description: 'Date in YYYY-MM-DD format',
    example: '2026-04-01',
  })
  async getAvailableSlots(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') date: string,
  ) {
    return this.schedulesService.getAvailableSlots(doctorId, date);
  }

  // ──────────────────── Private helper ───────────────────────────────────

  /**
   * Doctors can only modify their own schedule. Admins can modify any.
   */
  private async ensureSelfOrAdmin(
    doctorId: string,
    currentUser: AuthUser,
  ): Promise<void> {
    const isAdmin =
      currentUser.role === Role.ADMIN ||
      currentUser.role === Role.SUPER_ADMIN;

    if (isAdmin) return;

    // For DOCTOR role, verify the doctorId belongs to the current user
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { userId: true },
    });

    if (!profile || profile.userId !== currentUser.id) {
      throw new ForbiddenException(
        'You can only modify your own schedule',
      );
    }
  }
}
