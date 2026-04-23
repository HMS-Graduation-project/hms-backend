import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DispenseDto {
  @ApiProperty({
    description: 'ID of the prescription being dispensed',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty()
  @IsUUID()
  prescriptionId: string;

  @ApiProperty({
    description: 'ID of the medication to dispense',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsNotEmpty()
  @IsUUID()
  medicationId: string;

  @ApiProperty({
    description: 'Quantity to dispense (must be at least 1)',
    example: 2,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}
