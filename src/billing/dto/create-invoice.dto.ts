import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceItemDto {
  @ApiProperty({
    description: 'Line-item description',
    example: 'General consultation',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Item category (CONSULTATION, LAB_TEST, MEDICATION, PROCEDURE)',
    example: 'CONSULTATION',
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
    example: 150.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Patient profile UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({
    description: 'Related appointment UUID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({
    description: 'Invoice line items',
    type: [CreateInvoiceItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @ApiPropertyOptional({
    description: 'Tax amount',
    example: 15.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({
    description: 'Discount amount',
    example: 10.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;
}
