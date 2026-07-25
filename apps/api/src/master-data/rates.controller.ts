import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RatesService } from './rates.service';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';
import { SetPalletThresholdDto } from './dto/set-pallet-threshold.dto';

@ApiTags('MasterData')
@Controller('master-data')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(Role.HQ_ADMIN)
export class RatesController {
  constructor(private readonly service: RatesService) {}

  @Post('rate-cards')
  @ApiOperation({ summary: 'Create transport rate card' })
  create(@Body() dto: CreateRateCardDto) {
    return this.service.createRateCard(dto);
  }

  @Get('rate-cards')
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF) // method-level override: warehouse staff need the optional vehicle select for transaction entry (read-only; write stays HQ_ADMIN via class-level @Roles above)
  @ApiOperation({ summary: 'List active transport rate cards' })
  findAll() {
    return this.service.listRateCards();
  }

  @Patch('rate-cards/:id')
  @ApiOperation({ summary: 'Update transport rate card' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRateCardDto) {
    return this.service.updateRateCard(id, dto);
  }

  @Patch('rate-cards/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate transport rate card' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivateRateCard(id);
  }

  @Get('settings/pallet-threshold')
  @ApiOperation({ summary: 'Get pallet threshold default (%)' })
  async getPalletThreshold() {
    return { value: await this.service.getPalletThreshold() };
  }

  @Put('settings/pallet-threshold')
  @ApiOperation({ summary: 'Set pallet threshold default (%)' })
  async setPalletThreshold(@Body() dto: SetPalletThresholdDto) {
    await this.service.setPalletThreshold(dto.value);
    return { value: dto.value };
  }
}
