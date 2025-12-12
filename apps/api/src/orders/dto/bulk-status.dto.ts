import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class BulkStatusDto {
  @ApiProperty({ type: [String], description: 'Array of order IDs' })
  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({ description: 'Installer ID for assignment' })
  @IsOptional()
  @IsString()
  installerId?: string;

  @ApiPropertyOptional({ description: 'Reason code' })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
