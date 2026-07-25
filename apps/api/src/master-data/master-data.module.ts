import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  controllers: [PartnersController, CategoriesController, ProductsController],
  providers: [PartnersService, CategoriesService, ProductsService],
  exports: [PartnersService, CategoriesService, ProductsService],
})
export class MasterDataModule {}
