import { ApiProperty } from '@nestjs/swagger';
import { LabOrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateLabOrderStatusDto {
  @ApiProperty({
    description: 'New lab order status',
    enum: LabOrderStatus,
    example: LabOrderStatus.SAMPLE_COLLECTED,
  })
  @IsEnum(LabOrderStatus)
  status: LabOrderStatus;
}
