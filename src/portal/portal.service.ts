import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookPortalAppointmentDto } from './dto/book-portal-appointment.dto';
import { PortalListQueryDto } from './dto/portal-appointment-query.dto';

/**
 * The portal surfaces the patient's data ACROSS every hospital they have a
 * PatientProfile at. Identity is resolved via the NationalPatient (NHID).
 *
 * The patient's User row carries a `hospitalId` (set when they first
 * registered), so the tenant middleware would normally scope reads to
 * that hospital. We escape this in two ways:
 *  1. The patient's profile fan-out runs by `nationalPatientId`, not by
 *     `hospitalId`.
 *  2. Child queries put `hospitalId: { in: [...allPatientHospitalIds] }`
 *     as a top-level where key, which the middleware respects (it only
 *     skips its own injection when the caller already constrains
 *     hospitalId at the top level).
 */
@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────── Identity resolution ─────────────────────────────

  /**
   * The patient's "primary" PatientProfile is the one carrying their
   * userId. From there we get the NHID and fan out to all profiles.
   */
  private async resolvePatient(userId: string) {
    const primary = await this.prisma.patientProfile.findFirst({
      // Top-level hospitalId disables tenant middleware injection — we
      // want the lookup to succeed regardless of which hospital the
      // user.hospitalId currently points at.
      where: { userId, hospitalId: { not: '__never__' } },
      include: {
        nationalPatient: true,
        hospital: { select: { id: true, code: true, name: true, nameAr: true } },
      },
    });
    if (!primary) {
      throw new NotFoundException(
        'Patient profile not found for the current user',
      );
    }

    const profiles = await this.prisma.patientProfile.findMany({
      where: {
        nationalPatientId: primary.nationalPatientId,
        // Top-level hospitalId constraint disables tenant middleware injection.
        hospitalId: { not: '__never__' },
      },
      include: {
        hospital: {
          select: {
            id: true,
            code: true,
            name: true,
            nameAr: true,
            city: { select: { id: true, name: true, nameAr: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const hospitalIds = profiles.map((p) => p.hospitalId);
    const profileIds = profiles.map((p) => p.id);

    return { primary, profiles, hospitalIds, profileIds };
  }

  // ──────────────── Profile / national record ───────────────────────

  async getMe(userId: string) {
    const { primary, profiles } = await this.resolvePatient(userId);

    return {
      nationalPatient: primary.nationalPatient,
      primaryProfileId: primary.id,
      hospitals: profiles.map((p) => ({
        profileId: p.id,
        hospital: p.hospital,
        bloodType: p.bloodType,
        insuranceProvider: p.insuranceProvider,
        insurancePolicyNumber: p.insurancePolicyNumber,
        emergencyContactName: p.emergencyContactName,
        emergencyContactPhone: p.emergencyContactPhone,
        emergencyContactRelation: p.emergencyContactRelation,
        registeredAt: p.createdAt,
      })),
    };
  }

  /**
   * Unified cross-hospital health record. Returns demographics + critical
   * alerts plus a flat (recent-first) feed of records, prescriptions, and
   * lab results across every hospital the patient has visited.
   */
  async getNationalRecord(userId: string) {
    const { primary, profiles, profileIds, hospitalIds } =
      await this.resolvePatient(userId);

    if (profileIds.length === 0) {
      return {
        nationalPatient: primary.nationalPatient,
        hospitals: [],
        medicalRecords: [],
        prescriptions: [],
        labOrders: [],
      };
    }

    const inProfiles = { in: profileIds };
    const inHospitals = { in: hospitalIds };

    const [medicalRecords, prescriptions, labOrders] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where: { patientId: inProfiles, hospitalId: inHospitals },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          hospitalId: true,
          diagnosis: true,
          chiefComplaint: true,
          icdCodes: true,
          treatmentPlan: true,
          createdAt: true,
          doctor: {
            select: {
              id: true,
              specialization: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
      }),
      this.prisma.prescription.findMany({
        where: { patientId: inProfiles, hospitalId: inHospitals },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          hospitalId: true,
          status: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              medicationName: true,
              dosage: true,
              frequency: true,
              duration: true,
              instructions: true,
            },
          },
          doctor: {
            select: {
              id: true,
              specialization: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
      }),
      this.prisma.labOrder.findMany({
        where: { patientId: inProfiles, hospitalId: inHospitals },
        orderBy: { orderedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          hospitalId: true,
          testName: true,
          testCategory: true,
          status: true,
          orderedAt: true,
          result: {
            select: {
              id: true,
              result: true,
              normalRange: true,
              unit: true,
              isAbnormal: true,
              reportedAt: true,
            },
          },
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
      }),
    ]);

    return {
      nationalPatient: primary.nationalPatient,
      hospitals: profiles.map((p) => ({
        profileId: p.id,
        hospital: p.hospital,
      })),
      medicalRecords,
      prescriptions,
      labOrders,
    };
  }

  // ──────────────── Appointments ────────────────────────────────────

  async listAppointments(userId: string, query: PortalListQueryDto) {
    const { profileIds, hospitalIds } = await this.resolvePatient(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where: Prisma.AppointmentWhereInput = {
      patientId: { in: profileIds },
      hospitalId: query.hospitalId
        ? query.hospitalId
        : { in: hospitalIds.length ? hospitalIds : ['__never__'] },
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: {
          doctor: {
            select: {
              id: true,
              specialization: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          department: { select: { id: true, name: true } },
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Patient books an appointment at any active hospital. If the patient
   * does not yet have a PatientProfile at that hospital, one is created
   * in the same transaction (pointing to the same NHID).
   */
  async bookAppointment(userId: string, dto: BookPortalAppointmentDto) {
    const { primary } = await this.resolvePatient(userId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Validate hospital is active.
      const hospital = await tx.hospital.findUnique({
        where: { id: dto.hospitalId },
        select: { id: true, isActive: true },
      });
      if (!hospital || !hospital.isActive) {
        throw new NotFoundException('Hospital not found or inactive');
      }

      // 2. Ensure a PatientProfile exists for this patient at the chosen
      //    hospital — auto-create if needed.
      let profile = await tx.patientProfile.findUnique({
        where: {
          hospitalId_nationalPatientId: {
            hospitalId: dto.hospitalId,
            nationalPatientId: primary.nationalPatientId,
          },
        },
        select: { id: true },
      });
      if (!profile) {
        profile = await tx.patientProfile.create({
          data: {
            // userId stays NULL — there is exactly one User row per
            // patient (the original one). Other-hospital profiles are
            // shadows that share the same NHID for clinical purposes.
            nationalPatientId: primary.nationalPatientId,
            hospitalId: dto.hospitalId,
          },
          select: { id: true },
        });
      }

      // 3. Validate doctor belongs to the chosen hospital.
      const doctor = await tx.doctorProfile.findFirst({
        where: { id: dto.doctorId, hospitalId: dto.hospitalId },
        select: { id: true },
      });
      if (!doctor) {
        throw new NotFoundException(
          'Doctor not found at the chosen hospital',
        );
      }

      // 4. Department check (optional).
      if (dto.departmentId) {
        const dept = await tx.department.findFirst({
          where: { id: dto.departmentId, hospitalId: dto.hospitalId },
          select: { id: true },
        });
        if (!dept) {
          throw new NotFoundException('Department not found at this hospital');
        }
      }

      const appointmentDate = new Date(dto.date + 'T00:00:00.000Z');
      const startOfDay = new Date(dto.date + 'T00:00:00.000Z');
      const endOfDay = new Date(dto.date + 'T23:59:59.999Z');

      // 5. Doctor slot conflict. Top-level hospitalId disables tenant
      // middleware (the patient's home hospital may differ from the
      // booking hospital).
      const doctorConflict = await tx.appointment.findFirst({
        where: {
          hospitalId: dto.hospitalId,
          doctorId: dto.doctorId,
          date: { gte: startOfDay, lte: endOfDay },
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: {
            notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
          },
        },
        select: { id: true },
      });
      if (doctorConflict) {
        throw new ConflictException(
          'This time slot is already booked for the selected doctor',
        );
      }

      // 6. Patient overlap across ALL hospitals — same NHID. Use
      // hospitalId: { not: '__never__' } to disable middleware injection
      // and check globally.
      const overlap = await tx.appointment.findFirst({
        where: {
          hospitalId: { not: '__never__' },
          patient: { nationalPatientId: primary.nationalPatientId },
          date: { gte: startOfDay, lte: endOfDay },
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: {
            notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
          },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new ConflictException(
          'You already have an appointment at this time at another hospital',
        );
      }

      // 7. Create.
      return tx.appointment.create({
        data: {
          patientId: profile.id,
          doctorId: dto.doctorId,
          departmentId: dto.departmentId,
          hospitalId: dto.hospitalId,
          date: appointmentDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          type: dto.type,
          reason: dto.reason,
        },
        include: {
          doctor: {
            select: {
              id: true,
              specialization: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          department: { select: { id: true, name: true } },
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
      });
    });
  }

  /**
   * Cancel one of the patient's own upcoming appointments.
   */
  async cancelAppointment(userId: string, appointmentId: string) {
    const { profileIds, hospitalIds } = await this.resolvePatient(userId);

    const appt = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patientId: { in: profileIds },
        hospitalId: hospitalIds.length
          ? { in: hospitalIds }
          : { not: '__never__' },
      },
      select: { id: true, status: true, hospitalId: true },
    });
    if (!appt) {
      throw new NotFoundException('Appointment not found');
    }
    if (
      appt.status === AppointmentStatus.CANCELLED ||
      appt.status === AppointmentStatus.COMPLETED ||
      appt.status === AppointmentStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Cannot cancel an appointment in status "${appt.status}"`,
      );
    }
    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelReason: 'Cancelled by patient',
      },
      select: { id: true, status: true },
    });
  }

  // ──────────────── Prescriptions / Lab / Invoices ──────────────────

  async listPrescriptions(userId: string, query: PortalListQueryDto) {
    const { profileIds, hospitalIds } = await this.resolvePatient(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where: Prisma.PrescriptionWhereInput = {
      patientId: { in: profileIds },
      hospitalId: query.hospitalId
        ? query.hospitalId
        : { in: hospitalIds.length ? hospitalIds : ['__never__'] },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.prescription.findMany({
        where,
        include: {
          items: true,
          doctor: {
            select: {
              id: true,
              specialization: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listLabResults(userId: string, query: PortalListQueryDto) {
    const { profileIds, hospitalIds } = await this.resolvePatient(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where: Prisma.LabOrderWhereInput = {
      patientId: { in: profileIds },
      hospitalId: query.hospitalId
        ? query.hospitalId
        : { in: hospitalIds.length ? hospitalIds : ['__never__'] },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.labOrder.findMany({
        where,
        include: {
          result: true,
          doctor: {
            select: {
              id: true,
              specialization: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { orderedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.labOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listInvoices(userId: string, query: PortalListQueryDto) {
    const { profileIds, hospitalIds } = await this.resolvePatient(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where: Prisma.InvoiceWhereInput = {
      patientId: { in: profileIds },
      hospitalId: query.hospitalId
        ? query.hospitalId
        : { in: hospitalIds.length ? hospitalIds : ['__never__'] },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          items: true,
          hospital: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ──────────────── Referrals ───────────────────────────────────────

  /**
   * The patient's own referral history (every referral tied to their NHID).
   * Patients see status timestamps and metadata, no clinical details
   * beyond the reason field.
   */
  async listReferrals(userId: string) {
    const { primary } = await this.resolvePatient(userId);

    return this.prisma.referral.findMany({
      where: { nationalPatientId: primary.nationalPatientId },
      orderBy: { createdAt: 'desc' },
      include: {
        fromHospital: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            city: { select: { id: true, name: true, nameAr: true } },
          },
        },
        toHospital: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            city: { select: { id: true, name: true, nameAr: true } },
          },
        },
      },
    });
  }

  // ──────────────── Booking helpers (hospital + doctor pickers) ─────

  async listAvailableHospitals() {
    return this.prisma.hospital.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        nameAr: true,
        address: true,
        phone: true,
        city: { select: { id: true, name: true, nameAr: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listDoctorsAtHospital(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, isActive: true },
    });
    if (!hospital || !hospital.isActive) {
      throw new NotFoundException('Hospital not found or inactive');
    }

    return this.prisma.doctorProfile.findMany({
      where: { hospitalId },
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
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ specialization: 'asc' }],
    });
  }

  // ──────────────── Misc ────────────────────────────────────────────

  /**
   * Self-service profile update writes to NationalPatient (the source of
   * truth for demographics).
   */
  async updateMyProfile(
    userId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
      bloodType?: string;
      allergies?: string;
      chronicConditions?: string;
    },
  ) {
    const { primary } = await this.resolvePatient(userId);

    if (
      dto.firstName ||
      dto.lastName ||
      dto.phone ||
      dto.address ||
      dto.bloodType ||
      dto.allergies ||
      dto.chronicConditions
    ) {
      await this.prisma.nationalPatient.update({
        where: { id: primary.nationalPatientId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          address: dto.address,
          bloodType: dto.bloodType,
          allergies: dto.allergies,
          chronicConditions: dto.chronicConditions,
        },
      });
    }

    return this.getMe(userId);
  }

  /**
   * Guard: ensure caller has a PatientProfile. Used by higher-level guards
   * when surfacing portal-only pages.
   */
  async assertHasProfile(userId: string) {
    const exists = await this.prisma.patientProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!exists) {
      throw new ForbiddenException(
        'No patient profile is attached to this account',
      );
    }
  }
}
