import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';

/** User fields exposed alongside each patient profile (no passwordHash). */
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

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── List (paginated) ────────────────────────────────

  async findAll(query: PatientQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.bloodType) {
      where.bloodType = query.bloodType;
    }

    if (query.search) {
      where.user = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    return paginate(
      this.prisma.patientProfile as any,
      { where, include: { user: { select: USER_SELECT } } },
      query,
    );
  }

  // ───────────────────── Find by ID ──────────────────────────────────────

  async findById(id: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id },
      include: { user: { select: USER_SELECT } },
    });

    if (!profile) {
      throw new NotFoundException(`Patient profile with id "${id}" not found`);
    }

    return profile;
  }

  // ───────────────────── Create ──────────────────────────────────────────

  async create(dto: CreatePatientDto, hospitalId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const profile = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: Role.PATIENT,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          address: dto.address,
          hospitalId,
        },
      });

      return tx.patientProfile.create({
        data: {
          userId: user.id,
          bloodType: dto.bloodType,
          allergies: dto.allergies,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
          emergencyContactRelation: dto.emergencyContactRelation,
          insuranceProvider: dto.insuranceProvider,
          insurancePolicyNumber: dto.insurancePolicyNumber,
          hospitalId,
        },
        include: { user: { select: USER_SELECT } },
      });
    });

    return profile;
  }

  // ───────────────────── Update ──────────────────────────────────────────

  async update(id: string, dto: UpdatePatientDto) {
    const existing = await this.prisma.patientProfile.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      throw new NotFoundException(`Patient profile with id "${id}" not found`);
    }

    const {
      firstName,
      lastName,
      phone,
      gender,
      dateOfBirth,
      address,
      ...profileData
    } = dto;

    const hasUserUpdates =
      firstName !== undefined ||
      lastName !== undefined ||
      phone !== undefined ||
      gender !== undefined ||
      dateOfBirth !== undefined ||
      address !== undefined;

    const profile = await this.prisma.$transaction(async (tx) => {
      if (hasUserUpdates) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            firstName,
            lastName,
            phone,
            gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            address,
          },
        });
      }

      return tx.patientProfile.update({
        where: { id },
        data: profileData,
        include: { user: { select: USER_SELECT } },
      });
    });

    return profile;
  }
}
