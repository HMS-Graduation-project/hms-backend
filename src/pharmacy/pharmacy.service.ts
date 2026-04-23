import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrescriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { paginate } from '../common/utils/pagination.util';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { DispenseDto } from './dto/dispense.dto';
import { MedicationQueryDto } from './dto/medication-query.dto';

/** Map camelCase sort fields to snake_case DB column names. */
const COLUMN_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  name: 'name',
  genericName: 'generic_name',
  category: 'category',
  stock: 'stock',
  price: 'price',
  expiryDate: 'expiry_date',
  reorderLevel: 'reorder_level',
};

/** Column list used in every raw‑SQL SELECT on the medications table. */
const MEDICATION_COLUMNS = `
  id, name, generic_name AS "genericName", category, manufacturer,
  dosage_form AS "dosageForm", strength, unit, price, stock,
  reorder_level AS "reorderLevel", expiry_date AS "expiryDate",
  is_active AS "isActive", created_at AS "createdAt",
  updated_at AS "updatedAt"`;

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Find All Medications (paginated) ────────────────────

  async findAllMedications(query: MedicationQueryDto) {
    // When lowStockOnly is requested we need a column‑to‑column comparison
    // (stock <= reorder_level) that Prisma's query API cannot express.
    // Delegate to a raw‑SQL pagination helper in that case.
    if (query.lowStockOnly) {
      return this.findAllLowStockPaginated(query);
    }

    const where: Record<string, unknown> = { isActive: true };

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { genericName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return paginate(this.prisma.medication as any, { where }, query);
  }

  // ───────────────────── Low‑Stock Paginated (raw SQL) ───────────────────────

  private async findAllLowStockPaginated(query: MedicationQueryDto) {
    const { page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const conditions: string[] = ['is_active = true', 'stock <= reorder_level'];
    const params: unknown[] = [];
    let idx = 1;

    if (query.category) {
      conditions.push(`category = $${idx}`);
      params.push(query.category);
      idx++;
    }

    if (query.search) {
      conditions.push(
        `(name ILIKE $${idx} OR generic_name ILIKE $${idx})`,
      );
      params.push(`%${query.search}%`);
      idx++;
    }

    const whereClause = conditions.join(' AND ');
    const orderCol = COLUMN_MAP[sortBy ?? 'createdAt'] ?? 'created_at';
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [countResult, data] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) AS count FROM medications WHERE ${whereClause}`,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT ${MEDICATION_COLUMNS}
         FROM medications
         WHERE ${whereClause}
         ORDER BY ${orderCol} ${dir}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
        limit,
        skip,
      ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  // ───────────────────── Find Medication By ID ───────────────────────────────

  async findMedicationById(id: string) {
    const medication = await this.prisma.medication.findUnique({
      where: { id },
    });

    if (!medication) {
      throw new NotFoundException(`Medication "${id}" not found`);
    }

    return medication;
  }

  // ───────────────────── Create Medication ───────────────────────────────────

  async createMedication(dto: CreateMedicationDto, hospitalId: string) {
    return this.prisma.medication.create({
      data: {
        name: dto.name,
        genericName: dto.genericName,
        category: dto.category,
        manufacturer: dto.manufacturer,
        dosageForm: dto.dosageForm,
        strength: dto.strength,
        unit: dto.unit,
        price: dto.price,
        stock: dto.stock ?? 0,
        reorderLevel: dto.reorderLevel ?? 10,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        hospitalId,
      },
    });
  }

  // ───────────────────── Update Medication ───────────────────────────────────

  async updateMedication(id: string, dto: UpdateMedicationDto) {
    await this.findMedicationById(id);

    const data: Record<string, unknown> = { ...dto };

    // Convert ISO date string to Date object for Prisma
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }

    return this.prisma.medication.update({
      where: { id },
      data,
    });
  }

  // ───────────────────── Low Stock Alert ─────────────────────────────────────

  async getLowStock() {
    // Raw query required: Prisma cannot compare two columns (stock <= reorder_level).
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT ${MEDICATION_COLUMNS}
       FROM medications
       WHERE is_active = true AND stock <= reorder_level
       ORDER BY stock ASC`,
    );
  }

  // ───────────────────── Dispense ────────────────────────────────────────────

  async dispense(dto: DispenseDto, currentUserId: string, hospitalId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate medication exists and has enough stock
      const medication = await tx.medication.findUnique({
        where: { id: dto.medicationId },
      });

      if (!medication) {
        throw new NotFoundException(
          `Medication "${dto.medicationId}" not found`,
        );
      }

      if (!medication.isActive) {
        throw new BadRequestException(
          `Medication "${medication.name}" is inactive`,
        );
      }

      if (medication.stock < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${medication.name}". ` +
            `Available: ${medication.stock}, requested: ${dto.quantity}`,
        );
      }

      // 2. Validate prescription exists and is in a dispensable state
      const prescription = await tx.prescription.findUnique({
        where: { id: dto.prescriptionId },
        include: { items: true },
      });

      if (!prescription) {
        throw new NotFoundException(
          `Prescription "${dto.prescriptionId}" not found`,
        );
      }

      const dispensableStatuses: PrescriptionStatus[] = [
        PrescriptionStatus.PENDING,
        PrescriptionStatus.PARTIALLY_DISPENSED,
      ];

      if (!dispensableStatuses.includes(prescription.status)) {
        throw new BadRequestException(
          `Prescription status is "${prescription.status}". ` +
            'Only PENDING or PARTIALLY_DISPENSED prescriptions can be dispensed.',
        );
      }

      // 3. Decrement medication stock
      await tx.medication.update({
        where: { id: dto.medicationId },
        data: { stock: { decrement: dto.quantity } },
      });

      // 4. Create dispensing record
      const dispensing = await tx.dispensing.create({
        data: {
          prescriptionId: dto.prescriptionId,
          medicationId: dto.medicationId,
          quantity: dto.quantity,
          pharmacistId: currentUserId,
          hospitalId,
        },
        include: {
          medication: true,
          prescription: { include: { items: true } },
        },
      });

      // 5. Advance prescription to PARTIALLY_DISPENSED if it was PENDING
      if (prescription.status === PrescriptionStatus.PENDING) {
        await tx.prescription.update({
          where: { id: dto.prescriptionId },
          data: { status: PrescriptionStatus.PARTIALLY_DISPENSED },
        });
      }

      return dispensing;
    });
  }
}
