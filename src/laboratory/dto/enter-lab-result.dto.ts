import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class EnterLabResultDto {
  @ApiProperty({
    description: 'The test result value',
    example: '14.2 g/dL',
  })
  @IsString()
  result: string;

  @ApiPropertyOptional({
    description: 'Normal reference range for the test',
    example: '12.0 - 16.0 g/dL',
  })
  @IsOptional()
  @IsString()
  normalRange?: string;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    example: 'g/dL',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Whether the result is outside the normal range',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isAbnormal?: boolean;

  @ApiPropertyOptional({
    description: 'Additional notes about the result',
    example: 'Slight elevation, recommend retest in 2 weeks',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
