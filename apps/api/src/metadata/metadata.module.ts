import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { MetadataController } from './metadata.controller';
import { WasteController } from './waste.controller';

@Module({
  controllers: [MetadataController, WasteController],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}
