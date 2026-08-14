import { Module } from '@nestjs/common';
import { MasterDataModule } from '../master-data/master-data.module';
import { SettlementFeesService } from './settlement-fees.service';
import { SettlementFeesController } from './settlement-fees.controller';
import { StatementExportService } from './statement-export.service';
import { SettlementInvoiceService } from './settlement-invoice.service';

@Module({
  imports: [MasterDataModule],
  controllers: [SettlementFeesController],
  providers: [SettlementFeesService, StatementExportService, SettlementInvoiceService],
  exports: [SettlementFeesService, StatementExportService],
})
export class SettlementFeesModule {}
