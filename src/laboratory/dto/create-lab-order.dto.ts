import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLabOrderDto {
  @ApiProperty({
    description: 'ID of the patient profile',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  patientId: string;

  @ApiProperty({
    description: 'ID of the ordering doctor profile',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsUUID()
  doctorId: string;

  @ApiPropertyOptional({
    description: 'ID of the associated medical record',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  })
  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @ApiProperty({
    description: 'Name of the lab test to perform',
    example: 'Complete Blood Count (CBC)',
  })
  @IsString()
  testName: string;

  @ApiPropertyOptional({
    description: 'Category of the lab test',
    example: 'Hematology',
  })
  @IsOptional()
  @IsString()
  testCategory?: string;

  @ApiPropertyOptional({
    description: 'Priority level of the lab order',
    enum: ['NORMAL', 'URGENT', 'STAT'],
    default: 'NORMAL',
    example: 'NORMAL',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the lab order',
    example: 'Patient is fasting',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
