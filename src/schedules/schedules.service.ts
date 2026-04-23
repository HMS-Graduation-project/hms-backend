import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SetScheduleDto } from './dto/set-schedule.dto';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────── Get schedule ──────────────────────────────────────

  async getSchedule(doctorId: string) {
    await this.ensureDoctorExists(doctorId);

    return this.prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ──────────────────── Set schedule (upsert) ────────────────────────────

  async setSchedule(
    doctorId: string,
    dto: SetScheduleDto,
    hospitalId: string,
  ) {
    await this.ensureDoctorExists(doctorId);

    return this.prisma.$transaction(async (tx) => {
      // Delete all existing schedule entries for this doctor
      await tx.doctorSchedule.deleteMany({ where: { doctorId } });

      // Create all new entries
      const entries = dto.entries.map((entry) => ({
        doctorId,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        slotDuration: entry.slotDuration ?? 30,
        isActive: entry.isActive ?? true,
        hospitalId,
      }));

      await tx.doctorSchedule.createMany({ data: entries });

      return tx.doctorSchedule.findMany({
        where: { doctorId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  // ──────────────────── Available slots ──────────────────────────────────

  async getAvailableSlots(
    doctorId: string,
    date: string,
  ): Promise<TimeSlot[]> {
    await this.ensureDoctorExists(doctorId);

    // Determine day of week from the requested date
    const requestedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = requestedDate.getUTCDay();

    // Find the doctor's schedule for that day
    const schedule = await this.prisma.doctorSchedule.findFirst({
      where: { doctorId, dayOfWeek, isActive: true },
    });

    if (!schedule) {
      return [];
    }

    // Generate all possible slots
    const allSlots = this.generateSlots(
      schedule.startTime,
      schedule.endTime,
      schedule.slotDuration,
    );

    // Find existing booked appointments for that doctor on that date
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        date: { gte: startOfDay, lte: endOfDay },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      select: { startTime: true, endTime: true },
    });

    // Mark slots as unavailable when they overlap with a booked appointment
    const bookedSet = new Set(
      bookedAppointments.map((a) => `${a.startTime}-${a.endTime}`),
    );

    return allSlots.map((slot) => ({
      ...slot,
      isAvailable: !bookedSet.has(`${slot.startTime}-${slot.endTime}`),
    }));
  }

  // ──────────────────── Private helpers ──────────────────────────────────

  private generateSlots(
    startTime: string,
    endTime: string,
    slotDuration: number,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

    let currentMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    while (currentMinutes + slotDuration <= endMinutes) {
      const slotStart = this.minutesToTime(currentMinutes);
      const slotEnd = this.minutesToTime(currentMinutes + slotDuration);
      slots.push({ startTime: slotStart, endTime: slotEnd, isAvailable: true });
      currentMinutes += slotDuration;
    }

    return slots;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private async ensureDoctorExists(doctorId: string): Promise<void> {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException(
        `Doctor profile with id "${doctorId}" not found`,
      );
    }
  }
}
