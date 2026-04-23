import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class SearchNationalPatientDto {
  @ApiPropertyOptional({ description: 'Exact Syrian National ID (11 digits)' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{11}$/)
  syrianNationalId?: string;

  @ApiPropertyOptional({ description: 'Substring name match (first OR last, case-insensitive)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Date of birth (YYYY-MM-DD) — combined with name for fuzzy match' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
