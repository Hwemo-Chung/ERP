import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  controllers: [PartnersController, CategoriesController],
  providers: [PartnersService, CategoriesService],
  exports: [PartnersService, CategoriesService],
})
export class MasterDataModule {}
