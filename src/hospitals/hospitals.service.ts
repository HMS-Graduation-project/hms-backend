import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SUPER_ADMIN sees all. HOSPITAL_ADMIN / DOCTOR / etc. see only their own
   * hospital. REGIONAL_ADMIN (Phase 2+) will be scoped to their city.
   */
  async findAll(callerHospitalId: string | null) {
    if (callerHospitalId) {
      // Hospital-scoped caller: return only their hospital
      return this.prisma.hospital.findMany({
        where: { id: callerHospitalId },
        include: { city: true },
      });
    }
    return this.prisma.hospital.findMany({
      include: { city: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, callerHospitalId: string | null) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      include: { city: true },
    });
    if (!hospital) {
      throw new NotFoundException(`Hospital with id "${id}" not found`);
    }
    // Hospital-scoped caller can only read their own hospital
    if (callerHospitalId && hospital.id !== callerHospitalId) {
      throw new ForbiddenException('Cross-hospital read not permitted');
    }
    return hospital;
  }

  /**
   * Every active hospital except the caller's. Used to populate the target
   * selector when authoring a referral. Any authenticated hospital user may
   * call this — hospital names/locations are public info in the national
   * platform.
   */
  async listReferralTargets(callerHospitalId: string | null) {
    return this.prisma.hospital.findMany({
      where: {
        isActive: true,
        ...(callerHospitalId ? { id: { not: callerHospitalId } } : {}),
      },
      include: { city: true },
      orderBy: [{ city: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async getCurrentCallerHospital(callerHospitalId: string | null) {
    if (!callerHospitalId) {
      throw new NotFoundException(
        'Caller is not scoped to a hospital (national role)',
      );
    }
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: callerHospitalId },
      include: { city: true },
    });
    if (!hospital) {
      throw new NotFoundException('Current hospital no longer exists');
    }
    return hospital;
  }

  /** SUPER_ADMIN only. */
  async create(dto: CreateHospitalDto) {
    const existing = await this.prisma.hospital.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Hospital with code "${dto.code}" already exists`);
    }

    const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
    if (!city) {
      throw new NotFoundException(`City with id "${dto.cityId}" not found`);
    }

    return this.prisma.hospital.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
        cityId: dto.cityId,
        address: dto.address,
        phone: dto.phone,
        logoUrl: dto.logoUrl,
        isActive: dto.isActive ?? true,
      },
      include: { city: true },
    });
  }

  /**
   * SUPER_ADMIN can update any hospital.
   * HOSPITAL_ADMIN can only update their own.
   */
  async update(
    id: string,
    dto: UpdateHospitalDto,
    callerHospitalId: string | null,
  ) {
    if (callerHospitalId && callerHospitalId !== id) {
      throw new ForbiddenException('You can only update your own hospital');
    }
    await this.ensureExists(id);

    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
      if (!city) {
        throw new NotFoundException(`City with id "${dto.cityId}" not found`);
      }
    }

    return this.prisma.hospital.update({
      where: { id },
      data: dto,
      include: { city: true },
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.hospital.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Hospital with id "${id}" not found`);
    }
  }
}
