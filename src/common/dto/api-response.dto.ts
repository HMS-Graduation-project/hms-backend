import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ description: 'Response payload' })
  data: T;

  @ApiPropertyOptional({ description: 'Human-readable message' })
  message?: string;

  constructor(data: T, message?: string) {
    this.data = data;
    this.message = message;
  }

  static success<T>(data: T, message?: string): ApiResponseDto<T> {
    return new ApiResponseDto(data, message);
  }
}
