import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

/**
 * Patient-portal booking. The patient picks the hospital, doctor, date and
 * time. If the patient does not yet have a PatientProfile at this hospital
 * the service will create one in the same transaction (linked to the same
 * NHID).
 */
export class BookPortalAppointmentDto {
  @ApiProperty()
  @IsUUID()
  hospitalId!: string;

  @ApiProperty()
  @IsUUID()
  doctorId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ example: '2026-05-08' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '09:30' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:MM' })
  startTime!: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:MM' })
  endTime!: string;

  @ApiPropertyOptional({ description: 'CONSULTATION, FOLLOW_UP, EMERGENCY' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
