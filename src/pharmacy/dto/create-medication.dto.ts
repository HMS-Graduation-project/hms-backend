import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedicationDto {
  @ApiProperty({ description: 'Medication name', example: 'Amoxicillin' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Generic / INN name',
    example: 'Amoxicillin',
  })
  @IsOptional()
  @IsString()
  genericName?: string;

  @ApiPropertyOptional({
    description: 'Pharmacological category',
    example: 'Antibiotic',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Manufacturer name',
    example: 'Pfizer',
  })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({
    description: 'Dosage form (tablet, capsule, syrup, etc.)',
    example: 'Capsule',
  })
  @IsOptional()
  @IsString()
  dosageForm?: string;

  @ApiPropertyOptional({
    description: 'Strength of the medication',
    example: '500mg',
  })
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    example: 'mg',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    description: 'Unit price',
    example: 12.5,
    type: Number,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({
    description: 'Current stock quantity',
    default: 0,
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock?: number = 0;

  @ApiPropertyOptional({
    description: 'Stock level that triggers a reorder alert',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  reorderLevel?: number = 10;

  @ApiPropertyOptional({
    description: 'Expiry date (ISO 8601)',
    example: '2027-06-30',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
