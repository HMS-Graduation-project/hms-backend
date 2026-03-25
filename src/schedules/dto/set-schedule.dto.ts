import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ScheduleEntryDto {
  @ApiProperty({
    description: 'Day of week (0 = Sunday, 6 = Saturday)',
    minimum: 0,
    maximum: 6,
    example: 1,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Start time in HH:mm format',
    example: '09:00',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:mm format',
    example: '17:00',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Slot duration in minutes',
    minimum: 10,
    maximum: 120,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  slotDuration?: number;

  @ApiPropertyOptional({
    description: 'Whether this schedule entry is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetScheduleDto {
  @ApiProperty({
    description: 'Array of schedule entries for the doctor',
    type: [ScheduleEntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  entries: ScheduleEntryDto[];
}
