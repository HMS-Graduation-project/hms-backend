import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAiAnalysisDto {
  @ApiProperty({ enum: ['REVIEWED', 'APPROVED', 'REJECTED'] })
  @IsIn(['REVIEWED', 'APPROVED', 'REJECTED'])
  status: 'REVIEWED' | 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Doctor review comment', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  doctorComment?: string;
}
