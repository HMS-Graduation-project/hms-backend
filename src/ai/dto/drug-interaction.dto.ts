import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class DrugInteractionDto {
  @ApiProperty({
    description: 'List of medication names to check for interactions',
    example: ['aspirin', 'warfarin'],
    type: [String],
    minItems: 2,
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'At least two medications are required to check interactions' })
  @IsString({ each: true })
  medications: string[];
}
