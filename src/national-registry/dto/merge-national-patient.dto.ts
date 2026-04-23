import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Body for POST /v1/national-registry/patients/:nhid/merge
 * `:nhid` is the WINNER (kept). `loserId` is merged into it and deleted.
 * All PatientProfiles pointing at loser get reassigned to winner.
 */
export class MergeNationalPatientDto {
  @ApiProperty({
    description: 'The NHID whose PatientProfiles will be reassigned and which will then be deleted.',
  })
  @IsUUID()
  loserId: string;
}
