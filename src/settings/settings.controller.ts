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
    description: 'Returns every setting in the system as a flat JSON object.',
  })
  async getAll() {
    return this.settingsService.getAll();
  }

  // ──────────────────── Upsert Setting ───────────────────────────────────────

  @Put()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create or update a setting',
    description:
      'Upserts a setting by key. If the key exists its value is updated; otherwise a new entry is created.',
  })
  async set(@Body() dto: UpdateSettingDto) {
    return this.settingsService.set(dto.key, dto.value);
  }

  // ──────────────────── List Holidays ────────────────────────────────────────

  @Get('holidays')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List all holidays',
    description: 'Returns all holidays ordered by date ascending.',
  })
  async getHolidays() {
    return this.settingsService.getHolidays();
  }

  // ──────────────────── Create Holiday ───────────────────────────────────────

  @Post('holidays')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new holiday',
    description: 'Adds a named date to the holidays calendar.',
  })
  async createHoliday(@Body() dto: CreateHolidayDto) {
    return this.settingsService.createHoliday(dto);
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
