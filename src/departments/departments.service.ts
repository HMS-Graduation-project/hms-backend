import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── List (paginated) ────────────────────────────────────

  /**
   * Paginated list of departments with optional text search on name
   * and description.
   *
   * @param query  Pagination + search params
   * @param isAdmin  When true, inactive departments are included
   * @param hospitalId  When non-null, scope results to that hospital
   */
  async findAll(
    query: DepartmentQueryDto,
    isAdmin = false,
    hospitalId: string | null = null,
  ) {
    const where: Record<string, unknown> = {};

    if (!isAdmin) {
      where.isActive = true;
    }

    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return paginate(
      this.prisma.department as any,
      {
        where,
        include: {
          headDoctor: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { doctors: true } },
        },
      },
      query,
    );
  }

  // ───────────────────── Grouped (governorate → hospital) ─────────────────────

  /**
   * Return departments as a hierarchy: governorate → hospital → departments.
   * Intended for national / regional scope (SUPER_ADMIN, MINISTRY, REGIONAL)
   * where the flat list mixes identically-named departments from many
   * hospitals together.
   *
   * @param isAdmin     When true, inactive departments are included
   * @param hospitalId  When set, scope to a single hospital
   * @param cityId      When set (and no hospitalId), scope to one city
   */
  async findGrouped(
    isAdmin = false,
    hospitalId: string | null = null,
    cityId: string | null = null,
  ) {
    const where: Record<string, unknown> = {};

    if (!isAdmin) {
      where.isActive = true;
    }

    if (hospitalId) {
      where.hospitalId = hospitalId;
    } else if (cityId) {
      where.hospital = { cityId };
    }

    const departments = await (this.prisma.department as any).findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        headDoctor: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { doctors: true } },
        hospital: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            code: true,
            city: {
              select: {
                id: true,
                name: true,
                nameAr: true,
                governorate: true,
              },
            },
          },
        },
      },
    });

    // governorate name → (hospital id → hospital node)
    const govMap = new Map<string, Map<string, any>>();

    for (const dept of departments) {
      const { hospital, ...deptFields } = dept;
      const gov =
        hospital.city?.governorate || hospital.city?.name || 'Unknown';

      if (!govMap.has(gov)) {
        govMap.set(gov, new Map());
      }
      const hospitalMap = govMap.get(gov)!;

      if (!hospitalMap.has(hospital.id)) {
        hospitalMap.set(hospital.id, {
          id: hospital.id,
          name: hospital.name,
          nameAr: hospital.nameAr,
          code: hospital.code,
          city: hospital.city
            ? {
                id: hospital.city.id,
                name: hospital.city.name,
                nameAr: hospital.city.nameAr,
              }
            : null,
          departmentCount: 0,
          doctorCount: 0,
          departments: [] as any[],
        });
      }

      const hospitalNode = hospitalMap.get(hospital.id)!;
      const doctorCount = dept._count?.doctors ?? 0;
      hospitalNode.departments.push(deptFields);
      hospitalNode.departmentCount += 1;
      hospitalNode.doctorCount += doctorCount;
    }

    const governorates = [...govMap.entries()]
      .map(([governorate, hospitalMap]) => {
        const hospitals = [...hospitalMap.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        return {
          governorate,
          hospitalCount: hospitals.length,
          departmentCount: hospitals.reduce(
            (sum, h) => sum + h.departmentCount,
            0,
          ),
          doctorCount: hospitals.reduce((sum, h) => sum + h.doctorCount, 0),
          hospitals,
        };
      })
      .sort((a, b) => a.governorate.localeCompare(b.governorate));

    return {
      governorates,
      totals: {
        governorateCount: governorates.length,
        hospitalCount: governorates.reduce((s, g) => s + g.hospitalCount, 0),
        departmentCount: governorates.reduce(
          (s, g) => s + g.departmentCount,
          0,
        ),
        doctorCount: governorates.reduce((s, g) => s + g.doctorCount, 0),
      },
    };
  }

  // ───────────────────── Single ──────────────────────────────────────────────

  /**
   * Return a single department by ID with its head doctor and doctor list.
   * Throws NotFoundException when the department does not exist.
   */
  async findById(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        headDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        doctors: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with id "${id}" not found`);
    }

    return department;
  }

  // ───────────────────── Create ──────────────────────────────────────────────

  async create(dto: CreateDepartmentDto, hospitalId: string) {
    await this.ensureNameUnique(dto.name, hospitalId);

    if (dto.headDoctorId) {
      await this.ensureUserExists(dto.headDoctorId);
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        description: dto.description,
        floor: dto.floor,
        phone: dto.phone,
        headDoctorId: dto.headDoctorId,
        hospitalId,
      },
      include: {
        headDoctor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // ───────────────────── Update ──────────────────────────────────────────────

  async update(id: string, dto: UpdateDepartmentDto, hospitalId: string) {
    await this.ensureDepartmentExists(id);

    if (dto.name) {
      await this.ensureNameUnique(dto.name, hospitalId, id);
    }

    if (dto.headDoctorId) {
      await this.ensureUserExists(dto.headDoctorId);
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        floor: dto.floor,
        phone: dto.phone,
        headDoctorId: dto.headDoctorId,
      },
      include: {
        headDoctor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // ───────────────────── Soft delete ─────────────────────────────────────────

  /**
   * Soft-deletes a department by setting isActive = false.
   */
  async remove(id: string) {
    await this.ensureDepartmentExists(id);

    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ───────────────────── Private helpers ─────────────────────────────────────

  private async ensureDepartmentExists(id: string): Promise<void> {
    const count = await this.prisma.department.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Department with id "${id}" not found`);
    }
  }

  private async ensureNameUnique(
    name: string,
    hospitalId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.department.findUnique({
      where: { hospitalId_name: { hospitalId, name } },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Department with name "${name}" already exists`,
      );
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const count = await this.prisma.user.count({ where: { id: userId } });
    if (count === 0) {
      throw new NotFoundException(
        `User with id "${userId}" not found`,
      );
    }
  }
}
