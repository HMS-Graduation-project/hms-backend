import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReferralStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateReferralDto } from './dto/create-referral.dto';
import { AcceptReferralDto } from './dto/accept-referral.dto';
import { RejectReferralDto } from './dto/reject-referral.dto';
import { CompleteReferralDto } from './dto/complete-referral.dto';
import { CancelReferralDto } from './dto/cancel-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';

/**
 * Status set that grants the receiving hospital read-only access to the
 * patient's records at every hospital they have a PatientProfile at.
 */
const ACTIVE_GRANT_STATUSES: ReferralStatus[] = [
  ReferralStatus.ACCEPTED,
  ReferralStatus.COMPLETED,
];

const REFERRAL_INCLUDE = {
  nationalPatient: {
    select: {
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
    },
  },
  fromHospital: {
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      city: { select: { id: true, name: true } },
    },
  },
  toHospital: {
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      city: { select: { id: true, name: true } },
    },
  },
  fromDoctor: {
    select: {
      id: true,
      specialization: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  toDoctor: {
    select: {
      id: true,
      specialization: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} as const satisfies Prisma.ReferralInclude;

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Cross-hospital read access ────────────────────────────────────

  /**
   * Does the user's hospital have an active (ACCEPTED or COMPLETED) referral
   * in either direction for this national patient? National-scope roles
   * (hospitalId=null) always pass.
   */
  async canReadCrossHospital(
    userHospitalId: string | null,
    nationalPatientId: string,
  ): Promise<boolean> {
    if (!userHospitalId) return true; // SUPER_ADMIN / MINISTRY_ADMIN / REGIONAL_ADMIN
    const count = await this.prisma.referral.count({
      where: {
        nationalPatientId,
        status: { in: ACTIVE_GRANT_STATUSES },
        OR: [
          { toHospitalId: userHospitalId },
          { fromHospitalId: userHospitalId },
        ],
      },
    });
    return count > 0;
  }

  // ─── List ──────────────────────────────────────────────────────────

  private async listByDirection(
    direction: 'incoming' | 'outgoing',
    query: ReferralQueryDto,
    user: AuthUser,
  ) {
    if (!user.hospitalId) {
      throw new ForbiddenException(
        'Caller must be scoped to a hospital to list referrals',
      );
    }

    const where: Prisma.ReferralWhereInput = {
      [direction === 'incoming' ? 'toHospitalId' : 'fromHospitalId']:
        user.hospitalId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.urgency ? { urgency: query.urgency } : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.referral.findMany({
        where,
        include: REFERRAL_INCLUDE,
        orderBy: [
          // urgent work first, then newest
          { urgency: 'desc' }, // enum order ROUTINE/URGENT/EMERGENT — desc gives EMERGENT first
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.referral.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  listIncoming(query: ReferralQueryDto, user: AuthUser) {
    return this.listByDirection('incoming', query, user);
  }

  listOutgoing(query: ReferralQueryDto, user: AuthUser) {
    return this.listByDirection('outgoing', query, user);
  }

  /**
   * List referrals tied to a specific national patient that the caller
   * is party to (either side). Used by the patient detail page.
   */
  async listForPatient(nationalPatientId: string, user: AuthUser) {
    const where: Prisma.ReferralWhereInput = {
      nationalPatientId,
    };
    if (user.hospitalId) {
      where.OR = [
        { toHospitalId: user.hospitalId },
        { fromHospitalId: user.hospitalId },
      ];
    }
    // National roles see everything.

    return this.prisma.referral.findMany({
      where,
      include: REFERRAL_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findById(id: string, user: AuthUser) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      include: REFERRAL_INCLUDE,
    });
    if (!referral) {
      throw new NotFoundException(`Referral "${id}" not found`);
    }
    if (
      user.hospitalId &&
      referral.fromHospitalId !== user.hospitalId &&
      referral.toHospitalId !== user.hospitalId
    ) {
      throw new ForbiddenException(
        'Caller is not party to this referral',
      );
    }
    return referral;
  }

  // ─── Create ────────────────────────────────────────────────────────

  async create(dto: CreateReferralDto, user: AuthUser) {
    if (!user.hospitalId) {
      throw new ForbiddenException(
        'National roles cannot author referrals — must act on behalf of a hospital',
      );
    }
    if (dto.toHospitalId === user.hospitalId) {
      throw new BadRequestException(
        'Cannot refer to the same hospital you work at',
      );
    }

    // Resolve the author's DoctorProfile at this hospital.
    const fromDoctor = await this.prisma.doctorProfile.findFirst({
      where: { userId: user.id, hospitalId: user.hospitalId },
      select: { id: true },
    });
    if (!fromDoctor) {
      // Hospital admins without a doctor profile can't author referrals —
      // keep it simple; require a doctor. (Could relax later.)
      throw new ForbiddenException(
        'Only doctors can author referrals',
      );
    }

    // Validate target hospital exists + is active.
    const target = await this.prisma.hospital.findUnique({
      where: { id: dto.toHospitalId },
      select: { id: true, isActive: true },
    });
    if (!target || !target.isActive) {
      throw new NotFoundException('Target hospital not found or inactive');
    }

    // Validate the national patient exists.
    const np = await this.prisma.nationalPatient.findUnique({
      where: { id: dto.nationalPatientId },
      select: { id: true },
    });
    if (!np) {
      throw new NotFoundException('National patient not found');
    }

    return this.prisma.referral.create({
      data: {
        nationalPatientId: dto.nationalPatientId,
        fromHospitalId: user.hospitalId,
        toHospitalId: dto.toHospitalId,
        fromDoctorId: fromDoctor.id,
        reason: dto.reason,
        clinicalSummary: dto.clinicalSummary,
        urgency: dto.urgency ?? 'ROUTINE',
        status: ReferralStatus.PENDING,
      },
      include: REFERRAL_INCLUDE,
    });
  }

  // ─── Transitions ───────────────────────────────────────────────────

  async accept(id: string, dto: AcceptReferralDto, user: AuthUser) {
    const ref = await this.findById(id, user);
    this.assertReceiver(ref, user);
    if (ref.status !== ReferralStatus.PENDING) {
      throw new BadRequestException(
        `Cannot accept a referral in status "${ref.status}"`,
      );
    }

    if (dto.toDoctorId) {
      const doc = await this.prisma.doctorProfile.findFirst({
        where: { id: dto.toDoctorId, hospitalId: ref.toHospitalId },
        select: { id: true },
      });
      if (!doc) {
        throw new NotFoundException(
          'toDoctorId does not belong to the receiving hospital',
        );
      }
    }

    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.ACCEPTED,
        toDoctorId: dto.toDoctorId,
        respondedAt: new Date(),
        responseNote: dto.responseNote,
      },
      include: REFERRAL_INCLUDE,
    });
  }

  async reject(id: string, dto: RejectReferralDto, user: AuthUser) {
    const ref = await this.findById(id, user);
    this.assertReceiver(ref, user);
    if (ref.status !== ReferralStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject a referral in status "${ref.status}"`,
      );
    }
    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.REJECTED,
        respondedAt: new Date(),
        responseNote: dto.responseNote,
      },
      include: REFERRAL_INCLUDE,
    });
  }

  async complete(id: string, dto: CompleteReferralDto, user: AuthUser) {
    const ref = await this.findById(id, user);
    this.assertReceiver(ref, user);
    if (ref.status !== ReferralStatus.ACCEPTED) {
      throw new BadRequestException(
        `Cannot complete a referral in status "${ref.status}"`,
      );
    }
    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.COMPLETED,
        completedAt: new Date(),
        responseNote: dto.responseNote ?? ref.responseNote,
      },
      include: REFERRAL_INCLUDE,
    });
  }

  async cancel(id: string, dto: CancelReferralDto, user: AuthUser) {
    const ref = await this.findById(id, user);
    // Only the sender can cancel — and only while still open
    if (user.hospitalId && ref.fromHospitalId !== user.hospitalId) {
      throw new ForbiddenException(
        'Only the referring hospital can cancel a referral',
      );
    }
    if (
      ref.status !== ReferralStatus.PENDING &&
      ref.status !== ReferralStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Cannot cancel a referral in status "${ref.status}"`,
      );
    }
    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.CANCELLED,
        cancelledAt: new Date(),
        responseNote: dto.responseNote ?? ref.responseNote,
      },
      include: REFERRAL_INCLUDE,
    });
  }

  // ─── Cross-hospital records ────────────────────────────────────────

  /**
   * Return the patient's records from OTHER hospitals (not the caller's).
   * Caller must either (a) be a national role, or (b) have an active
   * referral granting read. Receiver sees records grouped by source hospital.
   */
  async getCrossHospitalRecords(
    nationalPatientId: string,
    user: AuthUser,
  ) {
    const allowed = await this.canReadCrossHospital(
      user.hospitalId,
      nationalPatientId,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'No active referral grants cross-hospital read for this patient',
      );
    }

    // Find every PatientProfile for this NHID, excluding the caller's hospital.
    // IMPORTANT: the tenant middleware auto-injects `hospitalId = user.hospitalId`
    // unless the top-level where has a `hospitalId` key. Put the exclusion as
    // `hospitalId: { not: ... }` so the middleware sees a hospitalId constraint
    // and skips its injection.
    const profiles = await this.prisma.patientProfile.findMany({
      where: {
        nationalPatientId,
        ...(user.hospitalId
          ? { hospitalId: { not: user.hospitalId } }
          : {}),
      },
      include: {
        hospital: {
          select: {
            id: true,
            code: true,
            name: true,
            nameAr: true,
            city: { select: { id: true, name: true } },
          },
        },
        medicalRecords: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            diagnosis: true,
            chiefComplaint: true,
            icdCodes: true,
            treatmentPlan: true,
            createdAt: true,
            doctor: {
              select: {
                id: true,
                specialization: true,
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        prescriptions: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            status: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                medicationName: true,
                dosage: true,
                frequency: true,
                duration: true,
              },
            },
          },
        },
        labOrders: {
          orderBy: { orderedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            testName: true,
            status: true,
            orderedAt: true,
            result: {
              select: { id: true, result: true, isAbnormal: true },
            },
          },
        },
      },
    });

    return profiles.map((profile) => ({
      hospital: profile.hospital,
      profileId: profile.id,
      medicalRecords: profile.medicalRecords,
      prescriptions: profile.prescriptions,
      labOrders: profile.labOrders,
    }));
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private assertReceiver(
    ref: { toHospitalId: string },
    user: AuthUser,
  ) {
    // National roles may take receiver actions on any referral (admin override).
    if (!user.hospitalId) return;
    if (user.hospitalId !== ref.toHospitalId) {
      throw new ForbiddenException(
        'Only the receiving hospital can respond to this referral',
      );
    }
    // Roles allowed to respond: DOCTOR / HOSPITAL_ADMIN / ADMIN.
    const allowed: string[] = [
      Role.DOCTOR,
      Role.HOSPITAL_ADMIN,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException(
        'Role cannot respond to referrals',
      );
    }
  }
}
