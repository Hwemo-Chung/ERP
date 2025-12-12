import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class RevertOrderDto {
  @ApiProperty({
    description: 'Target status to revert to (optional, defaults to previous status)',
    enum: OrderStatus,
    example: OrderStatus.ASSIGNED,
    required: false,
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  targetStatus?: OrderStatus;

  @ApiProperty({
    description: 'Reason for reverting the cancellation',
    example: '고객이 재주문을 요청하여 취소를 철회함',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @ApiProperty({
    description: 'Expected order version for optimistic locking (optional)',
    example: 2,
  })
  @IsOptional()
  expectedVersion?: number;
}
