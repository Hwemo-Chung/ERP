import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import {
  PushProviderFactory,
  WebPushProvider,
  FcmProvider,
  ApnsProvider,
} from './push-providers';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    // Push notification providers
    WebPushProvider,
    FcmProvider,
    ApnsProvider,
    PushProviderFactory,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
