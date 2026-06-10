import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReferralStatus, ReferralUrgency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ReferralQueryDto {
  @ApiPropertyOptional({ enum: ReferralStatus })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @ApiPropertyOptional({ enum: ReferralUrgency })
  @IsOptional()
  @IsEnum(ReferralUrgency)
  urgency?: ReferralUrgency;

  /** National scope only — filter by governorate on the viewed side. */
  @ApiPropertyOptional({ description: "Filter by the hospital's governorate" })
  @IsOptional()
  @IsString()
  governorate?: string;

  /** National scope only — filter by a specific hospital on the viewed side. */
  @ApiPropertyOptional({ description: 'Filter by hospital UUID' })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
