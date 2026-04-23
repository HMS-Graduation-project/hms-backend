import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AddInvoiceItemDto {
  @ApiProperty({
    description: 'Line-item description',
    example: 'Blood test - CBC',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Item category (CONSULTATION, LAB_TEST, MEDICATION, PROCEDURE)',
    example: 'LAB_TEST',
  })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ description: 'Quantity', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Unit price in decimal',
    example: 75.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;
}
