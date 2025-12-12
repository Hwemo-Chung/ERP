import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsArray, IsBoolean, IsString } from 'class-validator';

export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export class ExportOptionsDto {
  @ApiProperty({
    enum: ExportFormat,
    description: 'Export file format',
    example: ExportFormat.XLSX,
  })
  @IsEnum(ExportFormat)
  format!: ExportFormat;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional column filter (if not provided, all columns will be exported)',
    example: ['orderNo', 'customerName', 'status', 'appointmentDate'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @ApiProperty({
    description: 'Include timestamp watermark in export',
    default: true,
  })
  @IsBoolean()
  includeTimestamp!: boolean;
}
