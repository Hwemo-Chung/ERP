import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, IsBoolean } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Installer ID' })
  @IsOptional()
  @IsString()
  installerId?: string;

  @ApiPropertyOptional({ description: 'Partner ID' })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'New appointment date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  appointmentDate?: string;

  @ApiPropertyOptional({ description: 'Reason for appointment change' })
  @IsOptional()
  @IsString()
  appointmentChangeReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Reason code for status change' })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional({ description: 'Notes for status change' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Expected version for optimistic locking' })
  @IsOptional()
  @IsInt()
  expectedVersion?: number;

  // Context flags for state machine validation
  @ApiPropertyOptional({ description: 'Whether serial numbers are captured' })
  @IsOptional()
  @IsBoolean()
  serialsCaptured?: boolean;

  @ApiPropertyOptional({ description: 'Whether waste pickup is logged' })
  @IsOptional()
  @IsBoolean()
  wastePickupLogged?: boolean;
}
