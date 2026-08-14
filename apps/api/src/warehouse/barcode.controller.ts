import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BarcodeService } from './barcode.service';

class ScanBarcodeDto {
  @IsString() @MinLength(1) @MaxLength(120) barcode!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse/barcode')
export class BarcodeController {
  constructor(private readonly barcodes: BarcodeService) {}

  @Post('scan')
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF)
  scan(@Body() dto: ScanBarcodeDto, @CurrentUser() user: JwtPayload) {
    return this.barcodes.resolve(dto.barcode, user.sub);
  }
}
