import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export class GetOrdersDto {
  @ApiPropertyOptional({ description: 'Branch code filter' })
  @IsOptional()
  @IsString()
  branchCode?: string;

  @ApiPropertyOptional({ enum: OrderStatus, description: 'Status filter' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Installer ID filter' })
  @IsOptional()
  @IsString()
  installerId?: string;

  @ApiPropertyOptional({ description: 'Appointment date from (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  appointmentDateFrom?: string;

  @ApiPropertyOptional({ description: 'Appointment date to (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  appointmentDateTo?: string;

  @ApiPropertyOptional({ description: 'Customer name search' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Vendor filter' })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({ description: 'Cursor for pagination (cursor-based)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page number for offset-based pagination', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc' = 'asc';
}
