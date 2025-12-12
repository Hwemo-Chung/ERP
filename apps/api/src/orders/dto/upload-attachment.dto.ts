/**
 * Upload Attachment DTO
 * For file uploads with metadata
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UploadAttachmentDto {
  @ApiPropertyOptional({ 
    description: 'Description or notes for the attachment'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
