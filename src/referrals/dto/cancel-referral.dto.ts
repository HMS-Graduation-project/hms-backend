import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CancelReferralDto {
  @ApiPropertyOptional({ description: 'Why the referral was cancelled' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  responseNote?: string;
}
