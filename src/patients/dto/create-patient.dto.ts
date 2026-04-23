import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Register a patient at the current hospital.
 *
 * Two modes, mutually exclusive:
 *  A) **Link existing national record** — set `nationalPatientId` to the NHID.
 *  B) **Register new national record** — set `nationalPatient.*` demographic
 *     fields; a new NationalPatient will be created, then the PatientProfile.
 *
 * Optional: if `email` + `password` are provided, a User (login) row is
 * created too so the patient can self-service via the portal. Staff-only
 * patients can omit these.
 */
export class CreatePatientDto {
  // ── Mode A: link existing ────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'NHID of the existing national patient to link. If set, nationalPatient fields are ignored.',
  })
  @IsOptional()
  @IsUUID()
  nationalPatientId?: string;

  // ── Mode B: register new — required when nationalPatientId is absent ──

  @ApiPropertyOptional({ description: 'Syrian National ID (11 digits)', example: '99012345678' })
  @ValidateIf((o) => !o.nationalPatientId)
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{11}$/, { message: 'syrianNationalId must be exactly 11 digits' })
  syrianNationalId?: string;

  @ApiPropertyOptional({ description: 'First name (required when creating new national record)' })
  @ValidateIf((o) => !o.nationalPatientId)
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name (required when creating new national record)' })
  @ValidateIf((o) => !o.nationalPatientId)
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstNameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastNameAr?: string;

  @ApiPropertyOptional({ description: 'Date of birth (YYYY-MM-DD) — required for new national record' })
  @ValidateIf((o) => !o.nationalPatientId)
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female', 'Other'] })
  @ValidateIf((o) => !o.nationalPatientId)
  @IsString()
  @IsIn(['Male', 'Female', 'Other'])
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  // ── Optional login credentials ───────────────────────────────────────

  @ApiPropertyOptional({ description: 'Optional email for patient self-service login' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Password, required if email is set', minLength: 6 })
  @ValidateIf((o) => !!o.email)
  @IsString()
  @MinLength(6)
  password?: string;

  // ── Hospital-local clinical fields ───────────────────────────────────

  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional({ example: 'Penicillin' })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}
