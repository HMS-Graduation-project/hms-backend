import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePatientDto {
  // ── User fields (no email, password, or role) ────────────────────────

  @ApiPropertyOptional({ description: 'First name', example: 'Ahmed' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Hassan' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+201012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Gender', example: 'male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: 'Date of birth (ISO 8601)',
    example: '1990-05-15',
  })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Address', example: '123 Main St, Cairo' })
  @IsOptional()
  @IsString()
  address?: string;

  // ── Patient profile fields ───────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Blood type', example: 'O+' })
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional({
    description: 'Known allergies',
    example: 'Penicillin, Peanuts',
  })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact name',
    example: 'Sara Hassan',
  })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact phone',
    example: '+201098765432',
  })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    description: 'Relation to emergency contact',
    example: 'Spouse',
  })
  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  @ApiPropertyOptional({
    description: 'Insurance provider name',
    example: 'National Health Insurance',
  })
  @IsOptional()
  @IsString()
  insuranceProvider?: string;

  @ApiPropertyOptional({
    description: 'Insurance policy number',
    example: 'NHI-2024-00123',
  })
  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @ApiPropertyOptional({
    description: 'Medical notes',
    example: 'Chronic hypertension, controlled with medication',
  })
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}
