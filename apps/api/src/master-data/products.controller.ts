import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetProductsDto } from './dto/get-products.dto';

@ApiTags('MasterData')
@Controller('master-data/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(Role.HQ_ADMIN)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create product with auto-numbered code' })
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List products' })
  findAll(@Query() q: GetProductsDto) {
    return this.service.findAll(q);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
}
