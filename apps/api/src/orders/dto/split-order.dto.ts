import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Assignment for a split order line
 */
export class SplitAssignmentDto {
  @ApiProperty({
    example: 'installer_uuid_001',
    description: 'Installer ID for this assignment (optional for unassigned splits)',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  installerId?: string;

  @ApiProperty({
    example: '김철수',
    description: 'Installer name for display',
  })
  @IsString()
  @IsNotEmpty()
  installerName!: string;

  @ApiProperty({
    example: 5,
    description: 'Quantity to assign to this installer',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

/**
 * Split information for a single order line
 */
export class SplitLineDto {
  @ApiProperty({
    example: 'line_uuid_001',
    description: 'Order line ID to split',
  })
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty({
    type: [SplitAssignmentDto],
    description: 'Assignments for this line (must sum to line quantity)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitAssignmentDto)
  @ArrayMinSize(1)
  assignments!: SplitAssignmentDto[];
}

/**
 * Request to split an order into multiple child orders
 * FR-10: Split order workflow
 */
export class SplitOrderDto {
  @ApiProperty({
    example: 'order_uuid_001',
    description: 'Parent order ID to split',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    type: [SplitLineDto],
    description: 'Split configuration for each order line',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitLineDto)
  @ArrayMinSize(1)
  splits!: SplitLineDto[];

  @ApiProperty({
    example: 3,
    description: 'Optimistic locking version',
  })
  @IsNumber()
  version!: number;
}
