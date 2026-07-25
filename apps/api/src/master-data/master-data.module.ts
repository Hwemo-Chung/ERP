import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { RatesService } from './rates.service';
import { RatesController } from './rates.controller';

@Module({
  controllers: [PartnersController, CategoriesController, ProductsController, RatesController],
  providers: [PartnersService, CategoriesService, ProductsService, RatesService],
  exports: [PartnersService, CategoriesService, ProductsService, RatesService],
})
export class MasterDataModule {}
