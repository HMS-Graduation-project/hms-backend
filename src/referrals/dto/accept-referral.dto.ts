import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class AcceptReferralDto {
  @ApiPropertyOptional({
    description:
      'DoctorProfile id at the receiving hospital who will take the patient.',
  })
  @IsOptional()
  @IsUUID()
  toDoctorId?: string;

  @ApiPropertyOptional({ description: 'Note to the referring hospital' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  responseNote?: string;
}
