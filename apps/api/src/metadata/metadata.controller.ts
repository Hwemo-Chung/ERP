import { Controller, Get, Query, UseGuards, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Metadata')
@Controller('metadata')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get()
  @ApiOperation({ summary: 'Get all metadata for offline bootstrap' })
  getAll() {
    return this.metadataService.getAll();
  }

  @Get('branches')
  @ApiOperation({ summary: 'Get branches list' })
  @ApiQuery({ name: 'region', required: false })
  getBranches(
    @Query('region') region?: string,
  ) {
    return this.metadataService.getBranches({
      region,
    });
  }

  @Get('installers')
  @ApiOperation({ summary: 'Get installers list' })
  @ApiQuery({ name: 'branchCode', required: false })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  getInstallers(
    @Query('branchCode') branchCode?: string,
    @Query('active') active?: string,
  ) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.metadataService.getInstallers({
      branchCode,
      isActive,
    });
  }

  @Get('waste-types')
  @ApiOperation({ summary: 'Get waste types list' })
  getWasteTypes() {
    return this.metadataService.getWasteTypes();
  }

  @Get('order-statuses')
  @ApiOperation({ summary: 'Get order status metadata' })
  getOrderStatuses() {
    return this.metadataService.getOrderStatuses();
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get roles with permissions' })
  getRoles() {
    return this.metadataService.getRoles();
  }

  @Post('refresh')
  @Roles(Role.HQ_ADMIN)
  @ApiOperation({ summary: 'Force refresh metadata cache (admin only)' })
  refreshCache() {
    return this.metadataService.refreshCache();
  }
}
