import {
  BadRequestException,
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

/** NationalPatient fields always included on patient responses (demographics source-of-truth). */
const NATIONAL_PATIENT_SELECT = {
  id: true,
  syrianNationalId: true,
  firstName: true,
  lastName: true,
  firstNameAr: true,
  lastNameAr: true,
  dateOfBirth: true,
  gender: true,
  bloodType: true,
  allergies: true,
  chronicConditions: true,
  criticalAlerts: true,
  phone: true,
  address: true,
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
      where.OR = [
        {
          nationalPatient: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { syrianNationalId: { contains: query.search } },
            ],
          },
        },
        {
          user: {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    return paginate(
      this.prisma.patientProfile as any,
      {
        where,
        include: {
          user: { select: USER_SELECT },
          nationalPatient: { select: NATIONAL_PATIENT_SELECT },
        },
      },
      query,
    );
  }

  // ───────────────────── Find by ID ──────────────────────────────────────

  async findById(id: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id },
      include: {
        user: { select: USER_SELECT },
        nationalPatient: {
          select: {
            ...NATIONAL_PATIENT_SELECT,
            profiles: {
              select: {
                id: true,
                hospitalId: true,
                hospital: { select: { id: true, code: true, name: true, nameAr: true } },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Patient profile with id "${id}" not found`);
    }

    return profile;
  }

  // ───────────────────── Create ──────────────────────────────────────────

  /**
   * Register a patient at the caller's hospital.
   *
   * Mode A (link): dto.nationalPatientId is set → link existing NationalPatient.
   * Mode B (new): full demographics provided → create a new NationalPatient.
   *
   * Optionally creates a User (login) when dto.email + dto.password are set.
   */
  async create(dto: CreatePatientDto, hospitalId: string) {
    return this.prisma.$transaction(async (tx) => {
      // ---- 1. Resolve / create the NationalPatient ----
      let nationalPatientId: string;
      if (dto.nationalPatientId) {
        const existing = await tx.nationalPatient.findUnique({
          where: { id: dto.nationalPatientId },
          select: { id: true },
        });
        if (!existing) {
          throw new NotFoundException(
            `National patient with id "${dto.nationalPatientId}" not found`,
          );
        }
        nationalPatientId = existing.id;
      } else {
        if (!dto.firstName || !dto.lastName || !dto.dateOfBirth || !dto.gender) {
          throw new BadRequestException(
            'firstName, lastName, dateOfBirth, and gender are required when creating a new national patient',
          );
        }

        if (dto.syrianNationalId) {
          const clash = await tx.nationalPatient.findUnique({
            where: { syrianNationalId: dto.syrianNationalId },
            select: { id: true },
          });
          if (clash) {
            throw new ConflictException(
              `A national patient with Syrian ID "${dto.syrianNationalId}" already exists — link to that NHID instead`,
            );
          }
        }

        const created = await tx.nationalPatient.create({
          data: {
            syrianNationalId: dto.syrianNationalId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            firstNameAr: dto.firstNameAr,
            lastNameAr: dto.lastNameAr,
            dateOfBirth: new Date(dto.dateOfBirth),
            gender: dto.gender,
            phone: dto.phone,
            address: dto.address,
          },
        });
        nationalPatientId = created.id;
      }

      // ---- 2. Guard against duplicate profile at this hospital ----
      const existingProfile = await tx.patientProfile.findUnique({
        where: {
          hospitalId_nationalPatientId: { hospitalId, nationalPatientId },
        },
        select: { id: true },
      });
      if (existingProfile) {
        throw new ConflictException(
          'This national patient already has a profile at your hospital',
        );
      }

      // ---- 3. Optionally create a login User ----
      let userId: string | undefined;
      if (dto.email && dto.password) {
        const emailInUse = await tx.user.findUnique({
          where: { email: dto.email },
          select: { id: true },
        });
        if (emailInUse) {
          throw new ConflictException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            role: Role.PATIENT,
            phone: dto.phone,
            address: dto.address,
            hospitalId,
          },
          select: { id: true },
        });
        userId = user.id;
      }

      // ---- 4. Create the PatientProfile ----
      return tx.patientProfile.create({
        data: {
          userId,
          nationalPatientId,
          bloodType: dto.bloodType,
          allergies: dto.allergies,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
          emergencyContactRelation: dto.emergencyContactRelation,
          insuranceProvider: dto.insuranceProvider,
          insurancePolicyNumber: dto.insurancePolicyNumber,
          medicalNotes: dto.medicalNotes,
          hospitalId,
        },
        include: {
          user: { select: USER_SELECT },
          nationalPatient: { select: NATIONAL_PATIENT_SELECT },
        },
      });
    });
  }

  // ───────────────────── Update ──────────────────────────────────────────

  /**
   * Update hospital-local patient fields only (insurance, emergency contact,
   * medical notes, bloodType, allergies). National-level demographic edits
   * should go through /v1/national-registry/patients/:nhid. This split
   * guarantees the NationalPatient remains the single source of truth.
   */
  async update(id: string, dto: UpdatePatientDto) {
    const existing = await this.prisma.patientProfile.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Patient profile with id "${id}" not found`);
    }

    // Intentionally discard firstName/lastName/phone/gender/dob/address —
    // those live on NationalPatient now. The UpdatePatientDto still accepts
    // them for API back-compat but they are no-ops here.
    const {
      firstName: _fn,
      lastName: _ln,
      phone: _ph,
      gender: _gn,
      dateOfBirth: _dob,
      address: _ad,
      ...profileData
    } = dto;

    return this.prisma.patientProfile.update({
      where: { id },
      data: profileData,
      include: {
        user: { select: USER_SELECT },
        nationalPatient: { select: NATIONAL_PATIENT_SELECT },
      },
    });
  }
}
