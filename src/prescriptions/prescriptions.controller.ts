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
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@Controller()
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post('prescriptions')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Create a prescription for a medical record' })
  async create(
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.prescriptionsService.create(
      dto,
      currentUser.id,
      currentUser.hospitalId!,
    );
  }

  @Get('prescriptions/:id')
  @Roles(Role.DOCTOR, Role.NURSE, Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a prescription by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findById(id);
  }

  @Get('prescriptions')
  @Roles(Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all prescriptions (paginated, for pharmacists)' })
  async findAll(@Query() query: PrescriptionQueryDto) {
    return this.prescriptionsService.findAll(query);
  }

  @Patch('prescriptions/:id/status')
  @Roles(Role.PHARMACIST)
  @ApiOperation({ summary: 'Update prescription status (dispense / cancel)' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionStatusDto,
  ) {
    return this.prescriptionsService.updateStatus(id, dto.status);
  }

  @Get('patients/:patientId/prescriptions')
  @Roles(Role.DOCTOR, Role.NURSE, Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List prescriptions for a patient (paginated)' })
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: PrescriptionQueryDto,
  ) {
    return this.prescriptionsService.findByPatient(patientId, query);
  }
}
