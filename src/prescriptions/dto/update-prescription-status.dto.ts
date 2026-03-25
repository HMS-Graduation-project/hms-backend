import { ApiProperty } from '@nestjs/swagger';
import { PrescriptionStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePrescriptionStatusDto {
  @ApiProperty({
    description: 'New prescription status',
    enum: PrescriptionStatus,
    example: PrescriptionStatus.DISPENSED,
  })
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;
}
