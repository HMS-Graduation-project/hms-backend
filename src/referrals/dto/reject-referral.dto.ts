import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class RejectReferralDto {
  @ApiPropertyOptional({ description: 'Reason shared with the referring hospital' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  responseNote?: string;
}
