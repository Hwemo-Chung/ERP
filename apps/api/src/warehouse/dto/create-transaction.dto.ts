import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AdjustmentReason, TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType) type!: TransactionType;
  @IsUUID() partnerId!: string;
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsDateString() transactionDate!: string;
  @IsOptional() @IsUUID() vehicleRateId?: string;
  @ValidateIf((dto: CreateTransactionDto) => dto.type.startsWith('ADJUSTMENT_'))
  @IsEnum(AdjustmentReason)
  adjustmentReason?: AdjustmentReason;
  @ValidateIf((dto: CreateTransactionDto) => dto.adjustmentReason === 'OTHER')
  @IsString()
  @MaxLength(300)
  adjustmentNote?: string;
}
