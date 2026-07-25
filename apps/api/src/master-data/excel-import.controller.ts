import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExcelImportService } from './excel-import.service';
import { CommitPartnersDto, CommitProductsDto } from './dto/excel-import-commit.dto';
import {
  MAX_XLSX_SIZE_BYTES,
  assertXlsxFile,
  parseImportMapping,
  parseXlsxOrBadRequest,
} from '../common/xlsx-upload.util';

@ApiTags('MasterData')
@Controller('master-data/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(Role.HQ_ADMIN)
export class ExcelImportController {
  constructor(private readonly service: ExcelImportService) {}

  @Post('partners/parse')
  @ApiOperation({ summary: 'Parse an uploaded partner xlsx into valid/invalid rows' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, mapping: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_XLSX_SIZE_BYTES } }))
  async parsePartners(@UploadedFile() file: Express.Multer.File, @Body('mapping') mappingRaw: string) {
    assertXlsxFile(file);
    const mapping = parseImportMapping(mappingRaw);
    return parseXlsxOrBadRequest(() => this.service.parsePartners(file.buffer, mapping));
  }

  @Post('partners/commit')
  @ApiOperation({ summary: 'Commit previously parsed valid partner rows' })
  async commitPartners(@Body() dto: CommitPartnersDto) {
    return this.service.commitPartners(dto.rows, dto.defaultStorageContract);
  }

  @Post('products/parse')
  @ApiOperation({ summary: 'Parse an uploaded product xlsx into valid/invalid rows' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, mapping: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_XLSX_SIZE_BYTES } }))
  async parseProducts(@UploadedFile() file: Express.Multer.File, @Body('mapping') mappingRaw: string) {
    assertXlsxFile(file);
    const mapping = parseImportMapping(mappingRaw);
    return parseXlsxOrBadRequest(() => this.service.parseProducts(file.buffer, mapping));
  }

  @Post('products/commit')
  @ApiOperation({ summary: 'Commit previously parsed valid product rows' })
  async commitProducts(@Body() dto: CommitProductsDto) {
    return this.service.commitProducts(dto.rows, dto.defaultPartnerId);
  }
}
