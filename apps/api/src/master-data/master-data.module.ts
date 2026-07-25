import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { RatesService } from './rates.service';
import { RatesController } from './rates.controller';
import { ExcelImportService } from './excel-import.service';
import { ExcelImportController } from './excel-import.controller';

@Module({
  controllers: [
    PartnersController,
    CategoriesController,
    ProductsController,
    RatesController,
    ExcelImportController,
  ],
  providers: [PartnersService, CategoriesService, ProductsService, RatesService, ExcelImportService],
  exports: [PartnersService, CategoriesService, ProductsService, RatesService, ExcelImportService],
})
export class MasterDataModule {}
