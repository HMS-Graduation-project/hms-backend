import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentStatusDto {
  @ApiProperty({
    description: 'New appointment status',
    enum: AppointmentStatus,
    example: AppointmentStatus.CONFIRMED,
  })
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Additional notes (used as cancelReason when cancelling)',
    example: 'Patient requested cancellation',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
