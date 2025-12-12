/**
 * Waste Codes Controller
 * Dedicated endpoint for waste appliance codes
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Waste')
@Controller('waste')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WasteController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get('codes')
  @ApiOperation({ 
    summary: 'Get waste appliance codes',
    description: 'Returns a list of allowed waste appliance codes for pickup tracking'
  })
  getCodes() {
    return this.metadataService.getWasteTypes();
  }
}
