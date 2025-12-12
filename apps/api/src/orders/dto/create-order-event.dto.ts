import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength, IsEnum } from 'class-validator';

/**
 * Order Event Types (사건 유형)
 * REMARK: General remarks/notes (일반 비고)
 * ISSUE: Issue or problem reported (문제 사항)
 * REQUEST: Customer special request (고객 요청사항)
 * NOTE: Installation notes (설치 관련 메모)
 */
export enum OrderEventType {
  REMARK = 'REMARK',
  ISSUE = 'ISSUE',
  REQUEST = 'REQUEST',
  NOTE = 'NOTE',
}

/**
 * Create Order Event DTO
 * Used for POST /orders/{orderId}/events
 *
 * Implements FR-[order-events] - Add special notes/remarks to orders
 * Related to frontend addNote() functionality
 */
export class CreateOrderEventDto {
  @ApiProperty({
    enum: OrderEventType,
    example: OrderEventType.REMARK,
    description: 'Type of event (REMARK, ISSUE, REQUEST, NOTE)',
  })
  @IsEnum(OrderEventType)
  @IsNotEmpty()
  eventType!: OrderEventType;

  @ApiProperty({
    example: '고객이 확장형 거실 설치를 요청함. 기술 난이도 높음.',
    description: 'Detailed note or remark (특이사항)',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Expected version for optimistic locking (optional)',
  })
  expectedVersion?: number;
}
