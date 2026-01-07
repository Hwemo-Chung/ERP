import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean, Matches } from 'class-validator';

export class QuietHoursDto {
  @ApiProperty({ description: 'Enable or disable quiet hours' })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ description: 'Start time in HH:MM format (24h)', example: '22:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'start must be in HH:MM format' })
  start?: string;

  @ApiPropertyOptional({ description: 'End time in HH:MM format (24h)', example: '07:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'end must be in HH:MM format' })
  end?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'Asia/Seoul' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdatePreferencesDto {
  @ApiProperty({ description: 'Device ID to update preferences for' })
  @IsString()
  deviceId!: string;

  @ApiPropertyOptional({
    description: 'Categories to enable notifications for',
    type: [String],
    example: ['ORDER_ASSIGNED', 'SETTLEMENT_DEADLINE', 'CUSTOMER_REQUEST']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoriesEnabled?: string[];

  @ApiPropertyOptional({ description: 'Quiet hours configuration' })
  @IsOptional()
  quietHours?: QuietHoursDto;
}

export class PreferencesResponseDto {
  @ApiProperty()
  deviceId!: string;

  @ApiProperty()
  platform!: string;

  @ApiProperty({ type: [String] })
  categoriesEnabled!: string[];

  @ApiPropertyOptional()
  quietHours?: QuietHoursDto;

  @ApiProperty()
  isActive!: boolean;
}
