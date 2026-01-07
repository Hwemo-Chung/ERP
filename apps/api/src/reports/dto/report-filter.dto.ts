import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';

export enum ReportLevel {
  NATION = 'nation',
  BRANCH = 'branch',
  INSTALLER = 'installer',
}

export enum ReportType {
  UNCOMPLETED = 'uncompleted',
  COMPLETED = 'completed',
  ECOAS = 'ecoas',
  WASTE = 'waste',
}

export class ReportFilterDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Branch ID filter' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Installer ID filter' })
  @IsOptional()
  @IsString()
  installerId?: string;

  @ApiPropertyOptional({
    enum: ReportLevel,
    description: 'Report aggregation level',
  })
  @IsOptional()
  @IsEnum(ReportLevel)
  level?: ReportLevel;

  @ApiPropertyOptional({
    enum: ReportType,
    description: 'Report type',
  })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;
}
