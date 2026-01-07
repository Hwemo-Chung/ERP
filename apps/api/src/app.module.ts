import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { CompletionModule } from './completion/completion.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { MetadataModule } from './metadata/metadata.module';
import { HealthModule } from './health/health.module';
import { SettlementModule } from './settlement/settlement.module';
import { JobsModule } from './jobs/jobs.module';
import { EventsModule } from './events/events.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 60,
      },
      {
        name: 'auth',
        ttl: 60000, // 1 minute
        limit: 5,
      },
    ]),

    // BullMQ for async job processing
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        url: configService.get<string>('redis.url'),
      }),
    }),

    // Common module (Redis, distributed lock)
    CommonModule,

    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    CompletionModule,
    NotificationsModule,
    ReportsModule,
    MetadataModule,
    HealthModule,
    SettlementModule,
    JobsModule,
    EventsModule,
  ],
})
export class AppModule {}
