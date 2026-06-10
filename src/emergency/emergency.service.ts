import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmergencyVisitStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateEmergencyVisitDto } from './dto/create-emergency-visit.dto';
import { TriageEmergencyVisitDto } from './dto/triage-emergency-visit.dto';
import {
  DispositionEmergencyVisitDto,
  type Disposition,
} from './dto/disposition-emergency-visit.dto';
import { LinkEmergencyPatientDto } from './dto/link-patient.dto';
import { EmergencyQueryDto } from './dto/emergency-query.dto';

const VISIT_INCLUDE = {
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
      criticalAlerts: true,
    },
  },
  patientProfile: {
    select: { id: true, hospitalId: true },
  },
  triagedBy: {
    select: { id: true, firstName: true, lastName: true, role: true },
  },
  attendingDoctor: {
    select: {
      id: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      specialization: true,
    },
  },
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
  medicalRecord: { select: { id: true } },
} as const;

const OPEN_STATUSES: EmergencyVisitStatus[] = [
  EmergencyVisitStatus.ARRIVED,
  EmergencyVisitStatus.IN_TRIAGE,
  EmergencyVisitStatus.IN_TREATMENT,
];

const CLOSED_STATUS_BY_DISPOSITION: Record<Disposition, EmergencyVisitStatus> = {
  DISCHARGED: EmergencyVisitStatus.DISCHARGED,
  ADMITTED: EmergencyVisitStatus.ADMITTED,
  TRANSFERRED: EmergencyVisitStatus.TRANSFERRED,
  LEFT_WITHOUT_BEING_SEEN: EmergencyVisitStatus.LEFT_WITHOUT_BEING_SEEN,
};

@Injectable()
export class EmergencyService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Queue / List ───────────────────────────────────

  async findAll(query: EmergencyQueryDto, hospitalId: string | null) {
    const where: Prisma.EmergencyVisitWhereInput = {};

    if (hospitalId) {
      // Hospital-scoped caller: restricted to their own hospital.
      where.hospitalId = hospitalId;
    } else if (query.hospitalId) {
      // National scope, drilled down to a specific hospital.
      where.hospitalId = query.hospitalId;
    } else if (query.governorate) {
      // National scope, filtered by governorate.
      where.hospital = { city: { governorate: query.governorate } };
    }

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { in: OPEN_STATUSES };
    }
    if (query.triageLevel) {
      where.triageLevel = query.triageLevel;
    }

    // Queue order: nulls-last on triageLevel, then arrival ascending (oldest waiting first)
    // Prisma doesn't auto-map enum ordering to clinical priority, so we sort
    // by `triageLevel` then `arrivedAt` — Postgres sorts enums by declaration
    // order, and TriageLevel is declared RED→BLUE, so `asc` gives RED first.
    const orderBy: Prisma.EmergencyVisitOrderByWithRelationInput[] = [
      { triageLevel: 'asc' },
      { arrivedAt: 'asc' },
    ];

    const [data, total] = await this.prisma.$transaction([
      this.prisma.emergencyVisit.findMany({
        where,
        include: VISIT_INCLUDE,
        orderBy,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 25),
        take: query.limit ?? 25,
      }),
      this.prisma.emergencyVisit.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 25,
        totalPages: Math.ceil(total / (query.limit ?? 25)),
      },
    };
  }

  async findById(id: string, hospitalId: string | null) {
    const visit = await this.prisma.emergencyVisit.findFirst({
      // National-scope callers (hospitalId = null) may view any visit.
      where: hospitalId ? { id, hospitalId } : { id },
      include: VISIT_INCLUDE,
    });
    if (!visit) {
      throw new NotFoundException(`Emergency visit "${id}" not found`);
    }
    return visit;
  }

  // ───────────────────── Intake ─────────────────────────────────────────

  async create(dto: CreateEmergencyVisitDto, hospitalId: string) {
    // Optional identification at intake — validate referenced rows exist.
    if (dto.nationalPatientId) {
      const np = await this.prisma.nationalPatient.findUnique({
        where: { id: dto.nationalPatientId },
        select: { id: true },
      });
      if (!np) {
        throw new NotFoundException(
          `National patient "${dto.nationalPatientId}" not found`,
        );
      }
    }
    if (dto.patientProfileId) {
      const pp = await this.prisma.patientProfile.findFirst({
        where: { id: dto.patientProfileId, hospitalId },
        select: { id: true, nationalPatientId: true },
      });
      if (!pp) {
        throw new NotFoundException(
          `Patient profile "${dto.patientProfileId}" not found at this hospital`,
        );
      }
      // If both are passed, they must be consistent
      if (
        dto.nationalPatientId &&
        pp.nationalPatientId !== dto.nationalPatientId
      ) {
        throw new BadRequestException(
          'nationalPatientId does not match the provided patientProfileId',
        );
      }
    }

    return this.prisma.emergencyVisit.create({
      data: {
        hospitalId,
        displayName: dto.displayName,
        chiefComplaint: dto.chiefComplaint,
        nationalPatientId: dto.nationalPatientId,
        patientProfileId: dto.patientProfileId,
        status: EmergencyVisitStatus.ARRIVED,
      },
      include: VISIT_INCLUDE,
    });
  }

  // ───────────────────── Triage ─────────────────────────────────────────

  async triage(
    id: string,
    dto: TriageEmergencyVisitDto,
    currentUser: AuthUser,
  ) {
    const visit = await this.findById(id, currentUser.hospitalId!);
    if (
      visit.status !== EmergencyVisitStatus.ARRIVED &&
      visit.status !== EmergencyVisitStatus.IN_TRIAGE
    ) {
      throw new BadRequestException(
        `Cannot triage a visit in status "${visit.status}"`,
      );
    }

    return this.prisma.emergencyVisit.update({
      where: { id },
      data: {
        triageLevel: dto.triageLevel,
        triageNotes: dto.triageNotes,
        triagedById: currentUser.id,
        triagedAt: new Date(),
        status: EmergencyVisitStatus.IN_TREATMENT,
      },
      include: VISIT_INCLUDE,
    });
  }

  // ───────────────────── Claim ──────────────────────────────────────────

  async claim(id: string, currentUser: AuthUser) {
    if (currentUser.role !== Role.DOCTOR) {
      throw new ForbiddenException('Only doctors can claim ER visits');
    }
    const visit = await this.findById(id, currentUser.hospitalId!);
    if (visit.status === EmergencyVisitStatus.DISCHARGED ||
        visit.status === EmergencyVisitStatus.ADMITTED ||
        visit.status === EmergencyVisitStatus.TRANSFERRED ||
        visit.status === EmergencyVisitStatus.LEFT_WITHOUT_BEING_SEEN) {
      throw new BadRequestException('Cannot claim a closed visit');
    }

    const doctorProfile = await this.prisma.doctorProfile.findFirst({
      where: { userId: currentUser.id, hospitalId: currentUser.hospitalId! },
      select: { id: true },
    });
    if (!doctorProfile) {
      throw new ForbiddenException(
        'Current user is not a doctor at this hospital',
      );
    }

    return this.prisma.emergencyVisit.update({
      where: { id },
      data: {
        attendingDoctorId: doctorProfile.id,
        claimedAt: new Date(),
        status: EmergencyVisitStatus.IN_TREATMENT,
      },
      include: VISIT_INCLUDE,
    });
  }

  // ───────────────────── Disposition ────────────────────────────────────

  async disposition(
    id: string,
    dto: DispositionEmergencyVisitDto,
    hospitalId: string,
  ) {
    const visit = await this.findById(id, hospitalId);
    if (
      visit.status === EmergencyVisitStatus.DISCHARGED ||
      visit.status === EmergencyVisitStatus.ADMITTED ||
      visit.status === EmergencyVisitStatus.TRANSFERRED ||
      visit.status === EmergencyVisitStatus.LEFT_WITHOUT_BEING_SEEN
    ) {
      throw new BadRequestException('Visit already closed');
    }

    return this.prisma.emergencyVisit.update({
      where: { id },
      data: {
        status: CLOSED_STATUS_BY_DISPOSITION[dto.disposition],
        dispositionNotes: dto.dispositionNotes,
        closedAt: new Date(),
      },
      include: VISIT_INCLUDE,
    });
  }

  // ───────────────────── Link patient (post-intake identification) ──────

  async linkPatient(
    id: string,
    dto: LinkEmergencyPatientDto,
    hospitalId: string,
  ) {
    if (!dto.nationalPatientId && !dto.patientProfileId) {
      throw new BadRequestException(
        'Provide nationalPatientId and/or patientProfileId',
      );
    }

    // Resolve NHID from PatientProfile when only the local id is given
    let nationalPatientId = dto.nationalPatientId;
    let patientProfileId = dto.patientProfileId;

    if (patientProfileId && !nationalPatientId) {
      const pp = await this.prisma.patientProfile.findFirst({
        where: { id: patientProfileId, hospitalId },
        select: { nationalPatientId: true },
      });
      if (!pp) {
        throw new NotFoundException(
          `Patient profile "${patientProfileId}" not found at this hospital`,
        );
      }
      nationalPatientId = pp.nationalPatientId;
    }

    // If only NHID given, optionally look up an existing local profile
    if (nationalPatientId && !patientProfileId) {
      const pp = await this.prisma.patientProfile.findUnique({
        where: {
          hospitalId_nationalPatientId: {
            hospitalId,
            nationalPatientId,
          },
        },
        select: { id: true },
      });
      patientProfileId = pp?.id;
    }

    // Make sure the visit itself exists in this hospital
    await this.findById(id, hospitalId);

    return this.prisma.emergencyVisit.update({
      where: { id },
      data: {
        nationalPatientId,
        patientProfileId,
      },
      include: VISIT_INCLUDE,
    });
  }
}
