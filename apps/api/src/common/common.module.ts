import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PROVIDER } from './constants';
import { RedisLockService } from './services/redis-lock.service';

/**
 * Common Module
 *
 * Provides shared services and utilities across the application.
 * Marked as @Global() to make Redis client available throughout the app.
 *
 * Exports:
 * - REDIS_PROVIDER: ioredis client instance
 * - RedisLockService: Distributed lock service
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_PROVIDER,
      useFactory: (configService: ConfigService): Redis => {
        const redisUrl = configService.get<string>('redis.url');
        return new Redis(redisUrl || 'redis://localhost:6379');
      },
      inject: [ConfigService],
    },
    RedisLockService,
  ],
  exports: [REDIS_PROVIDER, RedisLockService],
})
export class CommonModule {}
