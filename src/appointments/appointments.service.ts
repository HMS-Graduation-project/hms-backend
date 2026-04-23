import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';

/** Reusable include clause for appointment queries. */
const APPOINTMENT_INCLUDE = {
  patient: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatar: true,
        },
      },
    },
  },
  doctor: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
  department: { select: { id: true, name: true } },
};

/** Full include for single-appointment detail (adds medicalRecord). */
const DETAIL_INCLUDE = {
  ...APPOINTMENT_INCLUDE,
  medicalRecord: true,
};

/**
 * Allowed status transitions.
 * Key = current status, Value = set of statuses it can transition to.
 */
const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.PENDING]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.IN_PROGRESS]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.COMPLETED]: [AppointmentStatus.NO_SHOW],
  [AppointmentStatus.CANCELLED]: [AppointmentStatus.NO_SHOW],
  [AppointmentStatus.NO_SHOW]: [],
};

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────── List (paginated) ─────────────────────────────────

  async findAll(
    query: AppointmentQueryDto,
    currentUser: { id: string; role: Role },
  ) {
    const where: Record<string, unknown> = {};

    // Role-based filtering: patients can only see their own appointments
    if (currentUser.role === Role.PATIENT) {
      const patientProfile = await this.prisma.patientProfile.findUnique({
        where: { userId: currentUser.id },
        select: { id: true },
      });
      if (!patientProfile) {
        throw new NotFoundException('Patient profile not found');
      }
      where.patientId = patientProfile.id;
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.doctorId) {
      where.doctorId = query.doctorId;
    }
    if (query.patientId) {
      // Admins / staff can filter by patientId; patients already forced above
      if (currentUser.role !== Role.PATIENT) {
        where.patientId = query.patientId;
      }
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (query.dateFrom) {
        dateFilter.gte = new Date(query.dateFrom + 'T00:00:00.000Z');
      }
      if (query.dateTo) {
        dateFilter.lte = new Date(query.dateTo + 'T23:59:59.999Z');
      }
      where.date = dateFilter;
    }

    return paginate(
      this.prisma.appointment as any,
      { where, include: { ...APPOINTMENT_INCLUDE } },
      query,
    );
  }

  // ──────────────────── Find by ID ───────────────────────────────────────

  async findById(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with id "${id}" not found`);
    }

    return appointment;
  }

  // ──────────────────── Create ───────────────────────────────────────────

  async create(dto: CreateAppointmentDto, currentUser?: { id: string; role: string }) {
    // Validate that doctor exists
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: dto.doctorId },
      select: { id: true },
    });
    if (!doctor) {
      throw new NotFoundException(
        `Doctor profile with id "${dto.doctorId}" not found`,
      );
    }

    // Resolve patientId: if PATIENT role and no patientId provided, look up from current user
    let patientId = dto.patientId;
    if (currentUser?.role === 'PATIENT' && !patientId) {
      const profile = await this.prisma.patientProfile.findUnique({
        where: { userId: currentUser.id },
        select: { id: true },
      });
      if (!profile) {
        throw new NotFoundException('Patient profile not found for current user');
      }
      patientId = profile.id;
    }

    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    // Validate that patient exists
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException(
        `Patient profile with id "${patientId}" not found`,
      );
    }

    // Validate that department exists (if provided)
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
        select: { id: true },
      });
      if (!dept) {
        throw new NotFoundException(
          `Department with id "${dto.departmentId}" not found`,
        );
      }
    }

    const appointmentDate = new Date(dto.date + 'T00:00:00.000Z');
    const startOfDay = new Date(dto.date + 'T00:00:00.000Z');
    const endOfDay = new Date(dto.date + 'T23:59:59.999Z');

    // Check: doctor slot not already booked
    const doctorConflict = await this.prisma.appointment.findFirst({
      where: {
        doctorId: dto.doctorId,
        date: { gte: startOfDay, lte: endOfDay },
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
    });
    if (doctorConflict) {
      throw new ConflictException(
        'This time slot is already booked for the selected doctor',
      );
    }

    // Check: patient has no overlapping appointment
    const patientConflict = await this.prisma.appointment.findFirst({
      where: {
        patientId,
        date: { gte: startOfDay, lte: endOfDay },
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
    });
    if (patientConflict) {
      throw new ConflictException(
        'The patient already has an appointment at this time',
      );
    }

    return this.prisma.appointment.create({
      data: {
        patientId,
        doctorId: dto.doctorId,
        departmentId: dto.departmentId,
        date: appointmentDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        type: dto.type,
        reason: dto.reason,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  // ──────────────────── Update status ────────────────────────────────────

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with id "${id}" not found`);
    }

    // Validate status transition
    const allowed = STATUS_TRANSITIONS[appointment.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${appointment.status} to ${dto.status}`,
      );
    }

    const data: Record<string, unknown> = { status: dto.status };

    if (dto.status === AppointmentStatus.CANCELLED && dto.notes) {
      data.cancelReason = dto.notes;
    }
    if (dto.notes) {
      data.notes = dto.notes;
    }

    return this.prisma.appointment.update({
      where: { id },
      data,
      include: APPOINTMENT_INCLUDE,
    });
  }

  // ──────────────────── Reschedule ───────────────────────────────────────

  async reschedule(id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        doctorId: true,
        patientId: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with id "${id}" not found`);
    }

    // Can only reschedule PENDING or CONFIRMED appointments
    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot reschedule an appointment with status ${appointment.status}`,
      );
    }

    const newDate = new Date(dto.date + 'T00:00:00.000Z');
    const startOfDay = new Date(dto.date + 'T00:00:00.000Z');
    const endOfDay = new Date(dto.date + 'T23:59:59.999Z');

    // Check: doctor slot not already booked at new time
    const doctorConflict = await this.prisma.appointment.findFirst({
      where: {
        id: { not: id },
        doctorId: appointment.doctorId,
        date: { gte: startOfDay, lte: endOfDay },
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
    });
    if (doctorConflict) {
      throw new ConflictException(
        'The new time slot is already booked for this doctor',
      );
    }

    // Check: patient has no overlapping appointment at new time
    const patientConflict = await this.prisma.appointment.findFirst({
      where: {
        id: { not: id },
        patientId: appointment.patientId,
        date: { gte: startOfDay, lte: endOfDay },
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
    });
    if (patientConflict) {
      throw new ConflictException(
        'The patient already has an appointment at the new time',
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        date: newDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  // ──────────────────── Cancel ───────────────────────────────────────────

  async cancel(id: string, reason?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with id "${id}" not found`);
    }

    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot cancel an appointment with status ${appointment.status}`,
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelReason: reason ?? null,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  // ──────────────────── My appointments (patient) ────────────────────────

  async getMyAppointments(userId: string, query: AppointmentQueryDto) {
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patientProfile) {
      throw new NotFoundException('Patient profile not found for this user');
    }

    const where: Record<string, unknown> = {
      patientId: patientProfile.id,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.doctorId) {
      where.doctorId = query.doctorId;
    }
    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (query.dateFrom) {
        dateFilter.gte = new Date(query.dateFrom + 'T00:00:00.000Z');
      }
      if (query.dateTo) {
        dateFilter.lte = new Date(query.dateTo + 'T23:59:59.999Z');
      }
      where.date = dateFilter;
    }

    return paginate(
      this.prisma.appointment as any,
      { where, include: { ...APPOINTMENT_INCLUDE } },
      query,
    );
  }

  // ──────────────────── Today's appointments (doctor) ────────────────────

  async getTodayAppointments(userId: string) {
    const doctorProfile = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctorProfile) {
      throw new NotFoundException('Doctor profile not found for this user');
    }

    const today = new Date();
    const startOfDay = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const endOfDay = new Date(
      Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
        999,
      ),
    );

    return this.prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        date: { gte: startOfDay, lte: endOfDay },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      include: APPOINTMENT_INCLUDE,
      orderBy: { startTime: 'asc' },
    });
  }
}
