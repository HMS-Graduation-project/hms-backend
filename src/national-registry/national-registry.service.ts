import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNationalPatientDto } from './dto/create-national-patient.dto';
import { UpdateNationalPatientDto } from './dto/update-national-patient.dto';
import { SearchNationalPatientDto } from './dto/search-national-patient.dto';

@Injectable()
export class NationalRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search the national registry. Returns up to 20 matches.
   *
   * Match rules (priority):
   *  1. Exact syrianNationalId → at most one hit, short-circuit.
   *  2. Otherwise combine name substring AND date-of-birth (AND-logic).
   *  3. With just a query (no DOB), substring match on first/last name.
   *
   * At least one of (syrianNationalId, q, dateOfBirth) must be provided.
   */
  async search(params: SearchNationalPatientDto) {
    if (!params.syrianNationalId && !params.q && !params.dateOfBirth) {
      throw new BadRequestException(
        'Provide syrianNationalId, q, or dateOfBirth to search',
      );
    }

    if (params.syrianNationalId) {
      const hit = await this.prisma.nationalPatient.findUnique({
        where: { syrianNationalId: params.syrianNationalId },
      });
      return hit ? [hit] : [];
    }

    const where: Record<string, unknown> = {};
    if (params.q) {
      where.OR = [
        { firstName: { contains: params.q, mode: 'insensitive' } },
        { lastName: { contains: params.q, mode: 'insensitive' } },
        { firstNameAr: { contains: params.q } },
        { lastNameAr: { contains: params.q } },
      ];
    }
    if (params.dateOfBirth) {
      where.dateOfBirth = new Date(params.dateOfBirth);
    }

    return this.prisma.nationalPatient.findMany({
      where,
      take: 20,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /**
   * Fetch a national patient by NHID plus the list of hospitals where they
   * have a local PatientProfile. Records themselves are NOT returned here —
   * viewing records from another hospital requires a referral (Phase 5) or a
   * cross-hospital role.
   */
  async findById(nhid: string) {
    const patient = await this.prisma.nationalPatient.findUnique({
      where: { id: nhid },
      include: {
        profiles: {
          select: {
            id: true,
            hospitalId: true,
            hospital: { select: { id: true, code: true, name: true, nameAr: true } },
            createdAt: true,
          },
        },
      },
    });
    if (!patient) {
      throw new NotFoundException(`National patient with id "${nhid}" not found`);
    }
    return patient;
  }

  async create(dto: CreateNationalPatientDto) {
    if (dto.syrianNationalId) {
      const existing = await this.prisma.nationalPatient.findUnique({
        where: { syrianNationalId: dto.syrianNationalId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `National patient with Syrian ID "${dto.syrianNationalId}" already exists`,
        );
      }
    }

    return this.prisma.nationalPatient.create({
      data: {
        syrianNationalId: dto.syrianNationalId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        firstNameAr: dto.firstNameAr,
        lastNameAr: dto.lastNameAr,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        bloodType: dto.bloodType,
        allergies: dto.allergies,
        chronicConditions: dto.chronicConditions,
        criticalAlerts: dto.criticalAlerts,
        phone: dto.phone,
        address: dto.address,
      },
    });
  }

  async update(nhid: string, dto: UpdateNationalPatientDto) {
    await this.ensureExists(nhid);

    if (dto.syrianNationalId) {
      const collision = await this.prisma.nationalPatient.findUnique({
        where: { syrianNationalId: dto.syrianNationalId },
        select: { id: true },
      });
      if (collision && collision.id !== nhid) {
        throw new ConflictException(
          `Syrian ID "${dto.syrianNationalId}" already belongs to another national patient`,
        );
      }
    }

    return this.prisma.nationalPatient.update({
      where: { id: nhid },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  /**
   * Merge two NationalPatients into one. All PatientProfiles pointing at
   * `loserId` are reassigned to `winnerId`; the loser is then deleted.
   *
   * Safety: if the same hospital has profiles under both NHIDs (which
   * violates the @@unique([hospitalId, nationalPatientId]) constraint), the
   * duplicate loser-side profile is kept but its clinical rows (appointments,
   * records, prescriptions, lab orders, invoices) are reassigned to the
   * winner-side profile, and the loser profile is deleted.
   */
  async merge(winnerId: string, loserId: string) {
    if (winnerId === loserId) {
      throw new BadRequestException('winner and loser must be different NHIDs');
    }

    const [winner, loser] = await Promise.all([
      this.prisma.nationalPatient.findUnique({ where: { id: winnerId } }),
      this.prisma.nationalPatient.findUnique({ where: { id: loserId } }),
    ]);
    if (!winner) {
      throw new NotFoundException(`Winner NHID "${winnerId}" not found`);
    }
    if (!loser) {
      throw new NotFoundException(`Loser NHID "${loserId}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const loserProfiles = await tx.patientProfile.findMany({
        where: { nationalPatientId: loserId },
      });
      const winnerProfiles = await tx.patientProfile.findMany({
        where: { nationalPatientId: winnerId },
        select: { id: true, hospitalId: true },
      });
      const winnerByHospital = new Map(
        winnerProfiles.map((p) => [p.hospitalId, p.id]),
      );

      let reassignedProfiles = 0;
      let mergedProfiles = 0;

      for (const lp of loserProfiles) {
        const collidingWinnerId = winnerByHospital.get(lp.hospitalId);
        if (!collidingWinnerId) {
          // No winner-side profile at this hospital: simply reassign FK.
          await tx.patientProfile.update({
            where: { id: lp.id },
            data: { nationalPatientId: winnerId },
          });
          reassignedProfiles++;
          continue;
        }

        // Collision: move all clinical rows from loser-side profile to winner-side, then delete loser.
        await tx.appointment.updateMany({
          where: { patientId: lp.id },
          data: { patientId: collidingWinnerId },
        });
        await tx.medicalRecord.updateMany({
          where: { patientId: lp.id },
          data: { patientId: collidingWinnerId },
        });
        await tx.prescription.updateMany({
          where: { patientId: lp.id },
          data: { patientId: collidingWinnerId },
        });
        await tx.labOrder.updateMany({
          where: { patientId: lp.id },
          data: { patientId: collidingWinnerId },
        });
        await tx.invoice.updateMany({
          where: { patientId: lp.id },
          data: { patientId: collidingWinnerId },
        });
        await tx.patientProfile.delete({ where: { id: lp.id } });
        mergedProfiles++;
      }

      await tx.nationalPatient.delete({ where: { id: loserId } });

      return {
        winnerId,
        loserId,
        reassignedProfiles,
        mergedProfiles,
      };
    });
  }

  private async ensureExists(nhid: string): Promise<void> {
    const count = await this.prisma.nationalPatient.count({ where: { id: nhid } });
    if (count === 0) {
      throw new NotFoundException(`National patient with id "${nhid}" not found`);
    }
  }
}
