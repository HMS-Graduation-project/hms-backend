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
import { CreateNationalPatientDto } from './dto/create-national-patient.dto';
import { UpdateNationalPatientDto } from './dto/update-national-patient.dto';
import { SearchNationalPatientDto } from './dto/search-national-patient.dto';
import { MergeNationalPatientDto } from './dto/merge-national-patient.dto';
import { NationalRegistryService } from './national-registry.service';

/**
 * National Patient Registry — the master patient identity across hospitals.
 *
 * Search / read is allowed to any hospital staff role (DOCTOR, NURSE, HOSPITAL_ADMIN, etc.)
 * so they can link a walk-in patient to their existing NHID. Actual clinical
 * records remain hospital-scoped and only reachable via the patients endpoints
 * within the caller's hospital, or (Phase 5) via an accepted referral.
 *
 * Create / update / merge require a hospital role (staff can create new NHIDs
 * when registering a patient who isn't in the registry yet) or admin roles.
 * Merge is SUPER_ADMIN + MINISTRY_ADMIN only to avoid accidental data loss.
 */
@ApiTags('National Patient Registry')
@ApiBearerAuth()
@Controller('national-registry/patients')
export class NationalRegistryController {
  constructor(private readonly service: NationalRegistryService) {}

  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN)
  @ApiOperation({
    summary: 'Registry KPI stats: total patients, new this month, multi-hospital, potential duplicates',
  })
  getStats() {
    return this.service.getStats();
  }

  @Get('search')
  @Roles(
    Role.SUPER_ADMIN,
    Role.MINISTRY_ADMIN,
    Role.REGIONAL_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'Search national patients by ID, name, or DOB' })
  search(@Query() query: SearchNationalPatientDto) {
    return this.service.search(query);
  }

  @Get(':nhid')
  @Roles(
    Role.SUPER_ADMIN,
    Role.MINISTRY_ADMIN,
    Role.REGIONAL_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  @ApiOperation({
    summary:
      'Get a national patient by NHID, including the hospitals where they have a local profile',
  })
  findOne(@Param('nhid', ParseUUIDPipe) nhid: string) {
    return this.service.findById(nhid);
  }

  @Post()
  @Roles(
    Role.SUPER_ADMIN,
    Role.MINISTRY_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.RECEPTIONIST,
  )
  @ApiOperation({
    summary:
      'Register a new national patient (when the registry search returns no match)',
  })
  create(@Body() dto: CreateNationalPatientDto) {
    return this.service.create(dto);
  }

  @Patch(':nhid')
  @Roles(
    Role.SUPER_ADMIN,
    Role.MINISTRY_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
  )
  @ApiOperation({ summary: 'Update national patient demographics/alerts' })
  update(
    @Param('nhid', ParseUUIDPipe) nhid: string,
    @Body() dto: UpdateNationalPatientDto,
  ) {
    return this.service.update(nhid, dto);
  }

  @Post(':nhid/merge')
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN)
  @ApiOperation({
    summary:
      'Merge two national patients. :nhid is the WINNER (kept); body.loserId is merged in and deleted.',
  })
  merge(
    @Param('nhid', ParseUUIDPipe) nhid: string,
    @Body() dto: MergeNationalPatientDto,
  ) {
    return this.service.merge(nhid, dto.loserId);
  }
}
