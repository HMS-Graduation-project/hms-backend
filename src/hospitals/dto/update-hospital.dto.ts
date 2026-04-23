import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateHospitalDto } from './create-hospital.dto';

/** Code is immutable; every other field is optional on update. */
export class UpdateHospitalDto extends PartialType(
  OmitType(CreateHospitalDto, ['code'] as const),
) {}
