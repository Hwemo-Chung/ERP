import { Module } from '@nestjs/common';
import { SettlementFeesModule } from '../settlement-fees/settlement-fees.module';
import { TransactionsService } from './transactions.service';
import { TransactionImportService } from './transaction-import.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [SettlementFeesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionImportService],
  exports: [TransactionsService],
})
export class WarehouseModule {}
