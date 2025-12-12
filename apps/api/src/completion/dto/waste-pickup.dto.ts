import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsDateString, Matches } from 'class-validator';

export class WastePickupDto {
  @ApiProperty({
    example: 'P01',
    description: 'Waste code (P01-P21)',
    pattern: '^P(0[1-9]|1[0-9]|2[0-1])$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^P(0[1-9]|1[0-9]|2[0-1])$/, {
    message: 'Waste code must be in format P01-P21'
  })
  code!: string;

  @ApiProperty({
    example: 1,
    description: 'Quantity of waste items picked up',
    minimum: 1
  })
  @IsNumber()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;

  @ApiPropertyOptional({
    example: '2025-12-12T10:30:00.000Z',
    description: 'Collection timestamp (for offline captures)'
  })
  @IsOptional()
  @IsDateString()
  collectedAt?: string;
}
