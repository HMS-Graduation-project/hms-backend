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
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Register a new patient' })
  async create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.patientsService.create(dto, currentUser.hospitalId!);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'List patients (paginated)' })
  async findAll(@Query() query: PatientQueryDto) {
    return this.patientsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Get a patient by profile ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Update a patient' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(id, dto);
  }
}
