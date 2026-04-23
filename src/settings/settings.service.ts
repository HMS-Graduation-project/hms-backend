import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';

/**
 * Manages global application settings (key-value pairs) and holidays.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Settings (key-value) ───────────────────────────────

  /** Return all settings as a flat { key: value } map. */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Return a single setting value, or null if not found. */
  async get(key: string): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  /** Upsert a single setting. Creates if missing, updates if exists. */
  async set(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // ───────────────────── Holidays ───────────────────────────────────────────

  /** Return all holidays ordered by date ascending. */
  async getHolidays() {
    return this.prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    });
  }

  /** Create a new holiday entry. */
  async createHoliday(dto: CreateHolidayDto) {
    return this.prisma.holiday.create({
      data: {
        name: dto.name,
        date: new Date(dto.date),
      },
    });
  }

  /** Delete a holiday by ID. Throws if not found. */
  async deleteHoliday(id: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });

    if (!holiday) {
      throw new NotFoundException(`Holiday "${id}" not found`);
    }

    return this.prisma.holiday.delete({ where: { id } });
  }
}
