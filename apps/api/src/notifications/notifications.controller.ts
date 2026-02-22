import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SubscribeDto } from './dto/subscribe.dto';
import { UpdatePreferencesDto, PreferencesResponseDto } from './dto/preferences.dto';
import { NotificationStatus } from '@prisma/client';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe device for push notifications' })
  subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.subscribe(user.sub, dto);
  }

  @Delete('subscribe/:subscriptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe device' })
  unsubscribe(@Param('subscriptionId') subscriptionId: string) {
    return this.notificationsService.unsubscribe(subscriptionId);
  }

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: string,
    @Query('status') status?: NotificationStatus,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.getNotifications(user.sub, {
      category,
      status,
      limit,
      cursor,
    });
  }

  @Patch(':id/ack')
  @ApiOperation({ summary: 'Mark notification as read' })
  acknowledge(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.acknowledge(id, user.sub);
  }

  @Get('preferences')
  @ApiOperation({
    summary: 'Get notification preferences for a device',
    description:
      'Retrieves the notification preferences including enabled categories and quiet hours settings',
  })
  @ApiQuery({ name: 'deviceId', required: true, description: 'Device ID to get preferences for' })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
    type: PreferencesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Subscription not found for device' })
  getPreferences(@CurrentUser() user: JwtPayload, @Query('deviceId') deviceId: string) {
    if (!deviceId) {
      throw new BadRequestException('deviceId query parameter is required');
    }
    return this.notificationsService.getPreferences(user.sub, deviceId);
  }

  @Put('preferences')
  @ApiOperation({
    summary: 'Update notification preferences',
    description:
      'Update notification preferences for a specific device including enabled categories and quiet hours',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: PreferencesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Subscription not found for device' })
  updatePreferences(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePreferencesDto) {
    return this.notificationsService.updatePreferences(user.sub, dto);
  }
}
