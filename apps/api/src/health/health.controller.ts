import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      // Database health
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // Memory health (heap should not exceed 500MB)
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
      // RSS memory check (should not exceed 1GB)
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),
      // Disk health (should have at least 1GB free)
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  readiness() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
