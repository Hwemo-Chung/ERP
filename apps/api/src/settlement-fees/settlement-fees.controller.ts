import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
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

@ApiTags('SettlementFees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settlement-fees')
export class SettlementFeesController {
  constructor(
    private readonly service: SettlementFeesService,
    private readonly statementExport: StatementExportService,
  ) {}

  private scopeFor(user: JwtPayload): { partnerId?: string } {
    if (user.roles.includes(Role.PARTNER_COORDINATOR)) {
      if (!user.partnerId) {
        throw new ForbiddenException({ code: 'E4110', message: 'E4110: access denied to other partner data' });
      }
      return { partnerId: user.partnerId };
    }
    return {};
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.statementExport.buildStatementXlsx(q.partnerId, q.yearMonth, this.scopeFor(user));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="statement-${q.partnerId}-${q.yearMonth}.xlsx"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }
}
