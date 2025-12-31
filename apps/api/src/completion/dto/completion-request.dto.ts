import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Line completion data with serial number
 */
export class CompletionLineDto {
  @ApiProperty({
    example: 'line-uuid-001',
    description: 'Order line ID',
  })
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty({
    example: 'ABC1234567890',
    description: 'Serial number for the completed line',
  })
  @IsString()
  @IsNotEmpty()
  serialNumber!: string;
}

/**
 * Waste entry for completion
 */
export class CompletionWasteDto {
  @ApiProperty({
    example: 'P01',
    description: 'Waste code (P01-P21)',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    example: 1,
    description: 'Quantity of waste items',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

/**
 * Complete order request DTO
 * Used for POST /orders/{orderId}/complete
 */
export class CompletionRequestDto {
  @ApiProperty({
    example: 'IN_SU',
    description: 'Target status for completion (IN_SU, IN_PA, etc.)',
  })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({
    type: [CompletionLineDto],
    description: 'Array of line completions with serial numbers',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one line is required' })
  @ValidateNested({ each: true })
  @Type(() => CompletionLineDto)
  lines!: CompletionLineDto[];

  @ApiPropertyOptional({
    type: [CompletionWasteDto],
    description: 'Array of waste pickups',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletionWasteDto)
  waste?: CompletionWasteDto[];

  @ApiPropertyOptional({
    example: 'Installed successfully',
    description: 'Completion notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Version for optimistic locking',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  version?: number;
}

/**
 * Waste pickup request DTO
 * Used for POST /orders/{orderId}/waste
 */
export class WasteLogRequestDto {
  @ApiProperty({
    type: [CompletionWasteDto],
    description: 'Array of waste entries to log',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one waste entry is required' })
  @ValidateNested({ each: true })
  @Type(() => CompletionWasteDto)
  entries!: CompletionWasteDto[];

  @ApiPropertyOptional({
    example: 'Pickup notes',
    description: 'Additional notes for waste pickup',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
