import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDoctorDto {
  // ─── User fields ──────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Doctor email address',
    example: 'dr.smith@hospital.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password (min 6 characters)',
    example: 'securePass1',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Smith',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+201234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  // ─── Doctor profile fields ────────────────────────────────────────────

  @ApiProperty({
    description: 'Medical specialization',
    example: 'Cardiology',
  })
  @IsString()
  specialization: string;

  @ApiProperty({
    description: 'Medical license number (unique)',
    example: 'LIC-2024-00123',
  })
  @IsString()
  licenseNumber: string;

  @ApiPropertyOptional({
    description: 'Department ID to assign the doctor to',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Short biography',
    example: 'Board-certified cardiologist with 15 years of experience.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Years of professional experience',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;

  @ApiPropertyOptional({
    description: 'Consultation fee in base currency',
    example: 250.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;
}
