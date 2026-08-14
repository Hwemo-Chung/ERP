import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TransactionsService, TransactionScope } from './transactions.service';
import { TransactionImportService } from './transaction-import.service';
import { StatementExportService } from '../settlement-fees/statement-export.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { CommitTransactionsDto } from './dto/import-transactions-commit.dto';
import { ShipmentListQueryDto } from './dto/shipment-list-query.dto';
import {
  MAX_XLSX_SIZE_BYTES,
  assertXlsxFile,
  parseImportMapping,
  parseXlsxOrBadRequest,
} from '../common/xlsx-upload.util';

@ApiTags('Warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse/transactions')
export class TransactionsController {
  constructor(
    private readonly service: TransactionsService,
    private readonly importService: TransactionImportService,
    private readonly statementExport: StatementExportService,
  ) {}

  @Post()
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF)
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF, Role.PARTNER_COORDINATOR)
  findAll(@Query() q: GetTransactionsDto, @CurrentUser() user: JwtPayload) {
    if (user.roles.includes(Role.PARTNER_COORDINATOR)) {
      if (!user.partnerId) {
        throw new ForbiddenException('error.insufficient_permissions');
      }
      const scope: TransactionScope = { partnerId: user.partnerId };
      return this.service.findAll(q, scope, user.roles);
    }
    return this.service.findAll(q, {}, user.roles);
  }

  @Get('adjustments/summary')
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF, Role.PARTNER_COORDINATOR)
  adjustmentSummary(@CurrentUser() user: JwtPayload) {
    if (user.roles.includes(Role.PARTNER_COORDINATOR)) {
      if (!user.partnerId) throw new ForbiddenException('error.insufficient_permissions');
      return this.service.adjustmentSummary({ partnerId: user.partnerId });
    }
    return this.service.adjustmentSummary({});
  }

  @Post('import/parse')
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Parse an uploaded warehouse-transaction xlsx into valid/invalid rows' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' }, mapping: { type: 'string' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_XLSX_SIZE_BYTES } }))
  async importParse(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingRaw: string,
  ) {
    assertXlsxFile(file);
    const mapping = parseImportMapping(mappingRaw);
    return parseXlsxOrBadRequest(() => this.importService.parse(file.buffer, mapping));
  }

  @Post('import/commit')
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Commit previously parsed valid transaction rows (source: EXCEL)' })
  async importCommit(@Body() dto: CommitTransactionsDto, @CurrentUser() user: JwtPayload) {
    return this.importService.commit(dto.rows, user.sub);
  }

  @Get('shipment-list/download')
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF, Role.PARTNER_COORDINATOR)
  @ApiOperation({ summary: 'Download the outbound shipment list (xlsx) for a partner/date range' })
  async downloadShipmentList(
    @Query() q: ShipmentListQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    let partnerId = q.partnerId;
    if (user.roles.includes(Role.PARTNER_COORDINATOR)) {
      if (!user.partnerId) {
        throw new ForbiddenException('error.insufficient_permissions');
      }
      partnerId = user.partnerId; // 강제 스코프 우선 — findAll과 동일 정책
    }
    if (!partnerId) {
      throw new BadRequestException({ code: 'E4001', message: 'partnerId is required' });
    }
    const buffer = await this.statementExport.buildShipmentListXlsx(
      partnerId,
      q.dateFrom,
      q.dateTo,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="shipment-list-${partnerId}.xlsx"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }
}
