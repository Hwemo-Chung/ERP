import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReassignOrderDto {
  @ApiProperty({
    description: 'New installer ID',
    example: 'uuid-installer-002',
  })
  @IsUUID()
  @IsNotEmpty()
  newInstallerId!: string;

  @ApiProperty({
    description: 'New branch ID (optional, if changing branch)',
    example: 'uuid-branch-002',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  newBranchId?: string;

  @ApiProperty({
    description: 'New partner/center ID (optional, if changing partner)',
    example: 'uuid-partner-002',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  newPartnerId?: string;

  @ApiProperty({
    description: 'Reason for reassignment',
    example: '기존 설치자 휴가로 인한 긴급 재배정',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @ApiProperty({
    description: 'Expected order version for optimistic locking (optional)',
    example: 1,
  })
  @IsOptional()
  expectedVersion?: number;
}
