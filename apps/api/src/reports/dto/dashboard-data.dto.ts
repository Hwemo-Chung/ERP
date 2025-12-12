import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KpiSummaryDto } from './kpi-summary.dto';

export class StatusBreakdownDto {
  @ApiProperty({ example: 'COMPLETED', description: 'Order status' })
  @IsString()
  status!: string;

  @ApiProperty({ example: 250, description: 'Count of orders in this status' })
  @IsNumber()
  count!: number;
}

export class InstallerProgressDto {
  @ApiProperty({
    example: 'uuid-installer-1',
    description: 'Installer ID',
  })
  @IsString()
  installerId!: string;

  @ApiProperty({ example: 'John Doe', description: 'Installer name' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 45,
    description: 'Number of completed orders',
  })
  @IsNumber()
  completed!: number;

  @ApiProperty({
    example: 50,
    description: 'Total number of assigned orders',
  })
  @IsNumber()
  total!: number;
}

export class RecentActivityDto {
  @ApiProperty({
    example: 'uuid-order-1',
    description: 'Order ID',
  })
  @IsString()
  orderId!: string;

  @ApiProperty({
    example: 'Order completed',
    description: 'Activity action description',
  })
  @IsString()
  action!: string;

  @ApiProperty({
    example: '2025-12-12T10:30:00.000Z',
    description: 'Activity timestamp',
  })
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;
}

export class DashboardDataDto {
  @ApiProperty({
    type: KpiSummaryDto,
    description: 'KPI summary metrics',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => KpiSummaryDto)
  kpi!: KpiSummaryDto;

  @ApiProperty({
    type: [StatusBreakdownDto],
    description: 'Breakdown of orders by status',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusBreakdownDto)
  statusBreakdown!: StatusBreakdownDto[];

  @ApiProperty({
    type: [InstallerProgressDto],
    description: 'Progress summary for each installer',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallerProgressDto)
  installerProgress!: InstallerProgressDto[];

  @ApiProperty({
    type: [RecentActivityDto],
    description: 'Recent activity log',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecentActivityDto)
  recentActivity!: RecentActivityDto[];
}
