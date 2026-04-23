import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateNationalPatientDto {
  @ApiPropertyOptional({
    description: 'Syrian National ID (11 digits). Optional but strongly recommended.',
    example: '99000000001',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{11}$/, {
    message: 'syrianNationalId must be exactly 11 digits',
  })
  syrianNationalId?: string;

  @ApiProperty({ example: 'Ahmad' })
  @IsString()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({ example: 'Al-Saleh' })
  @IsString()
  @Length(1, 100)
  lastName: string;

  @ApiPropertyOptional({ example: 'أحمد' })
  @IsOptional()
  @IsString()
  firstNameAr?: string;

  @ApiPropertyOptional({ example: 'الصالح' })
  @IsOptional()
  @IsString()
  lastNameAr?: string;

  @ApiProperty({ example: '1985-03-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: ['Male', 'Female', 'Other'], example: 'Male' })
  @IsString()
  @IsIn(['Male', 'Female', 'Other'])
  gender: string;

  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional({ description: 'Allergy list, free-text for MVP', example: 'Penicillin, Latex' })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({ description: 'Chronic conditions, free-text', example: 'Diabetes Type 2' })
  @IsOptional()
  @IsString()
  chronicConditions?: string;

  @ApiPropertyOptional({ description: 'Critical alerts (allergies + conditions summary)' })
  @IsOptional()
  @IsString()
  criticalAlerts?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}
