import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum CancellationReason {
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  DUPLICATE_ORDER = 'DUPLICATE_ORDER',
  OTHER = 'OTHER',
}

export class CancelOrderDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    enum: CancellationReason,
    example: CancellationReason.CUSTOMER_REQUEST,
  })
  @IsEnum(CancellationReason)
  @IsNotEmpty()
  reason!: CancellationReason;

  @ApiProperty({
    description: 'Detailed cancellation note (optional)',
    example: '고객 요청으로 인한 취소',
    minLength: 0,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MinLength(0)
  @MaxLength(1000)
  note?: string;

  @ApiProperty({
    description: 'Expected order version for optimistic locking (optional)',
    example: 1,
  })
  @IsOptional()
  expectedVersion?: number;
}
