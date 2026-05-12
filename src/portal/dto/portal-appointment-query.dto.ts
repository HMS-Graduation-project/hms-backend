import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

/**
 * Query DTO for patient-portal cross-hospital list endpoints. We share this
 * across appointments / prescriptions / lab-results / invoices / referrals
 * because they all need the same dumb pagination + status filters.
 */
export class PortalListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 25 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Filter by hospitalId (one of the patient\'s)' })
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
