import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePneumoniaAnalysisDto {
  @ApiProperty({ description: 'Patient profile ID' })
  @IsUUID()
  patientProfileId: string;

  @ApiPropertyOptional({ description: 'Include Grad-CAM explanation', default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeGradcam?: boolean = true;
}
