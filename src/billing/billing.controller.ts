import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddInvoiceItemDto } from './dto/add-invoice-item.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { BillingService } from './billing.service';

/**
 * Billing & Invoicing endpoints.
 * All routes require an authenticated JWT (guards are global).
 */
@ApiTags('Billing')
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ──────────────────── Create Invoice ─────────────────────────────────────

  @Post('invoices')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Create a new invoice with line items' })
  async create(@Body() dto: CreateInvoiceDto) {
    return this.billingService.create(dto);
  }

  // ──────────────────── List Invoices ──────────────────────────────────────

  @Get('invoices')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'List all invoices (paginated, filterable)' })
  async findAll(@Query() query: InvoiceQueryDto) {
    return this.billingService.findAll(query);
  }

  // ──────────────────── Get Invoice by ID ──────────────────────────────────

  @Get('invoices/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST, Role.PATIENT)
  @ApiOperation({
    summary: 'Get invoice details by ID (patients may view only their own)',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: { id: string; role: Role },
  ) {
    return this.billingService.findById(id, currentUser);
  }

  // ──────────────────── Add Item to Invoice ────────────────────────────────

  @Patch('invoices/:id/items')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Add a line item to an existing invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
  ) {
    return this.billingService.addItem(id, dto);
  }

  // ──────────────────── Record Payment ─────────────────────────────────────

  @Post('invoices/:id/payments')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billingService.recordPayment(id, dto);
  }

  // ──────────────────── Patient Billing History ────────────────────────────

  @Get('patients/:patientId/invoices')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'List invoices for a specific patient (paginated)' })
  @ApiParam({ name: 'patientId', description: 'Patient profile UUID' })
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: InvoiceQueryDto,
  ) {
    return this.billingService.findByPatient(patientId, query);
  }
}
