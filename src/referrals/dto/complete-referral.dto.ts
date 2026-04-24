import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CompleteReferralDto {
  @ApiPropertyOptional({ description: 'Outcome note / discharge summary' })
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  responseNote?: string;
}
