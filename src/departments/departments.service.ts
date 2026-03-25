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
   */
  async findAll(query: DepartmentQueryDto, isAdmin = false) {
    const where: Record<string, unknown> = {};

    if (!isAdmin) {
      where.isActive = true;
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

  async create(dto: CreateDepartmentDto) {
    await this.ensureNameUnique(dto.name);

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
      },
      include: {
        headDoctor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // ───────────────────── Update ──────────────────────────────────────────────

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.ensureDepartmentExists(id);

    if (dto.name) {
      await this.ensureNameUnique(dto.name, id);
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
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.department.findUnique({
      where: { name },
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
