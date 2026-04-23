import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddInvoiceItemDto } from './dto/add-invoice-item.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

/** Safe user fields (no passwordHash). */
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
} as const;

/** Standard includes used by most read operations. */
const INVOICE_INCLUDE = {
  items: true,
  payments: true,
  patient: { include: { user: { select: USER_SELECT } } },
  appointment: {
    select: { id: true, date: true, type: true, startTime: true },
  },
  _count: { select: { items: true, payments: true } },
} as const;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Find All (paginated) ────────────────────────────────

  async findAll(query: InvoiceQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.patientId) {
      where.patientId = query.patientId;
    }

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
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
      this.prisma.invoice as any,
      {
        where,
        include: INVOICE_INCLUDE,
      },
      query,
    );
  }

  // ───────────────────── Find by ID ──────────────────────────────────────────

  async findById(
    id: string,
    currentUser: { id: string; role: Role },
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        ...INVOICE_INCLUDE,
        patient: {
          include: {
            user: { select: { ...USER_SELECT, role: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice "${id}" not found`);
    }

    // PATIENT role may only view their own invoices
    if (
      currentUser.role === Role.PATIENT &&
      invoice.patient.user.id !== currentUser.id
    ) {
      throw new ForbiddenException(
        'You can only view your own invoices',
      );
    }

    return invoice;
  }

  // ───────────────────── Create ──────────────────────────────────────────────

  async create(dto: CreateInvoiceDto, hospitalId: string) {
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

    // Validate appointment if provided
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
        select: { id: true, patientId: true },
      });

      if (!appointment) {
        throw new NotFoundException(
          `Appointment "${dto.appointmentId}" not found`,
        );
      }

      if (appointment.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Appointment does not belong to the specified patient',
        );
      }
    }

    const invoiceNumber = await this.generateInvoiceNumber(hospitalId);
    const tax = new Prisma.Decimal(dto.tax ?? 0);
    const discount = new Prisma.Decimal(dto.discount ?? 0);

    // Calculate subtotal from items
    const subtotal = dto.items.reduce(
      (sum, item) => sum.add(new Prisma.Decimal(item.quantity).mul(new Prisma.Decimal(item.unitPrice))),
      new Prisma.Decimal(0),
    );

    const total = subtotal.add(tax).sub(discount);

    return this.prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          invoiceNumber,
          patientId: dto.patientId,
          appointmentId: dto.appointmentId,
          status: InvoiceStatus.DRAFT,
          subtotal,
          tax,
          discount,
          total,
          paidAmount: 0,
          hospitalId,
          items: {
            create: dto.items.map((item) => ({
              description: item.description,
              category: item.category,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              total: new Prisma.Decimal(item.quantity).mul(
                new Prisma.Decimal(item.unitPrice),
              ),
            })),
          },
        },
        include: INVOICE_INCLUDE,
      });
    });
  }

  // ───────────────────── Add Item ────────────────────────────────────────────

  async addItem(invoiceId: string, dto: AddInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, subtotal: true, tax: true, discount: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice "${invoiceId}" not found`);
    }

    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot add items to a ${invoice.status.toLowerCase()} invoice`,
      );
    }

    const itemTotal = new Prisma.Decimal(dto.quantity).mul(
      new Prisma.Decimal(dto.unitPrice),
    );

    const newSubtotal = new Prisma.Decimal(invoice.subtotal.toString()).add(itemTotal);
    const newTotal = newSubtotal
      .add(new Prisma.Decimal(invoice.tax.toString()))
      .sub(new Prisma.Decimal(invoice.discount.toString()));

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.create({
        data: {
          invoiceId,
          description: dto.description,
          category: dto.category,
          quantity: dto.quantity,
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          total: itemTotal,
        },
      });

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
        },
        include: INVOICE_INCLUDE,
      });
    });
  }

  // ───────────────────── Record Payment ──────────────────────────────────────

  async recordPayment(invoiceId: string, dto: RecordPaymentDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        total: true,
        paidAmount: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice "${invoiceId}" not found`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot record payment for a cancelled invoice',
      );
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const paymentAmount = new Prisma.Decimal(dto.amount);
    const currentPaid = new Prisma.Decimal(invoice.paidAmount.toString());
    const total = new Prisma.Decimal(invoice.total.toString());
    const newPaidAmount = currentPaid.add(paymentAmount);

    // Determine new status
    let newStatus: InvoiceStatus;
    if (newPaidAmount.gte(total)) {
      newStatus = InvoiceStatus.PAID;
    } else if (newPaidAmount.gt(0)) {
      newStatus = InvoiceStatus.PARTIALLY_PAID;
    } else {
      newStatus = invoice.status;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          method: dto.method,
          reference: dto.reference,
        },
      });

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          // If it was a DRAFT, issue it on first payment
          ...(invoice.status === InvoiceStatus.DRAFT && {
            issuedAt: new Date(),
          }),
        },
        include: INVOICE_INCLUDE,
      });
    });
  }

  // ───────────────────── Find by Patient ─────────────────────────────────────

  async findByPatient(patientId: string, query: InvoiceQueryDto) {
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

    if (query.search) {
      where.invoiceNumber = { contains: query.search, mode: 'insensitive' };
    }

    return paginate(
      this.prisma.invoice as any,
      {
        where,
        include: {
          items: true,
          payments: true,
          appointment: {
            select: { id: true, date: true, type: true, startTime: true },
          },
          _count: { select: { items: true, payments: true } },
        },
      },
      query,
    );
  }

  // ───────────────────── Helpers ─────────────────────────────────────────────

  /**
   * Generates the next invoice number for today in format INV-YYYYMMDD-XXXX.
   * Uses a count of today's existing invoices + 1 (scoped to hospital),
   * zero-padded to 4 digits. invoiceNumber is unique per-hospital.
   */
  private async generateInvoiceNumber(hospitalId: string): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const prefix = `INV-${dateStr}-`;

    const todayStart = new Date(yyyy, now.getMonth(), now.getDate());
    const todayEnd = new Date(yyyy, now.getMonth(), now.getDate() + 1);

    const count = await this.prisma.invoice.count({
      where: {
        hospitalId,
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }
}
