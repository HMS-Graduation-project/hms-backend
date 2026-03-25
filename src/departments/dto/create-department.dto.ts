import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    description: 'Department name (must be unique)',
    example: 'Cardiology',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Short description of the department',
    example: 'Heart and cardiovascular care',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Floor or building location',
    example: '3rd Floor, Building A',
  })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({
    description: 'Department phone number',
    example: '+20-2-1234-5678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'UUID of the head doctor (must reference an existing user)',
    example: 'b3d7c1e0-5a9f-4b2e-8c1d-3f4a5b6c7d8e',
  })
  @IsOptional()
  @IsUUID()
  headDoctorId?: string;
}
