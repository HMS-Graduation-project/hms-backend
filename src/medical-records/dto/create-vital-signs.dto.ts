import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateVitalSignsDto {
  @ApiPropertyOptional({
    description: 'Body temperature in Celsius',
    example: 37.2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Systolic blood pressure (mmHg)',
    example: 120,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bloodPressureSystolic?: number;

  @ApiPropertyOptional({
    description: 'Diastolic blood pressure (mmHg)',
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bloodPressureDiastolic?: number;

  @ApiPropertyOptional({
    description: 'Heart rate (beats per minute)',
    example: 72,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  heartRate?: number;

  @ApiPropertyOptional({
    description: 'Respiratory rate (breaths per minute)',
    example: 16,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  respiratoryRate?: number;

  @ApiPropertyOptional({
    description: 'Oxygen saturation percentage (SpO2)',
    example: 98,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @ApiPropertyOptional({
    description: 'Body weight in kilograms',
    example: 70.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({
    description: 'Body height in centimeters',
    example: 175.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number;
}
