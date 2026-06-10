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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BedStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { InpatientService } from './inpatient.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { TransferBedDto } from './dto/transfer-bed.dto';
import { DischargeAdmissionDto } from './dto/discharge.dto';
import { AdmissionQueryDto } from './dto/admission-query.dto';

/**
 * Inpatient / IPD module — wards, beds, admissions.
 *
 * All endpoints are hospital-scoped. Cross-hospital IPD visibility is out of
 * scope (Phase 5 referrals cover inter-hospital transfers via a different path).
 */
@ApiTags('Inpatient')
@ApiBearerAuth()
@Controller('inpatient')
export class InpatientController {
  constructor(private readonly service: InpatientService) {}

  // ─── Wards ─────────────────────────────────────────────────────────

  @Get('wards')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'List wards at the current hospital' })
  listWards(@CurrentUser() user: AuthUser) {
    return this.service.listWards(user.hospitalId);
  }

  @Get('wards/:id')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'Get ward detail (includes bed layout)' })
  getWard(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getWard(id, user.hospitalId);
  }

  @Post('wards')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Create a ward' })
  createWard(@Body() dto: CreateWardDto, @CurrentUser() user: AuthUser) {
    return this.service.createWard(dto, user.hospitalId!);
  }

  @Patch('wards/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Update a ward' })
  updateWard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateWard(id, dto, user.hospitalId!);
  }

  // ─── Beds ──────────────────────────────────────────────────────────

  @Get('beds')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'List beds. Filter by wardId and/or status.' })
  listBeds(
    @CurrentUser() user: AuthUser,
    @Query('wardId') wardId?: string,
    @Query('status') status?: BedStatus,
  ) {
    return this.service.listBeds(user.hospitalId, wardId, status);
  }

  @Post('beds')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Create a bed inside a ward' })
  createBed(@Body() dto: CreateBedDto, @CurrentUser() user: AuthUser) {
    return this.service.createBed(dto, user.hospitalId!);
  }

  @Patch('beds/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.NURSE)
  @ApiOperation({ summary: 'Update bed status / notes' })
  updateBed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBedDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateBed(id, dto, user.hospitalId!);
  }

  // ─── Admissions ───────────────────────────────────────────────────

  @Get('admissions')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'List admissions. Defaults to open admissions.' })
  listAdmissions(
    @Query() query: AdmissionQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.listAdmissions(query, user.hospitalId);
  }

  @Get('admissions/:id')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'Get admission detail (timeline, transfers, records)' })
  getAdmission(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getAdmission(id, user.hospitalId);
  }

  @Post('admissions')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Admit a patient (optionally allocate a bed)' })
  admit(
    @Body() dto: CreateAdmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.admit(dto, user.hospitalId!);
  }

  @Patch('admissions/:id/transfer-bed')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Transfer an admitted patient to a different bed' })
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferBedDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.transferBed(id, dto, user, user.hospitalId!);
  }

  @Patch('admissions/:id/discharge')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Discharge (or mark deceased) an admission' })
  discharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DischargeAdmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.discharge(id, dto, user.hospitalId!);
  }
}
