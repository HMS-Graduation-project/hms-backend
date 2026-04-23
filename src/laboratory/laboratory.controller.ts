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
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { LabOrderQueryDto } from './dto/lab-order-query.dto';
import { UpdateLabOrderStatusDto } from './dto/update-lab-order-status.dto';
import { LaboratoryService } from './laboratory.service';

@ApiTags('Laboratory')
@ApiBearerAuth()
@Controller()
export class LaboratoryController {
  constructor(private readonly laboratoryService: LaboratoryService) {}

  @Post('lab-orders')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Create a new lab order' })
  async create(
    @Body() dto: CreateLabOrderDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.laboratoryService.create(dto, currentUser.hospitalId!);
  }

  @Get('lab-orders')
  @Roles(Role.LAB_TECHNICIAN, Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'List all lab orders (paginated, filterable)' })
  async findAll(@Query() query: LabOrderQueryDto) {
    return this.laboratoryService.findAll(query);
  }

  @Get('lab-orders/:id')
  @Roles(Role.DOCTOR, Role.LAB_TECHNICIAN, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a lab order by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.laboratoryService.findById(id);
  }

  @Patch('lab-orders/:id/status')
  @Roles(Role.LAB_TECHNICIAN)
  @ApiOperation({ summary: 'Update lab order status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabOrderStatusDto,
  ) {
    return this.laboratoryService.updateStatus(id, dto.status);
  }

  @Post('lab-orders/:id/results')
  @Roles(Role.LAB_TECHNICIAN)
  @ApiOperation({ summary: 'Enter or update lab results for an order' })
  async enterResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnterLabResultDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.laboratoryService.enterResult(id, dto, user.id);
  }

  @Get('patients/:patientId/lab-orders')
  @Roles(Role.DOCTOR, Role.LAB_TECHNICIAN, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List lab orders for a specific patient (paginated)' })
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: LabOrderQueryDto,
  ) {
    return this.laboratoryService.findByPatient(patientId, query);
  }
}
