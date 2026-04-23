import { PartialType } from '@nestjs/swagger';
import { CreateNationalPatientDto } from './create-national-patient.dto';

export class UpdateNationalPatientDto extends PartialType(CreateNationalPatientDto) {}
