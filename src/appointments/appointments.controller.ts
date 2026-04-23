import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { AppointmentsService } from './appointments.service';

/**
 * Appointment management endpoints.
 * All routes require an authenticated JWT (guards are global).
 */
@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ──────────────────── Static routes (before :id) ───────────────────────

  @Get('my')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Get current patient\'s appointments (paginated)' })
  async getMyAppointments(
    @CurrentUser() currentUser: { id: string; role: Role },
    @Query() query: AppointmentQueryDto,
  ) {
    return this.appointmentsService.getMyAppointments(currentUser.id, query);
  }

  @Get('today')
  @Roles(Role.DOCTOR, Role.NURSE)
  @ApiOperation({ summary: 'Get today\'s appointments for the current doctor' })
  async getTodayAppointments(
    @CurrentUser() currentUser: { id: string; role: Role },
  ) {
    return this.appointmentsService.getTodayAppointments(currentUser.id);
  }

  // ──────────────────── CRUD routes ──────────────────────────────────────

  @Post()
  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.RECEPTIONIST,
    Role.PATIENT,
    Role.DOCTOR,
  )
  @ApiOperation({ summary: 'Create a new appointment' })
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() currentUser: { id: string; role: string },
  ) {
    return this.appointmentsService.create(dto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'List all appointments (paginated, role-filtered)' })
  async findAll(
    @Query() query: AppointmentQueryDto,
    @CurrentUser() currentUser: { id: string; role: Role },
  ) {
    return this.appointmentsService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment details by ID' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.findById(id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Update appointment status' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(id, dto);
  }

  @Patch(':id/reschedule')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST, Role.PATIENT)
  @ApiOperation({ summary: 'Reschedule an appointment' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(id, dto);
  }

  @Post(':id/cancel')
  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.RECEPTIONIST,
    Role.PATIENT,
    Role.DOCTOR,
  )
  @ApiOperation({ summary: 'Cancel an appointment' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Cancellation reason',
          example: 'Patient requested cancellation',
        },
      },
    },
    required: false,
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.appointmentsService.cancel(id, reason);
  }
}
