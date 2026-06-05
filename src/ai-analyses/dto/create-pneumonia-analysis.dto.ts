import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'Analysis mode: SINGLE_MODEL or ENSEMBLE',
    default: 'SINGLE_MODEL',
    enum: ['SINGLE_MODEL', 'ENSEMBLE'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['SINGLE_MODEL', 'ENSEMBLE'])
  analysisMode?: string = 'SINGLE_MODEL';
}
