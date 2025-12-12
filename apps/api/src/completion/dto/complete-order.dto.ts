import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  IsDateString,
  ArrayMinSize
} from 'class-validator';
import { Type } from 'class-transformer';
import { WastePickupDto } from './waste-pickup.dto';

export class CompleteOrderDto {
  @ApiProperty({
    type: [String],
    example: ['ABC1234567890', 'DEF0987654321'],
    description: 'Serial numbers for each order line'
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one serial number is required' })
  @IsString({ each: true })
  serialNumbers!: string[];

  @ApiProperty({
    type: [WastePickupDto],
    example: [
      { code: 'P01', quantity: 1 },
      { code: 'P03', quantity: 2 }
    ],
    description: 'Waste items picked up during completion'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastePickupDto)
  wastePickups!: WastePickupDto[];

  @ApiPropertyOptional({
    example: 'Customer requested installation on balcony',
    description: 'Additional notes or remarks'
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: '2025-12-12T15:30:00.000Z',
    description: 'Completion timestamp (for offline completions)'
  })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiProperty({
    example: 1,
    description: 'Current version for optimistic locking',
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  version!: number;
}
