import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ShipmentListQueryDto {
  // Optional at the DTO level like GetTransactionsDto — PARTNER_COORDINATOR never has to send
  // it (the controller forces it to their own partnerId either way); HQ_ADMIN/WAREHOUSE_STAFF
  // must supply it explicitly (the controller 400s if they don't).
  @ApiPropertyOptional({ description: 'Partner id (forced to caller partnerId for PARTNER_COORDINATOR)' })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Filter from transaction date (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to transaction date (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
