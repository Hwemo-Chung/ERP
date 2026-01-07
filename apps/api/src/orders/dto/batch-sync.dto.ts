import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsObject,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Sync operation type for batch processing
 */
export enum SyncOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Single batch sync item representing one offline operation
 */
export class BatchSyncItemDto {
  @ApiProperty({
    enum: SyncOperationType,
    description: 'Type of sync operation',
    example: 'UPDATE',
  })
  @IsEnum(SyncOperationType)
  type!: SyncOperationType;

  @ApiProperty({
    description: 'Entity ID for the order being synced',
    example: 'order-123-uuid',
  })
  @IsString()
  entityId!: string;

  @ApiProperty({
    description: 'Payload containing the order data',
    example: { status: 'COMPLETED', remarks: 'Installed successfully' },
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({
    description: 'Client-side timestamp (Unix ms) when this operation was created',
    example: 1704067200000,
  })
  @IsNumber()
  @Min(0)
  clientTimestamp!: number;

  @ApiPropertyOptional({
    description: 'Expected version for optimistic locking (for UPDATE operations)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  expectedVersion?: number;
}

/**
 * Maximum number of items allowed in a single batch sync request.
 * This limit prevents memory exhaustion and ensures predictable response times.
 */
export const BATCH_SYNC_MAX_ITEMS = 100;

/**
 * Batch sync request DTO
 *
 * @description Accepts up to 100 items per request to prevent memory issues
 * and ensure predictable processing times. For larger syncs, chunk into
 * multiple requests on the client side.
 */
export class BatchSyncDto {
  @ApiProperty({
    type: [BatchSyncItemDto],
    description: `Array of sync items to process (max ${BATCH_SYNC_MAX_ITEMS} items)`,
    maxItems: BATCH_SYNC_MAX_ITEMS,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one sync item is required' })
  @ArrayMaxSize(BATCH_SYNC_MAX_ITEMS, {
    message: `Batch size cannot exceed ${BATCH_SYNC_MAX_ITEMS} items. Please chunk your requests.`,
  })
  @ValidateNested({ each: true })
  @Type(() => BatchSyncItemDto)
  items!: BatchSyncItemDto[];
}

/**
 * Result of a single batch sync item
 */
export class BatchSyncResultDto {
  @ApiProperty({
    description: 'Entity ID that was processed',
    example: 'order-123-uuid',
  })
  entityId!: string;

  @ApiProperty({
    description: 'Whether this item was processed successfully',
    example: true,
  })
  success!: boolean;

  @ApiPropertyOptional({
    description: 'Error code if the operation failed',
    example: 'E2006',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Human-readable error message',
    example: 'Version conflict detected',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Current server state of the entity (useful for conflict resolution)',
    example: { id: 'order-123', status: 'COMPLETED', version: 2 },
  })
  serverState?: unknown;
}

/**
 * Batch sync response summary
 */
export class BatchSyncResponseDto {
  @ApiProperty({
    description: 'Total number of items processed',
    example: 10,
  })
  totalProcessed!: number;

  @ApiProperty({
    description: 'Number of successful operations',
    example: 8,
  })
  successCount!: number;

  @ApiProperty({
    description: 'Number of failed operations',
    example: 2,
  })
  failureCount!: number;

  @ApiProperty({
    type: [BatchSyncResultDto],
    description: 'Individual results for each sync item',
  })
  results!: BatchSyncResultDto[];
}
