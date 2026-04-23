import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';

/**
 * Application settings and holiday management.
 * All routes require ADMIN or SUPER_ADMIN role.
 */
@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ──────────────────── Get All Settings ─────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all settings as key-value map',
    description:
      'Returns every setting in the caller hospital scope (or global when the caller has no hospital) as a flat JSON object.',
  })
  async getAll(@CurrentUser() currentUser: AuthUser) {
    return this.settingsService.getAll(currentUser.hospitalId);
  }

  // ──────────────────── Upsert Setting ───────────────────────────────────────

  @Put()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create or update a setting',
    description:
      'Upserts a setting by key scoped to the caller hospital (or globally when the caller has no hospital).',
  })
  async set(
    @Body() dto: UpdateSettingDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.settingsService.set(dto.key, dto.value, currentUser.hospitalId);
  }

  // ──────────────────── List Holidays ────────────────────────────────────────

  @Get('holidays')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List all holidays',
    description:
      'Returns all holidays (scoped to the caller hospital, or global) ordered by date ascending.',
  })
  async getHolidays(@CurrentUser() currentUser: AuthUser) {
    return this.settingsService.getHolidays(currentUser.hospitalId);
  }

  // ──────────────────── Create Holiday ───────────────────────────────────────

  @Post('holidays')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new holiday',
    description:
      'Adds a named date to the holidays calendar (scoped to the caller hospital, or global).',
  })
  async createHoliday(
    @Body() dto: CreateHolidayDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.settingsService.createHoliday(dto, currentUser.hospitalId);
  }

  // ──────────────────── Delete Holiday ───────────────────────────────────────

  @Delete('holidays/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a holiday by ID' })
  @ApiParam({ name: 'id', description: 'Holiday UUID' })
  async deleteHoliday(@Param('id', ParseUUIDPipe) id: string) {
    return this.settingsService.deleteHoliday(id);
  }
}
