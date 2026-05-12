import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PortalService } from './portal.service';
import { BookPortalAppointmentDto } from './dto/book-portal-appointment.dto';
import { PortalListQueryDto } from './dto/portal-appointment-query.dto';
import { UpdatePortalProfileDto } from './dto/update-portal-profile.dto';

/**
 * Patient-portal endpoints. Every route is scoped to the authenticated
 * patient via their NHID, so it spans every hospital they have a
 * PatientProfile at.
 */
@ApiTags('portal')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
@Roles(Role.PATIENT)
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  // ─── Profile ───────────────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: 'Current patient profile + linked hospitals' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.portal.getMe(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update demographics and self-reported alerts' })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePortalProfileDto,
  ) {
    return this.portal.updateMyProfile(user.id, dto);
  }

  @Get('national-record')
  @ApiOperation({ summary: 'Unified cross-hospital health record' })
  nationalRecord(@CurrentUser() user: AuthUser) {
    return this.portal.getNationalRecord(user.id);
  }

  // ─── Appointments ──────────────────────────────────────────────────

  @Get('appointments')
  @ApiOperation({ summary: "List the patient's appointments across hospitals" })
  listAppointments(
    @CurrentUser() user: AuthUser,
    @Query() query: PortalListQueryDto,
  ) {
    return this.portal.listAppointments(user.id, query);
  }

  @Post('appointments')
  @ApiOperation({ summary: 'Book a new appointment at any active hospital' })
  bookAppointment(
    @CurrentUser() user: AuthUser,
    @Body() dto: BookPortalAppointmentDto,
  ) {
    return this.portal.bookAppointment(user.id, dto);
  }

  @Delete('appointments/:id')
  @ApiOperation({ summary: 'Cancel a pending or confirmed appointment' })
  cancelAppointment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.portal.cancelAppointment(user.id, id);
  }

  // ─── Other clinical data ───────────────────────────────────────────

  @Get('prescriptions')
  @ApiOperation({ summary: 'Prescriptions across hospitals' })
  listPrescriptions(
    @CurrentUser() user: AuthUser,
    @Query() query: PortalListQueryDto,
  ) {
    return this.portal.listPrescriptions(user.id, query);
  }

  @Get('lab-results')
  @ApiOperation({ summary: 'Lab orders + results across hospitals' })
  listLabResults(
    @CurrentUser() user: AuthUser,
    @Query() query: PortalListQueryDto,
  ) {
    return this.portal.listLabResults(user.id, query);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Invoices across hospitals' })
  listInvoices(
    @CurrentUser() user: AuthUser,
    @Query() query: PortalListQueryDto,
  ) {
    return this.portal.listInvoices(user.id, query);
  }

  @Get('referrals')
  @ApiOperation({ summary: "Patient's referral history" })
  listReferrals(@CurrentUser() user: AuthUser) {
    return this.portal.listReferrals(user.id);
  }

  // ─── Booking helpers ───────────────────────────────────────────────

  @Get('hospitals')
  @ApiOperation({ summary: 'Active hospitals available for self-booking' })
  listHospitals() {
    return this.portal.listAvailableHospitals();
  }

  @Get('hospitals/:hospitalId/doctors')
  @ApiOperation({ summary: 'Doctors at a chosen hospital' })
  listDoctorsAtHospital(@Param('hospitalId') hospitalId: string) {
    return this.portal.listDoctorsAtHospital(hospitalId);
  }
}
