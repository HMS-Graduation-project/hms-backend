import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class TransferBedDto {
  @ApiProperty({ description: 'Target bed' })
  @IsUUID()
  toBedId: string;

  @ApiPropertyOptional({ example: 'Upgraded to ICU after deterioration' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
