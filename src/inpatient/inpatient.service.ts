import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  BedStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { TransferBedDto } from './dto/transfer-bed.dto';
import { DischargeAdmissionDto } from './dto/discharge.dto';
import { AdmissionQueryDto } from './dto/admission-query.dto';

const ADMISSION_INCLUDE = {
  patientProfile: {
    select: {
      id: true,
      hospitalId: true,
      nationalPatientId: true,
      bloodType: true,
      allergies: true,
      nationalPatient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          bloodType: true,
          allergies: true,
          criticalAlerts: true,
        },
      },
    },
  },
  admittingDoctor: {
    select: {
      id: true,
      specialization: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  bed: {
    select: {
      id: true,
      number: true,
      status: true,
      ward: { select: { id: true, name: true, type: true } },
    },
  },
  transfers: {
    orderBy: { transferredAt: 'desc' },
    include: {
      fromBed: {
        select: { id: true, number: true, ward: { select: { id: true, name: true } } },
      },
      toBed: {
        select: { id: true, number: true, ward: { select: { id: true, name: true } } },
      },
    },
  },
  medicalRecords: {
    select: {
      id: true,
      diagnosis: true,
      chiefComplaint: true,
      createdAt: true,
      doctor: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  },
} as const satisfies Prisma.AdmissionInclude;

const OPEN_ADMISSION_STATUSES: AdmissionStatus[] = [
  AdmissionStatus.ADMITTED,
  AdmissionStatus.TRANSFERRED,
];

@Injectable()
export class InpatientService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Wards ─────────────────────────────────────────

  async listWards(hospitalId: string) {
    return this.prisma.ward.findMany({
      where: { hospitalId },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { beds: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async getWard(id: string, hospitalId: string) {
    const ward = await this.prisma.ward.findFirst({
      where: { id, hospitalId },
      include: {
        department: { select: { id: true, name: true } },
        beds: {
          orderBy: { number: 'asc' },
          include: {
            admissions: {
              where: { status: { in: OPEN_ADMISSION_STATUSES } },
              include: {
                patientProfile: {
                  select: {
                    id: true,
                    nationalPatient: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!ward) throw new NotFoundException(`Ward "${id}" not found`);
    return ward;
  }

  async createWard(dto: CreateWardDto, hospitalId: string) {
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, hospitalId },
        select: { id: true },
      });
      if (!dept) {
        throw new NotFoundException(
          `Department "${dto.departmentId}" not found at this hospital`,
        );
      }
    }
    try {
      return await this.prisma.ward.create({
        data: {
          hospitalId,
          name: dto.name,
          type: dto.type,
          departmentId: dto.departmentId,
          floor: dto.floor,
          description: dto.description,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A ward with this name already exists');
      }
      throw e;
    }
  }

  async updateWard(id: string, dto: UpdateWardDto, hospitalId: string) {
    await this.getWard(id, hospitalId);
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, hospitalId },
        select: { id: true },
      });
      if (!dept) {
        throw new NotFoundException(
          `Department "${dto.departmentId}" not found at this hospital`,
        );
      }
    }
    return this.prisma.ward.update({
      where: { id },
      data: dto,
    });
  }

  // ───────────────────── Beds ──────────────────────────────────────────

  async listBeds(hospitalId: string, wardId?: string, status?: BedStatus) {
    return this.prisma.bed.findMany({
      where: {
        hospitalId,
        ...(wardId ? { wardId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        ward: { select: { id: true, name: true, type: true } },
        admissions: {
          where: { status: { in: OPEN_ADMISSION_STATUSES } },
          take: 1,
          include: {
            patientProfile: {
              select: {
                id: true,
                nationalPatient: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ ward: { name: 'asc' } }, { number: 'asc' }],
    });
  }

  async createBed(dto: CreateBedDto, hospitalId: string) {
    const ward = await this.prisma.ward.findFirst({
      where: { id: dto.wardId, hospitalId },
      select: { id: true },
    });
    if (!ward) {
      throw new NotFoundException(
        `Ward "${dto.wardId}" not found at this hospital`,
      );
    }
    try {
      return await this.prisma.bed.create({
        data: {
          hospitalId,
          wardId: dto.wardId,
          number: dto.number,
          status: dto.status ?? BedStatus.AVAILABLE,
          notes: dto.notes,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'A bed with this number already exists in the selected ward',
        );
      }
      throw e;
    }
  }

  async updateBed(id: string, dto: UpdateBedDto, hospitalId: string) {
    const bed = await this.prisma.bed.findFirst({
      where: { id, hospitalId },
      select: { id: true, status: true },
    });
    if (!bed) throw new NotFoundException(`Bed "${id}" not found`);

    // Guard: can't flip to AVAILABLE while occupied by an open admission
    if (
      dto.status &&
      dto.status === BedStatus.AVAILABLE &&
      bed.status === BedStatus.OCCUPIED
    ) {
      const openAdm = await this.prisma.admission.findFirst({
        where: { bedId: id, status: { in: OPEN_ADMISSION_STATUSES } },
        select: { id: true },
      });
      if (openAdm) {
        throw new BadRequestException(
          'Cannot mark bed AVAILABLE while an open admission occupies it. Discharge or transfer first.',
        );
      }
    }

    return this.prisma.bed.update({ where: { id }, data: dto });
  }

  // ───────────────────── Admissions ────────────────────────────────────

  async listAdmissions(query: AdmissionQueryDto, hospitalId: string) {
    const where: Prisma.AdmissionWhereInput = { hospitalId };
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { in: OPEN_ADMISSION_STATUSES };
    }
    if (query.patientProfileId) where.patientProfileId = query.patientProfileId;
    if (query.wardId) where.bed = { wardId: query.wardId };

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.admission.findMany({
        where,
        include: ADMISSION_INCLUDE,
        orderBy: [{ admissionDate: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.admission.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAdmission(id: string, hospitalId: string) {
    const adm = await this.prisma.admission.findFirst({
      where: { id, hospitalId },
      include: ADMISSION_INCLUDE,
    });
    if (!adm) throw new NotFoundException(`Admission "${id}" not found`);
    return adm;
  }

  async admit(dto: CreateAdmissionDto, hospitalId: string) {
    // Validate referenced patient + doctor belong to this hospital.
    const [patient, doctor] = await Promise.all([
      this.prisma.patientProfile.findFirst({
        where: { id: dto.patientProfileId, hospitalId },
        select: { id: true },
      }),
      this.prisma.doctorProfile.findFirst({
        where: { id: dto.admittingDoctorId, hospitalId },
        select: { id: true },
      }),
    ]);
    if (!patient) {
      throw new NotFoundException(
        `Patient profile "${dto.patientProfileId}" not found at this hospital`,
      );
    }
    if (!doctor) {
      throw new NotFoundException(
        `Doctor "${dto.admittingDoctorId}" not found at this hospital`,
      );
    }

    // Reject if the patient already has an open admission here.
    const openExisting = await this.prisma.admission.findFirst({
      where: {
        hospitalId,
        patientProfileId: dto.patientProfileId,
        status: { in: OPEN_ADMISSION_STATUSES },
      },
      select: { id: true },
    });
    if (openExisting) {
      throw new ConflictException(
        'Patient already has an open admission at this hospital',
      );
    }

    // Atomic path: validate + allocate bed + create admission together.
    return this.prisma.$transaction(async (tx) => {
      if (dto.bedId) {
        const bed = await tx.bed.findFirst({
          where: { id: dto.bedId, hospitalId },
          select: { id: true, status: true },
        });
        if (!bed) {
          throw new NotFoundException(
            `Bed "${dto.bedId}" not found at this hospital`,
          );
        }
        if (bed.status !== BedStatus.AVAILABLE) {
          throw new ConflictException(
            `Bed is not available (status: ${bed.status})`,
          );
        }
        await tx.bed.update({
          where: { id: dto.bedId },
          data: { status: BedStatus.OCCUPIED },
        });
      }

      return tx.admission.create({
        data: {
          hospitalId,
          patientProfileId: dto.patientProfileId,
          admittingDoctorId: dto.admittingDoctorId,
          bedId: dto.bedId ?? null,
          diagnosis: dto.diagnosis,
          reason: dto.reason,
          status: AdmissionStatus.ADMITTED,
        },
        include: ADMISSION_INCLUDE,
      });
    });
  }

  async transferBed(
    admissionId: string,
    dto: TransferBedDto,
    currentUser: AuthUser,
    hospitalId: string,
  ) {
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, hospitalId },
      select: { id: true, bedId: true, status: true },
    });
    if (!admission) {
      throw new NotFoundException(`Admission "${admissionId}" not found`);
    }
    if (!OPEN_ADMISSION_STATUSES.includes(admission.status)) {
      throw new BadRequestException(
        `Cannot transfer bed for a ${admission.status} admission`,
      );
    }
    if (admission.bedId === dto.toBedId) {
      throw new BadRequestException('Patient is already in that bed');
    }

    return this.prisma.$transaction(async (tx) => {
      const toBed = await tx.bed.findFirst({
        where: { id: dto.toBedId, hospitalId },
        select: { id: true, status: true },
      });
      if (!toBed) {
        throw new NotFoundException(`Bed "${dto.toBedId}" not found`);
      }
      if (toBed.status !== BedStatus.AVAILABLE) {
        throw new ConflictException(
          `Target bed is not available (status: ${toBed.status})`,
        );
      }

      if (admission.bedId) {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: { status: BedStatus.AVAILABLE },
        });
      }
      await tx.bed.update({
        where: { id: dto.toBedId },
        data: { status: BedStatus.OCCUPIED },
      });

      await tx.bedTransfer.create({
        data: {
          admissionId,
          fromBedId: admission.bedId,
          toBedId: dto.toBedId,
          reason: dto.reason,
          performedById: currentUser.id,
        },
      });

      return tx.admission.update({
        where: { id: admissionId },
        data: {
          bedId: dto.toBedId,
          status: AdmissionStatus.TRANSFERRED,
        },
        include: ADMISSION_INCLUDE,
      });
    });
  }

  async discharge(
    admissionId: string,
    dto: DischargeAdmissionDto,
    hospitalId: string,
  ) {
    if (
      dto.status !== AdmissionStatus.DISCHARGED &&
      dto.status !== AdmissionStatus.DECEASED
    ) {
      throw new BadRequestException(
        'Discharge status must be DISCHARGED or DECEASED',
      );
    }

    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, hospitalId },
      select: { id: true, bedId: true, status: true },
    });
    if (!admission) {
      throw new NotFoundException(`Admission "${admissionId}" not found`);
    }
    if (!OPEN_ADMISSION_STATUSES.includes(admission.status)) {
      throw new BadRequestException(
        `Admission already closed (status: ${admission.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (admission.bedId) {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: { status: BedStatus.AVAILABLE },
        });
      }
      return tx.admission.update({
        where: { id: admissionId },
        data: {
          status: dto.status,
          dischargeSummary: dto.dischargeSummary,
          dischargeDate: new Date(),
        },
        include: ADMISSION_INCLUDE,
      });
    });
  }
}
