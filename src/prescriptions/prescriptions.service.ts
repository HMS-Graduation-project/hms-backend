import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrescriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';

/** Safe user fields (no passwordHash). */
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
} as const;

/**
 * NationalPatient identity fields — the demographics source-of-truth.
 * A PatientProfile always has a NationalPatient but may have no User
 * (staff-created patients with no login), so names must come from here.
 */
const NATIONAL_PATIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameAr: true,
  lastNameAr: true,
  syrianNationalId: true,
} as const;

/** Reusable patient include: demographics (always) + login account (if any). */
const PATIENT_INCLUDE = {
  include: {
    nationalPatient: { select: NATIONAL_PATIENT_SELECT },
    user: { select: USER_SELECT },
  },
} as const;

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Create ────────────────────────────────────────────

  async create(
    dto: CreatePrescriptionDto,
    currentUserId: string,
    hospitalId: string,
  ) {
    const medicalRecord = await this.prisma.medicalRecord.findUnique({
      where: { id: dto.medicalRecordId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        doctor: { select: { userId: true } },
      },
    });

    if (!medicalRecord) {
      throw new NotFoundException(
        `Medical record "${dto.medicalRecordId}" not found`,
      );
    }

    // Only the doctor who owns the medical record can prescribe
    if (medicalRecord.doctor.userId !== currentUserId) {
      throw new BadRequestException(
        'Only the medical record doctor can create a prescription',
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'A prescription must contain at least one item',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.prescription.create({
        data: {
          medicalRecordId: dto.medicalRecordId,
          patientId: medicalRecord.patientId,
          doctorId: medicalRecord.doctorId,
          notes: dto.notes,
          hospitalId,
          items: {
            create: dto.items.map((item) => ({
              medicationName: item.medicationName,
              dosage: item.dosage,
              frequency: item.frequency,
              duration: item.duration,
              quantity: item.quantity,
              instructions: item.instructions,
            })),
          },
        },
        include: {
          items: true,
          patient: PATIENT_INCLUDE,
          doctor: { include: { user: { select: USER_SELECT } } },
          medicalRecord: {
            include: {
              appointment: { select: { id: true, date: true, type: true } },
            },
          },
        },
      });
    });
  }

  // ───────────────────── Find by ID ────────────────────────────────────────

  async findById(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        items: true,
        patient: PATIENT_INCLUDE,
        doctor: { include: { user: { select: USER_SELECT } } },
        medicalRecord: {
          include: {
            appointment: { select: { id: true, date: true, type: true } },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription "${id}" not found`);
    }

    return prescription;
  }

  // ───────────────────── Find All (paginated, for pharmacists) ─────────────

  async findAll(query: PrescriptionQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    // Organizational scope filters (Governorate → Hospital).
    if (query.hospitalId) {
      where.hospitalId = query.hospitalId;
    } else if (query.governorate) {
      where.hospital = { city: { governorate: query.governorate } };
    }

    if (query.search) {
      where.OR = [
        {
          patient: {
            nationalPatient: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { syrianNationalId: { contains: query.search } },
              ],
            },
          },
        },
        {
          doctor: {
            user: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    return paginate(
      this.prisma.prescription as any,
      {
        where,
        include: {
          items: true,
          patient: PATIENT_INCLUDE,
          doctor: { include: { user: { select: USER_SELECT } } },
          hospital: {
            select: {
              id: true,
              code: true,
              name: true,
              nameAr: true,
              city: {
                select: { id: true, name: true, nameAr: true, governorate: true },
              },
            },
          },
        },
      },
      query,
    );
  }

  // ───────────────────── Update Status ─────────────────────────────────────

  async updateStatus(id: string, status: PrescriptionStatus) {
    const existing = await this.prisma.prescription.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException(`Prescription "${id}" not found`);
    }

    if (existing.status === PrescriptionStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot update the status of a cancelled prescription',
      );
    }

    return this.prisma.prescription.update({
      where: { id },
      data: { status },
      include: {
        items: true,
        patient: PATIENT_INCLUDE,
        doctor: { include: { user: { select: USER_SELECT } } },
      },
    });
  }

  // ───────────────────── Find by Patient (paginated) ───────────────────────

  async findByPatient(patientId: string, query: PrescriptionQueryDto) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient profile "${patientId}" not found`,
      );
    }

    const where: Record<string, unknown> = { patientId };

    if (query.status) {
      where.status = query.status;
    }

    return paginate(
      this.prisma.prescription as any,
      {
        where,
        include: {
          items: true,
          doctor: { include: { user: { select: USER_SELECT } } },
          medicalRecord: {
            include: {
              appointment: { select: { id: true, date: true, type: true } },
            },
          },
        },
      },
      query,
    );
  }
}
