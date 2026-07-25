import { Body, Controller, Get, Param, Patch, Post, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, RenameCategoryDto } from './dto/create-category.dto';

@ApiTags('MasterData')
@Controller('master-data/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(Role.HQ_ADMIN)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create category with auto hierarchical code' })
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get category tree' })
  findTree() {
    return this.service.findTree();
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename category' })
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameCategoryDto) {
    return this.service.rename(id, dto.name);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate category' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }
}
