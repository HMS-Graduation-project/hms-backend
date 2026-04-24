import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { HospitalsService } from './hospitals.service';

@ApiTags('Hospitals')
@ApiBearerAuth()
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  /** Every authenticated user can see hospital info (their own, or all if national role). */
  @Get()
  @ApiOperation({ summary: 'List hospitals (scoped by role)' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.hospitalsService.findAll(user.hospitalId);
  }

  @Get('me')
  @ApiOperation({ summary: "Get the caller's current hospital" })
  getMyHospital(@CurrentUser() user: AuthUser) {
    return this.hospitalsService.getCurrentCallerHospital(user.hospitalId);
  }

  @Get('referral-targets')
  @ApiOperation({
    summary: 'List every OTHER hospital (for populating referral-target selectors)',
  })
  listReferralTargets(@CurrentUser() user: AuthUser) {
    return this.hospitalsService.listReferralTargets(user.hospitalId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hospital by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hospitalsService.findById(id, user.hospitalId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new hospital (SUPER_ADMIN only)' })
  create(@Body() dto: CreateHospitalDto) {
    return this.hospitalsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary:
      'Update a hospital. SUPER_ADMIN can update any; HOSPITAL_ADMIN/ADMIN only their own.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHospitalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hospitalsService.update(id, dto, user.hospitalId);
  }
}
