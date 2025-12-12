/**
 * Settlement Controller
 * REST endpoints for settlement period management
 *
 * Endpoints:
 * - GET /settlement/current - Get current settlement period
 * - GET /settlement/history - Get settlement period history
 * - POST /settlement/:id/lock - Lock a settlement period (BRANCH_MANAGER+)
 * - POST /settlement/:id/unlock - Unlock a settlement period (HQ_ADMIN only)
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

@ApiTags('Settlement')
@Controller('settlement')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * Get current settlement period for the user's branch
   * Returns the most recent period (OPEN or LOCKED)
   */
  @Get('current')
  @ApiOperation({ summary: 'Get current settlement period' })
  @ApiResponse({
    status: 200,
    description: 'Current settlement period',
    schema: {
      example: {
        id: 'uuid',
        branchId: 'uuid',
        periodStart: '2025-01-06',
        periodEnd: '2025-01-12',
        status: 'LOCKED',
        lockedBy: 'uuid',
        lockedAt: '2025-01-13T09:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No settlement period found' })
  async getCurrentPeriod(@CurrentUser() user: JwtPayload) {
    // HQ_ADMIN can query any branch, others see their own branch only
    const branchId = user.branchId;

    if (!branchId) {
      return { message: 'User has no branch assigned' };
    }

    return this.settlementService.getCurrentPeriod(branchId);
  }

  /**
   * Get settlement period history with pagination
   * Supports cursor-based pagination
   */
  @Get('history')
  @ApiOperation({ summary: 'Get settlement period history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of records to return (default: 20)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for pagination (period ID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Settlement period history',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            branchId: 'uuid',
            periodStart: '2025-01-06',
            periodEnd: '2025-01-12',
            status: 'LOCKED',
            lockedBy: 'uuid',
            lockedAt: '2025-01-13T09:00:00Z',
          },
        ],
        totalCount: 10,
      },
    },
  })
  async getPeriodHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    const branchId = user.branchId;

    if (!branchId) {
      return { data: [], totalCount: 0 };
    }

    return this.settlementService.getPeriodHistory(
      branchId,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  /**
   * Lock a settlement period
   * Requires: BRANCH_MANAGER or higher
   * Transition: OPEN → LOCKED
   */
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.BRANCH_MANAGER, Role.HQ_ADMIN)
  @ApiOperation({ summary: 'Lock a settlement period' })
  @ApiParam({ name: 'id', description: 'Settlement period ID' })
  @ApiResponse({ status: 200, description: 'Period locked successfully' })
  @ApiResponse({ status: 400, description: 'Period is already locked' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  async lockPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settlementService.lockPeriod(id, user.sub);
  }

  /**
   * Unlock a settlement period
   * Requires: HQ_ADMIN only (enforced by @Roles decorator)
   * Transition: LOCKED → OPEN
   *
   * Use case: Manual unlock for corrections or adjustments
   */
  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.HQ_ADMIN)
  @ApiOperation({ summary: 'Unlock a settlement period (HQ_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Settlement period ID' })
  @ApiResponse({ status: 200, description: 'Period unlocked successfully' })
  @ApiResponse({ status: 400, description: 'Period is already unlocked' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  @ApiResponse({ status: 403, description: 'Only HQ_ADMIN can unlock' })
  async unlockPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settlementService.unlockPeriod(id, user.sub);
  }

  /**
   * Get settlement period by ID
   * For debugging or specific period lookup
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get settlement period by ID' })
  @ApiParam({ name: 'id', description: 'Settlement period ID' })
  @ApiResponse({ status: 200, description: 'Settlement period details' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  async getPeriodById(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlementService.getPeriodById(id);
  }
}
