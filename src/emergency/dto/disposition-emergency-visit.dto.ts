import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export const DISPOSITIONS = [
  'DISCHARGED',
  'ADMITTED',
  'TRANSFERRED',
  'LEFT_WITHOUT_BEING_SEEN',
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export class DispositionEmergencyVisitDto {
  @ApiProperty({
    description: 'Final disposition of the ER visit',
    enum: DISPOSITIONS,
  })
  @IsIn(DISPOSITIONS as unknown as string[])
  disposition: Disposition;

  @ApiPropertyOptional({
    description:
      'Summary for discharge instructions, admission reason, or transfer destination',
  })
  @IsOptional()
  @IsString()
  dispositionNotes?: string;
}
