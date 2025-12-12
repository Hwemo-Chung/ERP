/**
 * Amend Completion DTO
 * For modifying completion data after initial completion
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

class AmendSerialNumberDto {
  @ApiProperty({ description: 'Line ID' })
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty({ description: 'Serial number' })
  @IsString()
  @IsNotEmpty()
  serialNumber!: string;
}

class AmendWasteDto {
  @ApiProperty({ description: 'Waste code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNotEmpty()
  quantity!: number;
}

export class AmendCompletionDto {
  @ApiPropertyOptional({ 
    description: 'Updated serial numbers',
    type: [AmendSerialNumberDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AmendSerialNumberDto)
  serials?: AmendSerialNumberDto[];

  @ApiPropertyOptional({
    description: 'Updated waste pickup entries',
    type: [AmendWasteDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AmendWasteDto)
  waste?: AmendWasteDto[];

  @ApiProperty({ 
    description: 'Reason for amendment',
    example: 'Corrected serial number typo'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ 
    description: 'Additional notes for the amendment'
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
