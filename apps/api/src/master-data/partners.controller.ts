import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { GetPartnersDto } from './dto/get-partners.dto';

@ApiTags('MasterData')
@Controller('master-data/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(Role.HQ_ADMIN)
export class PartnersController {
  constructor(private readonly service: PartnersService) {}

  @Post()
  @ApiOperation({ summary: 'Create partner with mandatory storage contract' })
  create(@Body() dto: CreatePartnerDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF) // method-level override: warehouse staff need the partner dropdown for transaction entry (read-only; write stays HQ_ADMIN via class-level @Roles above)
  @ApiOperation({ summary: 'List partners' })
  findAll(@Query() q: GetPartnersDto) {
    return this.service.findAll(q);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update partner' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
}
