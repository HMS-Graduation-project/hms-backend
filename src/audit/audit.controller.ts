import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List audit log entries',
    description:
      'Returns a paginated list of audit log entries. Restricted to SUPER_ADMIN role.',
  })
  async findAll(@Query() query: PaginationQueryDto) {
    return this.auditService.findAll(query);
  }
}
