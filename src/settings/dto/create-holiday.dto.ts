import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({
    description: 'Holiday name',
    example: 'National Day',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Holiday date (ISO 8601)',
    example: '2026-12-25',
  })
  @IsDateString()
  date: string;
}
