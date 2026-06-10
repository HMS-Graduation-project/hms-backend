import {
  Body,
  Controller,
  Delete,
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
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { DepartmentsService } from './departments.service';

/**
 * Department management endpoints.
 * Listing and detail are available to any authenticated user.
 * Create, update, and delete are restricted to ADMIN / SUPER_ADMIN.
 */
@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new department' })
  async create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.departmentsService.create(dto, currentUser.hospitalId!);
  }

  @Get()
  @ApiOperation({ summary: 'List departments (paginated)' })
  async findAll(
    @Query() query: DepartmentQueryDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const isAdmin =
      currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN;
    return this.departmentsService.findAll(
      query,
      isAdmin,
      currentUser.hospitalId,
    );
  }

  @Get('grouped')
  @ApiOperation({
    summary: 'List departments grouped by governorate → hospital',
  })
  async findGrouped(@CurrentUser() currentUser: AuthUser) {
    const isAdmin =
      currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN;
    return this.departmentsService.findGrouped(
      isAdmin,
      currentUser.hospitalId,
      currentUser.cityId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a department' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // TODO P2: proper guard — SUPER_ADMIN may need to target a specific hospital
    return this.departmentsService.update(id, dto, currentUser.hospitalId!);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a department (set inactive)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.remove(id);
  }
}
