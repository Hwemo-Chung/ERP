import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SettlementFeesService } from './settlement-fees.service';
import { StatementExportService } from './statement-export.service';
import { YearMonthDto } from './dto/year-month.dto';
import { GetStatementDto } from './dto/get-statement.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { SettlementInvoiceService } from './settlement-invoice.service';

@ApiTags('SettlementFees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settlement-fees')
export class SettlementFeesController {
  constructor(
    private readonly service: SettlementFeesService,
    private readonly statementExport: StatementExportService,
    private readonly invoices: SettlementInvoiceService,
  ) {}

  private scopeFor(user: JwtPayload): { partnerId?: string } {
    if (user.roles.includes(Role.PARTNER_COORDINATOR)) {
      if (!user.partnerId) {
        throw new ForbiddenException({
          code: 'E4110',
          message: 'E4110: access denied to other partner data',
        });
      }
      return { partnerId: user.partnerId };
    }
    return {};
  }

  @Get('invoice')
  @Roles(Role.HQ_ADMIN, Role.PARTNER_COORDINATOR)
  invoice(@Query() q: GetStatementDto, @CurrentUser() user: JwtPayload) {
    return this.invoices.find(q.partnerId, q.yearMonth, this.scopeFor(user).partnerId);
  }

  @Post('invoice/:id/status')
  @Roles(Role.HQ_ADMIN)
  invoiceStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invoices.changeStatus(id, dto.status, user.sub, dto.cancelReason);
  }

  @Get('invoice/:id/pdf')
  @Roles(Role.HQ_ADMIN, Role.PARTNER_COORDINATOR)
  async invoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const buffer = await this.invoices.pdf(id, this.scopeFor(user).partnerId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="settlement-invoice-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('preview')
  @Roles(Role.HQ_ADMIN)
  preview(@Body() dto: YearMonthDto) {
    return this.service.previewMonth(dto.yearMonth);
  }

  @Post('close')
  @Roles(Role.HQ_ADMIN)
  close(@Body() dto: YearMonthDto, @CurrentUser() user: JwtPayload) {
    return this.service.closeMonth(dto.yearMonth, user.sub);
  }

  @Get('breakdown/:transactionId')
  @Roles(Role.HQ_ADMIN, Role.PARTNER_COORDINATOR)
  breakdown(@Param('transactionId') transactionId: string, @CurrentUser() user: JwtPayload) {
    return this.service.getBreakdown(transactionId, this.scopeFor(user));
  }

  @Get('statement')
  @Roles(Role.HQ_ADMIN, Role.PARTNER_COORDINATOR)
  statement(@Query() q: GetStatementDto, @CurrentUser() user: JwtPayload) {
    return this.service.getStatement(q.partnerId, q.yearMonth, this.scopeFor(user));
  }

  @Get('statement/download')
  @Roles(Role.HQ_ADMIN, Role.PARTNER_COORDINATOR)
  async downloadStatement(
    @Query() q: GetStatementDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.statementExport.buildStatementXlsx(
      q.partnerId,
      q.yearMonth,
      this.scopeFor(user),
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="statement-${q.partnerId}-${q.yearMonth}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
