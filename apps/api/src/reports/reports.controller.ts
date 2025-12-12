import { Controller, Get, Post, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get KPI summary' })
  @ApiQuery({ name: 'level', enum: ['nation', 'branch', 'installer'] })
  @ApiQuery({ name: 'branchCode', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  getSummary(
    @Query('level') level: 'nation' | 'branch' | 'installer',
    @Query('branchCode') branchCode?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    // Restrict to own branch for non-HQ users
    const effectiveBranch = user?.roles.includes(Role.HQ_ADMIN)
      ? branchCode
      : user?.branchCode || branchCode;

    return this.reportsService.getSummary({
      level,
      branchCode: effectiveBranch,
      dateFrom,
      dateTo,
    });
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get progress report' })
  @ApiQuery({ name: 'groupBy', enum: ['branch', 'installer', 'status', 'date'] })
  @ApiQuery({ name: 'branchCode', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  getProgress(
    @Query('groupBy') groupBy: 'branch' | 'installer' | 'status' | 'date',
    @Query('branchCode') branchCode?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.reportsService.getProgress({ groupBy, branchCode, dateFrom, dateTo });
  }

  @Get('raw')
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Generate raw data export' })
  @ApiQuery({ name: 'type', enum: ['ecoas', 'completed', 'pending', 'waste'] })
  @ApiQuery({ name: 'branchCode', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  generateExport(
    @Query('type') type: 'ecoas' | 'completed' | 'pending' | 'waste',
    @Query('branchCode') branchCode: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.generateExport(
      type,
      { branchCode, dateFrom, dateTo },
      user.sub,
    );
  }

  @Get('export/:exportId')
  @ApiOperation({ summary: 'Get export status and download URL' })
  getExport(@Param('exportId') exportId: string) {
    return this.reportsService.getExport(exportId);
  }

  @Get('install-confirmation')
  @ApiOperation({
    summary: 'Generate installation confirmation report (PDF)',
    description: 'Generate a PDF installation confirmation certificate for a specific order'
  })
  @ApiQuery({ name: 'orderId', required: true })
  @ApiResponse({
    status: 200,
    description: 'PDF generation info',
    schema: {
      type: 'object',
      properties: {
        exportId: { type: 'string' },
        status: { type: 'string', enum: ['READY', 'PENDING'] },
        downloadUrl: { type: 'string' },
        expiresAt: { type: 'string' },
      },
    },
  })
  generateInstallConfirmation(
    @Query('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.generateInstallConfirmation(orderId, user.sub);
  }

  // ============================================
  // Unreturned Items (미환입 현황)
  // Manual Reference: Slide 19 (2017.10.26 v0.9)
  // ============================================

  @Get('unreturned')
  @ApiOperation({
    summary: 'Get unreturned items list (미환입 현황)',
    description: 'Get list of cancelled orders with pending item returns. Supports filtering by date range, branch, and return status.'
  })
  @ApiQuery({ name: 'branchCode', required: false, description: 'Filter by branch code' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date for cancellation date filter (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date for cancellation date filter (YYYY-MM-DD)' })
  @ApiQuery({ name: 'returnStatus', required: false, enum: ['all', 'returned', 'unreturned'], description: 'Filter by return status' })
  @ApiResponse({
    status: 200,
    description: 'Unreturned items list with summary',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              orderNo: { type: 'string' },
              customerName: { type: 'string' },
              productName: { type: 'string' },
              cancelledAt: { type: 'string' },
              cancelReason: { type: 'string' },
              isReturned: { type: 'boolean' },
              returnedAt: { type: 'string' },
              branchName: { type: 'string' },
            },
          },
        },
        totalCount: { type: 'number' },
        unreturnedCount: { type: 'number' },
        returnedCount: { type: 'number' },
        byBranch: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              branchCode: { type: 'string' },
              branchName: { type: 'string' },
              unreturnedCount: { type: 'number' },
              returnedCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  getUnreturnedItems(
    @Query('branchCode') branchCode?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('returnStatus') returnStatus?: 'all' | 'returned' | 'unreturned',
    @CurrentUser() user?: JwtPayload,
  ) {
    // Restrict to own branch for non-HQ users
    const effectiveBranch = user?.roles.includes(Role.HQ_ADMIN)
      ? branchCode
      : user?.branchCode || branchCode;

    return this.reportsService.getUnreturnedItems({
      branchCode: effectiveBranch,
      dateFrom,
      dateTo,
      returnStatus,
    });
  }

  @Post('unreturned/:orderId/return')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Mark cancelled order item as returned (환입 처리)',
    description: 'Mark a cancelled order item as returned. Only HQ_ADMIN and BRANCH_MANAGER can perform this action.'
  })
  @ApiResponse({
    status: 200,
    description: 'Item marked as returned',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Cancellation record not found' })
  markItemAsReturned(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.markItemAsReturned(orderId, user.sub);
  }
}
