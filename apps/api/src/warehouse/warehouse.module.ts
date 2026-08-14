import { Module } from '@nestjs/common';
import { SettlementFeesModule } from '../settlement-fees/settlement-fees.module';
import { TransactionsService } from './transactions.service';
import { TransactionImportService } from './transaction-import.service';
import { TransactionsController } from './transactions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { BarcodeController } from './barcode.controller';
import { BarcodeService } from './barcode.service';

@Module({
  imports: [SettlementFeesModule, NotificationsModule],
  controllers: [TransactionsController, BarcodeController],
  providers: [TransactionsService, TransactionImportService, BarcodeService],
  exports: [TransactionsService],
})
export class WarehouseModule {}
