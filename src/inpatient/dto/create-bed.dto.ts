import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BedStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateBedDto {
  @ApiProperty({ description: 'Ward this bed belongs to' })
  @IsUUID()
  wardId: string;

  @ApiProperty({ example: 'A-12', description: 'Bed identifier within the ward' })
  @IsString()
  @Length(1, 30)
  number: string;

  @ApiPropertyOptional({ enum: BedStatus, default: BedStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(BedStatus)
  status?: BedStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
