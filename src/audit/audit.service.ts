import { Injectable } from '@nestjs/common';
import { AuditLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, PaginatedResponseDto } from '../common/dto';
import { paginate } from '../common/utils';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return a paginated list of audit log entries, newest first.
   */
  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    return paginate<AuditLog>(
      this.prisma.auditLog as any,
      {
        where: {},
        orderBy: { createdAt: 'desc' },
      },
      query,
    );
  }
}
