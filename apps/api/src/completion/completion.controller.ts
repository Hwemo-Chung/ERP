/**
 * Completion Controller
 * Endpoints for order completion and waste tracking
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { CompletionService } from './completion.service';
import { AmendCompletionDto } from './dto/amend-completion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

interface User {
  id: string;
}

@Controller('orders/:orderId')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Completion')
@ApiBearerAuth('JWT-auth')
export class CompletionController {
  private readonly logger = new Logger(CompletionController.name);

  constructor(private readonly completionService: CompletionService) {}

  /**
   * POST /orders/{orderId}/complete
   * Complete order with serial numbers and waste
   *
   * Request body:
   * {
   *   "status": "IN_SU",
   *   "lines": [
   *     { "lineId": "ln1", "serialNumber": "ABC1234567" }
   *   ],
   *   "waste": [
   *     { "code": "P01", "quantity": 1 }
   *   ],
   *   "notes": "Installed successfully"
   * }
   *
   * Response: 200 OK with completion details
   */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @Roles('INSTALLER', 'BRANCH_MANAGER', 'HQ_ADMIN')
  async completeOrder(
    @Param('orderId') orderId: string,
    @Body() dto: any,
    @CurrentUser() user: User,
  ): Promise<any> {
    this.logger.log(
      `Completion requested for order ${orderId} by user ${user.id}`,
    );

    // Validate request
    if (!dto.lines || !Array.isArray(dto.lines)) {
      throw new Error('lines must be an array');
    }

    return this.completionService.completeOrder(orderId, dto, user.id);
  }

  /**
   * POST /orders/{orderId}/waste
   * Log waste pickup entries (separate from completion)
   *
   * Request body:
   * {
   *   "entries": [
   *     { "code": "P01", "quantity": 1 }
   *   ],
   *   "notes": "Pickup notes"
   * }
   */
  @Post('waste')
  @HttpCode(HttpStatus.CREATED)
  @Roles('INSTALLER', 'BRANCH_MANAGER', 'HQ_ADMIN')
  async logWaste(
    @Param('orderId') orderId: string,
    @Body() dto: any,
    @CurrentUser() user: User,
  ): Promise<any> {
    this.logger.log(`Waste pickup logged for order ${orderId}`);

    return this.completionService.logWastePickup(orderId, dto, user.id);
  }

  /**
   * PATCH /orders/{orderId}/completion
   * Amend completion data (serial numbers or waste) after initial completion
   */
  @Patch('completion')
  @HttpCode(HttpStatus.OK)
  @Roles('INSTALLER', 'BRANCH_MANAGER', 'HQ_ADMIN')
  @ApiOperation({ 
    summary: 'Amend completion data',
    description: 'Modify serial numbers or waste pickup entries after initial completion. Requires reason for audit trail.'
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  async amendCompletion(
    @Param('orderId') orderId: string,
    @Body() dto: AmendCompletionDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    this.logger.log(
      `Completion amendment requested for order ${orderId} by user ${user.id}`,
    );

    return this.completionService.amendCompletion(orderId, dto, user.id);
  }

  /**
   * GET /orders/{orderId}/completion
   * Get completion details including serials and waste
   */
  @Get('completion')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get completion details by order ID' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  async getCompletion(@Param('orderId') orderId: string): Promise<any> {
    return this.completionService.getCompletionDetails(orderId);
  }
}
