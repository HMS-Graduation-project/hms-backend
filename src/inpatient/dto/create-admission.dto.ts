import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

/**
 * Admit a patient — either from Emergency, OPD, or direct admission.
 * A bed is optional at creation: admission can be "floating" (pending bed
 * allocation). Typical flow is to allocate a bed immediately.
 */
export class CreateAdmissionDto {
  @ApiProperty({ description: 'PatientProfile id at this hospital' })
  @IsUUID()
  patientProfileId: string;

  @ApiProperty({ description: 'DoctorProfile id of the admitting doctor' })
  @IsUUID()
  admittingDoctorId: string;

  @ApiPropertyOptional({
    description: 'Bed to allocate at admission. If omitted, admission is pending bed allocation.',
  })
  @IsOptional()
  @IsUUID()
  bedId?: string;

  @ApiPropertyOptional({ example: 'Community-acquired pneumonia' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'Transferred from ER after stabilization' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  reason?: string;
}
