import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Matches } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({
    description: 'New appointment date in ISO 8601 format (YYYY-MM-DD)',
    example: '2026-04-05',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'New start time in HH:mm format',
    example: '10:00',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({
    description: 'New end time in HH:mm format',
    example: '10:30',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;
}
