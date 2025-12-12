import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PeriodDto {
  @ApiProperty({ example: '2025-12-01T00:00:00.000Z', description: 'Period start date' })
  start!: Date;

  @ApiProperty({ example: '2025-12-31T23:59:59.999Z', description: 'Period end date' })
  end!: Date;
}

export class KpiSummaryDto {
  @ApiProperty({
    example: 95.5,
    description: 'Customer satisfaction percentage',
  })
  @IsNumber()
  customerSatisfaction!: number;

  @ApiProperty({
    example: 92.3,
    description: 'Appointment compliance percentage',
  })
  @IsNumber()
  appointmentCompliance!: number;

  @ApiProperty({
    example: 87.8,
    description: 'Waste recovery rate percentage',
  })
  @IsNumber()
  wasteRecoveryRate!: number;

  @ApiProperty({
    example: 2.5,
    description: 'Installation defect rate percentage',
  })
  @IsNumber()
  installationDefectRate!: number;

  @ApiProperty({
    example: 1500,
    description: 'Total number of orders',
  })
  @IsNumber()
  totalOrders!: number;

  @ApiProperty({
    example: 1350,
    description: 'Number of completed orders',
  })
  @IsNumber()
  completedOrders!: number;

  @ApiProperty({
    type: PeriodDto,
    description: 'Report period',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PeriodDto)
  period!: PeriodDto;
}
