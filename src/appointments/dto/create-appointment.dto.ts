import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiPropertyOptional({
    description: 'Patient profile UUID (optional for PATIENT role - auto-resolved)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiProperty({
    description: 'Doctor profile UUID',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsUUID()
  doctorId: string;

  @ApiPropertyOptional({
    description: 'Department UUID',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({
    description: 'Appointment date in ISO 8601 format (YYYY-MM-DD)',
    example: '2026-04-01',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Start time in HH:mm format',
    example: '09:00',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:mm format',
    example: '09:30',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Appointment type',
    enum: ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY'],
    example: 'CONSULTATION',
  })
  @IsOptional()
  @IsIn(['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY'])
  type?: string;

  @ApiPropertyOptional({
    description: 'Reason for the appointment',
    example: 'Regular check-up',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
