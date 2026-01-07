import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, IsObject } from 'class-validator';
import { Platform, PushProvider } from '@prisma/client';

export class SubscribeDto {
  @ApiProperty({ example: 'A1B2C3D4' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform!: Platform;

  @ApiProperty({ enum: PushProvider })
  @IsEnum(PushProvider)
  pushProvider!: PushProvider;

  @ApiProperty({ description: 'Push token data (endpoint, keys, etc.)' })
  @IsObject()
  token!: Record<string, unknown>;

  @ApiProperty({ type: [String], example: ['REASSIGN', 'DELAY'] })
  @IsArray()
  @IsString({ each: true })
  categoriesEnabled!: string[];
}
