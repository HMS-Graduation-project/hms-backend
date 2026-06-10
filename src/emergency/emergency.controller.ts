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
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateEmergencyVisitDto } from './dto/create-emergency-visit.dto';
import { TriageEmergencyVisitDto } from './dto/triage-emergency-visit.dto';
import { DispositionEmergencyVisitDto } from './dto/disposition-emergency-visit.dto';
import { LinkEmergencyPatientDto } from './dto/link-patient.dto';
import { EmergencyQueryDto } from './dto/emergency-query.dto';
import { EmergencyService } from './emergency.service';

/**
 * Emergency / ER module — walk-in triage workflow.
 *
 * All endpoints are hospital-scoped: a user can only see and mutate visits at
 * their own hospital. Cross-hospital visibility is out of scope until the
 * Referral module (Phase 5).
 */
@ApiTags('Emergency')
@ApiBearerAuth()
@Controller('emergency/visits')
export class EmergencyController {
  constructor(private readonly service: EmergencyService) {}

  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'List ER visits. Defaults to open (non-closed) visits.' })
  findAll(
    @Query() query: EmergencyQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    // National-scope users (SUPER_ADMIN, hospitalId = null) see all hospitals;
    // hospital-scoped users are restricted to their own hospital.
    return this.service.findAll(query, user.hospitalId);
  }

  @Get(':id')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'Get ER visit detail' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findById(id, user.hospitalId);
  }

  @Post()
  @Roles(
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.RECEPTIONIST,
    Role.NURSE,
    Role.DOCTOR,
  )
  @ApiOperation({ summary: 'Intake — create a new ER visit' })
  create(
    @Body() dto: CreateEmergencyVisitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user.hospitalId!);
  }

  @Patch(':id/triage')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Record triage level and observations' })
  triage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriageEmergencyVisitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.triage(id, dto, user);
  }

  @Patch(':id/claim')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Claim a visit as attending doctor' })
  claim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.claim(id, user);
  }

  @Patch(':id/disposition')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Close the visit with a disposition (discharge / admit / transfer / LWBS)' })
  disposition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispositionEmergencyVisitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.disposition(id, dto, user.hospitalId!);
  }

  @Patch(':id/link-patient')
  @Roles(
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.RECEPTIONIST,
    Role.NURSE,
    Role.DOCTOR,
  )
  @ApiOperation({
    summary:
      'Attach an NHID and/or local PatientProfile to a visit that started unidentified',
  })
  linkPatient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkEmergencyPatientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.linkPatient(id, dto, user.hospitalId!);
  }
}
