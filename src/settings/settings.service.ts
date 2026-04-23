import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';

/**
 * Manages application settings (key-value pairs) and holidays.
 *
 * Settings and holidays are hospital-scoped when a hospitalId is supplied.
 * When hospitalId is null (e.g., SUPER_ADMIN context) they fall back to
 * the global scope (DB column hospitalId = NULL).
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Settings (key-value) ───────────────────────────────

  /** Return all settings (for the given hospital, or global if null) as a flat { key: value } map. */
  async getAll(hospitalId: string | null): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({
      where: { hospitalId },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Return a single setting value, or null if not found. */
  async get(key: string, hospitalId: string | null): Promise<string | null> {
    // Prisma's composite unique `hospitalId_key` types hospitalId as string
    // and cannot express NULL; use findFirst for the global (hospitalId=null)
    // case, findUnique for hospital-scoped lookups.
    const row = hospitalId
      ? await this.prisma.setting.findUnique({
          where: { hospitalId_key: { hospitalId, key } },
        })
      : await this.prisma.setting.findFirst({
          where: { hospitalId: null, key },
        });
    return row?.value ?? null;
  }

  /** Upsert a single setting. Creates if missing, updates if exists. */
  async set(key: string, value: string, hospitalId: string | null) {
    if (hospitalId) {
      return this.prisma.setting.upsert({
        where: { hospitalId_key: { hospitalId, key } },
        update: { value },
        create: { key, value, hospitalId },
      });
    }

    // Global setting: manual upsert since Prisma can't express NULL in the
    // composite unique where.
    const existing = await this.prisma.setting.findFirst({
      where: { hospitalId: null, key },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.setting.update({
        where: { id: existing.id },
        data: { value },
      });
    }

    return this.prisma.setting.create({
      data: { key, value, hospitalId: null },
    });
  }

  // ───────────────────── Holidays ───────────────────────────────────────────

  /** Return all holidays (for the given hospital, or global) ordered by date ascending. */
  async getHolidays(hospitalId: string | null) {
    return this.prisma.holiday.findMany({
      where: { hospitalId },
      orderBy: { date: 'asc' },
    });
  }

  /** Create a new holiday entry. */
  async createHoliday(dto: CreateHolidayDto, hospitalId: string | null) {
    return this.prisma.holiday.create({
      data: {
        name: dto.name,
        date: new Date(dto.date),
        hospitalId,
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
