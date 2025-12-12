import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsOptional, IsDateString } from 'class-validator';

export class CaptureSerialDto {
  @ApiProperty({
    example: 'cly8x9z0a0001jy0g2h3k4l5m',
    description: 'Order line ID'
  })
  @IsString()
  @IsNotEmpty()
  orderLineId!: string;

  @ApiProperty({
    example: 'ABC1234567890',
    description: 'Serial number (10-20 alphanumeric characters)',
    pattern: '^[A-Za-z0-9]{10,20}$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9]{10,20}$/, {
    message: 'Serial number must be 10-20 alphanumeric characters'
  })
  serialNumber!: string;

  @ApiPropertyOptional({
    example: '2025-12-12T10:30:00.000Z',
    description: 'Capture timestamp (for offline captures)'
  })
  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}
