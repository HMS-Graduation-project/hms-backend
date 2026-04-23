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
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { DispenseDto } from './dto/dispense.dto';
import { MedicationQueryDto } from './dto/medication-query.dto';
import { PharmacyService } from './pharmacy.service';

@ApiTags('Pharmacy')
@ApiBearerAuth()
@Controller()
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  // ── Medications ────────────────────────────────────────────────────────────

  @Post('medications')
  @Roles(Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new medication' })
  async createMedication(
    @Body() dto: CreateMedicationDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.pharmacyService.createMedication(
      dto,
      currentUser.hospitalId!,
    );
  }

  @Get('medications')
  @Roles(Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'List medications (paginated, filterable)' })
  async findAllMedications(@Query() query: MedicationQueryDto) {
    return this.pharmacyService.findAllMedications(query);
  }

  // IMPORTANT: /low-stock must be defined BEFORE /:id to avoid route collision
  @Get('medications/low-stock')
  @Roles(Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all medications with stock at or below reorder level' })
  async getLowStock() {
    return this.pharmacyService.getLowStock();
  }

  @Get('medications/:id')
  @Roles(Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a medication by ID' })
  async findMedication(@Param('id', ParseUUIDPipe) id: string) {
    return this.pharmacyService.findMedicationById(id);
  }

  @Patch('medications/:id')
  @Roles(Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a medication' })
  async updateMedication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.pharmacyService.updateMedication(id, dto);
  }

  // ── Dispensing ─────────────────────────────────────────────────────────────

  @Post('dispensing')
  @Roles(Role.PHARMACIST)
  @ApiOperation({ summary: 'Dispense medication against a prescription' })
  async dispense(
    @Body() dto: DispenseDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.pharmacyService.dispense(
      dto,
      currentUser.id,
      currentUser.hospitalId!,
    );
  }
}
