import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class PrescriptionItemDto {
  @ApiProperty({
    description: 'Medication name',
    example: 'Amoxicillin 500mg',
  })
  @IsString()
  medicationName: string;

  @ApiProperty({
    description: 'Dosage',
    example: '500mg',
  })
  @IsString()
  dosage: string;

  @ApiProperty({
    description: 'Frequency of administration',
    example: 'Three times daily',
  })
  @IsString()
  frequency: string;

  @ApiProperty({
    description: 'Duration of treatment',
    example: '7 days',
  })
  @IsString()
  duration: string;

  @ApiPropertyOptional({
    description: 'Total quantity to dispense',
    example: 21,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Special instructions for the patient',
    example: 'Take with food',
  })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({
    description: 'ID of the associated medical record',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  medicalRecordId: string;

  @ApiPropertyOptional({
    description: 'Prescription-level notes',
    example: 'Complete the full course of antibiotics',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'List of medication items',
    type: [PrescriptionItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}
