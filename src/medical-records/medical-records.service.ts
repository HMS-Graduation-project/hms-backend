import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { CreateVitalSignsDto } from './dto/create-vital-signs.dto';

/** Safe user fields (no passwordHash). */
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
} as const;

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Create ────────────────────────────────────────────

  async create(dto: CreateMedicalRecordDto, currentUserId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        doctor: { select: { id: true, userId: true } },
        patient: { select: { id: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException(
        `Appointment "${dto.appointmentId}" not found`,
      );
    }

    const validStatuses: AppointmentStatus[] = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.IN_PROGRESS,
    ];

    if (!validStatuses.includes(appointment.status)) {
      throw new BadRequestException(
        `Appointment must be COMPLETED or IN_PROGRESS to create a medical record (current: ${appointment.status})`,
      );
    }

    // Check that the current user is the appointment's doctor
    if (appointment.doctor.userId !== currentUserId) {
      throw new BadRequestException(
        'Only the appointment doctor can create a medical record for this appointment',
      );
    }

    // Ensure one record per appointment (appointmentId is @unique, but
    // provide a friendlier error)
    const existing = await this.prisma.medicalRecord.findUnique({
      where: { appointmentId: dto.appointmentId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'A medical record already exists for this appointment',
      );
    }

    return this.prisma.medicalRecord.create({
      data: {
        appointmentId: dto.appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        chiefComplaint: dto.chiefComplaint,
        presentIllness: dto.presentIllness,
        examination: dto.examination,
        diagnosis: dto.diagnosis,
        icdCodes: dto.icdCodes,
        treatmentPlan: dto.treatmentPlan,
        notes: dto.notes,
      },
      include: {
        appointment: true,
        patient: { include: { user: { select: USER_SELECT } } },
        doctor: { include: { user: { select: USER_SELECT } } },
        vitalSigns: true,
        prescriptions: { include: { items: true } },
      },
    });
  }

  // ───────────────────── Find all (paginated) ─────────────────────────────

  async findAll(query: PaginationQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { diagnosis: { contains: query.search, mode: 'insensitive' } },
        { chiefComplaint: { contains: query.search, mode: 'insensitive' } },
        { patient: { user: { OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ] } } },
      ];
    }

    return paginate(
      this.prisma.medicalRecord as any,
      {
        where,
        include: {
          appointment: { select: { date: true, startTime: true } },
          patient: { include: { user: { select: USER_SELECT } } },
          doctor: { include: { user: { select: USER_SELECT } } },
        },
      },
      query,
    );
  }

  // ───────────────────── Find by ID ────────────────────────────────────────

  async findById(id: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        appointment: true,
        patient: { include: { user: { select: USER_SELECT } } },
        doctor: { include: { user: { select: USER_SELECT } } },
        vitalSigns: true,
        prescriptions: { include: { items: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Medical record "${id}" not found`);
    }

    return record;
  }

  // ───────────────────── Update ────────────────────────────────────────────

  async update(id: string, dto: UpdateMedicalRecordDto) {
    const existing = await this.prisma.medicalRecord.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Medical record "${id}" not found`);
    }

    return this.prisma.medicalRecord.update({
      where: { id },
      data: {
        chiefComplaint: dto.chiefComplaint,
        presentIllness: dto.presentIllness,
        examination: dto.examination,
        diagnosis: dto.diagnosis,
        icdCodes: dto.icdCodes,
        treatmentPlan: dto.treatmentPlan,
        notes: dto.notes,
      },
      include: {
        appointment: true,
        patient: { include: { user: { select: USER_SELECT } } },
        doctor: { include: { user: { select: USER_SELECT } } },
        vitalSigns: true,
        prescriptions: { include: { items: true } },
      },
    });
  }

  // ───────────────────── Find by Patient (paginated) ───────────────────────

  async findByPatient(patientId: string, query: PaginationQueryDto) {
    // Verify that the patient profile exists
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient profile "${patientId}" not found`,
      );
    }

    return paginate(
      this.prisma.medicalRecord as any,
      {
        where: { patientId },
        include: {
          appointment: { select: { id: true, date: true, startTime: true, type: true, status: true } },
          doctor: { include: { user: { select: USER_SELECT } } },
          vitalSigns: true,
        },
      },
      query,
    );
  }

  // ───────────────────── Add / Update Vital Signs ──────────────────────────

  async addVitalSigns(recordId: string, dto: CreateVitalSignsDto) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: { id: true },
    });

    if (!record) {
      throw new NotFoundException(`Medical record "${recordId}" not found`);
    }

    return this.prisma.vitalSigns.upsert({
      where: { medicalRecordId: recordId },
      update: {
        temperature: dto.temperature,
        bloodPressureSystolic: dto.bloodPressureSystolic,
        bloodPressureDiastolic: dto.bloodPressureDiastolic,
        heartRate: dto.heartRate,
        respiratoryRate: dto.respiratoryRate,
        oxygenSaturation: dto.oxygenSaturation,
        weight: dto.weight,
        height: dto.height,
      },
      create: {
        medicalRecordId: recordId,
        temperature: dto.temperature,
        bloodPressureSystolic: dto.bloodPressureSystolic,
        bloodPressureDiastolic: dto.bloodPressureDiastolic,
        heartRate: dto.heartRate,
        respiratoryRate: dto.respiratoryRate,
        oxygenSaturation: dto.oxygenSaturation,
        weight: dto.weight,
        height: dto.height,
      },
    });
  }
}
