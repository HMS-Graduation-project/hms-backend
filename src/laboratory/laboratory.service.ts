import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LabOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { LabOrderQueryDto } from './dto/lab-order-query.dto';

/** Safe user fields (no passwordHash). */
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
} as const;

/** Standard include clause for lab order queries. */
const LAB_ORDER_INCLUDE = {
  patient: { include: { user: { select: USER_SELECT } } },
  doctor: { include: { user: { select: USER_SELECT } } },
  result: {
    include: {
      technician: { select: USER_SELECT },
    },
  },
  medicalRecord: {
    select: {
      id: true,
      appointmentId: true,
      diagnosis: true,
    },
  },
} as const;

@Injectable()
export class LaboratoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Find All (paginated) ────────────────────────────────

  async findAll(query: LabOrderQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.search) {
      where.OR = [
        { testName: { contains: query.search, mode: 'insensitive' } },
        {
          patient: {
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
      this.prisma.labOrder as any,
      {
        where,
        include: LAB_ORDER_INCLUDE,
        orderBy: { orderedAt: 'desc' },
      },
      query,
    );
  }

  // ───────────────────── Find by ID ──────────────────────────────────────────

  async findById(id: string) {
    const labOrder = await this.prisma.labOrder.findUnique({
      where: { id },
      include: LAB_ORDER_INCLUDE,
    });

    if (!labOrder) {
      throw new NotFoundException(`Lab order "${id}" not found`);
    }

    return labOrder;
  }

  // ───────────────────── Create ──────────────────────────────────────────────

  async create(dto: CreateLabOrderDto) {
    // Validate patient exists
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: dto.patientId },
      select: { id: true },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient profile "${dto.patientId}" not found`,
      );
    }

    // Validate doctor exists
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: dto.doctorId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException(
        `Doctor profile "${dto.doctorId}" not found`,
      );
    }

    // Validate medical record if provided
    if (dto.medicalRecordId) {
      const medicalRecord = await this.prisma.medicalRecord.findUnique({
        where: { id: dto.medicalRecordId },
        select: { id: true },
      });

      if (!medicalRecord) {
        throw new NotFoundException(
          `Medical record "${dto.medicalRecordId}" not found`,
        );
      }
    }

    return this.prisma.labOrder.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        medicalRecordId: dto.medicalRecordId,
        testName: dto.testName,
        testCategory: dto.testCategory,
        priority: dto.priority ?? 'NORMAL',
        notes: dto.notes,
      },
      include: LAB_ORDER_INCLUDE,
    });
  }

  // ───────────────────── Update Status ───────────────────────────────────────

  async updateStatus(id: string, status: LabOrderStatus) {
    const existing = await this.prisma.labOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException(`Lab order "${id}" not found`);
    }

    if (existing.status === LabOrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot update the status of a cancelled lab order',
      );
    }

    if (existing.status === LabOrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot update the status of a completed lab order',
      );
    }

    const data: Record<string, unknown> = { status };

    if (status === LabOrderStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    return this.prisma.labOrder.update({
      where: { id },
      data,
      include: LAB_ORDER_INCLUDE,
    });
  }

  // ───────────────────── Enter Result ────────────────────────────────────────

  async enterResult(
    labOrderId: string,
    dto: EnterLabResultDto,
    currentUserId: string,
  ) {
    const labOrder = await this.prisma.labOrder.findUnique({
      where: { id: labOrderId },
      select: { id: true, status: true, result: { select: { id: true } } },
    });

    if (!labOrder) {
      throw new NotFoundException(`Lab order "${labOrderId}" not found`);
    }

    if (labOrder.status === LabOrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot enter results for a cancelled lab order',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Create or update lab result
      if (labOrder.result) {
        await tx.labResult.update({
          where: { labOrderId },
          data: {
            result: dto.result,
            normalRange: dto.normalRange,
            unit: dto.unit,
            isAbnormal: dto.isAbnormal ?? false,
            technicianId: currentUserId,
            notes: dto.notes,
            reportedAt: new Date(),
          },
        });
      } else {
        await tx.labResult.create({
          data: {
            labOrderId,
            result: dto.result,
            normalRange: dto.normalRange,
            unit: dto.unit,
            isAbnormal: dto.isAbnormal ?? false,
            technicianId: currentUserId,
            notes: dto.notes,
          },
        });
      }

      // Auto-set status to COMPLETED
      await tx.labOrder.update({
        where: { id: labOrderId },
        data: {
          status: LabOrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return tx.labOrder.findUnique({
        where: { id: labOrderId },
        include: LAB_ORDER_INCLUDE,
      });
    });
  }

  // ───────────────────── Find by Patient (paginated) ─────────────────────────

  async findByPatient(patientId: string, query: LabOrderQueryDto) {
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

    if (query.priority) {
      where.priority = query.priority;
    }

    return paginate(
      this.prisma.labOrder as any,
      {
        where,
        include: LAB_ORDER_INCLUDE,
        orderBy: { orderedAt: 'desc' },
      },
      query,
    );
  }
}
