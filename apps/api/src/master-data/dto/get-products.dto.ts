import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsUUID, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetProductsDto {
  @ApiPropertyOptional({ description: 'Filter by partner id' })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Filter by category id' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Search by product name or code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  pageSize?: number;
}
