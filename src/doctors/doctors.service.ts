import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';

/** Fields to include from the related User (password hash excluded). */
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Standard include clause reused across queries. */
const DEFAULT_INCLUDE = {
  user: { select: USER_SELECT },
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────── List (paginated) ────────────────────────────────

  async findAll(query: DoctorQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.specialization) {
      where.specialization = {
        contains: query.specialization,
        mode: 'insensitive',
      };
    }

    if (query.search) {
      where.user = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    return paginate(
      this.prisma.doctorProfile as any,
      { where, include: { ...DEFAULT_INCLUDE } },
      query,
    );
  }

  // ──────────────────── Find one ────────────────────────────────────────

  async findById(id: string) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { id },
      include: DEFAULT_INCLUDE,
    });

    if (!profile) {
      throw new NotFoundException(`Doctor profile with id "${id}" not found`);
    }

    return profile;
  }

  // ──────────────────── Create ──────────────────────────────────────────

  async create(dto: CreateDoctorDto, hospitalId: string) {
    // Guard: email must be unique
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Guard: license number must be unique
    const existingLicense = await this.prisma.doctorProfile.findUnique({
      where: { licenseNumber: dto.licenseNumber },
    });
    if (existingLicense) {
      throw new ConflictException('License number already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: Role.DOCTOR,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          hospitalId,
        },
      });

      const profile = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          specialization: dto.specialization,
          licenseNumber: dto.licenseNumber,
          departmentId: dto.departmentId,
          bio: dto.bio,
          yearsExperience: dto.yearsExperience,
          consultationFee: dto.consultationFee,
          hospitalId,
        },
        include: DEFAULT_INCLUDE,
      });

      return profile;
    });
  }

  // ──────────────────── Update ──────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateDoctorDto,
    currentUser: { id: string; role: Role },
  ) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundException(`Doctor profile with id "${id}" not found`);
    }

    // Self-check: DOCTOR role can only update their own profile
    const isAdmin =
      currentUser.role === Role.ADMIN ||
      currentUser.role === Role.SUPER_ADMIN;
    if (!isAdmin && currentUser.id !== profile.userId) {
      throw new ForbiddenException(
        'You can only update your own doctor profile',
      );
    }

    // Guard: license number uniqueness (only if changing it)
    if (dto.licenseNumber) {
      const existing = await this.prisma.doctorProfile.findUnique({
        where: { licenseNumber: dto.licenseNumber },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('License number already in use');
      }
    }

    // Separate user fields from profile fields
    const { firstName, lastName, phone, ...profileData } = dto;
    const hasUserUpdates =
      firstName !== undefined ||
      lastName !== undefined ||
      phone !== undefined;

    return this.prisma.$transaction(async (tx) => {
      if (hasUserUpdates) {
        await tx.user.update({
          where: { id: profile.userId },
          data: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(phone !== undefined && { phone }),
          },
        });
      }

      return tx.doctorProfile.update({
        where: { id },
        data: profileData,
        include: DEFAULT_INCLUDE,
      });
    });
  }
}
