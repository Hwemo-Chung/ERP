import { Module } from '@nestjs/common';
import { MasterDataModule } from '../master-data/master-data.module';
import { SettlementFeesService } from './settlement-fees.service';
import { SettlementFeesController } from './settlement-fees.controller';

@Module({
  imports: [MasterDataModule],
  controllers: [SettlementFeesController],
  providers: [SettlementFeesService],
  exports: [SettlementFeesService],
})
export class SettlementFeesModule {}
