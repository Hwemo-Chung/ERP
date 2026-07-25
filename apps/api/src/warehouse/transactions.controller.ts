import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TransactionsService, TransactionScope } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';

@ApiTags('Warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse/transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

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
      return this.service.findAll(q, scope);
    }
    return this.service.findAll(q, {});
  }
}
