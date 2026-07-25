import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType) type!: TransactionType;
  @IsUUID() partnerId!: string;
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsDateString() transactionDate!: string;
  @IsOptional() @IsUUID() vehicleRateId?: string;
}
