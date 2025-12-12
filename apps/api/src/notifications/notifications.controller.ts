import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SubscribeDto } from './dto/subscribe.dto';
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
}
