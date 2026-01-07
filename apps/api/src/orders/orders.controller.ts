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
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { AttachmentsService } from './attachments.service';
import { GetOrdersDto } from './dto/get-orders.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { SplitOrderDto } from './dto/split-order.dto';
import { CreateOrderEventDto } from './dto/create-order-event.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { RevertOrderDto } from './dto/revert-order.dto';
import { ReassignOrderDto } from './dto/reassign-order.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { BatchSyncDto, BatchSyncResponseDto } from './dto/batch-sync.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';
import * as fs from 'fs';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics by status' })
  @ApiResponse({
    status: 200,
    description: 'Order statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 1234 },
        unassigned: { type: 'number', example: 456 },
        assigned: { type: 'number', example: 234 },
        confirmed: { type: 'number', example: 345 },
        released: { type: 'number', example: 100 },
        dispatched: { type: 'number', example: 50 },
        completed: { type: 'number', example: 40 },
        cancelled: { type: 'number', example: 9 },
        pending: { type: 'number', example: 456 },
      },
    },
  })
  getStats(@Query('branchCode') branchCode: string, @CurrentUser() user: JwtPayload) {
    // Branch-level users can only see their branch stats
    const effectiveBranchCode = user.roles.includes(Role.HQ_ADMIN) ? branchCode : user.branchCode;
    return this.ordersService.getStats(effectiveBranchCode);
  }

  @Get()
  @ApiOperation({ summary: 'Get orders with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Orders list' })
  findAll(@Query() dto: GetOrdersDto, @CurrentUser() user: JwtPayload) {
    // Branch-level users can only see their branch orders
    const branchCode = user.roles.includes(Role.HQ_ADMIN) ? undefined : user.branchCode;
    return this.ordersService.findAll(dto, branchCode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order detail' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.ordersService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.update(id, dto, user.sub);
  }

  @Post('bulk-status')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER, Role.PARTNER_COORDINATOR)
  @ApiOperation({ summary: 'Bulk update order statuses' })
  @ApiResponse({ status: 202, description: 'Bulk update processed' })
  bulkStatusUpdate(@Body() dto: BulkStatusDto, @CurrentUser() user: JwtPayload) {
    return this.ordersService.bulkStatusUpdate(dto, user.sub);
  }

  @Post('batch-sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch sync offline operations',
    description: `Process multiple offline sync operations (CREATE, UPDATE, DELETE) in a single request.
    Each item is processed independently - failures do not rollback other items.
    Returns individual results for each operation including version conflict handling.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Batch sync processed',
    type: BatchSyncResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request payload',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async batchSync(
    @Body() dto: BatchSyncDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BatchSyncResponseDto> {
    return this.ordersService.processBatchSync(dto.items, user.sub);
  }

  @Post(':id/split')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Split order into multiple child orders (FR-10)' })
  @ApiParam({ name: 'id', description: 'Parent order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order split successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        parentOrder: { type: 'object' },
        childOrders: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid split configuration' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  splitOrder(
    @Param('id') id: string,
    @Body() dto: SplitOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.splitOrder(id, dto, user.sub);
  }

  @Post(':id/events')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER, Role.INSTALLER)
  @ApiOperation({
    summary: 'Add special note/remark to order (특이사항)',
    description: 'Append event to order event log. Implements FR-[order-events]',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 201,
    description: 'Event added successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        orderId: { type: 'string' },
        orderNo: { type: 'string', example: 'SO2025121001' },
        event: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            eventType: { type: 'string', example: 'REMARK' },
            note: { type: 'string' },
            createdBy: { type: 'object' },
            createdAt: { type: 'string' },
          },
        },
        totalEvents: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid event data or invalid order status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  addEvent(
    @Param('id') id: string,
    @Body() dto: CreateOrderEventDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.addEvent(id, dto, user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Cancel an order with reason and optional note. Valid statuses: UNASSIGNED, ASSIGNED, CONFIRMED, RELEASED, DISPATCHED, POSTPONED, ABSENT',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        orderId: { type: 'string' },
        orderNo: { type: 'string' },
        previousStatus: { type: 'string', example: 'ASSIGNED' },
        newStatus: { type: 'string', example: 'CANCELLED' },
        cancellationRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            reason: { type: 'string', example: 'CUSTOMER_REQUEST' },
            note: { type: 'string' },
            cancelledBy: { type: 'object' },
            cancelledAt: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid cancellation reason or invalid order status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order already cancelled or version conflict' })
  cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.cancelOrder(id, dto, user.sub);
  }

  @Post(':id/revert')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Revert a cancelled order back to processing',
    description: 'Revert a cancelled order to its previous status or a specified target status. Only cancelled orders can be reverted.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order reverted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        orderId: { type: 'string' },
        orderNo: { type: 'string' },
        previousStatus: { type: 'string', example: 'CANCELLED' },
        newStatus: { type: 'string', example: 'ASSIGNED' },
        revertReason: { type: 'string' },
        previousCancellationReason: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Order is not cancelled or invalid target status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  revertOrder(
    @Param('id') id: string,
    @Body() dto: RevertOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.revertOrder(id, dto, user.sub);
  }

  @Post(':id/reassign')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Reassign order to a new installer/branch/partner',
    description: 'Reassign an order to a different installer, and optionally change branch or partner. Valid for ASSIGNED, CONFIRMED, RELEASED, DISPATCHED, POSTPONED, ABSENT statuses.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order reassigned successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        orderId: { type: 'string' },
        orderNo: { type: 'string' },
        previousAssignment: {
          type: 'object',
          properties: {
            installer: { type: 'object' },
            branch: { type: 'object' },
            partner: { type: 'object' },
          },
        },
        newAssignment: {
          type: 'object',
          properties: {
            installer: { type: 'object' },
            branch: { type: 'object' },
            partner: { type: 'object' },
          },
        },
        reason: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid order status for reassignment' })
  @ApiResponse({ status: 404, description: 'Order, installer, branch, or partner not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  reassignOrder(
    @Param('id') id: string,
    @Body() dto: ReassignOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.reassignOrder(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.HQ_ADMIN)
  @ApiOperation({ summary: 'Delete order (soft delete)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 204, description: 'Order deleted' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersService.remove(id, user.sub);
  }

  // ============================================
  // File Attachments Endpoints
  // ============================================

  @Post(':id/attachments')
  @ApiOperation({ 
    summary: 'Upload file attachment',
    description: 'Upload a file (image/PDF) to an order. Max 5MB, max 10 attachments per order.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        description: {
          type: 'string',
        },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        attachmentId: { type: 'string' },
        fileName: { type: 'string' },
        url: { type: 'string' },
        uploadedAt: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.uploadAttachment(
      id,
      file,
      user.sub,
      dto.description,
    );
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Get all attachments for an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of attachments',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          filename: { type: 'string' },
          mimeType: { type: 'string' },
          fileSize: { type: 'number' },
          description: { type: 'string' },
          uploadedAt: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
  })
  getAttachments(@Param('id') id: string) {
    return this.attachmentsService.getAttachments(id);
  }

  @Get(':id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Download attachment file' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID' })
  @ApiResponse({ status: 200, description: 'File download' })
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentsService.getAttachment(id, attachmentId);
    
    res.setHeader('Content-Type', attachment.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
    
    const fs = await import('fs');
    const fileStream = fs.createReadStream(attachment.storageKey);
    fileStream.pipe(res);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete attachment' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID' })
  @ApiResponse({ status: 204, description: 'Attachment deleted' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentsService.deleteAttachment(id, attachmentId, user.sub);
  }
}
