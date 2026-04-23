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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { CreateVitalSignsDto } from './dto/create-vital-signs.dto';
import { MedicalRecordsService } from './medical-records.service';

@ApiTags('Medical Records')
@ApiBearerAuth()
@Controller()
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Get('medical-records')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all medical records (paginated)' })
  async findAll(@Query() query: PaginationQueryDto) {
    return this.medicalRecordsService.findAll(query);
  }

  @Post('medical-records')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Create a medical record for a completed/in-progress appointment' })
  async create(
    @Body() dto: CreateMedicalRecordDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.medicalRecordsService.create(
      dto,
      currentUser.id,
      currentUser.hospitalId!,
    );
  }

  @Get('medical-records/:id')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a medical record by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.findById(id);
  }

  @Patch('medical-records/:id')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Update a medical record' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    return this.medicalRecordsService.update(id, dto);
  }

  @Get('patients/:patientId/medical-records')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List medical records for a patient (paginated)' })
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.medicalRecordsService.findByPatient(patientId, query);
  }

  @Post('medical-records/:id/vitals')
  @Roles(Role.DOCTOR, Role.NURSE)
  @ApiOperation({ summary: 'Add or update vital signs for a medical record' })
  async addVitalSigns(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVitalSignsDto,
  ) {
    return this.medicalRecordsService.addVitalSigns(id, dto);
  }
}
