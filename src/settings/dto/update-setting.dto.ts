import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({
    description: 'Setting key',
    example: 'clinic_name',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'Setting value',
    example: 'HMS General Hospital',
  })
  @IsString()
  @IsNotEmpty()
  value: string;
}
