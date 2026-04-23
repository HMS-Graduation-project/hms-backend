import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class PredictDiseaseDto {
  @ApiProperty({
    description: 'List of patient symptoms',
    example: ['headache', 'fever', 'cough'],
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one symptom is required' })
  @IsString({ each: true })
  symptoms: string[];
}
